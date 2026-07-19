import { EPSILON_M } from "../geometry/constants.mjs";
import { obbPolygon } from "../geometry/obb.mjs";

export function validateCounterHeight(scene) {
  const loweredCounter = scene.accessibility.serviceCounter.loweredSegment;
  const topHeightM = loweredCounter.maxY;
  const maximumTopHeightM = scene.thresholds.counterMaximumHeightM;
  const passed = topHeightM <= maximumTopHeightM + EPSILON_M;
  const evidencePolygon = Object.freeze({
    id: `counter-height-evidence-${loweredCounter.id}`,
    type: "polygon",
    points: obbPolygon(loweredCounter),
    objectIds: Object.freeze([loweredCounter.id]),
    label: `Lowered counter top at ${topHeightM} m`,
  });

  return Object.freeze({
    checkId: "counterHeight",
    status: passed ? "pass" : "fail",
    severity: "error",
    message: passed
      ? `The lowered counter top is ${topHeightM} m above finished floor.`
      : `The lowered counter top is ${topHeightM} m above finished floor; maximum is ${maximumTopHeightM} m.`,
    measured: Object.freeze({
      objectId: loweredCounter.id,
      topHeightM,
    }),
    required: Object.freeze({
      maximumTopHeightM,
    }),
    evidenceGeometry: Object.freeze([evidencePolygon]),
    violationGeometry: Object.freeze(
      passed
        ? []
        : [
            Object.freeze({
              ...evidencePolygon,
              id: `counter-height-violation-${loweredCounter.id}`,
              label: `Lowered counter exceeds ${maximumTopHeightM} m`,
            }),
          ],
    ),
  });
}
