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

const state = {
  engine: "threejs",
  intent:
    "做一个温暖、易于独立使用的社区咖啡馆；轮椅用户从入口到点单、取餐、落座和卫生间全程无障碍。",
  tags: new Set(["安静阅读", "邻里交流", "低位点单"]),
  reference: {
    kind: "sample",
    name: "room50-sample-plan.svg",
    type: "image/svg+xml",
    size: null,
    width: 1000,
    height: 500,
  },
  objectUrl: null,
};

const elements = {
  uploadZone: document.querySelector("#uploadZone"),
  planUpload: document.querySelector("#planUpload"),
  uploadEmpty: document.querySelector("#uploadEmpty"),
  uploadPreview: document.querySelector("#uploadPreview"),
  previewImage: document.querySelector("#previewImage"),
  uploadName: document.querySelector("#uploadName"),
  uploadMeta: document.querySelector("#uploadMeta"),
  removeUpload: document.querySelector("#removeUpload"),
  useSample: document.querySelector("#useSample"),
  intentInput: document.querySelector("#intentInput"),
  promptOutput: document.querySelector("#promptOutput"),
  promptCount: document.querySelector("#promptCount"),
  copyPrompt: document.querySelector("#copyPrompt"),
  downloadBrief: document.querySelector("#downloadBrief"),
  copyPageUrl: document.querySelector("#copyPageUrl"),
  toast: document.querySelector("#toast"),
};

function pageUrl() {
  if (window.location.protocol === "file:") {
    return "[DEPLOYED_ROOM50_URL]";
  }

  return new URL("/", window.location.href).href;
}

function referenceDescription() {
  const reference = state.reference;
  const dimensions = reference.width && reference.height ? `${reference.width} × ${reference.height}px` : "dimensions unknown";

  if (reference.kind === "upload") {
    return [
      `User reference: uploaded image “${reference.name}” (${reference.type}, ${dimensions}).`,
      "The upload is browser-local and is NOT retrievable from the site URL. Inspect it in the current browser session if you have browser control; otherwise ask the user to attach the same file beside this prompt before you model.",
    ].join("\n");
  }

  return [
    "User reference: built-in schematic at /assets/sample-plan.svg (1000 × 500px).",
    "Treat the schematic as a zoning hint, not a construction drawing. Its dimensions are governed by the scene contract.",
  ].join("\n");
}

function engineInstructions() {
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

function generatePrompt() {
  const tags = [...state.tags];
  const selectedTags = tags.length ? tags.join("、") : "无额外标签；只遵循主要意图";
  const contract = CASE_CONTRACT;

  return `You are a spatial-modeling agent. Build one bounded concept model, not a generic design system.

DISCOVER FIRST
1. Open ${pageUrl()}
2. Read ${pageUrl()}llms.txt
3. Read ${pageUrl()}agent/scene-contract.json — this is the canonical machine-readable source.
4. Inspect the reference image before proposing geometry. Separate observed facts from assumptions.

REFERENCE
${referenceDescription()}

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
3. Build: create the smallest model that demonstrates the requested spatial idea.
4. Check: measure the route, three turning zones, door, lowered counter, and accessible table clearance.
5. Report: return files created, exact dimensions used, screenshots/renders, known gaps, and the next decision needed from the user.

DEFINITION OF DONE
- The model is true-scale and the 50 m² boundary is obvious.
- All objects/groups have semantic names.
- Accessibility overlays can be shown independently from presentation materials.
- Top view visibly demonstrates the continuous route and turning zones.
- Any conflict between the uploaded drawing and this fixed contract is reported, not silently resolved.
- The result is labeled “concept demo — not for construction.”

Do not widen the task to other room types, automatic code certification, photoreal rendering, or a production configurator.`;
}

function renderPrompt() {
  const prompt = generatePrompt();
  elements.promptOutput.textContent = prompt;
  elements.promptCount.textContent = `${prompt.length.toLocaleString()} chars`;
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "built-in sample";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let toastTimer;

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

async function copyText(text, successMessage) {
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

function revokeObjectUrl() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
}

function showReferencePreview(src, reference) {
  elements.previewImage.src = src;
  elements.uploadName.textContent = reference.name;
  const dimensions = reference.width && reference.height ? `${reference.width} × ${reference.height}px` : "尺寸读取中";
  elements.uploadMeta.textContent = `${dimensions} · ${formatBytes(reference.size)}`;
  elements.uploadEmpty.hidden = true;
  elements.uploadPreview.hidden = false;
}

function useSampleReference({ notify = true } = {}) {
  revokeObjectUrl();
  state.reference = {
    kind: "sample",
    name: "room50-sample-plan.svg",
    type: "image/svg+xml",
    size: null,
    width: 1000,
    height: 500,
  };
  elements.planUpload.value = "";
  showReferencePreview("/assets/sample-plan.svg", state.reference);
  renderPrompt();
  if (notify) showToast("已使用内置 10 × 5m 样例图");
}

function validateFile(file) {
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    throw new Error("请选择 PNG、JPG、WEBP 或 SVG 图片");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("图片不能超过 10MB");
  }
}

async function inspectImage(file, src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: null, height: null });
    image.src = src;
  });
}

async function handleFile(file) {
  if (!file) return;
  try {
    validateFile(file);
  } catch (error) {
    showToast(error.message);
    return;
  }

  revokeObjectUrl();
  state.objectUrl = URL.createObjectURL(file);
  const dimensions = await inspectImage(file, state.objectUrl);
  state.reference = {
    kind: "upload",
    name: file.name,
    type: file.type,
    size: file.size,
    ...dimensions,
  };
  showReferencePreview(state.objectUrl, state.reference);
  renderPrompt();
  showToast("参考图已载入，仅保存在当前浏览器");
}

function downloadBrief() {
  const brief = {
    schema: "https://room50.example/schemas/brief-v1.json",
    generatedAt: new Date().toISOString(),
    sourcePage: pageUrl(),
    demoStatus: "concept-only-not-for-construction",
    scenario: CASE_CONTRACT,
    userIntent: state.intent.trim(),
    experienceTags: [...state.tags],
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
  showToast("brief.json 已下载");
}

elements.uploadZone.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
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
elements.uploadZone.setAttribute("aria-label", "上传图片或平面图");

elements.planUpload.addEventListener("change", (event) => handleFile(event.target.files?.[0]));

["dragenter", "dragover"].forEach((eventName) => {
  elements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.uploadZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.uploadZone.classList.remove("is-dragging");
  });
});

elements.uploadZone.addEventListener("drop", (event) => handleFile(event.dataTransfer?.files?.[0]));

elements.removeUpload.addEventListener("click", (event) => {
  event.stopPropagation();
  useSampleReference({ notify: true });
});

elements.useSample.addEventListener("click", () => useSampleReference({ notify: true }));

elements.intentInput.addEventListener("input", (event) => {
  state.intent = event.target.value;
  renderPrompt();
});

document.querySelectorAll(".intent-chip").forEach((chip) => {
  chip.setAttribute("aria-pressed", chip.classList.contains("is-selected") ? "true" : "false");
  chip.addEventListener("click", () => {
    const selected = chip.classList.toggle("is-selected");
    chip.setAttribute("aria-pressed", String(selected));
    if (selected) state.tags.add(chip.dataset.intent);
    else state.tags.delete(chip.dataset.intent);
    renderPrompt();
  });
});

document.querySelectorAll('input[name="engine"]').forEach((input) => {
  input.addEventListener("change", () => {
    state.engine = input.value;
    document.querySelectorAll(".engine-card").forEach((card) => card.classList.remove("is-selected"));
    input.closest(".engine-card").classList.add("is-selected");
    renderPrompt();
  });
});

elements.copyPrompt.addEventListener("click", () => copyText(generatePrompt(), "Prompt 已复制，可以交给 Agent 了"));
elements.downloadBrief.addEventListener("click", downloadBrief);
elements.copyPageUrl.addEventListener("click", () => {
  const kickoff = `Explore ${pageUrl()} as an agent-friendly spatial brief. Start with /llms.txt and /agent/scene-contract.json, inspect the page and its sample plan, then tell me what you can build for this 50 m² accessible café. Do not modify files yet.`;
  copyText(kickoff, "Agent 探索指令已复制");
});

window.addEventListener("beforeunload", revokeObjectUrl);

useSampleReference({ notify: false });
