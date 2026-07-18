import assert from "node:assert/strict";
import test from "node:test";
import { obbAxes } from "../geometry/obb.mjs";
import { add, scale } from "../geometry/vector.mjs";
import { normalizeSceneBrief } from "../input/normalize.mjs";
import {
  doorOpeningSegment,
  validateRouteStopConnections,
} from "../route/stop-connections.mjs";
import { makeValidSceneBrief } from "./helpers.mjs";

function entityForStop(candidate, stop) {
  if (stop.target.collection === "objects") {
    return candidate.objects.find((object) => object.id === stop.target.id);
  }
  if (stop.target.collection === "seats") {
    return candidate.seats.find((seat) => seat.id === stop.target.id);
  }
  return candidate.accessibility.doors.find((door) => door.id === stop.target.id);
}

function setStopDistance(candidate, stopIndex, distanceM) {
  const stop = candidate.accessibility.route.stops[stopIndex];
  const entity = entityForStop(candidate, stop);
  let point;

  if (stop.target.collection === "objects") {
    const axes = obbAxes({ rotationRad: entity.rotation });
    point = add(entity.position, scale(axes.z, entity.bbox.d / 2 + distanceM));
  } else if (stop.target.collection === "seats") {
    point = [entity.position[0] + distanceM, entity.position[1]];
  } else {
    const axes = obbAxes({ rotationRad: entity.rotation });
    point = add(entity.position, scale(axes.z, distanceM));
  }

  candidate.accessibility.route.centerline[stop.pointIndex] = point;
}

test("door opening segment follows local x and declared clear width", async () => {
  const candidate = makeValidSceneBrief();
  const entrance = candidate.accessibility.doors[0];
  entrance.position = [1, 2];
  entrance.rotation = Math.PI / 2;
  entrance.clearWidthM = 1;
  const scene = await normalizeSceneBrief(candidate);

  const segment = doorOpeningSegment(scene.doorById.get("entrance-door"));

  assert.ok(Math.abs(segment.start[0] - 1) < 1e-9);
  assert.ok(Math.abs(segment.start[1] - 2.5) < 1e-9);
  assert.ok(Math.abs(segment.end[0] - 1) < 1e-9);
  assert.ok(Math.abs(segment.end[1] - 1.5) < 1e-9);
});

test("all five target types pass at 0, 0.59, and 0.60 m, then fail at 0.61 m", async () => {
  for (let stopIndex = 0; stopIndex < 5; stopIndex += 1) {
    for (const [distanceM, expectedConnected] of [[0, true], [0.59, true], [0.6, true], [0.61, false]]) {
      const candidate = makeValidSceneBrief();
      setStopDistance(candidate, stopIndex, distanceM);

      const result = validateRouteStopConnections(await normalizeSceneBrief(candidate));
      const stop = result.stops[stopIndex];

      assert.equal(stop.connected, expectedConnected, `stop ${stopIndex}, distance ${distanceM}`);
      assert.ok(Math.abs(stop.distanceM - distanceM) < 1e-9, `stop ${stopIndex}, distance ${distanceM}`);
    }
  }
});

test("rotated object and door targets use their local geometry", async () => {
  const candidate = makeValidSceneBrief();
  const lowered = candidate.objects.find((object) => object.id === "lowered-counter");
  const entrance = candidate.accessibility.doors.find((door) => door.id === "entrance-door");
  lowered.rotation = Math.PI / 2;
  entrance.rotation = Math.PI / 2;
  setStopDistance(candidate, 0, 0.4);
  setStopDistance(candidate, 1, 0.4);

  const result = validateRouteStopConnections(await normalizeSceneBrief(candidate));

  assert.ok(Math.abs(result.stops[0].distanceM - 0.4) < 1e-9);
  assert.ok(Math.abs(result.stops[1].distanceM - 0.4) < 1e-9);
  assert.equal(result.stops[0].connected, true);
  assert.equal(result.stops[1].connected, true);
});

test("a remote pick-up target makes allStopsConnected false and emits violation geometry", async () => {
  const candidate = makeValidSceneBrief();
  setStopDistance(candidate, 2, 0.61);

  const result = validateRouteStopConnections(await normalizeSceneBrief(candidate));

  assert.equal(result.allStopsConnected, false);
  assert.equal(result.stops[2].connected, false);
  assert.deepEqual(result.violationGeometry.map((item) => item.id), ["route-stop-violation-pick-up"]);
  assert.equal(result.violationGeometry[0].type, "segment");
});

test("connection evidence uses points for zero distance and segments otherwise", async () => {
  const candidate = makeValidSceneBrief();
  setStopDistance(candidate, 0, 0);
  setStopDistance(candidate, 1, 0.4);

  const result = validateRouteStopConnections(await normalizeSceneBrief(candidate));

  assert.equal(result.evidenceGeometry[0].type, "point");
  assert.equal(result.evidenceGeometry[1].type, "segment");
});

test("a stop inside its target is marked for route collision checks", async () => {
  const candidate = makeValidSceneBrief();
  const lowered = candidate.objects.find((object) => object.id === "lowered-counter");
  candidate.accessibility.route.centerline[1] = [...lowered.position];

  const result = validateRouteStopConnections(await normalizeSceneBrief(candidate));

  assert.equal(result.stops[1].distanceM, 0);
  assert.equal(result.stops[1].connected, true);
  assert.equal(result.stops[1].targetContainsStop, true);
});

test("route stop results are stable across source array order", async () => {
  const candidate = makeValidSceneBrief();
  setStopDistance(candidate, 2, 0.61);
  const reordered = structuredClone(candidate);
  reordered.objects.reverse();
  reordered.seats.reverse();
  reordered.accessibility.doors.reverse();

  const first = validateRouteStopConnections(await normalizeSceneBrief(candidate));
  const second = validateRouteStopConnections(await normalizeSceneBrief(reordered));

  assert.deepEqual(first, second);
});
