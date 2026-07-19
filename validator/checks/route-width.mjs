import { EPSILON_M } from "../geometry/constants.mjs";
import { scanDeclaredRoute } from "../geometry/route-scan.mjs";
import { validateRouteStopConnections } from "../route/stop-connections.mjs";

const REQUIRED_STAGES = Object.freeze([
  "entrance",
  "ordering",
  "pick-up",
  "accessible-seat",
  "accessible-wc",
]);

function polylineGeometry(scene) {
  return Object.freeze({
    id: "route-centerline",
    type: "polyline",
    points: scene.route.points,
    label: "Checked declared route centerline",
  });
}

function bottleneckGeometry(bottleneck, minimumClearWidthM) {
  if (
    Math.hypot(
      bottleneck.from[0] - bottleneck.to[0],
      bottleneck.from[1] - bottleneck.to[1],
    ) <= EPSILON_M
  ) {
    return Object.freeze({
      id: "route-bottleneck",
      type: "point",
      point: bottleneck.point,
      objectIds: bottleneck.limitingObjectIds,
      label: "Declared route intersects an obstacle",
    });
  }
  return Object.freeze({
    id: "route-bottleneck",
    type: "segment",
    from: bottleneck.from,
    to: bottleneck.to,
    objectIds: bottleneck.limitingObjectIds,
    label: `${minimumClearWidthM} m declared-route bottleneck`,
  });
}

function cornerViolationGeometry(vertex, minimumRadiusM) {
  return Object.freeze({
    id: `route-corner-clearance-${vertex.pointIndex}`,
    type: "circle",
    center: vertex.point,
    radiusM: minimumRadiusM,
    objectIds: vertex.conflictingObjectIds,
    label: `Declared-route corner ${vertex.pointIndex} requires ${minimumRadiusM} m radial clearance`,
  });
}

export function validateRouteWidth(scene) {
  const scan = scanDeclaredRoute(scene);
  const connections = validateRouteStopConnections(scene);
  const minimumClearWidthM = scan.routeConnected ? scan.bottleneck.widthM : 0;
  const minimumRadiusM = scene.thresholds.routeMinimumClearWidthM / 2;
  const failedVertices = scan.vertexClearances.filter(
    (vertex) => vertex.clearanceM < minimumRadiusM - EPSILON_M,
  );
  const widthPasses = minimumClearWidthM >= scene.thresholds.routeMinimumClearWidthM - EPSILON_M;
  const failed =
    !scan.routeConnected ||
    !connections.allStopsConnected ||
    !widthPasses ||
    failedVertices.length > 0;
  const bottleneckFailed = !scan.routeConnected || !widthPasses;
  const conflictingObjectIds = Object.freeze(
    [...new Set([
      ...(bottleneckFailed ? scan.bottleneck.limitingObjectIds : []),
      ...(bottleneckFailed ? scan.bottleneck.collidingObjectIds : []),
      ...failedVertices.flatMap((vertex) => vertex.conflictingObjectIds),
    ])].sort(),
  );

  let message;
  if (!scan.routeConnected) {
    message = "The declared route leaves the shell or intersects an obstacle.";
  } else if (!connections.allStopsConnected) {
    message = "The declared route does not connect all required functional stops.";
  } else if (failedVertices.length > 0) {
    message = `The declared route has insufficient radial clearance at ${failedVertices.length} corner(s).`;
  } else if (!widthPasses) {
    message = `The declared route narrows to ${minimumClearWidthM} m.`;
  } else {
    message = `The declared route maintains at least ${scene.thresholds.routeMinimumClearWidthM} m clear width and connects all required stops.`;
  }

  const violationGeometry = failed
    ? [
        ...(bottleneckFailed ? [bottleneckGeometry(scan.bottleneck, minimumClearWidthM)] : []),
        ...failedVertices.map((vertex) => cornerViolationGeometry(vertex, minimumRadiusM)),
        ...connections.violationGeometry,
      ]
    : [];

  return Object.freeze({
    checkId: "routeWidth",
    status: failed ? "fail" : "pass",
    severity: "error",
    message,
    measured: Object.freeze({
      minimumClearWidthM,
      bottleneck: scan.bottleneck.point,
      routeConnected: scan.routeConnected,
      allStopsConnected: connections.allStopsConnected,
      sampleSpacingM: scan.sampleSpacingM,
      minimumCornerClearanceM: scan.vertexClearances.length > 0
        ? Math.min(...scan.vertexClearances.map((vertex) => vertex.clearanceM))
        : minimumRadiusM,
      cornerClearances: Object.freeze(scan.vertexClearances.map((vertex) => Object.freeze({
        ...vertex,
        clear: vertex.clearanceM >= minimumRadiusM - EPSILON_M,
      }))),
      conflictingObjectIds,
      stops: connections.stops,
    }),
    required: Object.freeze({
      minimumClearWidthM: scene.thresholds.routeMinimumClearWidthM,
      minimumCornerClearanceM: minimumRadiusM,
      maximumStopDistanceM: connections.maximumDistanceM,
      allStopsConnected: true,
      requiredStages: REQUIRED_STAGES,
    }),
    evidenceGeometry: Object.freeze([
      polylineGeometry(scene),
      ...connections.evidenceGeometry,
    ]),
    violationGeometry: Object.freeze(violationGeometry),
  });
}
