import { createHash } from "node:crypto";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";

import sceneContract from "../../../agent/scene-contract.json" with { type: "json" };
import planCatalog from "../../../assets/plans/catalog.json" with { type: "json" };
import inputSchema from "../../../ginse/input-schema.json" with { type: "json" };
import outputSchema from "../../../ginse/output-schema.json" with { type: "json" };

export const PUBLIC_ORIGIN = "https://room-50.netlify.app";

const PLAN_IDS = ["end-entry", "central-entry", "fixed-core"] as const;
const EXPERIENCE_TAGS = [
  "quiet-reading",
  "community-connection",
  "lowered-ordering",
  "movable-furniture",
] as const;
const BUILD_ENGINES = ["threejs", "blender-mcp"] as const;

export type PlanId = (typeof PLAN_IDS)[number];
export type ExperienceTag = (typeof EXPERIENCE_TAGS)[number];
export type BuildEngine = (typeof BUILD_ENGINES)[number];

export interface Room50Input {
  plan_id: PlanId;
  intent: string;
  experience_tags: ExperienceTag[];
  engine: BuildEngine;
}

export interface Room50Output {
  brief_version: "ginse-room50-1";
  reference: {
    plan_id: PlanId;
    title: string;
    reference_url: string;
    catalog_url: string;
    design_challenge_context: string;
  };
  user_intent: {
    statement: string;
    experience_tags: ExperienceTag[];
  };
  fixed_constraints: {
    gross_area_m2: number;
    shell_length_m: number;
    shell_width_m: number;
    clear_height_m: number;
    minimum_route_width_m: number;
    turning_zone_diameter_m: number;
    door_clear_width_m: number;
    lowered_counter_max_height_m: number;
    accessible_table_knee_clear_height_m: number;
  };
  assumptions: string[];
  build_engine: BuildEngine;
  agent_prompt: string;
  completion_checks: string[];
  concept_notice: "concept demo — not for construction";
}

export class SchemaValidationError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[]) {
    super(message);
    this.name = "SchemaValidationError";
    this.details = details;
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateInputSchema = ajv.compile<Room50Input>(inputSchema);
const validateOutputSchema = ajv.compile<Room50Output>(outputSchema);

function schemaErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message ?? "is invalid"}`;
  });
}

export function validateInput(value: unknown): Room50Input {
  if (!validateInputSchema(value)) {
    throw new SchemaValidationError(
      "Input does not match the advertised ROOM/50 schema.",
      schemaErrors(validateInputSchema.errors),
    );
  }

  const normalized: Room50Input = {
    plan_id: value.plan_id,
    intent: value.intent.trim(),
    experience_tags: [...value.experience_tags].sort(),
    engine: value.engine,
  };

  if (!validateInputSchema(normalized)) {
    throw new SchemaValidationError(
      "Input does not match the advertised ROOM/50 schema.",
      schemaErrors(validateInputSchema.errors),
    );
  }

  return normalized;
}

export function assertValidOutput(value: unknown): asserts value is Room50Output {
  if (!validateOutputSchema(value)) {
    throw new SchemaValidationError(
      "Generated output does not match the advertised ROOM/50 schema.",
      schemaErrors(validateOutputSchema.errors),
    );
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(",")}}`;
}

export function requestFingerprint(input: Room50Input): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

function normalizeOrigin(origin: string): string {
  return new URL(origin).origin;
}

function engineInstructions(engine: BuildEngine): string {
  if (engine === "blender-mcp") {
    return `BLENDER MCP OUTPUT
- Confirm a real Blender MCP connection before claiming model work.
- Use Metric units with unit scale 1.0.
- Create collections 00_SHELL, 01_ARCHITECTURE, 02_SERVICE, 03_FURNITURE, 04_ACCESSIBILITY, and 05_LIGHTING.
- Save a .blend, export a .glb, and render axonometric and top-down evidence images.`;
  }

  return `THREE.JS OUTPUT
- Use 1 world unit = 1 metre.
- Create named groups shell, architecture, service, furniture, accessibility, and lighting.
- Provide Perspective, Top, and Accessibility views with independently toggleable overlays.
- Include a responsive non-WebGL fallback and the required static deployment files.`;
}

function buildAgentPrompt(
  input: Room50Input,
  referenceUrl: string,
  catalogUrl: string,
  designChallenge: string,
  origin: string,
): string {
  const experienceTags = input.experience_tags.length
    ? input.experience_tags.join(", ")
    : "none selected";

  return `You are a spatial-modeling agent. Build one bounded ROOM/50 concept model.

DISCOVER FIRST
1. Open ${origin}/ and understand the task from the deployed website.
2. Read ${origin}/llms.txt.
3. Read ${origin}/agent/scene-contract.json as the canonical source.
4. Read ${origin}/agent/scene-brief.schema.json and ${origin}/agent/workflow.md.
5. Fetch the exact selected SVG at ${referenceUrl} and inspect it directly.

OBSERVED INFORMATION TO EXTRACT
- Selected built-in plan: ${input.plan_id}.
- Public plan SVG: ${referenceUrl}.
- Public plan catalog: ${catalogUrl}.
- Catalog design challenge (context only, not an observed fact): ${designChallenge}
- Report the entrance, walls, openings, fixed zones, and obstructions actually visible in the SVG, with confidence levels.

USER INTENT
- Statement: ${input.intent}
- Experience priorities: ${experienceTags}

FIXED CONSTRAINTS
- Accessible neighbourhood café in a rectangular 10 m × 5 m shell: 50 m² gross area and 3.2 m clear height.
- One step-free entrance, ordering and pick-up counter, compact back bar, mixed seating, accessible table position, and accessible WC concept zone.
- One visible route: entrance → ordering → pick-up → accessible seat → WC, target clear width at least 1.2 m.
- Three visible 1.5 m diameter turning zones at entrance, counter, and WC.
- Door clear width target 0.9 m; lowered counter maximum 0.76 m; accessible-table knee clearance target at least 0.7 m.
- Concept LOD only. Label the result “concept demo — not for construction”.

ASSUMPTIONS TO KEEP EXPLICIT
- The fixed dimensions are modeling targets, not proof of local regulatory compliance.
- Local code, structure, fire egress, plumbing, MEP, and site conditions remain unverified.
- Catalog prose is context; observed plan facts must come from the selected SVG.
- If the reference conflicts with the fixed 50 m² contract, report the conflict instead of changing scale silently.

${engineInstructions(input.engine)}

REQUIRED WORKFLOW
1. Extract an observed-feature table from the selected SVG.
2. Plan coordinates, true scale, zoning, semantic hierarchy, route, and a plan-fit map before building.
3. Build only the shell, major partitions, service elements, furniture, accessibility evidence, simple materials, and review lighting.
4. Keep the Top view traceable to the selected entrance, walls, openings, fixed zones, and obstructions.
5. Validate scene-brief.json against the public schema and report every failed check or unresolved conflict.
6. Return files, opening/deployment instructions, exact dimensions, evidence views, known gaps, and the next user decision.`;
}

export function createRoom50Output(
  inputValue: unknown,
  publicOrigin = PUBLIC_ORIGIN,
): Room50Output {
  const input = validateInput(inputValue);
  const origin = normalizeOrigin(publicOrigin);
  const plan = planCatalog.plans.find((candidate) => candidate.id === input.plan_id);

  if (!plan) {
    throw new SchemaValidationError("Selected plan is not available.", [
      `/plan_id must be one of ${PLAN_IDS.join(", ")}`,
    ]);
  }

  const referenceUrl = new URL(plan.imageUrl, `${origin}/`).href;
  const catalogUrl = new URL("/assets/plans/catalog.json", `${origin}/`).href;
  const fixed = sceneContract.accessibilityTargets;
  const output: Room50Output = {
    brief_version: "ginse-room50-1",
    reference: {
      plan_id: input.plan_id,
      title: plan.title,
      reference_url: referenceUrl,
      catalog_url: catalogUrl,
      design_challenge_context: plan.designChallenge,
    },
    user_intent: {
      statement: input.intent,
      experience_tags: input.experience_tags,
    },
    fixed_constraints: {
      gross_area_m2: 50,
      shell_length_m: 10,
      shell_width_m: 5,
      clear_height_m: 3.2,
      minimum_route_width_m: fixed.continuousRoute.minimumClearWidthM,
      turning_zone_diameter_m: fixed.turningZones.diameterM,
      door_clear_width_m: fixed.doors.clearWidthTargetM,
      lowered_counter_max_height_m: fixed.serviceCounter.maximumHeightM,
      accessible_table_knee_clear_height_m:
        fixed.accessibleTable.kneeClearHeightTargetM,
    },
    assumptions: [
      "Accessibility dimensions are concept modeling targets, not code certification.",
      "Local code, structure, fire egress, plumbing, MEP, and site conditions are unverified.",
      "Catalog descriptions provide context; observed facts must come from inspecting the selected SVG.",
    ],
    build_engine: input.engine,
    agent_prompt: buildAgentPrompt(
      input,
      referenceUrl,
      catalogUrl,
      plan.designChallenge,
      origin,
    ),
    completion_checks: [...sceneContract.definitionOfDone],
    concept_notice: "concept demo — not for construction",
  };

  assertValidOutput(output);
  return output;
}
