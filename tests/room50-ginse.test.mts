import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SchemaValidationError,
  assertValidOutput,
  canonicalJson,
  createRoom50Output,
  requestFingerprint,
  validateInput,
} from "../netlify/functions/lib/room50-brief.mts";

const example = {
  plan_id: "central-entry",
  intent:
    "Create a calm neighbourhood café with an obvious arrival sequence and flexible companion seating.",
  experience_tags: [
    "quiet-reading",
    "community-connection",
    "lowered-ordering",
  ],
  engine: "threejs",
} as const;

describe("ROOM/50 Ginse contract", () => {
  it("creates a schema-valid, agent-ready brief from the advertised example", () => {
    const output = createRoom50Output(example);

    assertValidOutput(output);
    assert.equal(output.reference.plan_id, "central-entry");
    assert.equal(output.fixed_constraints.gross_area_m2, 50);
    assert.equal(output.fixed_constraints.minimum_route_width_m, 1.2);
    assert.equal(output.concept_notice, "concept demo — not for construction");
    assert.match(output.agent_prompt, /Read https:\/\/room-50\.netlify\.app\/llms\.txt/);
    assert.match(output.agent_prompt, /OBSERVED INFORMATION TO EXTRACT/);
    assert.match(output.agent_prompt, /USER INTENT/);
    assert.match(output.agent_prompt, /FIXED CONSTRAINTS/);
    assert.match(output.agent_prompt, /ASSUMPTIONS TO KEEP EXPLICIT/);
  });

  it("normalizes tag order before generating a request fingerprint", () => {
    const first = validateInput(example);
    const second = validateInput({
      ...example,
      experience_tags: [...example.experience_tags].reverse(),
    });

    assert.equal(requestFingerprint(first), requestFingerprint(second));
  });

  it("canonicalizes object keys recursively", () => {
    assert.equal(
      canonicalJson({ beta: { two: 2, one: 1 }, alpha: true }),
      canonicalJson({ alpha: true, beta: { one: 1, two: 2 } }),
    );
  });

  it("rejects whitespace-only intent after normalization", () => {
    assert.throws(
      () => createRoom50Output({ ...example, intent: "            " }),
      SchemaValidationError,
    );
  });

  it("rejects fields outside the advertised input schema", () => {
    assert.throws(
      () => createRoom50Output({ ...example, unsupported: true }),
      SchemaValidationError,
    );
  });
});
