# ROOM/50 validation report format

Status: **Draft v0.1 — requires Ivan, Chloe, and Gogo sign-off before implementation freeze.**

This document defines `validation-report.json`, written by the geometry validator and read by the website validation panel and the evidence overlay.

The report describes measured geometry. It must not repeat unverified claims from `scene-brief.json` as if they were validator results.

## Conventions

- Report format version: `1.0.0`.
- Coordinates use `[x, z]` in metres.
- The horizontal plane is `xz`; `y` is vertical.
- The origin is the shell centre at finished-floor level.
- Rotations, when reported, are radians around `+y` using the right-hand rule.
- Numeric measurements must be JSON numbers, not formatted strings.
- `status` is always `pass` or `fail`.
- `severity` describes the consequence of a failed check:
  - `error`: blocks overall validation;
  - `warning`: is reported but does not block overall validation.
- `overallStatus` is `fail` when at least one `error` check fails. Warning-only failures leave it at `pass`.
- A passing check has an empty `violationGeometry` array.
- `evidenceGeometry` contains validator-derived geometry for both passing and failing checks, allowing the overlay to render green as well as red evidence.
- Array order must be deterministic. Checks use the canonical order listed below; object ids and violation ids are lexically sorted where order has no geometric meaning.

## Top-level document

```json
{
  "reportVersion": "1.0.0",
  "validatorVersion": "0.1.0",
  "generatedAt": "2026-07-18T12:00:00.000Z",
  "source": {
    "sceneBriefSchemaVersion": "1.0.0",
    "contractId": "room50-accessible-cafe-v1",
    "label": "ROOM/50 accessible cafe candidate"
  },
  "coordinateSystem": {
    "horizontalPlane": "xz",
    "verticalAxis": "y-up",
    "origin": "shell-centre-at-finished-floor",
    "units": "metres"
  },
  "summary": {
    "overallStatus": "fail",
    "total": 6,
    "passed": 4,
    "failedErrors": 1,
    "failedWarnings": 1
  },
  "checks": []
}
```

### Required top-level fields

| Field | Type | Meaning |
|---|---|---|
| `reportVersion` | string | Version of this report interface. Initially `1.0.0`. |
| `validatorVersion` | string | Version of the validator implementation that produced the report. |
| `generatedAt` | string | ISO 8601 UTC timestamp. |
| `source` | object | Identity of the scene brief and scenario contract. |
| `coordinateSystem` | object | Fixed coordinate convention used by every geometry item. |
| `summary` | object | Derived counts and overall result. Consumers must not recalculate with different rules. |
| `checks` | array | One result per executed check. |

`source` must not include a browser-local `blob:` URL. A CLI may add an optional `fileName`, but consumers must treat it as display metadata rather than a stable identifier.

## Check result

Every check has the following shape:

```json
{
  "checkId": "routeWidth",
  "status": "fail",
  "severity": "error",
  "message": "The declared route narrows to 1.05 m near table-b3.",
  "measured": {
    "minimumClearWidthM": 1.05,
    "bottleneck": [0.85, 0.4],
    "allStopsConnected": true
  },
  "required": {
    "minimumClearWidthM": 1.2
  },
  "evidenceGeometry": [],
  "violationGeometry": []
}
```

### Required check fields

| Field | Type | Meaning |
|---|---|---|
| `checkId` | string | Stable machine id. Never use a translated display label here. |
| `status` | `pass \| fail` | Result of the measured check. |
| `severity` | `error \| warning` | Impact if this check fails. |
| `message` | string | Short human-readable explanation suitable for the website and CLI. |
| `measured` | object | Validator-derived values. The object may vary by check, but its keys are stable for that `checkId`. |
| `required` | object | Thresholds taken from the canonical scene contract, not copied blindly from candidate geometry. |
| `evidenceGeometry` | geometry[] | Geometry demonstrating what was checked; may be present on pass or fail. |
| `violationGeometry` | geometry[] | The failing subset or conflict geometry; empty on pass. |

Consumers should use `checkId`, `status`, and `severity` for logic. `message` is for display and may change without a report-version bump.

## Canonical checks

Checks appear in this order:

1. `boundary`
2. `routeWidth`
3. `turningZones`
4. `counterHeight`
5. `kneeClearance`
6. `seatCount`

Future checks may be appended without changing existing ids. Adding or renaming fields inside an existing check's `measured` or `required` object requires a report-format version review.

### `boundary`

```json
{
  "checkId": "boundary",
  "status": "fail",
  "severity": "error",
  "message": "1 object is outside the shell and 1 unintended intersection was found.",
  "measured": {
    "outsideObjectIds": ["chair-07"],
    "intersections": [
      { "objectIds": ["chair-03", "table-b3"] }
    ]
  },
  "required": {
    "shellLengthM": 10,
    "shellWidthM": 5,
    "outsideObjectCount": 0,
    "unintendedIntersectionCount": 0
  },
  "evidenceGeometry": [],
  "violationGeometry": [
    {
      "id": "boundary-chair-07",
      "type": "polygon",
      "points": [[4.8, 2.2], [5.2, 2.2], [5.2, 2.6], [4.8, 2.6]],
      "objectIds": ["chair-07"],
      "label": "Object footprint outside shell"
    }
  ]
}
```

Object-object intersection must account for vertical intervals as well as oriented `xz` footprints. Touching within the validator's documented numerical tolerance is not penetration. Explicit `allowOverlapWith` exemptions must be resolved symmetrically.

### `routeWidth`

```json
{
  "checkId": "routeWidth",
  "status": "fail",
  "severity": "error",
  "message": "The declared route narrows to 1.05 m near table-b3.",
  "measured": {
    "minimumClearWidthM": 1.05,
    "bottleneck": [0.85, 0.4],
    "routeConnected": true,
    "allStopsConnected": true,
    "toleranceM": 0.05,
    "conflictingObjectIds": ["table-b3"],
    "stops": [
      {
        "stage": "entrance",
        "pointIndex": 0,
        "point": [-3.3, 2.4],
        "target": { "collection": "doors", "id": "entrance-door" },
        "distanceM": 0,
        "connected": true
      },
      {
        "stage": "ordering",
        "pointIndex": 1,
        "point": [1.4, -0.3],
        "target": { "collection": "objects", "id": "lowered-counter" },
        "distanceM": 0.42,
        "connected": true
      },
      {
        "stage": "pick-up",
        "pointIndex": 2,
        "point": [2.5, -0.3],
        "target": { "collection": "objects", "id": "pickup-counter" },
        "distanceM": 0.4,
        "connected": true
      },
      {
        "stage": "accessible-seat",
        "pointIndex": 3,
        "point": [-0.5, 0.9],
        "target": { "collection": "seats", "id": "wheelchair-position-01" },
        "distanceM": 0,
        "connected": true
      },
      {
        "stage": "accessible-wc",
        "pointIndex": 4,
        "point": [-3.5, -0.2],
        "target": { "collection": "doors", "id": "wc-door" },
        "distanceM": 0,
        "connected": true
      }
    ]
  },
  "required": {
    "minimumClearWidthM": 1.2,
    "maximumStopDistanceM": 0.6,
    "allStopsConnected": true,
    "requiredStages": ["entrance", "ordering", "pick-up", "accessible-seat", "accessible-wc"]
  },
  "evidenceGeometry": [
    {
      "id": "route-centerline",
      "type": "polyline",
      "points": [[-3.3, 2.4], [1.4, -0.3], [2.5, -0.3], [-0.5, 0.9], [-3.5, -0.2]],
      "label": "Validated route centerline"
    }
  ],
  "violationGeometry": [
    {
      "id": "route-bottleneck",
      "type": "segment",
      "from": [0.325, 0.4],
      "to": [1.375, 0.4],
      "objectIds": ["table-b3"],
      "label": "1.05 m bottleneck"
    }
  ]
}
```

The validator resolves every stop target against the collection named in `scene-brief.json`. Runtime validation requires `doors` for `entrance` and `accessible-wc`, `objects` for `ordering` and `pick-up`, and `seats` for `accessible-seat`.

A stop is connected when its centerline point is no more than `0.6 m` from the referenced target geometry. Distance is measured to the target footprint or door opening segment, and to the marker point for a seat. This threshold is half of the required 1.2 m route width, so the route can approach a solid service object without passing through it.

If any target reference is missing or uses the wrong collection, treat the scene brief as invalid input and exit with code `2`. If the reference is valid but its stop is farther than `0.6 m`, set `allStopsConnected` to `false` and fail `routeWidth` as a geometry result.

If no continuous route exists, set `routeConnected` to `false`, set `minimumClearWidthM` to `0`, and return the last reachable route portion as evidence. JSON `null`, `NaN`, and `Infinity` must not be used as numeric measurements.

### `turningZones`

```json
{
  "checkId": "turningZones",
  "status": "pass",
  "severity": "error",
  "message": "All 3 required turning zones have 1.5 m collision-free diameter.",
  "measured": {
    "clearCount": 3,
    "requiredCount": 3,
    "zones": [
      { "id": "turn-entry", "at": "entrance", "diameterM": 1.5, "clear": true, "conflictingObjectIds": [] },
      { "id": "turn-counter", "at": "service-counter", "diameterM": 1.5, "clear": true, "conflictingObjectIds": [] },
      { "id": "turn-wc", "at": "accessible-wc", "diameterM": 1.5, "clear": true, "conflictingObjectIds": [] }
    ]
  },
  "required": {
    "diameterM": 1.5,
    "locations": ["entrance", "service-counter", "accessible-wc"]
  },
  "evidenceGeometry": [
    {
      "id": "turn-entry-circle",
      "type": "circle",
      "center": [-3.3, 1.55],
      "radiusM": 0.75,
      "label": "Entrance turning zone"
    }
  ],
  "violationGeometry": []
}
```

The actual circle-to-shell and circle-to-obstacle clearances determine the result; a declared `diameterM: 1.5` does not prove that the zone is clear.

### `counterHeight`

```json
{
  "checkId": "counterHeight",
  "status": "pass",
  "severity": "error",
  "message": "The lowered counter top is 0.76 m above finished floor.",
  "measured": {
    "objectId": "lowered-counter",
    "topHeightM": 0.76
  },
  "required": {
    "maximumTopHeightM": 0.76
  },
  "evidenceGeometry": [],
  "violationGeometry": []
}
```

The validator should normally calculate `topHeightM` as `elevationM + bbox.h`. It must not assume `bbox.h` alone is the height above finished floor unless `elevationM` is zero.

### `kneeClearance`

```json
{
  "checkId": "kneeClearance",
  "status": "fail",
  "severity": "error",
  "message": "The table declares sufficient height, but its knee-clearance volume intersects table-leg-east.",
  "measured": {
    "tableObjectId": "accessible-table",
    "wheelchairSeatId": "wheelchair-position-01",
    "clearHeightM": 0.72,
    "volumeCollisionFree": false,
    "conflictingObjectIds": ["table-leg-east"]
  },
  "required": {
    "minimumClearHeightM": 0.7,
    "volumeCollisionFree": true
  },
  "evidenceGeometry": [
    {
      "id": "accessible-table-knee-volume",
      "type": "polygon",
      "points": [[-1.0, 0.4], [-0.2, 0.4], [-0.2, 1.0], [-1.0, 1.0]],
      "objectIds": ["accessible-table"],
      "label": "Knee-clearance footprint"
    }
  ],
  "violationGeometry": [
    {
      "id": "knee-volume-collision",
      "type": "polygon",
      "points": [[-0.3, 0.5], [-0.2, 0.5], [-0.2, 0.6], [-0.3, 0.6]],
      "objectIds": ["table-leg-east"],
      "label": "Knee-clearance obstruction"
    }
  ]
}
```

### `seatCount`

```json
{
  "checkId": "seatCount",
  "status": "fail",
  "severity": "warning",
  "message": "13 capacity seats are modeled; the target range is 14–18.",
  "measured": {
    "count": 13,
    "accessibleSeatCount": 1
  },
  "required": {
    "minimum": 14,
    "maximum": 18,
    "minimumAccessibleSeatCount": 1
  },
  "evidenceGeometry": [],
  "violationGeometry": []
}
```

Only seats with `countsTowardCapacity: true` contribute to `count`. Seat-count failure is a warning because route and clearance take priority.

## Geometry union

Every item in `evidenceGeometry` or `violationGeometry` requires:

- `id`: unique within the report;
- `type`: one of `point`, `segment`, `polyline`, `polygon`, or `circle`;
- optional `label`: human-readable display text;
- optional `objectIds`: scene object ids related to the geometry.

Type-specific fields are:

```json
[
  { "id": "g1", "type": "point", "point": [0, 0] },
  { "id": "g2", "type": "segment", "from": [0, 0], "to": [1, 0] },
  { "id": "g3", "type": "polyline", "points": [[0, 0], [1, 0], [1, 1]] },
  { "id": "g4", "type": "polygon", "points": [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { "id": "g5", "type": "circle", "center": [0, 0], "radiusM": 0.75 }
]
```

Rules:

- A `segment` must have distinct endpoints.
- A `polyline` must have at least two points.
- A `polygon` must have at least three points. Do not repeat the first point at the end; consumers close it automatically.
- A circle radius must be positive.
- Geometry must contain finite coordinates inside a reasonable envelope around the shell.
- Renderers choose colour and line style from check `status` and `severity`; reports must not contain presentation colours.
- Geometry ids must be deterministic for the same source geometry.

## Invalid input

Malformed or semantically inconsistent `scene-brief.json` is a CLI/input error, not a geometry check failure. The CLI should:

1. print a concise input error;
2. exit with code `2`;
3. not write a normal `validation-report.json` that could be mistaken for completed validation.

Semantic input checks include globally unique ids, valid cross-references, stage-appropriate route stop target collections, finite numbers, strictly increasing in-range route stop indexes, symmetric overlap exemptions, and consistent clearance references.

## CLI exit codes

| Exit code | Meaning |
|---|---|
| `0` | All `error` checks pass; warning failures may be present. |
| `1` | At least one `error` check fails. A report is written. |
| `2` | Usage, JSON, schema, or semantic input error. No normal report is written. |

## Versioning

- Patch: wording or examples that do not alter machine-readable fields.
- Minor: optional additive fields or new check ids/geometry types.
- Major: renamed/removed fields, changed status semantics, or changed geometry representation.

The website and overlay should reject unsupported major versions and may ignore unknown optional fields from a newer minor version.

## Decisions required before v1.0 freeze

1. Confirm that `severity` is accepted in addition to the task-board minimum fields.
2. Confirm that `evidenceGeometry` is accepted so passed checks can produce green overlay evidence; `violationGeometry` alone only supports failures.
3. Confirm the six canonical check ids and their order.
4. Confirm that warning-only reports have `overallStatus: pass` and CLI exit code `0`.
5. Confirm whether `generatedAt` is required or optional for deterministic fixture snapshots.
6. Confirm whether door width becomes a seventh validator check in v1.0 or is deferred beyond Chloe's P0 task list.
7. Confirm the `0.6 m` maximum route-stop distance and the stage-to-target collection mapping shared with `scene-brief.schema.json`.
