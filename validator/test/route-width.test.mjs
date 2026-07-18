import assert from "node:assert/strict";
import test from "node:test";
import { validateRouteWidth } from "../checks/route-width.mjs";
import { resampleRoute, ROUTE_SAMPLE_SPACING_M } from "../geometry/route-scan.mjs";
import { obbAxes } from "../geometry/obb.mjs";
import { add, scale } from "../geometry/vector.mjs";
import { normalizeSceneBrief } from "../input/normalize.mjs";
import { makeValidSceneBrief } from "./helpers.mjs";

function corridorBrief(widthM, rotation = 0) {
  const candidate = makeValidSceneBrief();
  const axes = obbAxes({ rotationRad: rotation });
  const routeOffsets = [-3, -1.5, 0, 1.5, 3];
  candidate.accessibility.route.centerline = routeOffsets.map((offset) => scale(axes.x, offset));
  candidate.accessibility.doors[0].position = [...candidate.accessibility.route.centerline[0]];
  candidate.accessibility.doors[0].rotation = rotation;
  candidate.accessibility.doors[1].position = [...candidate.accessibility.route.centerline[4]];
  candidate.accessibility.doors[1].rotation = rotation;
  candidate.seats[0].position = [...candidate.accessibility.route.centerline[3]];

  for (const object of candidate.objects) object.collision.obstacle = false;
  const lowered = candidate.objects.find((object) => object.id === "lowered-counter");
  const pickup = candidate.objects.find((object) => object.id === "pickup-counter");
  lowered.position = add(candidate.accessibility.route.centerline[1], scale(axes.z, 0.5));
  lowered.rotation = rotation;
  lowered.bbox = { w: 0.4, d: 0.2, h: 0.76 };
  pickup.position = add(candidate.accessibility.route.centerline[2], scale(axes.z, 0.5));
  pickup.rotation = rotation;
  pickup.bbox = { w: 0.4, d: 0.2, h: 0.9 };

  const wallDepthM = 0.2;
  for (const [id, side] of [["corridor-left", 1], ["corridor-right", -1]]) {
    candidate.objects.push({
      id,
      semanticTag: "route-test-wall",
      semanticGroup: "architecture",
      position: scale(axes.z, side * (widthM / 2 + wallDepthM / 2)),
      rotation,
      bbox: { w: 7, d: wallDepthM, h: 2 },
      collision: { obstacle: true, allowOverlapWith: [] },
    });
  }
  return candidate;
}

async function validateCorridor(widthM, rotation = 0) {
  return validateRouteWidth(await normalizeSceneBrief(corridorBrief(widthM, rotation)));
}

function b3DemoBrief(centerZ) {
  const candidate = corridorBrief(5);
  candidate.objects = candidate.objects.filter((object) => !object.id.startsWith("corridor-"));
  for (const point of candidate.accessibility.route.centerline) point[1] -= 1.9;
  for (const door of candidate.accessibility.doors) door.position[1] -= 1.9;
  candidate.seats[0].position[1] -= 1.9;
  for (const id of ["lowered-counter", "pickup-counter"]) {
    candidate.objects.find((object) => object.id === id).position[1] -= 1.9;
  }
  candidate.objects.push({
    id: "table-b3",
    semanticTag: "table",
    semanticGroup: "furniture",
    position: [0, centerZ],
    rotation: 0,
    bbox: { w: 7, d: 0.2, h: 0.74 },
    collision: { obstacle: true, allowOverlapWith: [] },
  });
  return candidate;
}

test("route resampling includes endpoints and never exceeds 0.05 m spacing", () => {
  const samples = resampleRoute([[0, 0], [0.11, 0]]);
  assert.deepEqual(samples[0].point, [0, 0]);
  assert.deepEqual(samples.at(-1).point, [0.11, 0]);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(samples[index].point[0] - samples[index - 1].point[0] <= ROUTE_SAMPLE_SPACING_M);
  }
});

test("axis-aligned corridor measures 1.05, 1.19, 1.20, and 1.21 m boundaries", async () => {
  for (const [widthM, status] of [[1.05, "fail"], [1.19, "fail"], [1.2, "pass"], [1.21, "pass"]]) {
    const result = await validateCorridor(widthM);
    assert.equal(result.status, status, `${widthM} m corridor`);
    assert.ok(Math.abs(result.measured.minimumClearWidthM - widthM) < 1e-9);
    assert.deepEqual(
      result.measured.conflictingObjectIds,
      status === "fail" ? ["corridor-left", "corridor-right"] : [],
    );
  }
});

test("rotated corridor preserves its measured width", async () => {
  for (const widthM of [1.05, 1.2]) {
    const result = await validateCorridor(widthM, Math.PI / 6);
    assert.equal(result.status, widthM < 1.2 ? "fail" : "pass");
    assert.ok(Math.abs(result.measured.minimumClearWidthM - widthM) < 1e-9);
  }
});

test("moving table-b3 by 0.15 m changes the demo from 1.05 m fail to 1.20 m pass", async () => {
  const before = validateRouteWidth(await normalizeSceneBrief(b3DemoBrief(-1.35)));
  const after = validateRouteWidth(await normalizeSceneBrief(b3DemoBrief(-1.2)));

  assert.equal(before.status, "fail");
  assert.ok(Math.abs(before.measured.minimumClearWidthM - 1.05) < 1e-9);
  assert.deepEqual(before.measured.conflictingObjectIds, ["table-b3"]);
  assert.equal(after.status, "pass");
  assert.ok(Math.abs(after.measured.minimumClearWidthM - 1.2) < 1e-9);
  assert.deepEqual(after.measured.conflictingObjectIds, []);
  assert.deepEqual(after.violationGeometry, []);
});

test("a centerline intersecting an obstacle fails with zero connected width", async () => {
  const candidate = corridorBrief(1.5);
  candidate.objects.push({
    id: "table-b3",
    semanticTag: "table",
    semanticGroup: "furniture",
    position: [0.75, 0],
    rotation: Math.PI / 4,
    bbox: { w: 0.3, d: 0.3, h: 0.74 },
    collision: { obstacle: true, allowOverlapWith: [] },
  });

  const result = validateRouteWidth(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.equal(result.measured.routeConnected, false);
  assert.equal(result.measured.minimumClearWidthM, 0);
  assert.ok(result.measured.conflictingObjectIds.includes("table-b3"));
  assert.equal(
    result.violationGeometry.find((geometry) => geometry.id === "route-bottleneck").type,
    "point",
  );
});

test("exact segment collision catches a thin obstacle between scan samples", async () => {
  const candidate = corridorBrief(1.5);
  candidate.objects.push({
    id: "thin-obstacle",
    semanticTag: "thin-obstacle",
    semanticGroup: "furniture",
    position: [-2.975, 0],
    rotation: 0,
    bbox: { w: 0.01, d: 0.2, h: 0.74 },
    collision: { obstacle: true, allowOverlapWith: [] },
  });

  const result = validateRouteWidth(await normalizeSceneBrief(candidate));

  assert.equal(result.measured.routeConnected, false);
  assert.equal(result.measured.minimumClearWidthM, 0);
  assert.ok(result.measured.conflictingObjectIds.includes("thin-obstacle"));
});

test("a centerline that exits and re-enters the shell is disconnected", async () => {
  const candidate = corridorBrief(1.5);
  candidate.accessibility.route.centerline[2] = [5.2, 0];

  const result = validateRouteWidth(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.equal(result.measured.routeConnected, false);
  assert.equal(result.measured.minimumClearWidthM, 0);
});

test("a sharp corner fails radial clearance even when adjoining segments are clear", async () => {
  const candidate = corridorBrief(1.5);
  candidate.accessibility.route.centerline[2] = [0, 0.55];
  const leftWall = candidate.objects.find((object) => object.id === "corridor-left");
  leftWall.position = [0, 0.85];

  const result = validateRouteWidth(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.ok(result.measured.minimumCornerClearanceM < 0.6);
  assert.ok(result.violationGeometry.some((geometry) => geometry.type === "circle"));
});

test("a remote pick-up fails independently of route connectivity and width", async () => {
  const candidate = corridorBrief(1.5);
  const pickup = candidate.objects.find((object) => object.id === "pickup-counter");
  pickup.position = [0, 1.5];

  const result = validateRouteWidth(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.equal(result.measured.routeConnected, true);
  assert.equal(result.measured.allStopsConnected, false);
  assert.ok(result.measured.minimumClearWidthM >= 1.2);
  assert.deepEqual(result.measured.conflictingObjectIds, []);
  assert.equal(result.violationGeometry.some((geometry) => geometry.id === "route-bottleneck"), false);
  assert.ok(result.violationGeometry.some((geometry) => geometry.id === "route-stop-violation-pick-up"));
});

test("route-width output is deterministic when irrelevant object order changes", async () => {
  const candidate = corridorBrief(1.05);
  const reordered = structuredClone(candidate);
  reordered.objects.reverse();

  const first = validateRouteWidth(await normalizeSceneBrief(candidate));
  const second = validateRouteWidth(await normalizeSceneBrief(reordered));

  assert.deepEqual(first, second);
});
