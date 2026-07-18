import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createArchvizLayer } from "./archviz-layer.js";
import { createLightingRig, createStylePreset, disposeStylePreset, setLightingMode } from "./style-presets.js";

const GROUPS = ["shell", "architecture", "service", "furniture", "accessibility", "lighting"];
const PROCEDURAL_GROUPS = ["shell", "architecture", "service", "furniture"];
const VISUAL_GROUP = "visual";
const CANONICAL_GROUPS = new Set(GROUPS);
const PASS = 0x77df8b;
const FAIL = 0xff4d45;
const WARNING = 0xffb347;

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isPoint2(value) {
  return Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);
}

function isPositiveBbox(value) {
  return value
    && isFiniteNumber(value.w) && value.w > 0
    && isFiniteNumber(value.d) && value.d > 0
    && isFiniteNumber(value.h) && value.h > 0;
}

function distanceToPoint([ax, az], [bx, bz]) {
  return Math.hypot(ax - bx, az - bz);
}

function distanceToObjectFootprint(point, object) {
  const cosine = Math.cos(-object.rotation);
  const sine = Math.sin(-object.rotation);
  const dx = point[0] - object.x;
  const dz = point[1] - object.z;
  const localX = dx * cosine - dz * sine;
  const localZ = dx * sine + dz * cosine;
  const outsideX = Math.max(Math.abs(localX) - object.w / 2, 0);
  const outsideZ = Math.max(Math.abs(localZ) - object.d / 2, 0);
  return Math.hypot(outsideX, outsideZ);
}

function distanceToDoorOpening(point, door) {
  const halfWidth = door.clearWidthM / 2;
  const direction = [Math.cos(door.rotation), Math.sin(door.rotation)];
  const from = [door.position[0] - direction[0] * halfWidth, door.position[1] - direction[1] * halfWidth];
  const to = [door.position[0] + direction[0] * halfWidth, door.position[1] + direction[1] * halfWidth];
  const segment = [to[0] - from[0], to[1] - from[1]];
  const lengthSquared = segment[0] ** 2 + segment[1] ** 2;
  const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - from[0]) * segment[0] + (point[1] - from[1]) * segment[1]) / lengthSquared));
  return distanceToPoint(point, [from[0] + segment[0] * projection, from[1] + segment[1] * projection]);
}

function normalizeShell(brief = {}) {
  const shell = brief.shell || brief.roomShell || brief.room?.shell || brief.room || {};
  return {
    length: number(shell.lengthM ?? shell.length ?? shell.bbox?.w ?? shell.dimensions?.[0], 10),
    width: number(shell.widthM ?? shell.width ?? shell.bbox?.d ?? shell.dimensions?.[1], 5),
    height: number(shell.clearHeightM ?? shell.height ?? shell.bbox?.h ?? shell.dimensions?.[2], 3.2),
  };
}

function normalizeObject(item, index) {
  const bbox = item.bbox || item.size || {};
  const position = item.position || item.center || [0, 0];
  const semanticTag = String(item.semanticTag || item.tag || item.type || "furniture").toLowerCase();
  const x = number(Array.isArray(position) ? position[0] : position.x, 0);
  const z = number(Array.isArray(position) ? (position.length > 2 ? position[2] : position[1]) : position.z, 0);
  const w = Math.max(0.02, number(Array.isArray(bbox) ? bbox[0] : bbox.w ?? bbox.width, 0.6));
  const d = Math.max(0.02, number(Array.isArray(bbox) ? bbox[1] : bbox.d ?? bbox.depth, 0.6));
  const h = Math.max(0.02, number(Array.isArray(bbox) ? bbox[2] : bbox.h ?? bbox.height, 0.75));
  const elevationM = Math.max(0, number(item.elevationM ?? item.elevation, 0));
  const declaredGroup = String(item.semanticGroup || "").toLowerCase();
  return {
    ...item,
    id: item.id || `object-${index + 1}`,
    semanticTag,
    x,
    z,
    w,
    d,
    h,
    elevationM,
    y: elevationM + h / 2,
    semanticGroup: CANONICAL_GROUPS.has(declaredGroup) ? declaredGroup : legacySemanticGroup(semanticTag),
    rotation: number(item.rotation ?? item.rotationY, 0),
  };
}

export function normalizeSceneBrief(brief = {}) {
  const objects = brief.objects || brief.scene?.objects || brief.items || [];
  const seats = brief.seats || brief.scene?.seats || [];
  const canonical = brief.schemaVersion === "1.0.0";
  if (!Array.isArray(objects) || !Array.isArray(seats)) {
    throw new Error("Scene brief objects and seats must be arrays");
  }
  if (canonical) {
    const coordinateSystem = brief.coordinateSystem || {};
    const shell = brief.shell || {};
    const canonicalHeader = brief.contractId === "room50-accessible-cafe-v1"
      && brief.status === "concept-demo-not-for-construction"
      && brief.units === "metres"
      && coordinateSystem.horizontalPlane === "xz"
      && coordinateSystem.verticalAxis === "y-up"
      && coordinateSystem.origin === "shell-centre-at-finished-floor"
      && coordinateSystem.rotationUnit === "radians"
      && coordinateSystem.rotationAxis === "y"
      && coordinateSystem.rotationRule === "right-hand-rule";
    if (!canonicalHeader) throw new Error("Canonical scene brief header or coordinate system is invalid");
    if (shell.lengthM !== 10 || shell.widthM !== 5 || shell.clearHeightM !== 3.2 || shell.grossAreaM2 !== 50) {
      throw new Error("Canonical scene brief must use the fixed 10 × 5 × 3.2 m shell");
    }
    if (![brief.observations, brief.userIntent, brief.assumptions].every(Array.isArray)) {
      throw new Error("Canonical observations, userIntent, and assumptions must be arrays");
    }
    if (Object.hasOwn(brief, "seatCount")) throw new Error("Canonical capacity must not use a seatCount field");
    const rawObjectIds = objects.map((item) => item.id);
    if (rawObjectIds.some((id) => !id) || new Set(rawObjectIds).size !== rawObjectIds.length) {
      throw new Error("Canonical scene brief object IDs must be present and unique");
    }
    const invalidObject = objects.find((item) =>
      typeof item.semanticTag !== "string"
      || !isPoint2(item.position)
      || !isFiniteNumber(item.rotation)
      || !isPositiveBbox(item.bbox)
      || !item.collision
      || typeof item.collision.obstacle !== "boolean"
      || !Array.isArray(item.collision.allowOverlapWith)
      || new Set(item.collision.allowOverlapWith).size !== item.collision.allowOverlapWith.length
      || (item.elevationM !== undefined && (!isFiniteNumber(item.elevationM) || item.elevationM < 0)));
    if (invalidObject) throw new Error(`Canonical object ${invalidObject.id || "(unknown)"} has invalid geometry`);
    const missingGroup = objects.find((item) => !CANONICAL_GROUPS.has(String(item.semanticGroup || "").toLowerCase()));
    if (missingGroup) throw new Error(`Canonical object ${missingGroup.id || "(unknown)"} requires a valid semanticGroup`);
    const seatKinds = new Set(["chair", "stool", "bench-position", "wheelchair-position"]);
    const invalidSeat = seats.find((seat) =>
      !seatKinds.has(seat.kind)
      || !isPoint2(seat.position)
      || typeof seat.countsTowardCapacity !== "boolean"
      || typeof seat.accessible !== "boolean");
    if (invalidSeat) throw new Error(`Canonical seat ${invalidSeat.id || "(unknown)"} is invalid`);
  }
  const normalizedObjects = objects.map(normalizeObject);
  const objectIdList = normalizedObjects.map((item) => item.id);
  const seatIdList = seats.map((seat) => seat.id);
  if (new Set(objectIdList).size !== objectIdList.length) throw new Error("Scene brief object IDs must be unique");
  if (canonical && (seatIdList.some((id) => !id) || new Set(seatIdList).size !== seatIdList.length)) {
    throw new Error("Canonical scene brief seat IDs must be present and unique");
  }
  const objectIds = new Set(normalizedObjects.map((item) => item.id));
  const objectsById = new Map(normalizedObjects.map((item) => [item.id, item]));
  const seatIds = new Set(seatIdList);
  if (canonical && seatIdList.some((id) => objectIds.has(id))) {
    throw new Error("Canonical object and seat IDs must be globally unique");
  }
  const danglingSeat = seats.find((seat) => seat.objectId && !objectIds.has(seat.objectId));
  if (danglingSeat) throw new Error(`Seat ${danglingSeat.id || "(unknown)"} references missing object ${danglingSeat.objectId}`);
  if (canonical) {
    const expectedSeatTags = { chair: "chair", stool: "stool", "bench-position": "bench-seat" };
    const mismatchedSeat = seats.find((seat) =>
      seat.objectId
      && expectedSeatTags[seat.kind]
      && objectsById.get(seat.objectId)?.semanticTag !== expectedSeatTags[seat.kind]);
    if (mismatchedSeat) throw new Error(`Seat ${mismatchedSeat.id} references incompatible solid geometry`);
    const accessibility = brief.accessibility;
    const centerline = accessibility?.route?.centerline;
    const stops = accessibility?.route?.stops;
    if (!Array.isArray(centerline) || !Array.isArray(stops)) throw new Error("Canonical accessibility route is incomplete");
    if (accessibility.route.minimumClearWidthM !== 1.2 || !centerline.every(isPoint2)) {
      throw new Error("Canonical accessibility route coordinates or target width are invalid");
    }
    const expectedStages = ["entrance", "ordering", "pick-up", "accessible-seat", "accessible-wc"];
    const orderedStops = stops.length === expectedStages.length && stops.every((stop, index) =>
      stop.stage === expectedStages[index]
      && Number.isInteger(stop.pointIndex)
      && stop.pointIndex >= 0
      && stop.pointIndex < centerline.length
      && (index === 0 || stop.pointIndex > stops[index - 1].pointIndex));
    if (!orderedStops) throw new Error("Accessibility route stops must be ordered and reference centerline points");
    if (accessibility?.turningZones?.length !== 3 || accessibility?.doors?.length !== 2) {
      throw new Error("Canonical accessibility data requires three turning zones and two doors");
    }
    const declaredIds = [
      ...objectIdList,
      ...seatIdList,
      ...accessibility.turningZones.map((zone) => zone.id),
      ...accessibility.doors.map((door) => door.id),
    ];
    if (declaredIds.some((id) => !id) || new Set(declaredIds).size !== declaredIds.length) {
      throw new Error("Canonical object, seat, turning-zone, and door IDs must be globally unique");
    }
    const invalidOverlap = objects.find((item) => item.collision.allowOverlapWith.some((id) => id === item.id || !objectIds.has(id)));
    if (invalidOverlap) throw new Error(`Object ${invalidOverlap.id} has an invalid overlap exemption`);
    if (accessibility.turningZones.some((zone) => !isPoint2(zone.center) || !isFiniteNumber(zone.diameterM) || zone.diameterM <= 0)) {
      throw new Error("Canonical turning-zone geometry is invalid");
    }
    if (accessibility.doors.some((door) =>
      !isPoint2(door.position)
      || !isFiniteNumber(door.rotation)
      || !isFiniteNumber(door.clearWidthM)
      || door.clearWidthM <= 0
      || typeof door.stepFree !== "boolean")) {
      throw new Error("Canonical door geometry is invalid");
    }
    const turningStages = accessibility.turningZones.map((zone) => zone.at);
    if (turningStages.join("|") !== "entrance|service-counter|accessible-wc") {
      throw new Error("Canonical turning zones must follow entrance, service-counter, accessible-wc order");
    }
    const doorStages = new Set(accessibility.doors.map((door) => door.at));
    if (doorStages.size !== 2 || !doorStages.has("entrance") || !doorStages.has("accessible-wc")) {
      throw new Error("Canonical doors must cover the entrance and accessible WC");
    }
    const collections = {
      objects: new Map(normalizedObjects.map((item) => [item.id, item])),
      seats: new Map(seats.map((seat) => [seat.id, seat])),
      doors: new Map(accessibility.doors.map((door) => [door.id, door])),
    };
    const expectedTargetCollections = ["doors", "objects", "objects", "seats", "doors"];
    stops.forEach((stop, index) => {
      const target = stop.target;
      const expectedCollection = expectedTargetCollections[index];
      if (!target || target.collection !== expectedCollection || !collections[expectedCollection].has(target.id)) {
        throw new Error(`Route stop ${stop.stage} has an invalid target`);
      }
      const routePoint = centerline[stop.pointIndex];
      const targetValue = collections[expectedCollection].get(target.id);
      const distance = expectedCollection === "objects"
        ? distanceToObjectFootprint(routePoint, targetValue)
        : expectedCollection === "doors"
          ? distanceToDoorOpening(routePoint, targetValue)
          : distanceToPoint(routePoint, targetValue.position);
      if (distance > 0.6 + Number.EPSILON) {
        throw new Error(`Route stop ${stop.stage} is more than 0.6 m from its target`);
      }
    });
    const objectReferences = [
      accessibility?.serviceCounter?.counterObjectId,
      accessibility?.serviceCounter?.loweredSegmentObjectId,
      accessibility?.accessibleTable?.tableObjectId,
      ...accessibility.doors.map((door) => door.objectId).filter(Boolean),
    ];
    if (objectReferences.some((id) => !objectIds.has(id))) throw new Error("Accessibility object reference is missing");
    const counter = objectsById.get(accessibility.serviceCounter.counterObjectId);
    const loweredCounter = objectsById.get(accessibility.serviceCounter.loweredSegmentObjectId);
    const accessibleTable = objectsById.get(accessibility.accessibleTable.tableObjectId);
    if (counter?.semanticTag !== "service-counter"
      || loweredCounter?.semanticTag !== "lowered-counter"
      || accessibleTable?.semanticTag !== "accessible-table") {
      throw new Error("Accessibility references point to incompatible semantic objects");
    }
    const wheelchairSeat = seats.find((seat) => seat.id === accessibility?.accessibleTable?.wheelchairSeatId);
    if (!wheelchairSeat
      || !seatIds.has(wheelchairSeat.id)
      || wheelchairSeat.kind !== "wheelchair-position"
      || wheelchairSeat.accessible !== true
      || wheelchairSeat.countsTowardCapacity !== true
      || wheelchairSeat.objectId !== undefined) {
      throw new Error("Accessible table must reference an empty accessible wheelchair position");
    }
    if (!accessibility?.accessibleTable?.kneeClearanceVolume) {
      throw new Error("Accessible table knee-clearance volume is missing");
    }
    const kneeVolume = accessibility.accessibleTable.kneeClearanceVolume;
    if (!isPoint2(kneeVolume.position) || !isFiniteNumber(kneeVolume.rotation) || !isPositiveBbox(kneeVolume.bbox)) {
      throw new Error("Accessible table knee-clearance volume is invalid");
    }
  }
  return {
    shell: normalizeShell(brief),
    objects: normalizedObjects,
    seats,
    seatCapacity: seats.filter((seat) => seat.countsTowardCapacity === true).length,
    accessibility: brief.accessibility || null,
    raw: brief,
  };
}

function legacySemanticGroup(tag) {
  if (/wall|door|partition|window|wc|toilet|architecture/.test(tag)) return "architecture";
  if (/counter|bar|service|espresso|pickup|order/.test(tag)) return "service";
  if (/route|turn|clearance|access/.test(tag)) return "accessibility";
  return "furniture";
}

function materialFor(tag, style) {
  const materials = style.materials;
  if (/counter|clay|terracotta/.test(tag)) return materials.terracotta;
  if (/chair|bench|sofa|seat|fabric/.test(tag)) return materials.linen;
  if (/table|wood|timber|shelf/.test(tag)) return materials.timber;
  if (/plant/.test(tag)) return materials.plant;
  if (/glass|window/.test(tag)) return materials.glass;
  if (/toilet|sink|ceramic/.test(tag)) return materials.ceramic;
  if (/wall|partition/.test(tag)) return materials.wall;
  return materials.metal;
}

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function boxObject(item, material) {
  const mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h, item.d), material));
  mesh.position.set(item.x, item.y, item.z);
  mesh.rotation.y = item.rotation;
  mesh.name = item.id;
  mesh.userData.semanticTag = item.semanticTag;
  return mesh;
}

function tableObject(item, style) {
  const group = new THREE.Group();
  const round = /round/.test(item.semanticTag) || Math.abs(item.w - item.d) < 0.08;
  const top = shadow(new THREE.Mesh(
    round ? new THREE.CylinderGeometry(item.w / 2, item.w / 2, Math.min(0.07, item.h * 0.12), 28) : new THREE.BoxGeometry(item.w, Math.min(0.07, item.h * 0.12), item.d),
    style.materials.timber,
  ));
  top.position.y = item.h - 0.04;
  const stem = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, Math.max(0.1, item.h - 0.08), 12), style.materials.metal));
  stem.position.y = (item.h - 0.08) / 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(item.w, item.d) * 0.28, Math.min(item.w, item.d) * 0.3, 0.035, 18), style.materials.metal);
  foot.position.y = 0.018;
  group.add(top, stem, foot);
  group.position.set(item.x, item.y - item.h / 2, item.z);
  group.rotation.y = item.rotation;
  group.name = item.id;
  group.userData.semanticTag = item.semanticTag;
  return group;
}

function chairObject(item, style) {
  const group = new THREE.Group();
  const seatHeight = Math.min(0.46, item.h * 0.58);
  const seat = shadow(new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.08, item.d * 0.82), style.materials.linen));
  seat.position.y = seatHeight;
  const back = shadow(new THREE.Mesh(new THREE.BoxGeometry(item.w, Math.max(0.22, item.h - seatHeight), 0.07), style.materials.linen));
  back.position.set(0, seatHeight + (item.h - seatHeight) / 2, item.d * 0.4);
  [[-1,-1], [1,-1], [-1,1], [1,1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, seatHeight, 8), style.materials.metal);
    leg.position.set(sx * item.w * 0.38, seatHeight / 2, sz * item.d * 0.3);
    group.add(leg);
  });
  group.add(seat, back);
  group.position.set(item.x, item.y - item.h / 2, item.z);
  group.rotation.y = item.rotation;
  group.name = item.id;
  group.userData.semanticTag = item.semanticTag;
  return group;
}

function plantObject(item, style) {
  const group = new THREE.Group();
  const pot = shadow(new THREE.Mesh(new THREE.CylinderGeometry(item.w * 0.32, item.w * 0.25, item.h * 0.35, 16), style.materials.terracotta));
  pot.position.y = item.h * 0.175;
  for (let index = 0; index < 7; index += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(item.w * 0.16, 10, 8), style.materials.plant);
    const angle = index / 7 * Math.PI * 2;
    leaf.scale.set(0.55, 1.6, 0.45);
    leaf.position.set(Math.cos(angle) * item.w * 0.16, item.h * (0.55 + (index % 2) * 0.12), Math.sin(angle) * item.d * 0.16);
    group.add(leaf);
  }
  group.add(pot);
  group.position.set(item.x, item.y - item.h / 2, item.z);
  group.name = item.id;
  return group;
}

function createObject(item, style) {
  if (/table/.test(item.semanticTag)) return tableObject(item, style);
  if (/chair|seat|stool/.test(item.semanticTag)) return chairObject(item, style);
  if (/plant/.test(item.semanticTag)) return plantObject(item, style);
  return boxObject(item, materialFor(item.semanticTag, style));
}

function buildShell(group, shell, style) {
  const floor = shadow(new THREE.Mesh(new THREE.BoxGeometry(shell.length, 0.12, shell.width), style.materials.floor));
  floor.name = `floor_${shell.length}x${shell.width}m`;
  floor.position.y = -0.06;
  const back = shadow(new THREE.Mesh(new THREE.BoxGeometry(shell.length, shell.height, 0.1), style.materials.wall));
  back.position.set(0, shell.height / 2, -shell.width / 2);
  back.name = "rear_wall";
  const left = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, shell.height, shell.width), style.materials.wall));
  left.position.set(-shell.length / 2, shell.height / 2, 0);
  left.name = "left_wall";
  group.add(floor, back, left);

  const points = [];
  for (let x = -shell.length / 2; x <= shell.length / 2 + 0.01; x += 1) points.push(x, 0.012, -shell.width / 2, x, 0.012, shell.width / 2);
  for (let z = -shell.width / 2; z <= shell.width / 2 + 0.01; z += 1) points.push(-shell.length / 2, 0.012, z, shell.length / 2, 0.012, z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const grid = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x39352f, transparent: true, opacity: 0.15 }));
  grid.material.userData.room50Owned = true;
  grid.name = "one_metre_grid";
  group.add(grid);
}

const EXPECTED_CHECK_IDS = ["boundary", "routeWidth", "turningZones", "counterHeight", "kneeClearance", "seatCount"];
const GEOMETRY_TYPES = new Set(["point", "segment", "polyline", "polygon", "circle"]);

function validateGeometry(shape, geometryIds) {
  if (!shape || typeof shape !== "object" || typeof shape.id !== "string" || !shape.id || geometryIds.has(shape.id)) {
    throw new Error("Validation report geometry IDs must be present and unique");
  }
  geometryIds.add(shape.id);
  if (!GEOMETRY_TYPES.has(shape.type)) throw new Error(`Unsupported evidence geometry type: ${shape.type || "(missing)"}`);
  if (shape.color !== undefined || shape.colour !== undefined || shape.style !== undefined) {
    throw new Error("Validation report geometry must not contain presentation styling");
  }
  if (shape.type === "point" && !isPoint2(shape.point)) throw new Error(`Geometry ${shape.id} has an invalid point`);
  if (shape.type === "segment" && (!isPoint2(shape.from) || !isPoint2(shape.to) || distanceToPoint(shape.from, shape.to) === 0)) {
    throw new Error(`Geometry ${shape.id} has an invalid segment`);
  }
  if ((shape.type === "polyline" || shape.type === "polygon")) {
    const minimum = shape.type === "polygon" ? 3 : 2;
    if (!Array.isArray(shape.points) || shape.points.length < minimum || !shape.points.every(isPoint2)) {
      throw new Error(`Geometry ${shape.id} has invalid points`);
    }
    if (shape.type === "polygon" && distanceToPoint(shape.points[0], shape.points.at(-1)) === 0) {
      throw new Error(`Geometry ${shape.id} repeats its first polygon point`);
    }
  }
  if (shape.type === "circle" && (!isPoint2(shape.center) || !isFiniteNumber(shape.radiusM) || shape.radiusM <= 0)) {
    throw new Error(`Geometry ${shape.id} has an invalid circle`);
  }
}

export function validateValidationReport(report, brief) {
  const majorVersion = /^(\d+)\./.exec(report?.reportVersion)?.[1];
  if (majorVersion !== "1") throw new Error("Validation report uses an unsupported major version");
  if (typeof report.validatorVersion !== "string" || !report.validatorVersion || Number.isNaN(Date.parse(report.generatedAt))) {
    throw new Error("Validation report metadata is incomplete");
  }
  const rawBrief = brief?.raw || brief;
  const source = report.source;
  const coordinates = report.coordinateSystem;
  if (!rawBrief || !source
    || source.sceneBriefSchemaVersion !== rawBrief.schemaVersion
    || source.contractId !== rawBrief.contractId
    || source.label !== rawBrief.label
    || !coordinates
    || coordinates.horizontalPlane !== rawBrief.coordinateSystem?.horizontalPlane
    || coordinates.verticalAxis !== rawBrief.coordinateSystem?.verticalAxis
    || coordinates.origin !== rawBrief.coordinateSystem?.origin
    || coordinates.units !== rawBrief.units) {
    throw new Error("Validation report source or coordinate system does not match the scene brief");
  }
  const checks = report.checks;
  if (!Array.isArray(checks) || checks.length !== EXPECTED_CHECK_IDS.length) {
    throw new Error("Validation report must contain exactly six canonical checks");
  }
  const checkIds = checks.map((check) => check?.checkId);
  if (new Set(checkIds).size !== checkIds.length || checkIds.some((id, index) => id !== EXPECTED_CHECK_IDS[index])) {
    throw new Error("Validation report checks must be unique and in canonical order");
  }
  const geometryIds = new Set();
  checks.forEach((check) => {
    if (!["pass", "fail"].includes(check.status) || !["error", "warning"].includes(check.severity)) {
      throw new Error(`Validation check ${check.checkId} has an unsupported status or severity`);
    }
    if (!check.measured || typeof check.measured !== "object" || Array.isArray(check.measured)
      || !check.required || typeof check.required !== "object" || Array.isArray(check.required)
      || !Array.isArray(check.evidenceGeometry) || !Array.isArray(check.violationGeometry)) {
      throw new Error(`Validation check ${check.checkId} has invalid structured values or geometry`);
    }
    if (check.status === "pass" && check.violationGeometry.length) {
      throw new Error(`Passing check ${check.checkId} must not contain violation geometry`);
    }
    [...check.evidenceGeometry, ...check.violationGeometry].forEach((shape) => validateGeometry(shape, geometryIds));
  });
  const expectedSeatCapacity = (rawBrief.seats || []).filter((seat) => seat.countsTowardCapacity === true).length;
  if (checks[5].measured.count !== expectedSeatCapacity) {
    throw new Error("Validation report seat measurement does not match brief-derived capacity");
  }
  const counts = {
    total: checks.length,
    passed: checks.filter((check) => check.status === "pass").length,
    failedErrors: checks.filter((check) => check.status === "fail" && check.severity === "error").length,
    failedWarnings: checks.filter((check) => check.status === "fail" && check.severity === "warning").length,
  };
  const summary = report.summary;
  const expectedOverallStatus = counts.failedErrors > 0 ? "fail" : "pass";
  if (!summary
    || !["pass", "fail"].includes(summary.overallStatus)
    || summary.overallStatus !== expectedOverallStatus
    || Object.entries(counts).some(([key, value]) => summary[key] !== value)) {
    throw new Error("Validation report summary does not match its checks");
  }
  return checks;
}

function geometryItems(report, brief) {
  const checks = validateValidationReport(report, brief);
  return checks.flatMap((check) => [
    ...check.evidenceGeometry.map((shape) => ({ shape, checkId: check.checkId, status: check.status, severity: check.severity, subset: "evidence" })),
    ...check.violationGeometry.map((shape) => ({ shape, checkId: check.checkId, status: check.status, severity: check.severity, subset: "violation" })),
  ]);
}

function statusColor(status, severity) {
  if (status === "pass") return PASS;
  return severity === "warning" ? WARNING : FAIL;
}

function vector3([x, z], height = 0.05) {
  return new THREE.Vector3(x, height, z);
}

function overlayShape(parent, entry) {
  const { shape, status, severity, checkId, subset } = entry;
  const color = statusColor(status, severity);
  const opacity = subset === "violation" ? 1 : status === "pass" ? 0.72 : 0.52;
  const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, toneMapped: false });
  const fillMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: subset === "violation" ? 0.28 : 0.14, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
  let object;

  if (shape.type === "point") {
    lineMaterial.dispose();
    object = new THREE.Mesh(new THREE.SphereGeometry(subset === "violation" ? 0.1 : 0.075, 16, 12), fillMaterial);
    object.position.copy(vector3(shape.point, 0.09));
  } else if (shape.type === "circle") {
    lineMaterial.dispose();
    const fill = new THREE.Mesh(new THREE.CircleGeometry(shape.radiusM, 64), fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    const ringMaterial = fillMaterial.clone();
    ringMaterial.opacity = opacity;
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.001, shape.radiusM - 0.025), shape.radiusM + 0.025, 64), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    object = new THREE.Group();
    object.add(fill, ring);
    object.position.copy(vector3(shape.center, 0.035));
  } else {
    const points = shape.type === "segment" ? [shape.from, shape.to] : shape.points;
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => vector3(point)));
    object = shape.type === "polygon" ? new THREE.LineLoop(geometry, lineMaterial) : new THREE.Line(geometry, lineMaterial);
    fillMaterial.dispose();
  }
  object.name = `validator_${checkId}_${shape.id}`;
  object.traverse((child) => { child.renderOrder = subset === "violation" ? 1001 : 1000; });
  parent.add(object);
}

function clearGroup(group, { disposeMaterials = false } = {}) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.traverse?.((object) => {
      object.geometry?.dispose?.();
      object.shadow?.map?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        if (disposeMaterials || material.userData?.room50Owned) material.dispose?.();
      });
    });
  }
}

function clearGroupExcept(group, childToKeep, options) {
  group.remove(childToKeep);
  clearGroup(group, options);
  group.add(childToKeep);
}

async function readJson(source) {
  if (!source) return null;
  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Could not load ${source} (${response.status})`);
    return response.json();
  }
  return source;
}

export async function createStarterScene(options) {
  const container = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
  if (!container) throw new Error("createStarterScene requires a container element");

  let brief = normalizeSceneBrief(await readJson(options.brief));
  let report = await readJson(options.report);
  let presetId = options.preset || "hearth";
  let lightingMode = options.lighting || "day";
  let visualSource = options.visual || null;
  let loadRevision = 0;
  let style = createStylePreset(THREE, presetId);

  const scene = new THREE.Scene();
  scene.name = "room50_starter_scene";
  scene.background = new THREE.Color(style.colors.background);
  scene.fog = new THREE.Fog(style.colors.background, 16, 30);
  const groups = Object.fromEntries([...GROUPS, VISUAL_GROUP].map((name) => {
    const group = new THREE.Group(); group.name = name; scene.add(group); return [name, group];
  }));
  const validatorOverlay = new THREE.Group();
  validatorOverlay.name = "validator_evidence_overlay";
  groups.accessibility.add(validatorOverlay);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = lightingMode === "night" ? 0.92 : 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.replaceChildren(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;

  function setProceduralVisibility(visible) {
    PROCEDURAL_GROUPS.forEach((name) => { groups[name].visible = visible; });
  }

  const archviz = createArchvizLayer({
    renderer,
    parent: groups.visual,
    onState(state) {
      const ready = state.status === "ready";
      setProceduralVisibility(!ready);
      setLighting(lightingMode);
      options.onVisualState?.({ ...state, mode: ready ? "archviz" : "procedural" });
    },
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.minDistance = 5;
  controls.maxDistance = 28;
  const views = {};
  let activeTween;
  let destroyed = false;

  function setView(name = "perspective", immediate = false) {
    const view = views[name] || views.perspective;
    groups.accessibility.visible = name === "accessibility";
    if (immediate) {
      camera.position.copy(view.position);
      controls.target.copy(view.target);
      controls.update();
      return;
    }
    activeTween = {
      fromPosition: camera.position.clone(), toPosition: view.position.clone(),
      fromTarget: controls.target.clone(), toTarget: view.target.clone(), start: performance.now(), duration: 600,
    };
  }

  function rebuild() {
    GROUPS.filter((name) => name !== "accessibility" && name !== "lighting").forEach((name) => clearGroup(groups[name]));
    clearGroupExcept(groups.accessibility, validatorOverlay);
    clearGroup(validatorOverlay, { disposeMaterials: true });
    clearGroup(groups.lighting);
    buildShell(groups.shell, brief.shell, style);
    brief.objects.forEach((item) => groups[item.semanticGroup].add(createObject(item, style)));
    geometryItems(report, brief).forEach((entry) => overlayShape(validatorOverlay, entry));
    groups.lighting.add(createLightingRig(THREE, presetId, lightingMode));
    const extent = Math.max(brief.shell.length, brief.shell.width);
    views.perspective = { position: new THREE.Vector3(extent * 0.88, extent * 0.70, extent * 0.92), target: new THREE.Vector3(0, 0.55, 0) };
    views.top = { position: new THREE.Vector3(0.01, extent * 1.7, 0.01), target: new THREE.Vector3(0, 0, 0) };
    views.accessibility = { position: new THREE.Vector3(extent * 0.65, extent * 1.12, extent * 0.82), target: new THREE.Vector3(0, 0, 0) };
    options.onStatus?.({
      brief: brief.raw,
      report,
      checks: validateValidationReport(report, brief),
      overlayCount: validatorOverlay.children.length,
      seatCapacity: brief.seatCapacity,
    });
  }

  function setPreset(nextPreset) {
    presetId = nextPreset;
    disposeStylePreset(style);
    style = createStylePreset(THREE, presetId);
    scene.background.setHex(style.colors.background);
    scene.fog.color.setHex(style.colors.background);
    rebuild();
  }

  function setLighting(nextMode) {
    lightingMode = nextMode === "night" ? "night" : "day";
    const rig = groups.lighting.getObjectByName("lighting_rig");
    const hasArchviz = groups.visual.children.length > 0;
    if (rig) {
      setLightingMode(THREE, rig, presetId, lightingMode);
      if (hasArchviz) rig.traverse((object) => { if (object.isLight) object.intensity *= 0.78; });
    }
    renderer.toneMappingExposure = lightingMode === "night" ? (hasArchviz ? 0.86 : 0.92) : (hasArchviz ? 0.96 : 1.02);
  }

  async function load({ brief: nextBrief, report: nextReport, visual: nextVisual } = {}) {
    const revision = ++loadRevision;
    const resolvedVisual = nextVisual === undefined ? visualSource : nextVisual;
    const [resolvedBrief, resolvedReport] = await Promise.all([
      nextBrief ? readJson(nextBrief).then(normalizeSceneBrief) : Promise.resolve(brief),
      nextReport === undefined ? Promise.resolve(report) : readJson(nextReport),
    ]);
    if (revision !== loadRevision || destroyed) return { status: "superseded" };
    brief = resolvedBrief;
    report = resolvedReport;
    visualSource = resolvedVisual;
    rebuild();
    const visualState = await archviz.load(visualSource);
    if (revision !== loadRevision || destroyed) return { status: "superseded" };
    setView("perspective", true);
    return { status: "ready", visual: visualState };
  }

  async function loadVisual(nextVisual) {
    loadRevision += 1;
    visualSource = nextVisual;
    return archviz.load(visualSource);
  }

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  rebuild();
  setView(options.view || "perspective", true);

  function animate(time) {
    if (destroyed) return;
    if (activeTween) {
      const progress = Math.min(1, (time - activeTween.start) / activeTween.duration);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      camera.position.lerpVectors(activeTween.fromPosition, activeTween.toPosition, eased);
      controls.target.lerpVectors(activeTween.fromTarget, activeTween.toTarget, eased);
      if (progress === 1) activeTween = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(animate);
  const visualReady = archviz.load(visualSource);

  return {
    scene, camera, renderer, groups, load, loadVisual, setView, setPreset, setLighting, visualReady,
    dispose() {
      destroyed = true;
      loadRevision += 1;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      archviz.dispose();
      GROUPS.filter((name) => name !== "accessibility").forEach((name) => clearGroup(groups[name]));
      clearGroupExcept(groups.accessibility, validatorOverlay);
      clearGroup(validatorOverlay, { disposeMaterials: true });
      groups.accessibility.remove(validatorOverlay);
      environment.dispose();
      renderer.dispose();
      disposeStylePreset(style);
      container.replaceChildren();
    },
  };
}
