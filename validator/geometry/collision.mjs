import { EPSILON_M } from "./constants.mjs";
import { obbAxes, obbCorners, projectPointsOntoAxis } from "./obb.mjs";

function intervalPenetration(left, right) {
  return Math.min(left.maximum, right.maximum) - Math.max(left.minimum, right.minimum);
}

export function obbPenetrationDepth(left, right, epsilon = EPSILON_M) {
  const leftCorners = obbCorners(left);
  const rightCorners = obbCorners(right);
  const leftAxes = obbAxes(left);
  const rightAxes = obbAxes(right);
  const axes = [leftAxes.x, leftAxes.z, rightAxes.x, rightAxes.z];
  let minimumDepth = Number.POSITIVE_INFINITY;

  for (const axis of axes) {
    const depth = intervalPenetration(
      projectPointsOntoAxis(leftCorners, axis),
      projectPointsOntoAxis(rightCorners, axis),
    );
    if (depth <= epsilon) return 0;
    minimumDepth = Math.min(minimumDepth, depth);
  }

  return minimumDepth;
}

export function obbsPenetrate(left, right, epsilon = EPSILON_M) {
  return obbPenetrationDepth(left, right, epsilon) > 0;
}

export function verticalPenetrationDepth(left, right, epsilon = EPSILON_M) {
  const depth = Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY);
  return depth > epsilon ? depth : 0;
}

export function verticalIntervalsPenetrate(left, right, epsilon = EPSILON_M) {
  return verticalPenetrationDepth(left, right, epsilon) > 0;
}

export function objectsPenetrate3d(left, right, epsilon = EPSILON_M) {
  return obbsPenetrate(left, right, epsilon) && verticalIntervalsPenetrate(left, right, epsilon);
}

export function pointInsideShell(point, shell, epsilon = EPSILON_M) {
  return (
    point[0] >= shell.minX - epsilon &&
    point[0] <= shell.maxX + epsilon &&
    point[1] >= shell.minZ - epsilon &&
    point[1] <= shell.maxZ + epsilon
  );
}

export function obbInsideShell(box, shell, epsilon = EPSILON_M) {
  return obbCorners(box).every((corner) => pointInsideShell(corner, shell, epsilon));
}
