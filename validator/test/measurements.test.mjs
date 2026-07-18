import assert from "node:assert/strict";
import test from "node:test";
import { validateCounterHeight } from "../checks/counter-height.mjs";
import { validateKneeClearance } from "../checks/knee-clearance.mjs";
import { validateSeatCount } from "../checks/seat-count.mjs";
import { normalizeSceneBrief } from "../input/normalize.mjs";
import { makeValidSceneBrief } from "./helpers.mjs";

function addObject(candidate, object) {
  candidate.objects.push({
    semanticTag: "test-obstacle",
    semanticGroup: "furniture",
    elevationM: 0,
    rotation: 0,
    collision: { obstacle: true, allowOverlapWith: [] },
    ...object,
  });
}

function setCapacity(candidate, total) {
  candidate.seats = [candidate.seats[0]];
  for (let index = 1; index < total; index += 1) {
    candidate.seats.push({
      id: `chair-${String(index).padStart(2, "0")}`,
      kind: "chair",
      position: [0, 0],
      countsTowardCapacity: true,
      accessible: false,
    });
  }
}

test("counter height passes below and at 0.76 m, then fails above it", async () => {
  for (const [heightM, expectedStatus] of [[0.75, "pass"], [0.76, "pass"], [0.77, "fail"]]) {
    const candidate = makeValidSceneBrief();
    const counter = candidate.objects.find((object) => object.id === "lowered-counter");
    counter.bbox.h = heightM;

    const result = validateCounterHeight(await normalizeSceneBrief(candidate));

    assert.equal(result.status, expectedStatus, `height ${heightM}`);
    assert.equal(result.measured.topHeightM, heightM);
  }
});

test("counter height measures elevation plus bbox height", async () => {
  const candidate = makeValidSceneBrief();
  const counter = candidate.objects.find((object) => object.id === "lowered-counter");
  counter.elevationM = 0.1;
  counter.bbox.h = 0.7;

  const result = validateCounterHeight(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.ok(Math.abs(result.measured.topHeightM - 0.8) < 1e-9);
  assert.equal(result.violationGeometry[0].id, "counter-height-violation-lowered-counter");
});

test("knee clearance passes below, at, and above the height threshold correctly", async () => {
  for (const [heightM, expectedStatus] of [[0.69, "fail"], [0.7, "pass"], [0.71, "pass"]]) {
    const candidate = makeValidSceneBrief();
    candidate.accessibility.accessibleTable.kneeClearanceVolume.bbox.h = heightM;

    const result = validateKneeClearance(await normalizeSceneBrief(candidate));

    assert.equal(result.status, expectedStatus, `height ${heightM}`);
    assert.equal(result.measured.clearHeightM, heightM);
  }
});

test("knee clearance excludes the accessible table object itself", async () => {
  const result = validateKneeClearance(await normalizeSceneBrief(makeValidSceneBrief()));

  assert.equal(result.status, "pass");
  assert.deepEqual(result.measured.conflictingObjectIds, []);
});

test("separately modeled table legs block knee clearance", async () => {
  const candidate = makeValidSceneBrief();
  const volume = candidate.accessibility.accessibleTable.kneeClearanceVolume;
  addObject(candidate, {
    id: "table-leg-east",
    position: [...volume.position],
    bbox: { w: 0.1, d: 0.1, h: 0.6 },
  });

  const result = validateKneeClearance(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.equal(result.measured.volumeCollisionFree, false);
  assert.deepEqual(result.measured.conflictingObjectIds, ["table-leg-east"]);
  assert.equal(result.violationGeometry[0].id, "knee-clearance-obstacle-table-leg-east");
});

test("objects vertically touching or marked non-obstacle do not block knee clearance", async () => {
  const touchingCandidate = makeValidSceneBrief();
  const volume = touchingCandidate.accessibility.accessibleTable.kneeClearanceVolume;
  addObject(touchingCandidate, {
    id: "object-above",
    position: [...volume.position],
    elevationM: 0.7,
    bbox: { w: 0.2, d: 0.2, h: 0.1 },
  });
  const nonObstacleCandidate = makeValidSceneBrief();
  addObject(nonObstacleCandidate, {
    id: "non-obstacle-leg",
    position: [...volume.position],
    bbox: { w: 0.2, d: 0.2, h: 0.6 },
    collision: { obstacle: false, allowOverlapWith: [] },
  });

  assert.equal(
    validateKneeClearance(await normalizeSceneBrief(touchingCandidate)).status,
    "pass",
  );
  assert.equal(
    validateKneeClearance(await normalizeSceneBrief(nonObstacleCandidate)).status,
    "pass",
  );
});

test("seat count uses warning severity at 13, passes 14–18, and warns at 19", async () => {
  for (const [count, expectedStatus] of [[13, "fail"], [14, "pass"], [18, "pass"], [19, "fail"]]) {
    const candidate = makeValidSceneBrief();
    setCapacity(candidate, count);

    const result = validateSeatCount(await normalizeSceneBrief(candidate));

    assert.equal(result.status, expectedStatus, `count ${count}`);
    assert.equal(result.severity, "warning");
    assert.equal(result.measured.count, count);
    assert.equal(result.measured.accessibleSeatCount, 1);
    assert.deepEqual(result.violationGeometry, []);
  }
});

test("seat count ignores markers that do not count toward capacity", async () => {
  const candidate = makeValidSceneBrief();
  setCapacity(candidate, 14);
  candidate.seats.push({
    id: "display-stool",
    kind: "stool",
    position: [0, 0],
    countsTowardCapacity: false,
    accessible: false,
  });

  const result = validateSeatCount(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "pass");
  assert.equal(result.measured.count, 14);
});

test("measurement checks produce deterministic conflict ordering", async () => {
  const candidate = makeValidSceneBrief();
  const volume = candidate.accessibility.accessibleTable.kneeClearanceVolume;
  addObject(candidate, {
    id: "z-leg",
    position: [...volume.position],
    bbox: { w: 0.1, d: 0.1, h: 0.6 },
  });
  addObject(candidate, {
    id: "a-leg",
    position: [...volume.position],
    bbox: { w: 0.1, d: 0.1, h: 0.6 },
  });
  const reversed = structuredClone(candidate);
  reversed.objects.reverse();

  const first = validateKneeClearance(await normalizeSceneBrief(candidate));
  const second = validateKneeClearance(await normalizeSceneBrief(reversed));

  assert.deepEqual(first, second);
  assert.deepEqual(first.measured.conflictingObjectIds, ["a-leg", "z-leg"]);
});
