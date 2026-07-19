import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const contractPath = fileURLToPath(new URL("../../agent/scene-contract.json", import.meta.url));
let contractPromise;

function loadContract() {
  contractPromise ??= readFile(contractPath, "utf8").then(JSON.parse);
  return contractPromise;
}

function compareIds(left, right) {
  return left.id.localeCompare(right.id);
}

function clonePoint(point) {
  return Object.freeze([point[0], point[1]]);
}

function normalizeObject(object) {
  const elevationM = object.elevationM ?? 0;
  return Object.freeze({
    id: object.id,
    semanticTag: object.semanticTag,
    semanticGroup: object.semanticGroup,
    center: clonePoint(object.position),
    rotationRad: object.rotation,
    widthM: object.bbox.w,
    depthM: object.bbox.d,
    heightM: object.bbox.h,
    elevationM,
    minY: elevationM,
    maxY: elevationM + object.bbox.h,
    obstacle: object.collision.obstacle,
    allowOverlapWith: Object.freeze([...object.collision.allowOverlapWith].sort()),
  });
}

function normalizeSeat(seat) {
  return Object.freeze({
    id: seat.id,
    kind: seat.kind,
    point: clonePoint(seat.position),
    objectId: seat.objectId,
    countsTowardCapacity: seat.countsTowardCapacity,
    accessible: seat.accessible,
  });
}

function normalizeDoor(door) {
  return Object.freeze({
    id: door.id,
    at: door.at,
    center: clonePoint(door.position),
    rotationRad: door.rotation,
    clearWidthM: door.clearWidthM,
    stepFree: door.stepFree,
    objectId: door.objectId,
  });
}

function normalizeTurningZone(zone) {
  return Object.freeze({
    id: zone.id,
    at: zone.at,
    center: clonePoint(zone.center),
    diameterM: zone.diameterM,
    radiusM: zone.diameterM / 2,
  });
}

function sortedMap(values) {
  return new Map([...values].sort(compareIds).map((value) => [value.id, value]));
}

function overlapPairKey(leftId, rightId) {
  return [leftId, rightId].sort().join("\u0000");
}

function buildOverlapExemptions(objects) {
  const pairs = new Set();
  for (const object of objects) {
    for (const targetId of object.allowOverlapWith) {
      pairs.add(overlapPairKey(object.id, targetId));
    }
  }
  return new Set([...pairs].sort());
}

function normalizeClearanceVolume(volume) {
  return Object.freeze({
    center: clonePoint(volume.position),
    rotationRad: volume.rotation,
    widthM: volume.bbox.w,
    depthM: volume.bbox.d,
    heightM: volume.bbox.h,
    minY: 0,
    maxY: volume.bbox.h,
  });
}

function resolveRouteTarget(target, indexes) {
  const index = indexes[target.collection];
  return Object.freeze({
    collection: target.collection,
    id: target.id,
    entity: index.get(target.id),
  });
}

export async function normalizeSceneBrief(candidate) {
  const contract = await loadContract();
  const objects = candidate.objects.map(normalizeObject).sort(compareIds);
  const seats = candidate.seats.map(normalizeSeat).sort(compareIds);
  const doors = candidate.accessibility.doors.map(normalizeDoor).sort(compareIds);
  const turningZones = candidate.accessibility.turningZones.map(normalizeTurningZone);
  const objectById = sortedMap(objects);
  const seatById = sortedMap(seats);
  const doorById = sortedMap(doors);
  const indexes = Object.freeze({
    objects: objectById,
    seats: seatById,
    doors: doorById,
  });
  const routePoints = Object.freeze(candidate.accessibility.route.centerline.map(clonePoint));
  const routeStops = Object.freeze(
    candidate.accessibility.route.stops.map((stop) =>
      Object.freeze({
        stage: stop.stage,
        pointIndex: stop.pointIndex,
        point: routePoints[stop.pointIndex],
        target: resolveRouteTarget(stop.target, indexes),
      }),
    ),
  );
  const counterObject = objectById.get(candidate.accessibility.serviceCounter.counterObjectId);
  const loweredCounterObject = objectById.get(
    candidate.accessibility.serviceCounter.loweredSegmentObjectId,
  );
  const accessibleTableObject = objectById.get(candidate.accessibility.accessibleTable.tableObjectId);
  const wheelchairSeat = seatById.get(candidate.accessibility.accessibleTable.wheelchairSeatId);

  return Object.freeze({
    source: Object.freeze({
      schemaVersion: candidate.schemaVersion,
      contractId: candidate.contractId,
      label: candidate.label,
      status: candidate.status,
    }),
    coordinateSystem: Object.freeze({
      horizontalPlane: candidate.coordinateSystem.horizontalPlane,
      verticalAxis: candidate.coordinateSystem.verticalAxis,
      origin: candidate.coordinateSystem.origin,
      rotationUnit: candidate.coordinateSystem.rotationUnit,
      rotationAxis: candidate.coordinateSystem.rotationAxis,
      rotationRule: candidate.coordinateSystem.rotationRule,
      units: candidate.units,
    }),
    shell: Object.freeze({
      lengthM: candidate.shell.lengthM,
      widthM: candidate.shell.widthM,
      clearHeightM: candidate.shell.clearHeightM,
      grossAreaM2: candidate.shell.grossAreaM2,
      minX: -candidate.shell.lengthM / 2,
      maxX: candidate.shell.lengthM / 2,
      minZ: -candidate.shell.widthM / 2,
      maxZ: candidate.shell.widthM / 2,
      minY: 0,
      maxY: candidate.shell.clearHeightM,
    }),
    thresholds: Object.freeze({
      routeMinimumClearWidthM: contract.accessibilityTargets.continuousRoute.minimumClearWidthM,
      routeMaximumStopDistanceM:
        contract.accessibilityTargets.continuousRoute.minimumClearWidthM / 2,
      turningZoneDiameterM: contract.accessibilityTargets.turningZones.diameterM,
      turningZoneRadiusM: contract.accessibilityTargets.turningZones.diameterM / 2,
      doorMinimumClearWidthM: contract.accessibilityTargets.doors.clearWidthTargetM,
      counterMaximumHeightM: contract.accessibilityTargets.serviceCounter.maximumHeightM,
      kneeMinimumClearHeightM:
        contract.accessibilityTargets.accessibleTable.kneeClearHeightTargetM,
      seatMinimum: contract.use.targetSeats.min,
      seatMaximum: contract.use.targetSeats.max,
    }),
    objects: Object.freeze(objects),
    objectById,
    seats: Object.freeze(seats),
    seatById,
    doors: Object.freeze(doors),
    doorById,
    turningZones: Object.freeze(turningZones),
    overlapExemptions: buildOverlapExemptions(objects),
    route: Object.freeze({
      points: routePoints,
      stops: routeStops,
    }),
    accessibility: Object.freeze({
      serviceCounter: Object.freeze({
        counter: counterObject,
        loweredSegment: loweredCounterObject,
      }),
      accessibleTable: Object.freeze({
        table: accessibleTableObject,
        wheelchairSeat,
        kneeClearanceVolume: normalizeClearanceVolume(
          candidate.accessibility.accessibleTable.kneeClearanceVolume,
        ),
      }),
    }),
  });
}

export function hasOverlapExemption(normalizedScene, leftId, rightId) {
  return normalizedScene.overlapExemptions.has(overlapPairKey(leftId, rightId));
}
