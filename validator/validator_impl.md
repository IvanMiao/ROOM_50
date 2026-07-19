# ROOM/50 validator implementation plan

Status: **Implementation draft**

This plan turns `agent/scene-brief.schema.json` into a deterministic, render-free geometry validator that writes the `validation-report.json` contract defined in `validator/report-format.md`.

The validator is successful when geometry, rather than builder-authored labels or screenshots, determines whether the café model passes.

## Scope and boundaries

The validator:

- runs in Node.js without DOM, Three.js, WebGL, or browser state;
- reads one `scene-brief.json` candidate;
- validates structural and runtime semantic requirements;
- calculates six checks in canonical order;
- writes `validation-report.json` for the CLI, website, and overlay;
- exits predictably for pass, geometry failure, and invalid input.

The validator does not:

- generate or repair geometry;
- infer geometry from `scene.js`, a screenshot, or a GLB;
- certify legal or local-code compliance;
- choose presentation colours or render evidence;
- silently repair malformed scene briefs.

## Proposed file layout

```text
validator/
├── cli.mjs
├── index.mjs
├── report-format.md
├── validator_impl.md
├── input/
│   ├── parse.mjs
│   ├── semantic-validation.mjs
│   └── normalize.mjs
├── geometry/
│   ├── constants.mjs
│   ├── vector.mjs
│   ├── obb.mjs
│   ├── collision.mjs
│   ├── distance.mjs
│   └── route-scan.mjs
├── checks/
│   ├── boundary.mjs
│   ├── route-width.mjs
│   ├── turning-zones.mjs
│   ├── counter-height.mjs
│   ├── knee-clearance.mjs
│   └── seat-count.mjs
├── report/
│   └── build-report.mjs
├── fixtures/
│   ├── pass.json
│   └── fail.json
└── test/
    ├── helpers.mjs
    ├── input.test.mjs
    ├── geometry.test.mjs
    ├── checks.test.mjs
    ├── report.test.mjs
    └── fixtures.test.mjs
```

Use Node's built-in `node:test` and `node:assert/strict`. Keep the validator dependency-free for P0. If full JSON Schema evaluation with Ajv is later required, adding Ajv to the root package remains a cross-workstream decision.

## Global validation rules

These rules apply to every implementation step:

- All coordinates and dimensions are finite numbers in metres.
- Horizontal points use `[x, z]`; `y` is vertical.
- The shell occupies `x = [-5, 5]` and `z = [-2.5, 2.5]`.
- Object `position` is the centre of its oriented footprint.
- Object vertical interval is `[elevationM, elevationM + bbox.h]`; omitted `elevationM` normalizes to `0`.
- Rotations are radians around `+y` using the right-hand rule.
- Numerical comparisons use a shared `EPSILON_M`, initially `1e-6`.
- Route scanning uses a documented sample spacing of at most `0.05 m`.
- Output ordering is deterministic.
- Tests do not depend on object-array insertion order.
- The same candidate geometry produces the same check results. Timestamp testing uses an injected clock.

## Step 1 — Establish the executable and test harness

### Implementation

Create the validator modules, a minimal `cli.mjs`, and a test command that can run directly with Node:

```bash
node --test validator/test/*.test.mjs
node validator/cli.mjs path/to/scene-brief.json
```

`cli.mjs` should parse arguments but may initially return a clear "not implemented" result after successfully reading a file.

Ivan owns the root-package integration needed for the final convenience command:

```json
{
  "scripts": {
    "validate": "node validator/cli.mjs"
  }
}
```

### Verification

- Run the Node version check and confirm it satisfies the repository engine range.
- Run an empty smoke test through `node --test`.
- Run the CLI with no argument, a missing file, and a valid JSON file.
- Confirm no Three.js, DOM, Vite, or network import appears under `validator/`.

### Validation requirements

- No argument exits `2` and prints usage.
- Missing file exits `2` and names the unresolved path.
- A syntactically valid JSON file reaches the next validation stage.
- Test output is non-interactive and CI-safe.

### Intended effect

The validator becomes independently executable before any geometry logic exists. Later checks can be added without changing how callers invoke it.

### Completion gate

Do not proceed until a clean checkout can execute the test harness without starting Vite or a browser.

## Step 2 — Parse and semantically validate scene briefs

### Implementation

Implement two layers:

1. Structural validation against the fixed fields and constants in `agent/scene-brief.schema.json`.
2. Runtime semantic validation for relationships JSON Schema does not fully enforce.

Runtime checks include:

- globally unique ids across objects, seats, turning zones, and doors;
- every `seat.objectId` resolves to an object;
- service-counter object references resolve;
- accessible-table object and wheelchair-seat references resolve;
- `allowOverlapWith` references resolve and behave symmetrically;
- route stop indexes are strictly increasing and in range;
- route target ids resolve in the declared collection;
- stage-to-target mapping is:
  - entrance → doors;
  - ordering → objects;
  - pick-up → objects;
  - accessible-seat → seats;
  - accessible-wc → doors;
- entrance targets a door with `at: entrance` and `stepFree: true`;
- ordering targets `serviceCounter.loweredSegmentObjectId`;
- accessible-seat targets `accessibleTable.wheelchairSeatId`, whose seat is an accessible wheelchair position;
- accessible-wc targets a door with `at: accessible-wc`;
- all numeric values are finite; JSON values that become `NaN` or `Infinity` internally are rejected.

Return structured input errors containing a stable error code, JSON-style path, and concise message.

### Verification

Create table-driven tests that mutate one valid minimal brief at a time:

- duplicate an id;
- remove `collision`;
- reference a missing object;
- use `seats` for the ordering target;
- repeat or reverse a route stop index;
- use a point index beyond `centerline.length - 1`;
- put a string in a coordinate;
- use the wrong contract or schema version.

### Validation requirements

- Every malformed candidate exits `2`.
- No normal `validation-report.json` is written for invalid input.
- Each test receives the expected stable error code and field path.
- Two or more semantic errors may be collected, but output ordering must remain deterministic.

### Intended effect

All geometry checks receive trustworthy references, finite numbers, and a stable coordinate system. Geometry failures remain distinct from broken handoff data.

### Completion gate

Do not implement geometry checks until invalid references can no longer reach them.

## Step 3 — Normalize external data into an internal scene model

### Implementation

Create one adapter:

```text
normalizeSceneBrief(sceneBrief) → NormalizedScene
```

The normalized model should contain:

- explicit shell bounds;
- object maps keyed by id;
- seat and door maps keyed by id;
- normalized elevation values;
- OBB-ready object footprints;
- precomputed vertical intervals;
- symmetric overlap-exemption pairs;
- ordered route points and resolved stop targets;
- accessibility thresholds copied from the canonical contract fields.

Checks must consume `NormalizedScene`, not raw external field paths.

### Verification

- Normalize the same brief with objects in different array orders.
- Compare normalized maps, sorted ids, shell bounds, and route stops.
- Verify `elevationM` omission becomes exactly `0`.
- Verify a one-sided overlap declaration produces a symmetric normalized pair.
- Serialize a debug representation twice and compare it byte-for-byte, excluding no fields.

### Validation requirements

- Reordering input arrays does not change normalized meaning.
- Normalization never mutates the input object.
- No schema default is assumed to have been injected by an external library.
- Thresholds used by checks are explicit in the normalized result.

### Intended effect

Ivan can evolve external serialization in a future schema version without forcing geometry algorithms to understand multiple field layouts.

### Completion gate

Every check test must be able to construct or receive a `NormalizedScene` without loading a JSON file.

## Step 4 — Implement and prove geometry primitives

### Implementation

Implement pure functions for:

- vector addition, subtraction, dot product, normalization, and distance;
- OBB corner generation from centre, width, depth, and rotation;
- projections and Separating Axis Theorem intersection;
- point-to-segment and point-to-OBB distance;
- closest point on an OBB;
- circle-to-OBB intersection;
- vertical interval overlap;
- line/ray intersection with OBB edges and shell edges;
- polygon evidence generation.

All functions must avoid global state and return finite values or explicit errors.

### Verification

Test at minimum:

- rotations `0`, `π/4`, `π/2`, and negative rotation;
- identical boxes;
- separated boxes;
- boxes with positive penetration;
- boxes whose edges only touch;
- boxes whose `xz` footprints overlap but vertical intervals do not;
- point inside, on the edge of, and outside an OBB;
- circle tangent to, intersecting, and clear of an OBB;
- symmetry: `intersects(a, b) === intersects(b, a)`;
- translation invariance and rotation invariance within tolerance.

### Validation requirements

- Touching within `EPSILON_M` is not reported as penetration.
- Positive penetration beyond `EPSILON_M` is detected.
- Distance functions never return negative values.
- Geometry functions do not round intermediate calculations for display.
- Evidence polygon points follow one consistent winding order.

### Intended effect

All higher-level checks share one tested geometric meaning of boundary, distance, overlap, and rotation. This prevents each check from implementing subtly different collision rules.

### Completion gate

Do not implement route scanning until rotated OBB distance and intersection tests pass.

## Step 5 — Implement `boundary`

### Implementation

For every object:

1. Generate its four rotated footprint corners.
2. Confirm all corners are within the 10 × 5 m shell.
3. Confirm its vertical interval remains within finished floor and the 3.2 m clear-height shell.
4. Compare every relevant object pair.
5. Report unintended intersection only when their OBB footprints and vertical intervals both overlap beyond tolerance.
6. Skip a pair when either object explicitly allows overlap with the other.

`collision.obstacle: false` excludes an object from route and clearance obstruction, but does not automatically exempt it from shell or object-object checks.

### Verification

- Place a rotated chair fully inside the shell.
- Move one corner 1 cm outside the shell.
- Stack a counter top above a cabinet without vertical penetration.
- Move the top down until vertical penetration occurs.
- Test a permitted overlap declared by only one member of a pair.
- Shuffle object order and confirm identical result ordering.

### Validation requirements

- Inside objects produce `status: pass` and no violation geometry.
- Outside objects list stable `outsideObjectIds` and footprint polygons.
- Intersections report sorted two-id pairs with no duplicates.
- Vertical separation prevents a false-positive collision.
- Passing `violationGeometry` is empty.

### Intended effect

The validator proves the true 50 m² boundary is respected and detects unintended solid intersections without penalizing valid stacked assemblies.

### Completion gate

The exact outside object and collision pair must be visible in a report snapshot.

## Step 6 — Implement `turningZones`

### Implementation

For each required 1.5 m turning zone:

1. Use the declared centre and a `0.75 m` radius.
2. Confirm the complete circle lies inside the shell.
3. Test the circle against every object with `collision.obstacle: true`.
4. Return per-zone clear status and conflicting object ids.
5. Emit a circle in `evidenceGeometry`; emit the failed circle and obstacle polygons in `violationGeometry`.

### Verification

- Test one circle centred in empty space.
- Test shell-edge distances of `0.76`, `0.75`, and `0.74 m`.
- Test tangent, 1 cm penetration, and 1 cm clearance against a rotated object.
- Test an overlapping object with `obstacle: false`.
- Independently fail entrance, counter, and WC zones.

### Validation requirements

- Exactly three zone results are reported in canonical location order.
- A tangent circle passes within tolerance; measurable penetration fails.
- Non-obstacle objects do not cause turning-zone failure.
- `clearCount` equals the number of clear zone entries.
- All circles use validator-derived radius, not presentation geometry.

### Intended effect

The three visible turning circles become measured collision-free areas instead of decorative overlays authored by the builder.

### Completion gate

Gogo must be able to render both a passing green circle and a failing red circle directly from one report fixture.

## Step 7 — Implement counter, knee-clearance, and seat checks

### Implementation

#### `counterHeight`

Resolve `loweredSegmentObjectId` and calculate:

```text
topHeightM = elevationM + bbox.h
```

Pass when `topHeightM <= 0.76 m` within numerical tolerance.

#### `kneeClearance`

- Treat the declared knee-clearance bbox as a volume from finished floor to `bbox.h`.
- Confirm `bbox.h >= 0.7 m`.
- Test its OBB footprint and vertical interval against obstacle objects.
- Exclude `tableObjectId` itself; separately modeled table legs remain obstacles unless explicitly exempted.

#### `seatCount`

- Count only entries with `countsTowardCapacity: true`.
- Count accessible wheelchair positions independently.
- Use `severity: warning` when total capacity is outside 14–18.
- Missing required accessible-seat data is an invalid input under the schema, not a seat warning.

### Verification

- Counter top heights: `0.75`, `0.76`, and `0.77 m`.
- Elevated counter segment: verify height uses elevation plus bbox height.
- Knee heights: `0.69`, `0.70`, and `0.71 m`.
- Knee volume with no collision, with a table self-reference, and with a separate leg obstruction.
- Seat totals: `13`, `14`, `18`, and `19`.
- A warning-only set of results must leave overall validation eligible to pass.

### Validation requirements

- Threshold equality passes.
- Counter and knee failures have `severity: error`.
- Seat-range failure has `severity: warning`.
- A 13-seat warning does not turn `overallStatus` to fail by itself.
- Conflicting knee-clearance object ids are stable and sorted.

### Intended effect

Critical usable dimensions block acceptance, while lower-priority capacity remains visible without overriding accessibility priorities.

### Completion gate

Each of the three checks must have independent threshold tests and report-shape assertions.

## Step 8 — Validate route-stop connections

### Implementation

Resolve each route stop target and calculate distance from its centreline point:

- object target: distance to the target OBB footprint;
- seat target: Euclidean distance to the seat marker;
- door target: distance to the door opening segment derived from position, rotation, and clear width.

The door opening segment follows the door's rotated local x axis. Stop-connection output also records whether an object target strictly contains its stop point so Step 9 can demonstrate that zero target distance does not bypass route collision checks.

A valid target at more than `0.6 m` is a geometry failure with `connected: false`. A missing target or wrong collection is an input error from Step 2.

### Verification

For every stage, test:

- correct collection and existing id;
- wrong collection;
- missing id;
- wrong functional target within the correct collection;
- distances `0`, `0.59`, `0.60`, and `0.61 m`;
- rotated object and rotated door targets;
- route points that lie inside a solid target, which must not be accepted merely because distance is zero if the route itself collides.

### Validation requirements

- Five stops are reported in canonical sequence.
- Entrance, ordering, accessible-seat, and accessible-wc are bound to their declared accessible features before distance is measured.
- All stop measurements include stage, point index, point, target, distance, and connected state.
- Exactly `0.6 m` passes within tolerance.
- `allStopsConnected` is the conjunction of all five connected states.
- Stop connection cannot override a route collision or insufficient route width.

### Intended effect

The builder can no longer prove the required journey by attaching five stage names to arbitrary points. Each stage must be spatially connected to its real modeled function.

### Completion gate

A fixture with a correctly labelled but spatially remote pick-up stop must fail `routeWidth`.

## Step 9 — Implement `routeWidth`

### Implementation

Validate the declared centreline rather than generating an alternative route.

1. Reject zero-length consecutive route segments as invalid input.
2. Resample every segment at intervals no greater than `0.05 m`, including vertices and endpoints.
3. At each sample, calculate the local tangent and left/right normal.
4. Find the nearest shell boundary or obstacle OBB along each normal.
5. Calculate local clear width as left clearance plus right clearance.
6. Test vertices with radial clearance as well, so sharp corners cannot cut through an obstacle between segment normals.
7. The smallest valid local width is `minimumClearWidthM`; retain its coordinate and cross-section segment.
8. Fail if the centreline intersects an obstacle, leaves the shell, is disconnected, has any stop farther than `0.6 m`, or has minimum width below `1.2 m`.
9. Emit the checked centreline in `evidenceGeometry` and the bottleneck segment in `violationGeometry` when it fails.

This is a deterministic declared-route scan. It does not claim that no alternative route exists elsewhere in the room.

### Verification

- Empty-room straight route.
- Axis-aligned corridor widths `1.05`, `1.19`, `1.20`, and `1.21 m`.
- The same widths with both corridor objects rotated.
- A centreline that intersects a table.
- A centreline that exits the shell and re-enters.
- A polyline with a sharp corner close to an obstacle.
- A route with all width checks passing but a remote pick-up stop.
- Reverse irrelevant object order and confirm identical bottleneck.
- Run the same fixture repeatedly and compare all results except injected timestamp metadata.

### Validation requirements

- The fail fixture reports approximately `1.05 m` within the documented scan tolerance.
- A modeled `1.20 m` corridor passes at the agreed numerical boundary.
- The reported bottleneck lies on the declared centreline.
- The bottleneck segment endpoints describe the measured cross-section.
- `conflictingObjectIds` identifies the object or objects forming the obstruction.
- `routeConnected` and `allStopsConnected` are independent fields.
- Report wording says "declared route" and does not claim global path impossibility.

### Intended effect

The central demo claim becomes measurable: moving B3 changes a validator-computed bottleneck from 1.05 m failure to at least 1.2 m success.

### Completion gate

Do not integrate with the website until fail-to-pass geometry changes produce the expected numeric report without editing validator thresholds.

## Step 10 — Build the report and CLI result semantics

### Implementation

Run checks in canonical order:

1. `boundary`
2. `routeWidth`
3. `turningZones`
4. `counterHeight`
5. `kneeClearance`
6. `seatCount`

Build the top-level summary, inject the clock for `generatedAt`, write JSON atomically, and print a concise terminal summary. Structured `measured` and `required` objects remain objects; the CLI must format them explicitly rather than coercing them to strings.

Exit codes are:

- `0`: no failed error check;
- `1`: one or more failed error checks, report written;
- `2`: usage, parse, schema, or semantic input error, no normal report written.

Respect `NO_COLOR` and avoid ANSI control sequences when stdout is not interactive.

### Verification

- Snapshot one full pass report and one full fail report with a fixed injected time.
- Parse every emitted report with `JSON.parse`.
- Assert check order and all summary counts.
- Test warning-only, one-error, multiple-error, and invalid-input cases.
- Run with `NO_COLOR=1` and inspect stdout for escape sequences.
- Confirm a failed validation overwrites no unrelated file.

### Validation requirements

- Report fields conform to `report-format.md`.
- Pass checks have empty `violationGeometry`.
- Warning-only report has `overallStatus: pass` and exit `0`.
- Geometry failure writes a report and exits `1`.
- Invalid input writes no normal report and exits `2`.
- No UI receives `[object Object]` from CLI formatting.

### Intended effect

Humans, CI, Codex, Ivan's panel, and Gogo's overlay all receive the same authoritative result with no consumer-specific pass/fail calculation.

### Completion gate

The CLI exit code, JSON summary, and terminal summary must agree for every test case.

## Step 11 — Create the pass/fail fixtures and regression suite

### Implementation

Create two complete, schema-valid scene briefs:

- `fail.json`: B3 constrains the declared route to approximately `1.05 m`; all references remain valid so this is a geometry failure, not an input error.
- `pass.json`: move B3 and sacrifice one capacity seat while retaining 14 seats, so route width reaches at least `1.2 m` and all six checks pass.

Keep all unrelated geometry identical so the demo visibly isolates the spatial trade-off.

### Verification

Run:

```bash
node validator/cli.mjs validator/fixtures/fail.json
node validator/cli.mjs validator/fixtures/pass.json
node --test validator/test/*.test.mjs
```

Compare reports and assert that the intended B3 position and one seat marker are the only meaningful scenario differences.

### Validation requirements

- `fail.json` is schema- and reference-valid, exits `1`, and reports route width near `1.05 m`.
- `pass.json` exits `0`, reports route width at least `1.2 m`, retains 14 capacity seats, and has no failed checks.
- Both reports contain renderable route and turning-zone evidence.
- Repeated runs produce identical check content.

### Intended effect

The fixtures become executable specifications, test inputs, overlay inputs, and the demo narrative: accessibility clearance wins, while capacity remains credible.

### Completion gate

The fail-to-pass sequence must work from a clean checkout using documented commands only.

## Step 12 — Integrate with Ivan and Gogo

### Implementation

Provide both generated reports to the consumers.

Ivan:

- adds the root `validate` package script;
- formats check-specific `measured` and `required` objects rather than directly interpolating them into HTML;
- renders pass/fail plus warning severity from the report summary;
- does not recalculate geometry in the website.

Gogo:

- renders `evidenceGeometry` for passing or failing evidence;
- renders `violationGeometry` only for failures;
- maps `[x, z]` to Three.js `(x, smallOverlayY, z)`;
- derives green/red/yellow styling from status and severity;
- ignores unknown optional fields from compatible report versions.

### Verification

- Run the fail fixture and load its report in both consumers.
- Confirm the website shows a numeric 1.05 m measurement, not `[object Object]`.
- Confirm the overlay bottleneck aligns with B3 in top view.
- Run the pass fixture and confirm green route/turning evidence remains visible even though `violationGeometry` is empty.
- Confirm consumer display does not change CLI exit codes or report JSON.

### Validation requirements

- Website, CLI, and overlay show the same statuses and measurements.
- Consumers use report data and do not trust scene-authored pass labels.
- Overlay geometry aligns in the shared coordinate system.
- Unsupported major report versions fail visibly rather than rendering misleading evidence.

### Intended effect

The project becomes a closed harness: the site issues the contract, the builder produces geometry, the validator decides, and every presentation surface displays the same evidence.

### Completion gate

Ivan and Gogo each confirm one fail report and one pass report work without format-specific patches to the validator.

## Step 13 — Final end-to-end and demo acceptance

### Implementation

Exercise the real loop:

```text
build scene brief
→ validate
→ read failure and bottleneck
→ move B3 / adjust seat
→ validate again
→ render validator evidence
```

Document the exact commands, generated files, and known modeling limitations.

### Verification

- Start from a clean checkout.
- Run the complete fail-to-pass flow without manually editing a report.
- Verify generated reports are fresh and correspond to the selected brief.
- Test invalid input separately to demonstrate exit `2` is not confused with geometry fail.
- Run the repository typecheck/build after root integration.
- Run at least one desktop and 375 px website display check with both reports.

### Validation requirements

- First validation reports the B3 bottleneck and exits `1`.
- Second validation passes and exits `0`.
- All three turning zones are evidenced.
- Counter, knee clearance, seat count, and boundary results are present.
- Report, website panel, and overlay agree.
- Output is labelled `concept demo — not for construction` where presented to users.

### Intended effect

The demo proves the full ROOM/50 thesis: the agent can iterate, but geometry is the independent acceptance authority.

### Completion gate

Record the fallback demo only after the clean-checkout workflow succeeds twice without manual report repair.

## Required test matrix

| Layer | Minimum test class | Required evidence |
|---|---|---|
| Input | invalid JSON, missing fields, bad references, wrong stage target | exit `2`, stable input error, no normal report |
| Normalization | reordered arrays, omitted elevation, symmetric overlap | identical normalized meaning |
| Geometry | rotations, tangency, penetration, vertical separation | pure function assertions |
| Boundary | outside object, allowed overlap, unintended 3D collision | object ids and polygons |
| Turning zones | clear, tangent, obstructed, outside shell | three zone results and circles |
| Counter | below, equal, above threshold | measured top height |
| Knee clearance | below height, clear, obstructed | volume status and collision ids |
| Seats | 13, 14, 18, 19 | warning semantics and capacity count |
| Route targets | missing, wrong collection, near, threshold, far | exit `2` or connected result as appropriate |
| Route width | 1.05, 1.19, 1.20, 1.21, blocked, sharp corner | bottleneck, width, route evidence |
| Report | pass, warning-only, error, invalid input | summary consistency and exit code |
| Integration | fail and pass report in website and overlay | matching red/green evidence |

## Definition of validator done

- The validator runs without rendering or network access.
- Invalid input exits `2` and cannot masquerade as a geometry report.
- Geometry failure exits `1` and writes a complete report.
- Error-free validation exits `0`; warning-only validation remains non-blocking.
- All six checks are present in stable order.
- Rotated bbox and vertical intervals are handled consistently.
- The declared five-stage route is connected to real targets.
- `fail.json` reproduces the approximately 1.05 m B3 bottleneck.
- `pass.json` clears at least 1.2 m and retains 14 seats.
- Evidence and violation geometry can be rendered without reading internal validator state.
- CLI, website, and overlay agree on the result.
- All outputs remain concept evidence, not a regulatory or construction certification.
