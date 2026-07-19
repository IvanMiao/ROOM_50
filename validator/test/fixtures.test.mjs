import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateScene } from "../index.mjs";
import { loadValidSceneBrief } from "../input/index.mjs";
import { normalizeSceneBrief } from "../input/normalize.mjs";

const validatorDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(validatorDirectory, "cli.mjs");
const failPath = path.join(validatorDirectory, "fixtures", "fail.json");
const passPath = path.join(validatorDirectory, "fixtures", "pass.json");
const FIXED_TIME = "2026-07-18T12:00:00.000Z";

async function fixedReport(inputPath) {
  const candidate = await loadValidSceneBrief(inputPath);
  const scene = await normalizeSceneBrief(candidate);
  return validateScene(scene, { clock: () => new Date(FIXED_TIME) });
}

test("fixture briefs differ only by B3 position and removal of chair-14", async () => {
  const failing = JSON.parse(await readFile(failPath, "utf8"));
  const passing = JSON.parse(await readFile(passPath, "utf8"));
  const reconstructedFail = structuredClone(passing);
  reconstructedFail.objects.find((object) => object.id === "table-b3").position = [0, 0.55];
  reconstructedFail.seats.push(
    failing.seats.find((seat) => seat.id === "chair-14"),
  );

  assert.deepEqual(reconstructedFail, failing);
  assert.ok(Math.abs(
    passing.objects.find((object) => object.id === "table-b3").position[1] -
      failing.objects.find((object) => object.id === "table-b3").position[1] -
      0.15,
  ) < 1e-9);
});

test("fail fixture is valid input and isolates a 1.05 m route-width failure", async () => {
  const report = await fixedReport(failPath);
  const route = report.checks.find((check) => check.checkId === "routeWidth");
  const turns = report.checks.find((check) => check.checkId === "turningZones");
  const seats = report.checks.find((check) => check.checkId === "seatCount");

  assert.deepEqual(report.summary, {
    overallStatus: "fail", total: 6, passed: 5, failedErrors: 1, failedWarnings: 0,
  });
  assert.equal(route.status, "fail");
  assert.ok(Math.abs(route.measured.minimumClearWidthM - 1.05) < 1e-9);
  assert.deepEqual(route.measured.conflictingObjectIds, ["fixed-bench-edge", "table-b3"]);
  assert.equal(route.evidenceGeometry.some((geometry) => geometry.type === "polyline"), true);
  assert.equal(turns.evidenceGeometry.filter((geometry) => geometry.type === "circle").length, 3);
  assert.equal(seats.status, "pass");
  assert.equal(seats.measured.count, 15);
});

test("pass fixture is valid input with 1.20 m route width and 14 seats", async () => {
  const report = await fixedReport(passPath);
  const route = report.checks.find((check) => check.checkId === "routeWidth");
  const turns = report.checks.find((check) => check.checkId === "turningZones");
  const seats = report.checks.find((check) => check.checkId === "seatCount");

  assert.deepEqual(report.summary, {
    overallStatus: "pass", total: 6, passed: 6, failedErrors: 0, failedWarnings: 0,
  });
  assert.ok(Math.abs(route.measured.minimumClearWidthM - 1.2) < 1e-9);
  assert.equal(route.evidenceGeometry.some((geometry) => geometry.type === "polyline"), true);
  assert.equal(turns.evidenceGeometry.filter((geometry) => geometry.type === "circle").length, 3);
  assert.equal(seats.measured.count, 14);
});

test("fixture check content is deterministic with a fixed clock", async () => {
  const first = await fixedReport(failPath);
  const second = await fixedReport(failPath);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("real CLI exits 1 for fail and 0 for pass while writing matching reports", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "room50-fixtures-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const failing = spawnSync(process.execPath, [cliPath, failPath], {
    cwd: directory,
    encoding: "utf8",
  });
  const failReport = JSON.parse(await readFile(path.join(directory, "validation-report.json"), "utf8"));
  const passing = spawnSync(process.execPath, [cliPath, passPath], {
    cwd: directory,
    encoding: "utf8",
  });
  const passReport = JSON.parse(await readFile(path.join(directory, "validation-report.json"), "utf8"));

  assert.equal(failing.status, 1);
  assert.equal(failReport.summary.overallStatus, "fail");
  assert.equal(passing.status, 0);
  assert.equal(passReport.summary.overallStatus, "pass");
});
