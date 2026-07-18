import { EPSILON_M } from "./constants.mjs";
import {
  pointStrictlyInsideObb,
  pointToObbDistance,
  rayToObbDistance,
  rayToShellBoundaryDistance,
  segmentObbInteriorIntersection,
} from "./distance.mjs";
import { add, distance, normalize, perpendicularLeft, scale, subtract } from "./vector.mjs";

export const ROUTE_SAMPLE_SPACING_M = 0.05;

function frozenPoint(point) {
  return Object.freeze([point[0], point[1]]);
}

export function resampleRoute(points, maximumSpacingM = ROUTE_SAMPLE_SPACING_M) {
  if (!Number.isFinite(maximumSpacingM) || maximumSpacingM <= 0) {
    throw new RangeError("Route sample spacing must be a positive finite number.");
  }

  const samples = [];
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const segmentLengthM = distance(start, end);
    if (segmentLengthM <= EPSILON_M) {
      throw new RangeError(`Route segment ${segmentIndex} has zero length.`);
    }
    const tangent = normalize(subtract(end, start));
    const intervalCount = Math.ceil(segmentLengthM / maximumSpacingM);
    for (let intervalIndex = 0; intervalIndex <= intervalCount; intervalIndex += 1) {
      if (segmentIndex > 0 && intervalIndex === 0) continue;
      const amount = intervalIndex / intervalCount;
      samples.push(Object.freeze({
        point: frozenPoint(add(start, scale(subtract(end, start), amount))),
        tangent: frozenPoint(tangent),
        segmentIndex,
        amount,
      }));
    }
  }
  return Object.freeze(samples);
}

function nearestRayHit(point, direction, scene, obstacles) {
  let nearest = Object.freeze({
    distanceM: rayToShellBoundaryDistance(point, direction, scene.shell),
    objectId: undefined,
  });
  for (const object of obstacles) {
    const distanceM = rayToObbDistance(point, direction, object);
    if (
      distanceM < nearest.distanceM - EPSILON_M ||
      (Math.abs(distanceM - nearest.distanceM) <= EPSILON_M &&
        object.id.localeCompare(nearest.objectId ?? "\uffff") < 0)
    ) {
      nearest = Object.freeze({ distanceM, objectId: object.id });
    }
  }
  return nearest;
}

function pointInsideShell(point, shell) {
  return (
    point[0] >= shell.minX - EPSILON_M &&
    point[0] <= shell.maxX + EPSILON_M &&
    point[1] >= shell.minZ - EPSILON_M &&
    point[1] <= shell.maxZ + EPSILON_M
  );
}

function radialClearance(point, scene, obstacles) {
  const shellClearanceM = Math.min(
    point[0] - scene.shell.minX,
    scene.shell.maxX - point[0],
    point[1] - scene.shell.minZ,
    scene.shell.maxZ - point[1],
  );
  let minimumClearanceM = Math.max(0, shellClearanceM);
  const conflictingObjectIds = [];
  for (const object of obstacles) {
    const clearanceM = pointToObbDistance(point, object);
    if (clearanceM < minimumClearanceM - EPSILON_M) {
      minimumClearanceM = clearanceM;
      conflictingObjectIds.length = 0;
      conflictingObjectIds.push(object.id);
    } else if (Math.abs(clearanceM - minimumClearanceM) <= EPSILON_M) {
      conflictingObjectIds.push(object.id);
    }
  }
  return Object.freeze({
    clearanceM: minimumClearanceM,
    conflictingObjectIds: Object.freeze(conflictingObjectIds.sort()),
  });
}

export function scanDeclaredRoute(scene) {
  const obstacles = scene.objects.filter((object) => object.obstacle);
  const samples = resampleRoute(scene.route.points);
  const segmentCollisions = [];
  for (let segmentIndex = 0; segmentIndex < scene.route.points.length - 1; segmentIndex += 1) {
    for (const object of obstacles) {
      const point = segmentObbInteriorIntersection(
        scene.route.points[segmentIndex],
        scene.route.points[segmentIndex + 1],
        object,
      );
      if (point) {
        segmentCollisions.push(Object.freeze({
          segmentIndex,
          point: frozenPoint(point),
          objectId: object.id,
        }));
      }
    }
  }
  const crossSections = samples.map((sample) => {
    const leftNormal = perpendicularLeft(sample.tangent);
    const rightNormal = scale(leftNormal, -1);
    const left = nearestRayHit(sample.point, leftNormal, scene, obstacles);
    const right = nearestRayHit(sample.point, rightNormal, scene, obstacles);
    const collidingObjectIds = obstacles
      .filter((object) => pointStrictlyInsideObb(sample.point, object))
      .map((object) => object.id);
    const insideShell = pointInsideShell(sample.point, scene.shell);
    const widthM = insideShell && collidingObjectIds.length === 0
      ? left.distanceM + right.distanceM
      : 0;
    return Object.freeze({
      point: sample.point,
      segmentIndex: sample.segmentIndex,
      widthM,
      from: frozenPoint(add(sample.point, scale(leftNormal, left.distanceM))),
      to: frozenPoint(add(sample.point, scale(rightNormal, right.distanceM))),
      insideShell,
      collidingObjectIds: Object.freeze(collidingObjectIds),
      limitingObjectIds: Object.freeze(
        [...new Set([left.objectId, right.objectId].filter(Boolean))].sort(),
      ),
    });
  });

  let bottleneck = crossSections[0];
  for (const crossSection of crossSections.slice(1)) {
    if (crossSection.widthM < bottleneck.widthM - EPSILON_M) bottleneck = crossSection;
  }
  if (segmentCollisions.length > 0) {
    const firstCollision = segmentCollisions[0];
    const collisionIds = segmentCollisions
      .filter((collision) =>
        collision.segmentIndex === firstCollision.segmentIndex &&
        distance(collision.point, firstCollision.point) <= EPSILON_M)
      .map((collision) => collision.objectId)
      .sort();
    bottleneck = Object.freeze({
      point: firstCollision.point,
      segmentIndex: firstCollision.segmentIndex,
      widthM: 0,
      from: firstCollision.point,
      to: firstCollision.point,
      insideShell: true,
      collidingObjectIds: Object.freeze(collisionIds),
      limitingObjectIds: Object.freeze(collisionIds),
    });
  }

  const vertexClearances = scene.route.points.slice(1, -1).map((point, index) => {
    const radial = radialClearance(point, scene, obstacles);
    return Object.freeze({
      pointIndex: index + 1,
      point: frozenPoint(point),
      clearanceM: radial.clearanceM,
      conflictingObjectIds: radial.conflictingObjectIds,
    });
  });
  const routeConnected = crossSections.every(
    (section) => section.insideShell && section.collidingObjectIds.length === 0,
  ) && segmentCollisions.length === 0;

  return Object.freeze({
    sampleSpacingM: ROUTE_SAMPLE_SPACING_M,
    samples,
    crossSections: Object.freeze(crossSections),
    segmentCollisions: Object.freeze(segmentCollisions),
    bottleneck,
    vertexClearances: Object.freeze(vertexClearances),
    routeConnected,
  });
}
