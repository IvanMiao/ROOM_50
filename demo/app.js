import { createStarterScene } from "../kit/starter-scene.js";

const SCENARIOS = {
  fail: {
    brief: "./fixtures/fail.scene-brief.json",
    report: "./fixtures/fail.validation-report.json",
    decision: "B3 桌旁座椅侵入动线，最窄处只剩 1.05 m。",
    delta: "15 seats · one fix required",
  },
  pass: {
    brief: "./fixtures/pass.scene-brief.json",
    report: "./fixtures/pass.validation-report.json",
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
  light: document.querySelector("#lightToggle"),
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
    row.innerHTML = `<span class="check-mark">${mark}</span><div><b>${displayName(check.checkId || check.id)}</b><small>${check.measured ?? "—"} <i>/ ${check.required ?? "—"}</i></small></div><em>${check.status}</em>`;
    return row;
  }));
}

let activeScenario = "fail";
let lighting = "day";
const starter = await createStarterScene({
  container: ui.mount,
  brief: SCENARIOS.fail.brief,
  report: SCENARIOS.fail.report,
  view: "accessibility",
  onStatus: renderStatus,
});

async function selectScenario(name) {
  activeScenario = name;
  const scenario = SCENARIOS[name];
  document.querySelectorAll("[data-scenario]").forEach((button) => button.classList.toggle("is-active", button.dataset.scenario === name));
  ui.mount.classList.add("is-loading");
  await starter.load({ brief: scenario.brief, report: scenario.report });
  starter.setView("accessibility");
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === "accessibility"));
  ui.decision.textContent = scenario.decision;
  ui.seatDelta.textContent = scenario.delta;
  window.setTimeout(() => ui.mount.classList.remove("is-loading"), 180);
  history.replaceState(null, "", `#${name}`);
}

document.querySelectorAll("[data-scenario]").forEach((button) => button.addEventListener("click", () => selectScenario(button.dataset.scenario)));
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
  starter.setView(button.dataset.view);
}));
ui.palette.addEventListener("change", () => starter.setPreset(ui.palette.value));
ui.light.addEventListener("click", () => {
  lighting = lighting === "day" ? "night" : "day";
  starter.setLighting(lighting);
  ui.light.setAttribute("aria-pressed", String(lighting === "night"));
  ui.light.innerHTML = lighting === "night" ? "<span>☾</span> Night light" : "<span>☼</span> Day light";
});

if (location.hash === "#pass") selectScenario("pass");
window.addEventListener("beforeunload", () => starter.dispose(), { once: true });
