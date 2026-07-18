import { EPSILON_M } from "../geometry/constants.mjs";
import { circlePenetratesObb } from "../geometry/distance.mjs";
import { obbPolygon } from "../geometry/obb.mjs";

function circleInsideShell(center, radiusM, shell) {
  return (
    center[0] - radiusM >= shell.minX - EPSILON_M &&
    center[0] + radiusM <= shell.maxX + EPSILON_M &&
    center[1] - radiusM >= shell.minZ - EPSILON_M &&
    center[1] + radiusM <= shell.maxZ + EPSILON_M
  );
}

function circleGeometry(zone, id, label) {
  return Object.freeze({
    id,
    type: "circle",
    center: Object.freeze([zone.center[0], zone.center[1]]),
    radiusM: zone.radiusM,
    label,
  });
}

export function validateTurningZones(scene) {
  const obstacleObjects = scene.objects.filter((object) => object.obstacle);
  const zones = scene.turningZones.map((zone) => {
    const insideShell = circleInsideShell(zone.center, zone.radiusM, scene.shell);
    const conflictingObjectIds = obstacleObjects
      .filter((object) => circlePenetratesObb(zone.center, zone.radiusM, object))
      .map((object) => object.id);
    return Object.freeze({
      id: zone.id,
      at: zone.at,
      diameterM: zone.diameterM,
      insideShell,
      clear: insideShell && conflictingObjectIds.length === 0,
      conflictingObjectIds: Object.freeze(conflictingObjectIds),
    });
  });
  const clearCount = zones.filter((zone) => zone.clear).length;
  const failedZones = zones.filter((zone) => !zone.clear);
  const failed = failedZones.length > 0;
  const message = failed
    ? `${clearCount} of ${zones.length} required turning zones are collision-free inside the shell.`
    : `All ${zones.length} required turning zones have ${scene.thresholds.turningZoneDiameterM} m collision-free diameter.`;
  const evidenceGeometry = scene.turningZones.map((zone) =>
    circleGeometry(zone, `turning-zone-${zone.id}`, `${zone.at} turning zone`),
  );
  const violationGeometry = failedZones.flatMap((zoneResult) => {
    const zone = scene.turningZones.find((candidate) => candidate.id === zoneResult.id);
    const circle = circleGeometry(
      zone,
      `turning-zone-violation-${zone.id}`,
      `${zone.at} turning zone is not clear`,
    );
    const obstaclePolygons = zoneResult.conflictingObjectIds.map((objectId) => {
      const object = scene.objectById.get(objectId);
      return Object.freeze({
        id: `turning-zone-obstacle-${zone.id}-${objectId}`,
        type: "polygon",
        points: obbPolygon(object),
        objectIds: Object.freeze([objectId]),
        label: `Obstacle “${objectId}” conflicts with ${zone.at} turning zone`,
      });
    });
    return [circle, ...obstaclePolygons];
  });

  return Object.freeze({
    checkId: "turningZones",
    status: failed ? "fail" : "pass",
    severity: "error",
    message,
    measured: Object.freeze({
      clearCount,
      requiredCount: zones.length,
      zones: Object.freeze(zones),
    }),
    required: Object.freeze({
      diameterM: scene.thresholds.turningZoneDiameterM,
      locations: Object.freeze(["entrance", "service-counter", "accessible-wc"]),
    }),
    evidenceGeometry: Object.freeze(evidenceGeometry),
    violationGeometry: Object.freeze(violationGeometry),
  });
}
