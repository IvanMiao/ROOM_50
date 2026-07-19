import { EPSILON_M } from "../geometry/constants.mjs";
import {
  closestPointOnObb,
  closestPointOnSegment,
  pointStrictlyInsideObb,
} from "../geometry/distance.mjs";
import { obbAxes } from "../geometry/obb.mjs";
import { add, distance, scale, subtract } from "../geometry/vector.mjs";

export function doorOpeningSegment(door) {
  const openingAxis = obbAxes(door).x;
  const halfOpening = scale(openingAxis, door.clearWidthM / 2);
  return Object.freeze({
    start: Object.freeze(subtract(door.center, halfOpening)),
    end: Object.freeze(add(door.center, halfOpening)),
  });
}

function closestTargetPoint(stop) {
  const target = stop.target.entity;
  if (stop.target.collection === "objects") return closestPointOnObb(stop.point, target);
  if (stop.target.collection === "seats") return [target.point[0], target.point[1]];
  const opening = doorOpeningSegment(target);
  return closestPointOnSegment(stop.point, opening.start, opening.end);
}

function targetContainsStop(stop) {
  return (
    stop.target.collection === "objects" &&
    pointStrictlyInsideObb(stop.point, stop.target.entity)
  );
}

function connectionGeometry(connection, kind) {
  const id = `route-stop-${kind}-${connection.stage}`;
  const label = `${connection.stage} stop to ${connection.target.collection}:${connection.target.id}`;
  if (connection.distanceM <= EPSILON_M) {
    return Object.freeze({
      id,
      type: "point",
      point: Object.freeze([connection.point[0], connection.point[1]]),
      label,
    });
  }
  return Object.freeze({
    id,
    type: "segment",
    from: Object.freeze([connection.point[0], connection.point[1]]),
    to: Object.freeze([connection.targetPoint[0], connection.targetPoint[1]]),
    label,
  });
}

export function validateRouteStopConnections(scene) {
  const maximumDistanceM = scene.thresholds.routeMaximumStopDistanceM;
  const stops = scene.route.stops.map((stop) => {
    const targetPoint = closestTargetPoint(stop);
    const distanceM = distance(stop.point, targetPoint);
    return Object.freeze({
      stage: stop.stage,
      pointIndex: stop.pointIndex,
      point: Object.freeze([stop.point[0], stop.point[1]]),
      target: Object.freeze({
        collection: stop.target.collection,
        id: stop.target.id,
      }),
      targetPoint: Object.freeze(targetPoint),
      targetContainsStop: targetContainsStop(stop),
      distanceM,
      connected: distanceM <= maximumDistanceM + EPSILON_M,
    });
  });
  const disconnectedStops = stops.filter((stop) => !stop.connected);

  return Object.freeze({
    allStopsConnected: disconnectedStops.length === 0,
    maximumDistanceM,
    stops: Object.freeze(stops),
    evidenceGeometry: Object.freeze(
      stops.map((stop) => connectionGeometry(stop, "connection")),
    ),
    violationGeometry: Object.freeze(
      disconnectedStops.map((stop) => connectionGeometry(stop, "violation")),
    ),
  });
}
