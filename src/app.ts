const CASE_CONTRACT = Object.freeze({
  id: "room50-accessible-cafe-v1",
  title: "50 m² accessible neighbourhood café",
  shell: {
    grossAreaM2: 50,
    widthM: 5,
    lengthM: 10,
    clearHeightM: 3.2,
  },
  accessibilityTargets: {
    continuousRouteMinWidthM: 1.2,
    turningCircleDiameterM: 1.5,
    clearDoorWidthTargetM: 0.9,
    accessibleCounterMaxHeightM: 0.76,
    accessibleTableClearHeightTargetM: 0.7,
  },
});

type Engine = "threejs" | "blender";
type SamplePlanId = "end-entry" | "central-entry" | "fixed-core";

interface SamplePlan {
  id: SamplePlanId;
  title: string;
  name: string;
  sourceUrl: string;
  designChallenge: string;
}

const SAMPLE_PLANS: Record<SamplePlanId, SamplePlan> = {
  "end-entry": {
    id: "end-entry",
    title: "End-entry plan",
    name: "room50-end-entry-plan.svg",
    sourceUrl: "/assets/sample-plan.svg",
    designChallenge:
      "A short-side entrance with the accessible WC and service zone arranged at opposite ends of the rear wall.",
  },
  "central-entry": {
    id: "central-entry",
    title: "Central shopfront plan",
    name: "room50-central-entry-plan.svg",
    sourceUrl: "/assets/plans/central-entry.svg",
    designChallenge:
      "A centred long-side entrance with service to the left and an existing accessible WC at the rear right.",
  },
  "fixed-core": {
    id: "fixed-core",
    title: "Fixed-core plan",
    name: "room50-fixed-core-plan.svg",
    sourceUrl: "/assets/plans/fixed-core.svg",
    designChallenge:
      "A long-side entrance near the right corner with a fixed rear core and structural column that the layout must respect.",
  },
};

const DEFAULT_SAMPLE_PLAN_ID: SamplePlanId = "end-entry";

interface ReferenceImage {
  kind: "sample" | "upload";
  sampleId: SamplePlanId | null;
  name: string;
  sourceUrl: string | null;
  designChallenge: string | null;
  type: string;
  size: number | null;
  width: number | null;
  height: number | null;
}

interface AppState {
  engine: Engine;
  intent: string;
  tags: Set<IntentTag>;
  reference: ReferenceImage;
  objectUrl: string | null;
}

interface ImageDimensions {
  width: number | null;
  height: number | null;
}

function sampleReference(planId: SamplePlanId): ReferenceImage {
  const plan = SAMPLE_PLANS[planId];
  return {
    kind: "sample",
    sampleId: plan.id,
    name: plan.name,
    sourceUrl: plan.sourceUrl,
    designChallenge: plan.designChallenge,
    type: "image/svg+xml",
    size: null,
    width: 1000,
    height: 500,
  };
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

const i18n = window.ROOM50_I18N;

const state: AppState = {
  engine: "threejs",
  intent: i18n.defaultIntent(),
  tags: new Set<IntentTag>([
    "quietReading",
    "communityConnection",
    "loweredOrdering",
  ]),
  reference: sampleReference(DEFAULT_SAMPLE_PLAN_ID),
  objectUrl: null,
};

const elements = {
  uploadZone: requiredElement<HTMLElement>("#uploadZone"),
  planUpload: requiredElement<HTMLInputElement>("#planUpload"),
  uploadEmpty: requiredElement<HTMLElement>("#uploadEmpty"),
  uploadPreview: requiredElement<HTMLElement>("#uploadPreview"),
  previewImage: requiredElement<HTMLImageElement>("#previewImage"),
  uploadName: requiredElement<HTMLElement>("#uploadName"),
  uploadMeta: requiredElement<HTMLElement>("#uploadMeta"),
  removeUpload: requiredElement<HTMLButtonElement>("#removeUpload"),
  intentInput: requiredElement<HTMLTextAreaElement>("#intentInput"),
  promptOutput: requiredElement<HTMLElement>("#promptOutput"),
  promptCount: requiredElement<HTMLElement>("#promptCount"),
  copyPrompt: requiredElement<HTMLButtonElement>("#copyPrompt"),
  downloadBrief: requiredElement<HTMLButtonElement>("#downloadBrief"),
  copyPageUrl: requiredElement<HTMLButtonElement>("#copyPageUrl"),
  toast: requiredElement<HTMLElement>("#toast"),
};

function pageUrl(): string {
  if (window.location.protocol === "file:") {
    return "[DEPLOYED_ROOM50_URL]/";
  }

  return new URL("/", window.location.href).href;
}

function publicResourceUrl(path: string): string {
  return `${pageUrl()}${path.replace(/^\/+/, "")}`;
}

function referenceDescription(): string {
  const reference = state.reference;
  const dimensions = reference.width && reference.height ? `${reference.width} × ${reference.height}px` : "dimensions unknown";

  if (reference.kind === "upload") {
    return [
      `User reference: uploaded image “${reference.name}” (${reference.type}, ${dimensions}).`,
      "The upload is browser-local and is NOT retrievable from the site URL. Inspect it in the current browser session if you have browser control; otherwise ask the user to attach the same file beside this prompt before you model.",
    ].join("\n");
  }

  return [
    `Selected built-in reference: ${reference.sampleId} — “${reference.name}” (${dimensions}).`,
    `Reference URL: ${publicResourceUrl(reference.sourceUrl ?? "/assets/sample-plan.svg")}`,
    `Reference catalog: ${publicResourceUrl("/assets/plans/catalog.json")}`,
    `Curated design challenge: ${reference.designChallenge ?? "Inspect the selected plan."}`,
    "Inspect the selected SVG itself. Treat the catalog challenge as context, not as an observed fact, and let the scene contract govern dimensions.",
  ].join("\n");
}

function engineInstructions(): string {
  if (state.engine === "blender") {
    return `BLENDER MCP BUILD PATH
- Confirm that a Blender MCP connection is available. If it is unavailable, stop and say exactly what connection is missing; do not pretend to have created a .blend file.
- Set Blender units to Metric, unit scale 1.0. Use one Blender unit per metre.
- Create named collections: 00_SHELL, 01_ARCHITECTURE, 02_SERVICE, 03_FURNITURE, 04_ACCESSIBILITY, 05_LIGHTING.
- Model the shell and large furniture with clean, low-poly geometry. Keep modifiers non-destructive where practical.
- Put the route and 1.5 m turning zones in 04_ACCESSIBILITY as visible translucent geometry; keep it toggleable in viewport/render.
- Save room50-accessible-cafe.blend, export room50-accessible-cafe.glb, and render one axonometric review image plus one top-down evidence image.`;
  }

  return `THREE.JS BUILD PATH
- Build a small static web app with Three.js using metres as world units (1 unit = 1 metre).
- Create semantic scene groups named shell, architecture, service, furniture, accessibility, and lighting.
- Provide orbit controls plus Perspective, Top, and Accessibility views. The Accessibility view must reveal route width and turning-circle overlays.
- Keep geometry low-poly and materials restrained. Do not hide failed spatial reasoning behind photorealism.
- Make the result responsive and keyboard reachable; show a useful fallback if WebGL or the CDN fails.
- Deliver index.html, scene.js, styles.css, scene-brief.json, and a short README with local/deploy instructions.`;
}

function generatePrompt(): string {
  const tags = [...state.tags];
  const selectedTags = tags.length
    ? tags.map((tag) => i18n.tagLabel(tag, "en")).join(", ")
    : "No extra experience tags";
  const contract = CASE_CONTRACT;

  return `You are a spatial-modeling agent. Build one bounded concept model, not a generic design system.

DISCOVER FIRST
1. Open ${pageUrl()}
2. Read ${pageUrl()}llms.txt
3. Read ${pageUrl()}agent/scene-contract.json — this is the canonical machine-readable source.
4. Read ${pageUrl()}agent/scene-brief.schema.json — scene-brief.json must conform to this interface.
5. Read ${pageUrl()}agent/workflow.md for the selected build path and validation handoff.
6. Inspect the reference image before proposing geometry. Separate observed facts from assumptions.

REFERENCE
${referenceDescription()}

PLAN FIDELITY EVIDENCE
- Preserve the entrance, walls, openings, fixed zones, and obstructions that are visibly observed in the selected reference.
- Before building, report each observed plan feature, its image location, confidence, modeling consequence, and any conflict with the fixed contract.
- Make the model Top view visibly correspond to this specific reference instead of reusing another ROOM/50 layout.
- Report every intentional deviation and every ambiguous feature. Never present an assumption as something observed in the plan.

USER INTENT
${state.intent.trim() || "Create a calm, welcoming accessible neighbourhood café."}
Experience tags: ${selectedTags}

FIXED SCENARIO — DO NOT EXPAND THE SCOPE
- Use: accessible neighbourhood café.
- Gross floor area: ${contract.shell.grossAreaM2} m².
- Baseline shell: ${contract.shell.lengthM} m × ${contract.shell.widthM} m, clear height ${contract.shell.clearHeightM} m.
- Required zones: step-free entrance, ordering/pick-up counter, compact back bar, mixed seating, one accessible table position, and one accessible WC concept zone.
- Concept LOD only: shell, partitions, key furniture, zoning, route evidence, simple material intent. No structural, MEP, fabrication, or construction claims.

ACCESSIBILITY EVIDENCE TO MODEL
- Show one continuous route connecting entrance → ordering → pick-up → accessible seat → WC.
- Target clear route width ≥ ${contract.accessibilityTargets.continuousRouteMinWidthM} m.
- Show Ø ${contract.accessibilityTargets.turningCircleDiameterM} m turning zones at entrance, counter, and WC.
- Target clear door width ≥ ${contract.accessibilityTargets.clearDoorWidthTargetM} m.
- Include a lowered service segment at ≤ ${contract.accessibilityTargets.accessibleCounterMaxHeightM} m and an accessible table with knee clearance target ≥ ${contract.accessibilityTargets.accessibleTableClearHeightTargetM} m.
- Treat these as demo modeling targets, not proof of regulatory compliance. Flag every unverified local-code assumption.

SPATIAL PRIORITIES
1. Preserve the continuous accessible route before maximizing seat count.
2. Keep queueing out of the entrance turning zone.
3. Place menu, ordering, payment, and pick-up within a usable sight/reach sequence.
4. Use movable two-person tables to support different wheelchair companion configurations.
5. Aim for 14–18 seats only if all modeled clearances remain credible.

${engineInstructions()}

REQUIRED PROCESS
1. Extract: list what the reference actually shows, with confidence levels.
2. Plan: state coordinate system, scale, zoning, object list, and assumptions before building.
3. Build: create the smallest model that demonstrates the requested spatial idea, record this selection in scene-brief.reference, and write scene-brief.json so it conforms to /agent/scene-brief.schema.json.
4. Validate: run \`npm run validate -- path/to/scene-brief.json\` and read the generated validation-report.json.
5. Repair: for every failed check, use its measured, required, and violationGeometry data to update both the model and scene-brief.json. Never edit or hand-author validation-report.json to manufacture a pass.
6. Repeat: run build → validate → read report → repair until every validation check reports pass. If the validator command is unavailable, stop and report that blocker instead of claiming completion.
7. Evidence: generate the accessibility overlay from validator report data, not from agent-authored pass claims.
8. Report: return files created, exact dimensions used, screenshots/renders, validation-report.json, known gaps, and the next decision needed from the user.

DEFINITION OF DONE
- The model is true-scale and the 50 m² boundary is obvious.
- All objects/groups have semantic names.
- The selected plan id or uploaded reference name is recorded, and the model Top view visibly corresponds to its observed entrance, walls, openings, and fixed zones.
- Accessibility overlays can be shown independently from presentation materials.
- Top view visibly demonstrates the continuous route and turning zones.
- Any conflict between the uploaded drawing and this fixed contract is reported, not silently resolved.
- validation-report.json reports pass for every validation check.
- The evidence overlay is generated from validator report data rather than agent self-report.
- The result is labeled “concept demo — not for construction.”

Do not widen the task to other room types, automatic code certification, photoreal rendering, or a production configurator.`;
}

function renderPrompt(): void {
  const prompt = generatePrompt();
  elements.promptOutput.textContent = prompt;
  elements.promptCount.textContent = `${prompt.length.toLocaleString()} chars`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return i18n.t("builtInSample");
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let toastTimer: number | undefined;

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

async function copyText(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    if (!copied) throw new Error("Clipboard is unavailable");
  }
  showToast(successMessage);
}

function revokeObjectUrl(): void {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
}

function showReferencePreview(src: string, reference: ReferenceImage): void {
  elements.previewImage.src = src;
  elements.uploadName.textContent = reference.name;
  const dimensions = reference.width && reference.height
    ? `${reference.width} x ${reference.height}px`
    : i18n.t("dimensionsLoading");
  elements.uploadMeta.textContent = `${dimensions} · ${formatBytes(reference.size)}`;
  elements.uploadEmpty.hidden = true;
  elements.uploadPreview.hidden = false;
}

function updateSampleSelection(planId: SamplePlanId | null): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-sample-plan]")
    .forEach((button) => {
      const selected = button.dataset.samplePlan === planId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
}

let lastSamplePlanId: SamplePlanId = DEFAULT_SAMPLE_PLAN_ID;

function useSampleReference(
  planId: SamplePlanId = DEFAULT_SAMPLE_PLAN_ID,
  { notify = true }: { notify?: boolean } = {},
): void {
  revokeObjectUrl();
  const plan = SAMPLE_PLANS[planId];
  lastSamplePlanId = planId;
  state.reference = sampleReference(planId);
  elements.planUpload.value = "";
  updateSampleSelection(planId);
  showReferencePreview(plan.sourceUrl, state.reference);
  renderPrompt();
  if (notify) showToast(`${plan.title} · ${i18n.t("toastSample")}`);
}

function validateFile(file: File): void {
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    throw new Error(i18n.t("toastType"));
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(i18n.t("toastSize"));
  }
}

async function inspectImage(_file: File, src: string): Promise<ImageDimensions> {
  return new Promise<ImageDimensions>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: null, height: null });
    image.src = src;
  });
}

async function handleFile(file: File | undefined): Promise<void> {
  if (!file) return;
  try {
    validateFile(file);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
    return;
  }

  revokeObjectUrl();
  state.objectUrl = URL.createObjectURL(file);
  const dimensions = await inspectImage(file, state.objectUrl);
  state.reference = {
    kind: "upload",
    sampleId: null,
    name: file.name,
    sourceUrl: null,
    designChallenge: null,
    type: file.type,
    size: file.size,
    ...dimensions,
  };
  updateSampleSelection(null);
  showReferencePreview(state.objectUrl, state.reference);
  renderPrompt();
  showToast(i18n.t("toastUpload"));
}

function downloadBrief(): void {
  const brief = {
    schema: "https://room50.example/schemas/brief-v1.json",
    generatedAt: new Date().toISOString(),
    sourcePage: pageUrl(),
    demoStatus: "concept-only-not-for-construction",
    scenario: CASE_CONTRACT,
    userIntent: state.intent.trim(),
    experienceTags: [...state.tags].map((tag) => i18n.tagLabel(tag, "en")),
    buildEngine: state.engine === "blender" ? "blender-mcp" : "threejs",
    reference: {
      ...state.reference,
      localOnly: state.reference.kind === "upload",
      objectUrl: undefined,
    },
    agentPrompt: generatePrompt(),
  };
  const blob = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "room50-agent-brief.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(i18n.t("toastDownload"));
}

elements.uploadZone.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("button")) return;
  elements.planUpload.click();
});

elements.uploadZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    elements.planUpload.click();
  }
});

elements.uploadZone.setAttribute("tabindex", "0");
elements.uploadZone.setAttribute("role", "button");
elements.uploadZone.setAttribute("aria-label", i18n.t("uploadAria"));

elements.planUpload.addEventListener("change", () =>
  handleFile(elements.planUpload.files?.[0]),
);

(["dragenter", "dragover"] as const).forEach((eventName) => {
  elements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.uploadZone.classList.add("is-dragging");
  });
});

(["dragleave", "drop"] as const).forEach((eventName) => {
  elements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.uploadZone.classList.remove("is-dragging");
  });
});

elements.uploadZone.addEventListener("drop", (event) =>
  handleFile(event.dataTransfer?.files?.[0]),
);

elements.removeUpload.addEventListener("click", (event) => {
  event.stopPropagation();
  useSampleReference(lastSamplePlanId, { notify: true });
});

document
  .querySelectorAll<HTMLButtonElement>("[data-sample-plan]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const planId = button.dataset.samplePlan as SamplePlanId;
      useSampleReference(planId, { notify: true });
    });
  });

elements.intentInput.addEventListener("input", () => {
  state.intent = elements.intentInput.value;
  renderPrompt();
});

document.querySelectorAll<HTMLButtonElement>(".intent-chip").forEach((chip) => {
  chip.setAttribute(
    "aria-pressed",
    chip.classList.contains("is-selected") ? "true" : "false",
  );
  chip.addEventListener("click", () => {
    const selected = chip.classList.toggle("is-selected");
    const intentTag = chip.dataset.intent as IntentTag;
    chip.setAttribute("aria-pressed", String(selected));
    if (selected) state.tags.add(intentTag);
    else state.tags.delete(intentTag);
    renderPrompt();
  });
});

document
  .querySelectorAll<HTMLInputElement>('input[name="engine"]')
  .forEach((input) => {
    input.addEventListener("change", () => {
      state.engine = input.value as Engine;
      document
        .querySelectorAll(".engine-card")
        .forEach((card) => card.classList.remove("is-selected"));
      input.closest(".engine-card")!.classList.add("is-selected");
      renderPrompt();
    });
  });

elements.copyPrompt.addEventListener("click", () =>
  copyText(generatePrompt(), i18n.t("toastCopyPrompt")),
);
elements.downloadBrief.addEventListener("click", downloadBrief);
elements.copyPageUrl.addEventListener("click", () => {
  const kickoff = `Explore ${pageUrl()} as an agent-friendly spatial brief. Start with /llms.txt and /agent/scene-contract.json, inspect the currently selected reference plan, then tell me how its observed entrance, walls, openings, and fixed zones should shape this 50 m2 accessible cafe. Do not modify files yet.`;
  copyText(kickoff, i18n.t("toastCopyPage"));
});

window.addEventListener("room50:localechange", ({ detail }) => {
  const previousDefault = i18n.defaultIntent(detail.previousLocale);
  if (state.intent.trim() === previousDefault) {
    state.intent = i18n.defaultIntent(detail.locale);
    elements.intentInput.value = state.intent;
  }
  elements.uploadZone.setAttribute("aria-label", i18n.t("uploadAria"));
  showReferencePreview(
    state.objectUrl || state.reference.sourceUrl || "/assets/sample-plan.svg",
    state.reference,
  );
  renderPrompt();
});

window.addEventListener("beforeunload", revokeObjectUrl);

useSampleReference(DEFAULT_SAMPLE_PLAN_ID, { notify: false });
