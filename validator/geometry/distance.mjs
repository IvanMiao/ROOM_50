import { EPSILON_M } from "./constants.mjs";
import { obbAxes, obbLocalToWorld, worldToObbLocal } from "./obb.mjs";
import { add, distance, dot, normalize, scale, subtract } from "./vector.mjs";

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function closestPointOnSegment(point, start, end) {
  const segment = subtract(end, start);
  const lengthSquared = dot(segment, segment);
  if (lengthSquared <= EPSILON_M ** 2) return [start[0], start[1]];
  const amount = clamp(dot(subtract(point, start), segment) / lengthSquared, 0, 1);
  return add(start, scale(segment, amount));
}

export function pointToSegmentDistance(point, start, end) {
  return distance(point, closestPointOnSegment(point, start, end));
}

export function closestPointOnObb(point, box) {
  const local = worldToObbLocal(point, box);
  const closestLocal = [
    clamp(local[0], -box.widthM / 2, box.widthM / 2),
    clamp(local[1], -box.depthM / 2, box.depthM / 2),
  ];
  return obbLocalToWorld(closestLocal, box);
}

export function pointToObbDistance(point, box) {
  return distance(point, closestPointOnObb(point, box));
}

export function pointStrictlyInsideObb(point, box, epsilon = EPSILON_M) {
  const local = worldToObbLocal(point, box);
  return (
    Math.abs(local[0]) < box.widthM / 2 - epsilon &&
    Math.abs(local[1]) < box.depthM / 2 - epsilon
  );
}

export function segmentObbInteriorIntersection(start, end, box, epsilon = EPSILON_M) {
  const localStart = worldToObbLocal(start, box);
  const localEnd = worldToObbLocal(end, box);
  const delta = subtract(localEnd, localStart);
  const halfSizes = [box.widthM / 2 - epsilon, box.depthM / 2 - epsilon];
  if (halfSizes.some((halfSize) => halfSize <= 0)) return undefined;

  let near = 0;
  let far = 1;
  for (let axis = 0; axis < 2; axis += 1) {
    const minimum = -halfSizes[axis];
    const maximum = halfSizes[axis];
    if (Math.abs(delta[axis]) <= epsilon) {
      if (localStart[axis] < minimum || localStart[axis] > maximum) return undefined;
      continue;
    }
    const first = (minimum - localStart[axis]) / delta[axis];
    const second = (maximum - localStart[axis]) / delta[axis];
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return undefined;
  }

  return add(start, scale(subtract(end, start), (near + far) / 2));
}

export function circlePenetratesObb(center, radiusM, box, epsilon = EPSILON_M) {
  if (!Number.isFinite(radiusM) || radiusM <= 0) {
    throw new RangeError("Circle radius must be a positive finite number.");
  }
  return pointToObbDistance(center, box) < radiusM - epsilon;
}

function rayToLocalAabbDistance(origin, direction, halfWidth, halfDepth) {
  let near = Number.NEGATIVE_INFINITY;
  let far = Number.POSITIVE_INFINITY;
  const bounds = [
    [-halfWidth, halfWidth],
    [-halfDepth, halfDepth],
  ];

  for (let axis = 0; axis < 2; axis += 1) {
    if (Math.abs(direction[axis]) <= EPSILON_M) {
      if (origin[axis] < bounds[axis][0] || origin[axis] > bounds[axis][1]) {
        return Number.POSITIVE_INFINITY;
      }
      continue;
    }

    const first = (bounds[axis][0] - origin[axis]) / direction[axis];
    const second = (bounds[axis][1] - origin[axis]) / direction[axis];
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return Number.POSITIVE_INFINITY;
  }

  if (far < 0) return Number.POSITIVE_INFINITY;
  return near <= 0 ? 0 : near;
}

export function rayToObbDistance(origin, direction, box) {
  const unitDirection = normalize(direction);
  const axes = obbAxes(box);
  const localOrigin = worldToObbLocal(origin, box);
  const localDirection = [dot(unitDirection, axes.x), dot(unitDirection, axes.z)];
  return rayToLocalAabbDistance(localOrigin, localDirection, box.widthM / 2, box.depthM / 2);
}

export function rayToShellBoundaryDistance(origin, direction, shell) {
  if (
    origin[0] < shell.minX - EPSILON_M ||
    origin[0] > shell.maxX + EPSILON_M ||
    origin[1] < shell.minZ - EPSILON_M ||
    origin[1] > shell.maxZ + EPSILON_M
  ) {
    return 0;
  }

  const unitDirection = normalize(direction);
  const candidates = [];
  if (unitDirection[0] > EPSILON_M) candidates.push((shell.maxX - origin[0]) / unitDirection[0]);
  if (unitDirection[0] < -EPSILON_M) candidates.push((shell.minX - origin[0]) / unitDirection[0]);
  if (unitDirection[1] > EPSILON_M) candidates.push((shell.maxZ - origin[1]) / unitDirection[1]);
  if (unitDirection[1] < -EPSILON_M) candidates.push((shell.minZ - origin[1]) / unitDirection[1]);
  return Math.min(...candidates.filter((candidate) => candidate >= -EPSILON_M));
}
