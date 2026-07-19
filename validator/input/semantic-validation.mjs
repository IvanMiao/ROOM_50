import { appendPath, inputIssue } from "./errors.mjs";
import { EPSILON_M } from "../geometry/constants.mjs";

const targetCollectionByStage = Object.freeze({
  entrance: "doors",
  ordering: "objects",
  "pick-up": "objects",
  "accessible-seat": "seats",
  "accessible-wc": "doors",
});

function addEntriesToGlobalIndex(entries, basePath, globalIds, issues) {
  entries.forEach((entry, index) => {
    const idPath = appendPath(appendPath(basePath, index), "id");
    if (globalIds.has(entry.id)) {
      issues.push(
        inputIssue(
          "GLOBAL_ID_DUPLICATE",
          idPath,
          `id “${entry.id}” duplicates ${globalIds.get(entry.id)}.`,
        ),
      );
    } else {
      globalIds.set(entry.id, idPath);
    }
  });
}

function requireReference(map, id, path, code, kind, issues) {
  if (!map.has(id)) {
    issues.push(inputIssue(code, path, `${kind} id “${id}” does not exist.`));
    return undefined;
  }
  return map.get(id);
}

export function validateSceneBriefSemantics(candidate) {
  const issues = [];
  const objects = new Map(candidate.objects.map((object) => [object.id, object]));
  const seats = new Map(candidate.seats.map((seat) => [seat.id, seat]));
  const doors = new Map(candidate.accessibility.doors.map((door) => [door.id, door]));
  const globalIds = new Map();

  addEntriesToGlobalIndex(candidate.objects, "/objects", globalIds, issues);
  addEntriesToGlobalIndex(candidate.seats, "/seats", globalIds, issues);
  addEntriesToGlobalIndex(candidate.accessibility.turningZones, "/accessibility/turningZones", globalIds, issues);
  addEntriesToGlobalIndex(candidate.accessibility.doors, "/accessibility/doors", globalIds, issues);

  candidate.objects.forEach((object, objectIndex) => {
    object.collision.allowOverlapWith.forEach((targetId, targetIndex) => {
      const path = `/objects/${objectIndex}/collision/allowOverlapWith/${targetIndex}`;
      if (targetId === object.id) {
        issues.push(inputIssue("OVERLAP_SELF_REFERENCE", path, "object cannot exempt overlap with itself."));
      } else {
        requireReference(objects, targetId, path, "OVERLAP_TARGET_NOT_FOUND", "object", issues);
      }
    });
  });

  candidate.seats.forEach((seat, seatIndex) => {
    if (seat.objectId !== undefined) {
      requireReference(
        objects,
        seat.objectId,
        `/seats/${seatIndex}/objectId`,
        "SEAT_OBJECT_NOT_FOUND",
        "object",
        issues,
      );
    }
  });

  candidate.accessibility.doors.forEach((door, doorIndex) => {
    if (door.objectId !== undefined) {
      requireReference(
        objects,
        door.objectId,
        `/accessibility/doors/${doorIndex}/objectId`,
        "DOOR_OBJECT_NOT_FOUND",
        "object",
        issues,
      );
    }
  });

  const serviceCounter = candidate.accessibility.serviceCounter;
  requireReference(
    objects,
    serviceCounter.counterObjectId,
    "/accessibility/serviceCounter/counterObjectId",
    "COUNTER_OBJECT_NOT_FOUND",
    "object",
    issues,
  );
  requireReference(
    objects,
    serviceCounter.loweredSegmentObjectId,
    "/accessibility/serviceCounter/loweredSegmentObjectId",
    "LOWERED_COUNTER_OBJECT_NOT_FOUND",
    "object",
    issues,
  );

  const accessibleTable = candidate.accessibility.accessibleTable;
  requireReference(
    objects,
    accessibleTable.tableObjectId,
    "/accessibility/accessibleTable/tableObjectId",
    "ACCESSIBLE_TABLE_OBJECT_NOT_FOUND",
    "object",
    issues,
  );
  const wheelchairSeat = requireReference(
    seats,
    accessibleTable.wheelchairSeatId,
    "/accessibility/accessibleTable/wheelchairSeatId",
    "WHEELCHAIR_SEAT_NOT_FOUND",
    "seat",
    issues,
  );
  if (wheelchairSeat && (wheelchairSeat.kind !== "wheelchair-position" || !wheelchairSeat.accessible)) {
    issues.push(
      inputIssue(
        "WHEELCHAIR_SEAT_INVALID",
        "/accessibility/accessibleTable/wheelchairSeatId",
        `seat “${accessibleTable.wheelchairSeatId}” must be an accessible wheelchair-position.`,
      ),
    );
  }

  const route = candidate.accessibility.route;
  route.centerline.slice(1).forEach((point, pointIndex) => {
    const previous = route.centerline[pointIndex];
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) <= EPSILON_M) {
      issues.push(
        inputIssue(
          "ROUTE_ZERO_LENGTH_SEGMENT",
          `/accessibility/route/centerline/${pointIndex + 1}`,
          `route points ${pointIndex} and ${pointIndex + 1} form a zero-length segment.`,
        ),
      );
    }
  });
  let previousIndex = -1;
  route.stops.forEach((stop, stopIndex) => {
    const stopPath = `/accessibility/route/stops/${stopIndex}`;
    if (stop.pointIndex <= previousIndex) {
      issues.push(
        inputIssue(
          "ROUTE_STOP_ORDER",
          `${stopPath}/pointIndex`,
          "route stop indexes must be strictly increasing.",
        ),
      );
    }
    previousIndex = stop.pointIndex;

    if (stop.pointIndex >= route.centerline.length) {
      issues.push(
        inputIssue(
          "ROUTE_STOP_INDEX_OUT_OF_RANGE",
          `${stopPath}/pointIndex`,
          `index ${stop.pointIndex} is outside a centerline with ${route.centerline.length} point(s).`,
        ),
      );
    }

    const requiredCollection = targetCollectionByStage[stop.stage];
    if (stop.target.collection !== requiredCollection) {
      issues.push(
        inputIssue(
          "ROUTE_TARGET_COLLECTION",
          `${stopPath}/target/collection`,
          `stage “${stop.stage}” requires collection “${requiredCollection}”.`,
        ),
      );
      return;
    }

    const collection = stop.target.collection === "objects" ? objects : stop.target.collection === "seats" ? seats : doors;
    const target = requireReference(
      collection,
      stop.target.id,
      `${stopPath}/target/id`,
      "ROUTE_TARGET_NOT_FOUND",
      stop.target.collection.slice(0, -1),
      issues,
    );

    if (!target) return;

    if (stop.stage === "entrance" && (target.at !== "entrance" || target.stepFree !== true)) {
      issues.push(
        inputIssue(
          "ROUTE_ENTRANCE_TARGET_INVALID",
          `${stopPath}/target/id`,
          `entrance must target a step-free entrance door; “${stop.target.id}” does not.`,
        ),
      );
    }

    if (stop.stage === "ordering" && stop.target.id !== serviceCounter.loweredSegmentObjectId) {
      issues.push(
        inputIssue(
          "ROUTE_ORDERING_TARGET_INVALID",
          `${stopPath}/target/id`,
          `ordering must target lowered counter “${serviceCounter.loweredSegmentObjectId}”.`,
        ),
      );
    }

    if (stop.stage === "accessible-seat") {
      const isDeclaredWheelchairSeat = stop.target.id === accessibleTable.wheelchairSeatId;
      const isUsableWheelchairSeat = target.kind === "wheelchair-position" && target.accessible === true;
      if (!isDeclaredWheelchairSeat || !isUsableWheelchairSeat) {
        issues.push(
          inputIssue(
            "ROUTE_ACCESSIBLE_SEAT_TARGET_INVALID",
            `${stopPath}/target/id`,
            `accessible-seat must target declared accessible wheelchair seat “${accessibleTable.wheelchairSeatId}”.`,
          ),
        );
      }
    }

    if (stop.stage === "accessible-wc" && target.at !== "accessible-wc") {
      issues.push(
        inputIssue(
          "ROUTE_WC_TARGET_INVALID",
          `${stopPath}/target/id`,
          `accessible-wc must target an accessible-wc door; “${stop.target.id}” does not.`,
        ),
      );
    }
  });

  return issues;
}
