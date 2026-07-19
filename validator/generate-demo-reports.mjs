#!/usr/bin/env node

import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { validateScene } from "./index.mjs";
import { loadValidSceneBrief } from "./input/index.mjs";
import { normalizeSceneBrief } from "./input/normalize.mjs";
import { writeReportAtomic } from "./report/write-report.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEMO_VARIANTS = Object.freeze([
  Object.freeze({ name: "fail", generatedAt: "2026-07-18T12:00:00.000Z" }),
  Object.freeze({ name: "pass", generatedAt: "2026-07-18T12:01:00.000Z" }),
]);

export async function buildDemoReport(variant) {
  const inputPath = path.join(
    repositoryRoot,
    "demo",
    "fixtures",
    `${variant.name}.scene-brief.json`,
  );
  const candidate = await loadValidSceneBrief(inputPath);
  const scene = await normalizeSceneBrief(candidate);
  return validateScene(scene, {
    clock: () => new Date(variant.generatedAt),
  });
}

export async function generateDemoReports() {
  const outputPaths = [];
  for (const variant of DEMO_VARIANTS) {
    const report = await buildDemoReport(variant);
    const outputPath = path.join(
      repositoryRoot,
      "demo",
      "fixtures",
      `${variant.name}.validation-report.json`,
    );
    outputPaths.push(await writeReportAtomic(report, outputPath));
  }
  return outputPaths;
}

function isDirectExecution() {
  const entryPath = process.argv[1];
  return entryPath && import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectExecution()) {
  const outputPaths = await generateDemoReports();
  for (const outputPath of outputPaths) console.log(`Report: ${outputPath}`);
}
