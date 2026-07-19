import assert from "node:assert/strict";
import test from "node:test";
import { validateSceneBriefStructure } from "../input/schema-validation.mjs";
import { validateSceneBriefSemantics } from "../input/semantic-validation.mjs";
import { makeValidSceneBrief } from "./helpers.mjs";

function findIssue(issues, code, path) {
  return issues.find((issue) => issue.code === code && issue.path === path);
}

test("canonical test brief passes structural and semantic validation", async () => {
  const candidate = makeValidSceneBrief();

  assert.deepEqual(await validateSceneBriefStructure(candidate), []);
  assert.deepEqual(validateSceneBriefSemantics(candidate), []);
});

test("structure reports a missing collision policy at a stable path", async () => {
  const candidate = makeValidSceneBrief();
  delete candidate.objects[0].collision;

  const issues = await validateSceneBriefStructure(candidate);

  assert.ok(findIssue(issues, "SCHEMA_REQUIRED", "/objects/0/collision"));
});

test("structure rejects a wrong contract constant", async () => {
  const candidate = makeValidSceneBrief();
  candidate.contractId = "another-contract";

  const issues = await validateSceneBriefStructure(candidate);

  assert.ok(findIssue(issues, "SCHEMA_CONST", "/contractId"));
});

test("structure rejects a coordinate with the wrong type", async () => {
  const candidate = makeValidSceneBrief();
  candidate.objects[0].position[0] = "two";

  const issues = await validateSceneBriefStructure(candidate);

  assert.ok(findIssue(issues, "SCHEMA_TYPE", "/objects/0/position/0"));
});

test("structure rejects non-finite numeric values", async () => {
  const candidate = makeValidSceneBrief();
  candidate.objects[0].rotation = Number.POSITIVE_INFINITY;

  const issues = await validateSceneBriefStructure(candidate);

  assert.ok(findIssue(issues, "SCHEMA_TYPE", "/objects/0/rotation"));
});

test("structure rejects additional properties", async () => {
  const candidate = makeValidSceneBrief();
  candidate.unapprovedField = true;

  const issues = await validateSceneBriefStructure(candidate);

  assert.ok(findIssue(issues, "SCHEMA_ADDITIONAL_PROPERTY", "/unapprovedField"));
});

test("structure accepts string and null reference identities", async () => {
  const sampleCandidate = makeValidSceneBrief();
  sampleCandidate.reference = {
    kind: "sample",
    name: "Central-entry plan",
    sampleId: "central-entry",
    sourceUrl: "/assets/plans/central-entry.svg",
  };
  const uploadCandidate = makeValidSceneBrief();
  uploadCandidate.reference = {
    kind: "upload",
    name: "user-plan.png",
    sampleId: null,
    sourceUrl: null,
  };

  assert.deepEqual(await validateSceneBriefStructure(sampleCandidate), []);
  assert.deepEqual(await validateSceneBriefStructure(uploadCandidate), []);
});

test("structure reports JSON Schema union types clearly", async () => {
  const candidate = makeValidSceneBrief();
  candidate.reference = {
    kind: "upload",
    name: "user-plan.png",
    sampleId: 42,
    sourceUrl: null,
  };

  const issues = await validateSceneBriefStructure(candidate);
  const issue = findIssue(issues, "SCHEMA_TYPE", "/reference/sampleId");

  assert.ok(issue);
  assert.equal(issue.message, "must be string or null.");
});

test("semantics reject globally duplicated ids", () => {
  const candidate = makeValidSceneBrief();
  candidate.seats[0].id = candidate.objects[0].id;
  candidate.accessibility.accessibleTable.wheelchairSeatId = candidate.objects[0].id;
  candidate.accessibility.route.stops[3].target.id = candidate.objects[0].id;

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(findIssue(issues, "GLOBAL_ID_DUPLICATE", "/seats/0/id"));
});

test("semantics reject missing cross references", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.serviceCounter.loweredSegmentObjectId = "missing-counter";

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(
    findIssue(
      issues,
      "LOWERED_COUNTER_OBJECT_NOT_FOUND",
      "/accessibility/serviceCounter/loweredSegmentObjectId",
    ),
  );
});

test("semantics reject a stage target from the wrong collection", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.route.stops[1].target = {
    collection: "seats",
    id: "wheelchair-position-01",
  };

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(
    findIssue(issues, "ROUTE_TARGET_COLLECTION", "/accessibility/route/stops/1/target/collection"),
  );
});

test("semantics require entrance to target the step-free entrance door", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.route.stops[0].target.id = "wc-door";

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(
    findIssue(issues, "ROUTE_ENTRANCE_TARGET_INVALID", "/accessibility/route/stops/0/target/id"),
  );
});

test("semantics require ordering to target the lowered counter", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.route.stops[1].target.id = "main-counter";

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(
    findIssue(issues, "ROUTE_ORDERING_TARGET_INVALID", "/accessibility/route/stops/1/target/id"),
  );
});

test("semantics require pick-up to target the declared pick-up object", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.route.stops[2].target.id = "main-counter";

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(
    findIssue(issues, "ROUTE_PICKUP_TARGET_INVALID", "/accessibility/route/stops/2/target/id"),
  );
});

test("semantics require accessible-seat to target the declared wheelchair position", () => {
  const candidate = makeValidSceneBrief();
  candidate.seats.push({
    id: "chair-01",
    kind: "chair",
    position: [0, 1],
    countsTowardCapacity: true,
    accessible: false,
  });
  candidate.accessibility.route.stops[3].target.id = "chair-01";

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(
    findIssue(
      issues,
      "ROUTE_ACCESSIBLE_SEAT_TARGET_INVALID",
      "/accessibility/route/stops/3/target/id",
    ),
  );
});

test("semantics require accessible-wc to target the WC door", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.route.stops[4].target.id = "entrance-door";

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(findIssue(issues, "ROUTE_WC_TARGET_INVALID", "/accessibility/route/stops/4/target/id"));
});

test("semantics reject non-increasing route stop indexes", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.route.stops[2].pointIndex = 1;

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(findIssue(issues, "ROUTE_STOP_ORDER", "/accessibility/route/stops/2/pointIndex"));
});

test("semantics reject an out-of-range route stop index", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.route.stops[4].pointIndex = 99;

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(
    findIssue(issues, "ROUTE_STOP_INDEX_OUT_OF_RANGE", "/accessibility/route/stops/4/pointIndex"),
  );
});

test("semantics reject a zero-length route segment", () => {
  const candidate = makeValidSceneBrief();
  candidate.accessibility.route.centerline[2] = [
    ...candidate.accessibility.route.centerline[1],
  ];

  const issues = validateSceneBriefSemantics(candidate);

  assert.ok(
    findIssue(
      issues,
      "ROUTE_ZERO_LENGTH_SEGMENT",
      "/accessibility/route/centerline/2",
    ),
  );
});

test("one-sided overlap exemptions are accepted when the target exists", () => {
  const candidate = makeValidSceneBrief();
  candidate.objects[0].collision.allowOverlapWith.push(candidate.objects[1].id);

  assert.deepEqual(validateSceneBriefSemantics(candidate), []);
});

test("overlap exemptions cannot reference missing objects or self", () => {
  const missingCandidate = makeValidSceneBrief();
  missingCandidate.objects[0].collision.allowOverlapWith.push("missing-object");
  const selfCandidate = makeValidSceneBrief();
  selfCandidate.objects[0].collision.allowOverlapWith.push(selfCandidate.objects[0].id);

  assert.ok(
    findIssue(
      validateSceneBriefSemantics(missingCandidate),
      "OVERLAP_TARGET_NOT_FOUND",
      "/objects/0/collision/allowOverlapWith/0",
    ),
  );
  assert.ok(
    findIssue(
      validateSceneBriefSemantics(selfCandidate),
      "OVERLAP_SELF_REFERENCE",
      "/objects/0/collision/allowOverlapWith/0",
    ),
  );
});
