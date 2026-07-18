import { createStarterScene } from "../kit/starter-scene.js";
import { versionedArchvizUrl } from "../kit/archviz-version.js";

const SCENARIOS = {
  fail: {
    brief: "./fixtures/fail.scene-brief.json",
    report: "./fixtures/fail.validation-report.json",
    visual: { url: versionedArchvizUrl("../assets/archviz/room50-cafe-fail.glb"), variant: "fail", name: "archviz_fail" },
    poster: versionedArchvizUrl("../assets/archviz/room50-cafe-fail.webp"),
    decision: "B3 桌旁座椅侵入动线，最窄处只剩 1.05 m。",
    delta: "15 seats · one fix required",
  },
  pass: {
    brief: "./fixtures/pass.scene-brief.json",
    report: "./fixtures/pass.validation-report.json",
    visual: { url: versionedArchvizUrl("../assets/archviz/room50-cafe-pass.glb"), variant: "pass", name: "archviz_pass" },
    poster: versionedArchvizUrl("../assets/archviz/room50-cafe-pass.webp"),
    decision: "B3 向东移动 0.55 m，并移除一把椅子：净宽回到 1.24 m。",
    delta: "14 seats · clearance wins",
  },
};

const ui = {
  mount: document.querySelector("#sceneMount"),
  status: document.querySelector("#statusPill"),
  runState: document.querySelector("#runState"),
  label: document.querySelector("#sceneLabel"),
  summary: document.querySelector("#reportSummary"),
  list: document.querySelector("#checkList"),
  decision: document.querySelector("#decisionText"),
  seatDelta: document.querySelector("#seatDelta"),
  palette: document.querySelector("#paletteSelect"),
  paletteLabel: document.querySelector("#paletteLabel"),
  light: document.querySelector("#lightToggle"),
  visualState: document.querySelector("#visualState"),
};

function displayName(checkId) {
  return ({
    routeWidth: "Continuous route",
    turningZones: "Turning zones",
    counterHeight: "Lowered counter",
    kneeClearance: "Knee clearance",
    seatCount: "Seat count",
    boundary: "Room boundary",
  })[checkId] || checkId;
}

function renderStatus({ brief, report, checks }) {
  const failed = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  const passed = checks.length - failed - warnings;
  const overall = failed ? "fail" : warnings ? "warning" : "pass";
  ui.status.textContent = overall.toUpperCase();
  ui.status.className = `status-pill is-${overall}`;
  ui.runState.textContent = overall === "pass" ? "ALL CHECKS GREEN" : "FIX REQUIRED";
  ui.runState.closest(".run-state").className = `run-state is-${overall}`;
  ui.label.textContent = brief.label || "ROOM/50 scene";
  ui.summary.textContent = `${passed} pass / ${failed} fail${warnings ? ` / ${warnings} warn` : ""}`;
  ui.list.replaceChildren(...checks.map((check) => {
    const row = document.createElement("article");
    row.className = `check-row is-${check.status}`;
    const mark = check.status === "pass" ? "✓" : check.status === "warning" ? "!" : "×";
    const markNode = document.createElement("span");
    markNode.className = "check-mark";
    markNode.textContent = mark;
    const detail = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = displayName(check.checkId || check.id);
    const measurement = document.createElement("small");
    measurement.append(document.createTextNode(`${check.measured ?? "—"} `));
    const requirement = document.createElement("i");
    requirement.textContent = `/ ${check.required ?? "—"}`;
    measurement.append(requirement);
    detail.append(name, measurement);
    const status = document.createElement("em");
    status.textContent = check.status;
    row.append(markNode, detail, status);
    return row;
  }));
}

function renderVisualState({ status, progress }) {
  ui.visualState.className = `visual-state is-${status}`;
  ui.mount.classList.toggle("is-loading-visual", status === "loading");
  if (status === "ready") {
    ui.visualState.textContent = "ArchViz GLB";
    ui.palette.disabled = true;
    ui.paletteLabel.textContent = "ArchViz materials";
    return;
  }
  if (status === "loading") {
    const percent = Number.isFinite(progress) ? ` ${Math.round(progress * 100)}%` : "";
    ui.visualState.textContent = `Loading visual${percent}`;
    ui.palette.disabled = true;
    ui.paletteLabel.textContent = "Loading materials";
    return;
  }
  ui.visualState.textContent = "Procedural fallback";
  ui.palette.disabled = false;
  ui.paletteLabel.textContent = "Fallback palette";
}

function setPoster(scenario) {
  ui.mount.style.setProperty("--archviz-poster", `url("${scenario.poster}")`);
  const fallbackImage = ui.mount.querySelector(".viewer-fallback img");
  if (fallbackImage) fallbackImage.src = scenario.poster;
}

function checksFromReport(report) {
  const source = report?.checks || report?.results || report?.validationResults || [];
  if (Array.isArray(source)) return source;
  return Object.entries(source).map(([checkId, check]) => ({ checkId, ...check }));
}

async function renderScenarioData(scenario, revision = null) {
  const [briefResponse, reportResponse] = await Promise.all([fetch(scenario.brief), fetch(scenario.report)]);
  if (!briefResponse.ok || !reportResponse.ok) throw new Error("Scenario fixtures could not be loaded");
  const [brief, report] = await Promise.all([briefResponse.json(), reportResponse.json()]);
  if (revision !== null && revision !== scenarioRevision) return false;
  renderStatus({ brief, report, checks: checksFromReport(report) });
  return true;
}

let activeScenario = "fail";
let scenarioRevision = 0;
let lighting = "day";
let starter;

setPoster(SCENARIOS.fail);
try {
  starter = await createStarterScene({
    container: ui.mount,
    brief: SCENARIOS.fail.brief,
    report: SCENARIOS.fail.report,
    visual: SCENARIOS.fail.visual,
    view: "accessibility",
    onStatus: renderStatus,
    onVisualState: renderVisualState,
  });
} catch (error) {
  console.warn("ROOM/50 interactive viewer could not start; keeping report evidence readable.", error);
  const fallback = document.createElement("div");
  fallback.className = "viewer-fallback";
  fallback.innerHTML = `<img src="${SCENARIOS.fail.poster}" alt="ROOM/50 café visualization" /><div><b>Interactive 3D unavailable</b><span>The validator report remains available.</span></div>`;
  ui.mount.replaceChildren(fallback);
  renderVisualState({ status: "fallback" });
  await renderScenarioData(SCENARIOS.fail);
}

async function selectScenario(name) {
  const revision = ++scenarioRevision;
  const previousScenario = activeScenario;
  const scenario = SCENARIOS[name];
  setPoster(scenario);
  document.querySelectorAll("[data-scenario]").forEach((button) => button.classList.toggle("is-active", button.dataset.scenario === name));
  ui.mount.classList.add("is-loading");
  try {
    if (starter) {
      await starter.load({ brief: scenario.brief, report: scenario.report, visual: scenario.visual });
      if (revision !== scenarioRevision) return;
      starter.setView("accessibility");
    } else {
      await renderScenarioData(scenario, revision);
      if (revision !== scenarioRevision) return;
    }
    activeScenario = name;
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === "accessibility"));
    ui.decision.textContent = scenario.decision;
    ui.seatDelta.textContent = scenario.delta;
    history.replaceState(null, "", `#${name}`);
  } catch (error) {
    if (revision !== scenarioRevision) return;
    console.warn(`ROOM/50 scenario could not load: ${name}`, error);
    setPoster(SCENARIOS[previousScenario]);
    document.querySelectorAll("[data-scenario]").forEach((button) => button.classList.toggle("is-active", button.dataset.scenario === previousScenario));
  } finally {
    if (revision === scenarioRevision) window.setTimeout(() => ui.mount.classList.remove("is-loading"), 180);
  }
}

document.querySelectorAll("[data-scenario]").forEach((button) => button.addEventListener("click", () => selectScenario(button.dataset.scenario)));
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  if (!starter) return;
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
  starter.setView(button.dataset.view);
}));
ui.palette.addEventListener("change", () => starter?.setPreset(ui.palette.value));
ui.light.addEventListener("click", () => {
  if (!starter) return;
  lighting = lighting === "day" ? "night" : "day";
  starter.setLighting(lighting);
  ui.light.setAttribute("aria-pressed", String(lighting === "night"));
  ui.light.innerHTML = lighting === "night" ? "<span>☾</span> Night light" : "<span>☼</span> Day light";
});

if (location.hash === "#pass") selectScenario("pass");
window.addEventListener("beforeunload", () => starter?.dispose(), { once: true });
