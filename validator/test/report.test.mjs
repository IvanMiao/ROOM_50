import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { formatTerminalSummary } from "../cli.mjs";
import { summarizeChecks, validateScene } from "../index.mjs";
import { normalizeSceneBrief } from "../input/normalize.mjs";
import { writeReportAtomic } from "../report/write-report.mjs";
import { makePassingSceneBrief } from "./helpers.mjs";

const FIXED_TIME = "2026-07-18T12:00:00.000Z";
const CHECK_ORDER = [
  "boundary",
  "routeWidth",
  "turningZones",
  "counterHeight",
  "kneeClearance",
  "seatCount",
];

async function reportFor(candidate, time = FIXED_TIME) {
  const scene = await normalizeSceneBrief(candidate);
  return validateScene(scene, { clock: () => new Date(time) });
}

function assertGeometryIsRenderable(geometry) {
  assert.match(geometry.id, /\S/);
  assert.match(geometry.label, /\S/);
  if (geometry.type === "point") {
    assert.equal(geometry.point.length, 2);
  } else if (geometry.type === "segment") {
    assert.equal(geometry.from.length, 2);
    assert.equal(geometry.to.length, 2);
    assert.ok(Math.hypot(
      geometry.from[0] - geometry.to[0],
      geometry.from[1] - geometry.to[1],
    ) > 0);
  } else if (geometry.type === "polyline") {
    assert.ok(geometry.points.length >= 2);
  } else if (geometry.type === "polygon") {
    assert.ok(geometry.points.length >= 3);
  } else if (geometry.type === "circle") {
    assert.ok(geometry.radiusM > 0);
  } else {
    assert.fail(`unsupported geometry type ${geometry.type}`);
  }
  const serialized = JSON.stringify(geometry);
  assert.doesNotMatch(serialized, /null/);
}

test("full pass report has stable top-level fields, order, counts, and JSON shape", async () => {
  const report = await reportFor(makePassingSceneBrief());
  const reparsed = JSON.parse(JSON.stringify(report));

  assert.equal(report.reportVersion, "1.0.0");
  assert.equal(report.validatorVersion, "0.1.0");
  assert.equal(report.generatedAt, FIXED_TIME);
  assert.deepEqual(report.source, {
    sceneBriefSchemaVersion: "1.0.0",
    contractId: "room50-accessible-cafe-v1",
    label: "Validator test café",
  });
  assert.deepEqual(report.coordinateSystem, {
    horizontalPlane: "xz",
    verticalAxis: "y-up",
    origin: "shell-centre-at-finished-floor",
    units: "metres",
  });
  assert.deepEqual(report.summary, {
    overallStatus: "pass",
    total: 6,
    passed: 6,
    failedErrors: 0,
    failedWarnings: 0,
  });
  assert.deepEqual(report.checks.map((check) => check.checkId), CHECK_ORDER);
  assert.ok(report.checks.every((check) => check.violationGeometry.length === 0));
  assert.deepEqual(reparsed, report);
});

test("fixed-clock reports are byte-for-byte deterministic", async () => {
  const first = await reportFor(makePassingSceneBrief());
  const second = await reportFor(makePassingSceneBrief());
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("all pass and collision-fail geometry is renderable under the report contract", async () => {
  const passing = await reportFor(makePassingSceneBrief());
  const failingCandidate = makePassingSceneBrief();
  failingCandidate.objects.push({
    id: "route-blocker",
    semanticTag: "route-blocker",
    semanticGroup: "furniture",
    position: [0.75, 0],
    rotation: 0,
    bbox: { w: 0.1, d: 0.2, h: 0.7 },
    collision: { obstacle: true, allowOverlapWith: [] },
  });
  const failing = await reportFor(failingCandidate);

  for (const report of [passing, failing]) {
    for (const check of report.checks) {
      for (const geometry of [...check.evidenceGeometry, ...check.violationGeometry]) {
        assertGeometryIsRenderable(geometry);
      }
    }
  }
});

test("warning-only, one-error, and multiple-error summaries follow severity", async () => {
  const warningOnly = await reportFor(makePassingSceneBrief(1));
  const oneErrorCandidate = makePassingSceneBrief();
  oneErrorCandidate.objects.find((object) => object.id === "lowered-counter").bbox.h = 0.77;
  const oneError = await reportFor(oneErrorCandidate);
  const multipleErrorCandidate = structuredClone(oneErrorCandidate);
  multipleErrorCandidate.objects.find((object) => object.id === "main-counter").position = [5, 0];
  const multipleErrors = await reportFor(multipleErrorCandidate);

  assert.deepEqual(warningOnly.summary, {
    overallStatus: "pass", total: 6, passed: 5, failedErrors: 0, failedWarnings: 1,
  });
  assert.deepEqual(oneError.summary, {
    overallStatus: "fail", total: 6, passed: 5, failedErrors: 1, failedWarnings: 0,
  });
  assert.deepEqual(multipleErrors.summary, {
    overallStatus: "fail", total: 6, passed: 4, failedErrors: 2, failedWarnings: 0,
  });
});

test("a failed check without severity is counted as an error", () => {
  const checks = [
    { checkId: "pass", status: "pass", severity: "error" },
    { checkId: "implicit-error", status: "fail" },
    { checkId: "warning", status: "fail", severity: "warning" },
  ];

  assert.deepEqual(summarizeChecks(checks), {
    overallStatus: "fail",
    total: 3,
    passed: 1,
    failedErrors: 1,
    failedWarnings: 1,
  });
});

test("terminal formatting agrees with report and never stringifies objects implicitly", async () => {
  const report = await reportFor(makePassingSceneBrief(1));
  const plain = formatTerminalSummary(report, false);
  const colored = formatTerminalSummary(report, true);

  assert.match(plain, /^PASS: 5\/6 checks passed; 0 failed errors; 1 failed warning\./);
  assert.match(plain, /WARN seatCount:/);
  assert.doesNotMatch(plain, /\[object Object\]/);
  assert.doesNotMatch(plain, /\u001b\[/);
  assert.match(colored, /\u001b\[/);
});

test("atomic writer emits parseable JSON and preserves unrelated files", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "room50-report-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, "validation-report.json");
  const unrelatedPath = path.join(directory, "notes.txt");
  await writeFile(unrelatedPath, "keep me", "utf8");
  const report = await reportFor(makePassingSceneBrief());

  const writtenPath = await writeReportAtomic(report, outputPath);

  assert.equal(writtenPath, outputPath);
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), report);
  assert.equal(await readFile(unrelatedPath, "utf8"), "keep me");
  assert.deepEqual((await readdir(directory)).sort(), ["notes.txt", "validation-report.json"]);
});
