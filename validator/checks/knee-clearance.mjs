import { objectsPenetrate3d } from "../geometry/collision.mjs";
import { EPSILON_M } from "../geometry/constants.mjs";
import { obbPolygon } from "../geometry/obb.mjs";

export function validateKneeClearance(scene) {
  const accessibleTable = scene.accessibility.accessibleTable;
  const volume = accessibleTable.kneeClearanceVolume;
  const minimumClearHeightM = scene.thresholds.kneeMinimumClearHeightM;
  const heightPassed = volume.heightM + EPSILON_M >= minimumClearHeightM;
  const conflictingObjects = scene.objects.filter(
    (object) =>
      object.id !== accessibleTable.table.id &&
      object.obstacle &&
      objectsPenetrate3d(volume, object),
  );
  const conflictingObjectIds = conflictingObjects.map((object) => object.id);
  const volumeCollisionFree = conflictingObjectIds.length === 0;
  const passed = heightPassed && volumeCollisionFree;
  const evidenceVolume = Object.freeze({
    id: "knee-clearance-evidence-volume",
    type: "polygon",
    points: obbPolygon(volume),
    objectIds: Object.freeze([accessibleTable.table.id]),
    label: `Knee-clearance volume at ${volume.heightM} m clear height`,
  });
  const violationGeometry = [];

  if (!heightPassed) {
    violationGeometry.push(
      Object.freeze({
        ...evidenceVolume,
        id: "knee-clearance-violation-height",
        label: `Knee-clearance height below ${minimumClearHeightM} m`,
      }),
    );
  }
  for (const object of conflictingObjects) {
    violationGeometry.push(
      Object.freeze({
        id: `knee-clearance-obstacle-${object.id}`,
        type: "polygon",
        points: obbPolygon(object),
        objectIds: Object.freeze([object.id]),
        label: `Obstacle “${object.id}” intrudes into knee-clearance volume`,
      }),
    );
  }

  const failures = [];
  if (!heightPassed) failures.push(`height is ${volume.heightM} m; minimum is ${minimumClearHeightM} m`);
  if (!volumeCollisionFree) failures.push(`volume intersects ${conflictingObjectIds.join(", ")}`);

  return Object.freeze({
    checkId: "kneeClearance",
    status: passed ? "pass" : "fail",
    severity: "error",
    message: passed
      ? `The accessible table has ${volume.heightM} m collision-free knee clearance.`
      : `Accessible table knee clearance fails: ${failures.join("; ")}.`,
    measured: Object.freeze({
      tableObjectId: accessibleTable.table.id,
      wheelchairSeatId: accessibleTable.wheelchairSeat.id,
      clearHeightM: volume.heightM,
      volumeCollisionFree,
      conflictingObjectIds: Object.freeze(conflictingObjectIds),
    }),
    required: Object.freeze({
      minimumClearHeightM,
      volumeCollisionFree: true,
    }),
    evidenceGeometry: Object.freeze([evidenceVolume]),
    violationGeometry: Object.freeze(violationGeometry),
  });
}
