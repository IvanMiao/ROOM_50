import assert from "node:assert/strict";
import test from "node:test";
import { validateBoundary } from "../checks/boundary.mjs";
import { normalizeSceneBrief } from "../input/normalize.mjs";
import { makeValidSceneBrief } from "./helpers.mjs";

function addObject(candidate, object) {
  candidate.objects.push({
    semanticTag: "test-object",
    semanticGroup: "furniture",
    rotation: 0,
    collision: { obstacle: true, allowOverlapWith: [] },
    ...object,
  });
}

test("boundary passes when all objects are inside and separated", async () => {
  const scene = await normalizeSceneBrief(makeValidSceneBrief());

  const result = validateBoundary(scene);

  assert.equal(result.status, "pass");
  assert.deepEqual(result.measured.outsideObjectIds, []);
  assert.deepEqual(result.measured.intersections, []);
  assert.equal(result.violationGeometry.length, 0);
  assert.deepEqual(result.evidenceGeometry[0].points, [[-5, -2.5], [5, -2.5], [5, 2.5], [-5, 2.5]]);
  assert.equal(Object.isFrozen(result.evidenceGeometry[0].points), true);
  assert.equal(result.evidenceGeometry[0].points.every((point) => Object.isFrozen(point)), true);
});

test("boundary reports a rotated object whose corner leaves the shell", async () => {
  const candidate = makeValidSceneBrief();
  addObject(candidate, {
    id: "outside-chair",
    position: [4.5, 2],
    rotation: Math.PI / 4,
    bbox: { w: 1, d: 1, h: 0.8 },
  });

  const result = validateBoundary(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.deepEqual(result.measured.outsideObjectIds, ["outside-chair"]);
  assert.equal(result.violationGeometry[0].id, "boundary-outside-outside-chair");
  assert.equal(result.violationGeometry[0].points.length, 4);
});

test("boundary reports objects above the clear-height shell", async () => {
  const candidate = makeValidSceneBrief();
  addObject(candidate, {
    id: "high-object",
    position: [0, 2],
    elevationM: 3,
    bbox: { w: 0.5, d: 0.5, h: 0.3 },
  });

  const result = validateBoundary(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.deepEqual(result.measured.outsideObjectIds, ["high-object"]);
});

test("boundary allows vertically touching stacked objects", async () => {
  const candidate = makeValidSceneBrief();
  addObject(candidate, {
    id: "counter-top",
    position: [2, -1],
    elevationM: 0.9,
    bbox: { w: 1.5, d: 0.6, h: 0.1 },
  });

  const result = validateBoundary(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "pass");
  assert.deepEqual(result.measured.intersections, []);
});

test("boundary reports positive vertical penetration", async () => {
  const candidate = makeValidSceneBrief();
  addObject(candidate, {
    id: "counter-top",
    position: [2, -1],
    elevationM: 0.89,
    bbox: { w: 1.5, d: 0.6, h: 0.1 },
  });

  const result = validateBoundary(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.deepEqual(result.measured.intersections, [
    { objectIds: ["counter-top", "main-counter"] },
  ]);
  assert.equal(result.violationGeometry.length, 2);
});

test("boundary honors a one-sided overlap exemption", async () => {
  const candidate = makeValidSceneBrief();
  const lowered = candidate.objects.find((object) => object.id === "lowered-counter");
  const main = candidate.objects.find((object) => object.id === "main-counter");
  lowered.position = [...main.position];
  lowered.collision.allowOverlapWith.push("main-counter");

  const result = validateBoundary(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "pass");
  assert.deepEqual(result.measured.intersections, []);
});

test("boundary result is stable when object order changes", async () => {
  const candidate = makeValidSceneBrief();
  addObject(candidate, {
    id: "collision-object",
    position: [2, -1],
    bbox: { w: 0.4, d: 0.4, h: 0.4 },
  });
  const reversed = structuredClone(candidate);
  reversed.objects.reverse();

  const first = validateBoundary(await normalizeSceneBrief(candidate));
  const second = validateBoundary(await normalizeSceneBrief(reversed));

  assert.deepEqual(first, second);
});
