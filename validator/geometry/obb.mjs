import { add, dot, scale, subtract } from "./vector.mjs";

export function obbAxes(box) {
  const cosine = Math.cos(box.rotationRad);
  const sine = Math.sin(box.rotationRad);
  return Object.freeze({
    x: Object.freeze([cosine, -sine]),
    z: Object.freeze([sine, cosine]),
  });
}

export function obbCorners(box) {
  const axes = obbAxes(box);
  const halfX = scale(axes.x, box.widthM / 2);
  const halfZ = scale(axes.z, box.depthM / 2);

  return Object.freeze([
    Object.freeze(subtract(subtract(box.center, halfX), halfZ)),
    Object.freeze(add(subtract(box.center, halfZ), halfX)),
    Object.freeze(add(add(box.center, halfX), halfZ)),
    Object.freeze(add(subtract(box.center, halfX), halfZ)),
  ]);
}

export function projectPointsOntoAxis(points, axis) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    const projection = dot(point, axis);
    minimum = Math.min(minimum, projection);
    maximum = Math.max(maximum, projection);
  }

  return Object.freeze({ minimum, maximum });
}

export function worldToObbLocal(point, box) {
  const axes = obbAxes(box);
  const offset = subtract(point, box.center);
  return [dot(offset, axes.x), dot(offset, axes.z)];
}

export function obbLocalToWorld(point, box) {
  const axes = obbAxes(box);
  return add(box.center, add(scale(axes.x, point[0]), scale(axes.z, point[1])));
}

export function obbPolygon(box) {
  return obbCorners(box);
}
