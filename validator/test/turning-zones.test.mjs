import assert from "node:assert/strict";
import test from "node:test";
import { validateTurningZones } from "../checks/turning-zones.mjs";
import { normalizeSceneBrief } from "../input/normalize.mjs";
import { makeValidSceneBrief } from "./helpers.mjs";

function disableExistingObstacles(candidate) {
  candidate.objects.forEach((object) => {
    object.collision.obstacle = false;
  });
}

function addObstacle(candidate, object) {
  candidate.objects.push({
    semanticTag: "turning-test-obstacle",
    semanticGroup: "furniture",
    elevationM: 0,
    rotation: 0,
    collision: { obstacle: true, allowOverlapWith: [] },
    ...object,
  });
}

test("turning zones pass and emit three evidence circles in empty clearance", async () => {
  const candidate = makeValidSceneBrief();
  disableExistingObstacles(candidate);

  const result = validateTurningZones(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "pass");
  assert.equal(result.measured.clearCount, 3);
  assert.equal(result.evidenceGeometry.length, 3);
  assert.equal(result.evidenceGeometry.every((item) => item.type === "circle" && item.radiusM === 0.75), true);
  assert.deepEqual(result.violationGeometry, []);
});

test("turning zone shell clearance passes at 0.76 and 0.75 m but fails at 0.74 m", async () => {
  for (const [distanceM, expectedStatus] of [[0.76, "pass"], [0.75, "pass"], [0.74, "fail"]]) {
    const candidate = makeValidSceneBrief();
    disableExistingObstacles(candidate);
    candidate.accessibility.turningZones[0].center = [-5 + distanceM, 0];

    const result = validateTurningZones(await normalizeSceneBrief(candidate));
    const entrance = result.measured.zones[0];

    assert.equal(entrance.insideShell, expectedStatus === "pass", `distance ${distanceM}`);
    assert.equal(entrance.clear, expectedStatus === "pass", `distance ${distanceM}`);
  }
});

test("turning zone distinguishes rotated-obstacle clearance, tangency, and penetration", async () => {
  const halfDiagonal = Math.SQRT2 * 0.2;
  for (const [offsetM, expectedClear] of [[0.01, true], [0, true], [-0.01, false]]) {
    const candidate = makeValidSceneBrief();
    disableExistingObstacles(candidate);
    candidate.accessibility.turningZones[0].center = [0, 0];
    addObstacle(candidate, {
      id: "rotated-obstacle",
      position: [0.75 + halfDiagonal + offsetM, 0],
      rotation: Math.PI / 4,
      bbox: { w: 0.4, d: 0.4, h: 0.8 },
    });

    const result = validateTurningZones(await normalizeSceneBrief(candidate));
    const entrance = result.measured.zones[0];

    assert.equal(entrance.clear, expectedClear, `offset ${offsetM}`);
  }
});

test("non-obstacle objects do not block turning zones", async () => {
  const candidate = makeValidSceneBrief();
  disableExistingObstacles(candidate);
  const zone = candidate.accessibility.turningZones[0];
  addObstacle(candidate, {
    id: "overlay-object",
    position: [...zone.center],
    bbox: { w: 1, d: 1, h: 0.1 },
    collision: { obstacle: false, allowOverlapWith: [] },
  });

  const result = validateTurningZones(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "pass");
  assert.deepEqual(result.measured.zones[0].conflictingObjectIds, []);
});

test("each required turning location can fail independently", async () => {
  const locations = ["entrance", "service-counter", "accessible-wc"];
  for (let zoneIndex = 0; zoneIndex < locations.length; zoneIndex += 1) {
    const candidate = makeValidSceneBrief();
    disableExistingObstacles(candidate);
    const zone = candidate.accessibility.turningZones[zoneIndex];
    addObstacle(candidate, {
      id: `blocker-${zoneIndex}`,
      position: [...zone.center],
      bbox: { w: 0.3, d: 0.3, h: 0.8 },
    });

    const result = validateTurningZones(await normalizeSceneBrief(candidate));

    assert.equal(result.status, "fail");
    assert.equal(result.measured.clearCount, 2);
    assert.equal(result.measured.zones[zoneIndex].at, locations[zoneIndex]);
    assert.deepEqual(result.measured.zones[zoneIndex].conflictingObjectIds, [`blocker-${zoneIndex}`]);
  }
});

test("turning-zone failure emits the failed circle and obstacle polygon", async () => {
  const candidate = makeValidSceneBrief();
  disableExistingObstacles(candidate);
  const zone = candidate.accessibility.turningZones[0];
  addObstacle(candidate, {
    id: "entry-blocker",
    position: [...zone.center],
    bbox: { w: 0.4, d: 0.4, h: 0.8 },
  });

  const result = validateTurningZones(await normalizeSceneBrief(candidate));

  assert.equal(result.status, "fail");
  assert.deepEqual(
    result.violationGeometry.map((item) => item.id),
    ["turning-zone-violation-turn-entry", "turning-zone-obstacle-turn-entry-entry-blocker"],
  );
  assert.equal(result.violationGeometry[0].type, "circle");
  assert.equal(result.violationGeometry[1].type, "polygon");
});

test("turning-zone results and conflict ids are deterministic", async () => {
  const candidate = makeValidSceneBrief();
  disableExistingObstacles(candidate);
  const zone = candidate.accessibility.turningZones[0];
  addObstacle(candidate, {
    id: "z-blocker",
    position: [...zone.center],
    bbox: { w: 0.3, d: 0.3, h: 0.8 },
  });
  addObstacle(candidate, {
    id: "a-blocker",
    position: [...zone.center],
    bbox: { w: 0.2, d: 0.2, h: 0.8 },
  });
  const reversed = structuredClone(candidate);
  reversed.objects.reverse();

  const first = validateTurningZones(await normalizeSceneBrief(candidate));
  const second = validateTurningZones(await normalizeSceneBrief(reversed));

  assert.deepEqual(first, second);
  assert.deepEqual(first.measured.zones[0].conflictingObjectIds, ["a-blocker", "z-blocker"]);
});
