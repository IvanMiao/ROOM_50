#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateScene, VALIDATOR_VERSION } from "./index.mjs";
import { formatInputValidationError, InputValidationError } from "./input/errors.mjs";
import { loadValidSceneBrief } from "./input/index.mjs";
import { normalizeSceneBrief } from "./input/normalize.mjs";
import { writeReportAtomic } from "./report/write-report.mjs";

const USAGE = "Usage: node validator/cli.mjs <path/to/scene-brief.json>";
const ANSI = Object.freeze({ reset: "\u001b[0m", green: "\u001b[32m", red: "\u001b[31m", yellow: "\u001b[33m" });

function paint(value, color, enabled) {
  return enabled ? `${ANSI[color]}${value}${ANSI.reset}` : value;
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

export function formatTerminalSummary(report, color = false) {
  const lines = report.checks.map((check) => {
    const label = check.status === "pass" ? "PASS" : check.severity === "warning" ? "WARN" : "FAIL";
    const tone = check.status === "pass" ? "green" : check.severity === "warning" ? "yellow" : "red";
    return `${paint(label, tone, color)} ${check.checkId}: ${check.message}`;
  });
  const summary = report.summary;
  const overallTone = summary.overallStatus === "pass" ? "green" : "red";
  lines.unshift(
    `${paint(summary.overallStatus.toUpperCase(), overallTone, color)}: ${summary.passed}/${summary.total} checks passed; ${summary.failedErrors} failed ${plural(summary.failedErrors, "error")}; ${summary.failedWarnings} failed ${plural(summary.failedWarnings, "warning")}.`,
  );
  return lines.join("\n");
}

export async function runCli(args, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;

  if (args.length !== 1 || args[0] === "--help" || args[0] === "-h") {
    const stream = args.length === 1 ? stdout : stderr;
    stream.write(`${USAGE}\n`);
    return args.length === 1 ? 0 : 2;
  }

  const inputPath = args[0];
  let candidate;
  try {
    candidate = await loadValidSceneBrief(inputPath);
  } catch (error) {
    if (error instanceof InputValidationError) {
      stderr.write(`${formatInputValidationError(error)}\n`);
      return 2;
    }
    throw error;
  }

  const normalizedScene = await normalizeSceneBrief(candidate);
  const report = validateScene(normalizedScene, { clock: io.clock });
  const outputPath = io.outputPath ?? path.resolve(process.cwd(), "validation-report.json");
  let writtenPath;
  try {
    writtenPath = await writeReportAtomic(report, outputPath);
  } catch (error) {
    stderr.write(`Output error [REPORT_WRITE_ERROR] ${outputPath}: ${error.message}\n`);
    return 2;
  }

  const color = io.color ?? Boolean(stdout.isTTY && !process.env.NO_COLOR);
  stdout.write(`ROOM/50 validator v${VALIDATOR_VERSION}\n`);
  stdout.write(`${formatTerminalSummary(report, color)}\n`);
  stdout.write(`Report: ${writtenPath}\n`);
  return report.summary.overallStatus === "pass" ? 0 : 1;
}

function isDirectExecution() {
  const entryPath = process.argv[1];
  return entryPath && import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectExecution()) process.exitCode = await runCli(process.argv.slice(2));
