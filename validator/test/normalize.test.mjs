import assert from "node:assert/strict";
import test from "node:test";
import { hasOverlapExemption, normalizeSceneBrief } from "../input/normalize.mjs";
import { makeValidSceneBrief } from "./helpers.mjs";

function normalizedSnapshot(scene) {
  return JSON.stringify(scene, (_key, value) => {
    if (value instanceof Map) return [...value.entries()];
    if (value instanceof Set) return [...value].sort();
    if (_key === "entity") return { id: value.id };
    return value;
  });
}

test("normalization derives shell bounds and canonical thresholds", async () => {
  const scene = await normalizeSceneBrief(makeValidSceneBrief());

  assert.deepEqual(scene.shell, {
    lengthM: 10,
    widthM: 5,
    clearHeightM: 3.2,
    grossAreaM2: 50,
    minX: -5,
    maxX: 5,
    minZ: -2.5,
    maxZ: 2.5,
    minY: 0,
    maxY: 3.2,
  });
  assert.deepEqual(scene.thresholds, {
    routeMinimumClearWidthM: 1.2,
    routeMaximumStopDistanceM: 0.6,
    turningZoneDiameterM: 1.5,
    turningZoneRadiusM: 0.75,
    doorMinimumClearWidthM: 0.9,
    counterMaximumHeightM: 0.76,
    kneeMinimumClearHeightM: 0.7,
    seatMinimum: 14,
    seatMaximum: 18,
  });
});

test("normalization defaults elevation to zero and derives vertical intervals", async () => {
  const candidate = makeValidSceneBrief();
  candidate.objects[0].elevationM = 0.2;

  const scene = await normalizeSceneBrief(candidate);
  const elevated = scene.objectById.get("main-counter");
  const floorObject = scene.objectById.get("lowered-counter");

  assert.equal(elevated.minY, 0.2);
  assert.equal(elevated.maxY, 1.1);
  assert.equal(floorObject.elevationM, 0);
  assert.equal(floorObject.minY, 0);
  assert.equal(floorObject.maxY, 0.76);
});

test("normalization resolves route targets to indexed normalized entities", async () => {
  const scene = await normalizeSceneBrief(makeValidSceneBrief());

  assert.equal(scene.route.stops.length, 5);
  assert.equal(scene.route.stops[0].target.entity, scene.doorById.get("entrance-door"));
  assert.equal(scene.route.stops[1].target.entity, scene.objectById.get("lowered-counter"));
  assert.equal(scene.route.stops[3].target.entity, scene.seatById.get("wheelchair-position-01"));
  assert.equal(scene.route.stops[3].point, scene.route.points[3]);
});

test("normalization makes one-sided overlap exemptions symmetric", async () => {
  const candidate = makeValidSceneBrief();
  candidate.objects[0].collision.allowOverlapWith.push("lowered-counter");

  const scene = await normalizeSceneBrief(candidate);

  assert.equal(hasOverlapExemption(scene, "main-counter", "lowered-counter"), true);
  assert.equal(hasOverlapExemption(scene, "lowered-counter", "main-counter"), true);
  assert.equal(hasOverlapExemption(scene, "main-counter", "pickup-counter"), false);
});

test("normalization is deterministic when source arrays are reordered", async () => {
  const original = makeValidSceneBrief();
  const reordered = structuredClone(original);
  reordered.objects.reverse();
  reordered.seats.reverse();
  reordered.accessibility.doors.reverse();

  const first = await normalizeSceneBrief(original);
  const second = await normalizeSceneBrief(reordered);

  assert.equal(normalizedSnapshot(first), normalizedSnapshot(second));
});

test("normalization does not mutate its input", async () => {
  const candidate = makeValidSceneBrief();
  const before = structuredClone(candidate);

  await normalizeSceneBrief(candidate);

  assert.deepEqual(candidate, before);
});

test("normalized object maps and arrays use lexical id order", async () => {
  const candidate = makeValidSceneBrief();
  candidate.objects.reverse();

  const scene = await normalizeSceneBrief(candidate);
  const arrayIds = scene.objects.map((object) => object.id);
  const mapIds = [...scene.objectById.keys()];

  assert.deepEqual(arrayIds, [...arrayIds].sort());
  assert.deepEqual(mapIds, arrayIds);
});
