import assert from "node:assert/strict";
import test from "node:test";
import {
  objectsPenetrate3d,
  obbInsideShell,
  obbPenetrationDepth,
  obbsPenetrate,
  verticalIntervalsPenetrate,
} from "../geometry/collision.mjs";
import {
  circlePenetratesObb,
  closestPointOnObb,
  pointToObbDistance,
  pointToSegmentDistance,
  rayToObbDistance,
  rayToShellBoundaryDistance,
} from "../geometry/distance.mjs";
import { obbAxes, obbCorners, obbPolygon } from "../geometry/obb.mjs";
import { cross, distance, normalize, pointsAlmostEqual, subtract } from "../geometry/vector.mjs";

const shell = { minX: -5, maxX: 5, minZ: -2.5, maxZ: 2.5 };

function box(overrides = {}) {
  return {
    center: [0, 0],
    rotationRad: 0,
    widthM: 2,
    depthM: 2,
    minY: 0,
    maxY: 1,
    ...overrides,
  };
}

function assertPointAlmostEqual(actual, expected, epsilon = 1e-9) {
  assert.equal(pointsAlmostEqual(actual, expected, epsilon), true, `${actual} != ${expected}`);
}

test("vector normalization rejects zero length and preserves unit length", () => {
  assert.throws(() => normalize([0, 0]), /zero-length/);
  assertPointAlmostEqual(normalize([3, 4]), [0.6, 0.8]);
});

test("OBB axes follow positive right-hand rotation around y", () => {
  const axes = obbAxes(box({ rotationRad: Math.PI / 2 }));

  assertPointAlmostEqual(axes.x, [0, -1]);
  assertPointAlmostEqual(axes.z, [1, 0]);
});

test("OBB corners are correct at zero, quarter-turn, and diagonal rotations", () => {
  assert.deepEqual(obbCorners(box()), [[-1, -1], [1, -1], [1, 1], [-1, 1]]);
  const quarterTurn = obbCorners(box({ widthM: 2, depthM: 4, rotationRad: Math.PI / 2 }));
  [[-2, 1], [-2, -1], [2, -1], [2, 1]].forEach((expected, index) =>
    assertPointAlmostEqual(quarterTurn[index], expected),
  );
  const diagonal = obbCorners(box({ rotationRad: Math.PI / 4 }));
  assert.equal(diagonal.every((point) => Math.abs(distance(point, [0, 0]) - Math.SQRT2) < 1e-9), true);
});

test("OBB evidence polygon uses consistent counter-clockwise winding", () => {
  const polygon = obbPolygon(box({ rotationRad: -0.7 }));
  const firstEdge = subtract(polygon[1], polygon[0]);
  const secondEdge = subtract(polygon[2], polygon[1]);

  assert.ok(cross(firstEdge, secondEdge) > 0);
  assert.equal(Object.isFrozen(polygon), true);
  assert.equal(polygon.every((point) => Object.isFrozen(point)), true);
});

test("SAT distinguishes separation, touching, and positive penetration", () => {
  const base = box();
  const separated = box({ center: [2.01, 0] });
  const touching = box({ center: [2, 0] });
  const penetrating = box({ center: [1.99, 0] });

  assert.equal(obbsPenetrate(base, separated), false);
  assert.equal(obbsPenetrate(base, touching), false);
  assert.equal(obbsPenetrate(base, penetrating), true);
  assert.ok(Math.abs(obbPenetrationDepth(base, penetrating) - 0.01) < 1e-9);
});

test("SAT is symmetric for rotated boxes", () => {
  const left = box({ center: [-0.4, 0], rotationRad: Math.PI / 4 });
  const right = box({ center: [0.7, 0.2], rotationRad: -Math.PI / 6 });

  assert.equal(obbsPenetrate(left, right), obbsPenetrate(right, left));
  assert.ok(Math.abs(obbPenetrationDepth(left, right) - obbPenetrationDepth(right, left)) < 1e-9);
});

test("3D collision requires footprint and vertical penetration", () => {
  const lower = box({ minY: 0, maxY: 1 });
  const touchingAbove = box({ minY: 1, maxY: 2 });
  const penetratingAbove = box({ minY: 0.99, maxY: 2 });

  assert.equal(verticalIntervalsPenetrate(lower, touchingAbove), false);
  assert.equal(objectsPenetrate3d(lower, touchingAbove), false);
  assert.equal(objectsPenetrate3d(lower, penetratingAbove), true);
});

test("OBB shell containment handles rotation and corner overflow", () => {
  assert.equal(obbInsideShell(box({ center: [3.5, 0], rotationRad: Math.PI / 4 }), shell), true);
  assert.equal(obbInsideShell(box({ center: [4.5, 2], rotationRad: Math.PI / 4 }), shell), false);
});

test("point-to-segment distance handles projected and zero-length segments", () => {
  assert.equal(pointToSegmentDistance([1, 1], [0, 0], [2, 0]), 1);
  assert.equal(pointToSegmentDistance([3, 4], [0, 0], [0, 0]), 5);
});

test("point-to-OBB distance and closest point handle inside, edge, and outside", () => {
  const target = box({ rotationRad: Math.PI / 4 });
  assert.equal(pointToObbDistance([0, 0], target), 0);
  const outside = [3, 0];
  const closest = closestPointOnObb(outside, target);
  assert.ok(pointToObbDistance(outside, target) > 1);
  assert.ok(distance(outside, closest) > 1);
});

test("circle collision distinguishes clearance, tangency, and penetration", () => {
  const target = box();
  assert.throws(() => circlePenetratesObb([0, 0], 0, target), /positive finite/);
  assert.equal(circlePenetratesObb([2.01, 0], 1, target), false);
  assert.equal(circlePenetratesObb([2, 0], 1, target), false);
  assert.equal(circlePenetratesObb([1.99, 0], 1, target), true);
});

test("ray distances work for OBBs and shell boundaries", () => {
  assert.equal(rayToObbDistance([-2, 0], [4, 0], box()), 1);
  assert.equal(rayToObbDistance([0, 0], [1, 0], box()), 0);
  assert.equal(rayToObbDistance([-2, 3], [1, 0], box()), Number.POSITIVE_INFINITY);
  assert.equal(
    rayToObbDistance([-3, 0], [1, 0], box({ widthM: 2, depthM: 4, rotationRad: Math.PI / 2 })),
    1,
  );
  assert.equal(rayToShellBoundaryDistance([0, 0], [2, 0], shell), 5);
  assert.equal(rayToShellBoundaryDistance([0, 0], [0, -3], shell), 2.5);
  assert.equal(rayToShellBoundaryDistance([6, 0], [1, 0], shell), 0);
});

test("collision and distance are invariant under shared translation", () => {
  const left = box({ center: [0, 0], rotationRad: 0.3 });
  const right = box({ center: [1.5, 0.1], rotationRad: -0.2 });
  const translatedLeft = { ...left, center: [10, -7] };
  const translatedRight = { ...right, center: [11.5, -6.9] };

  assert.equal(obbsPenetrate(left, right), obbsPenetrate(translatedLeft, translatedRight));
  assert.ok(
    Math.abs(pointToObbDistance([4, 3], left) - pointToObbDistance([14, -4], translatedLeft)) < 1e-9,
  );
});

test("collision and distance are invariant under shared rotation", () => {
  const theta = 0.8;
  const rotate = ([x, z]) => [
    Math.cos(theta) * x + Math.sin(theta) * z,
    -Math.sin(theta) * x + Math.cos(theta) * z,
  ];
  const left = box({ center: [-0.4, 0.1], rotationRad: 0.3 });
  const right = box({ center: [1.1, 0.2], rotationRad: -0.2 });
  const query = [3, 2];
  const rotatedLeft = { ...left, center: rotate(left.center), rotationRad: left.rotationRad + theta };
  const rotatedRight = { ...right, center: rotate(right.center), rotationRad: right.rotationRad + theta };

  assert.equal(obbsPenetrate(left, right), obbsPenetrate(rotatedLeft, rotatedRight));
  assert.ok(
    Math.abs(pointToObbDistance(query, left) - pointToObbDistance(rotate(query), rotatedLeft)) < 1e-9,
  );
});
