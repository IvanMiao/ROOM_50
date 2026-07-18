import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { makePassingSceneBrief } from "./helpers.mjs";

const validatorDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(validatorDirectory, "cli.mjs");

function runCli(args = [], options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? path.resolve(validatorDirectory, ".."),
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });
}

async function temporaryCandidate(context, candidate, prefix = "room50-cli-") {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, "scene-brief.json");
  await writeFile(inputPath, JSON.stringify(candidate), "utf8");
  return { directory, inputPath, reportPath: path.join(directory, "validation-report.json") };
}

test("CLI prints usage and exits 2 when the input path is missing", () => {
  const result = runCli();
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Usage: node validator\/cli\.mjs/);
  assert.equal(result.stdout, "");
});

test("CLI reports an unreadable input and exits 2", () => {
  const result = runCli(["validator/fixtures/does-not-exist.json"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Input error \[INPUT_READ_ERROR\]/);
  assert.match(result.stderr, /does-not-exist\.json/);
});

test("CLI reports invalid JSON and writes no report", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "room50-cli-invalid-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, "invalid.json");
  await writeFile(inputPath, "{not-json", "utf8");

  const result = runCli([inputPath], { cwd: directory });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /is not valid JSON/);
  await assert.rejects(access(path.join(directory, "validation-report.json")));
});

test("CLI pass writes a parseable report and exits 0", async (context) => {
  const fixture = await temporaryCandidate(context, makePassingSceneBrief());
  const result = runCli([fixture.inputPath], { cwd: fixture.directory });
  const report = JSON.parse(await readFile(fixture.reportPath, "utf8"));

  assert.equal(result.status, 0);
  assert.match(result.stdout, /PASS: 6\/6 checks passed/);
  assert.equal(result.stderr, "");
  assert.equal(report.summary.overallStatus, "pass");
});

test("CLI warning-only report exits 0", async (context) => {
  const fixture = await temporaryCandidate(context, makePassingSceneBrief(1));
  const result = runCli([fixture.inputPath], { cwd: fixture.directory });
  const report = JSON.parse(await readFile(fixture.reportPath, "utf8"));

  assert.equal(result.status, 0);
  assert.match(result.stdout, /WARN seatCount:/);
  assert.deepEqual(report.summary, {
    overallStatus: "pass", total: 6, passed: 5, failedErrors: 0, failedWarnings: 1,
  });
});

test("CLI geometry failure writes a report and exits 1", async (context) => {
  const candidate = makePassingSceneBrief();
  candidate.objects.find((object) => object.id === "lowered-counter").bbox.h = 0.77;
  const fixture = await temporaryCandidate(context, candidate);
  const result = runCli([fixture.inputPath], { cwd: fixture.directory });
  const report = JSON.parse(await readFile(fixture.reportPath, "utf8"));

  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL: 5\/6 checks passed/);
  assert.match(result.stdout, /FAIL counterHeight:/);
  assert.equal(report.summary.overallStatus, "fail");
});

test("CLI semantic input error exits 2 and writes no report", async (context) => {
  const candidate = makePassingSceneBrief();
  candidate.accessibility.route.stops[1].target = {
    collection: "seats",
    id: "wheelchair-position-01",
  };
  const fixture = await temporaryCandidate(context, candidate);
  const result = runCli([fixture.inputPath], { cwd: fixture.directory });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /\[ROUTE_TARGET_COLLECTION\]/);
  assert.equal(result.stdout, "");
  await assert.rejects(access(fixture.reportPath));
});

test("CLI respects NO_COLOR", async (context) => {
  const fixture = await temporaryCandidate(context, makePassingSceneBrief());
  const result = runCli([fixture.inputPath], { cwd: fixture.directory, env: { NO_COLOR: "1" } });
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /\u001b\[/);
});
