import { validateBoundary } from "./checks/boundary.mjs";
import { validateCounterHeight } from "./checks/counter-height.mjs";
import { validateKneeClearance } from "./checks/knee-clearance.mjs";
import { validateRouteWidth } from "./checks/route-width.mjs";
import { validateSeatCount } from "./checks/seat-count.mjs";
import { validateTurningZones } from "./checks/turning-zones.mjs";

export const VALIDATOR_VERSION = "0.1.0";
export const REPORT_VERSION = "1.0.0";

const CHECKS = Object.freeze([
  validateBoundary,
  validateRouteWidth,
  validateTurningZones,
  validateCounterHeight,
  validateKneeClearance,
  validateSeatCount,
]);

function generatedAt(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Validation clock returned an invalid date.");
  return date.toISOString();
}

export function validateScene(scene, options = {}) {
  const clock = options.clock ?? (() => new Date());
  const checks = Object.freeze(CHECKS.map((check) => check(scene)));
  const passed = checks.filter((check) => check.status === "pass").length;
  const failedErrors = checks.filter(
    (check) => check.status === "fail" && check.severity === "error",
  ).length;
  const failedWarnings = checks.filter(
    (check) => check.status === "fail" && check.severity === "warning",
  ).length;

  return Object.freeze({
    reportVersion: REPORT_VERSION,
    validatorVersion: VALIDATOR_VERSION,
    generatedAt: generatedAt(clock),
    source: Object.freeze({
      sceneBriefSchemaVersion: scene.source.schemaVersion,
      contractId: scene.source.contractId,
      label: scene.source.label,
    }),
    coordinateSystem: Object.freeze({
      horizontalPlane: scene.coordinateSystem.horizontalPlane,
      verticalAxis: scene.coordinateSystem.verticalAxis,
      origin: scene.coordinateSystem.origin,
      units: scene.coordinateSystem.units,
    }),
    summary: Object.freeze({
      overallStatus: failedErrors > 0 ? "fail" : "pass",
      total: checks.length,
      passed,
      failedErrors,
      failedWarnings,
    }),
    checks,
  });
}
