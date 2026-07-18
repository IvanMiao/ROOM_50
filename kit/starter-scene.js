import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createArchvizLayer } from "./archviz-layer.js";
import { createLightingRig, createStylePreset, disposeStylePreset, setLightingMode } from "./style-presets.js";

const GROUPS = ["shell", "architecture", "service", "furniture", "accessibility", "lighting"];
const PROCEDURAL_GROUPS = ["shell", "architecture", "service", "furniture"];
const VISUAL_GROUP = "visual";
const PASS = 0x77df8b;
const FAIL = 0xff4d45;
const WARNING = 0xffb347;

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeShell(brief = {}) {
  const shell = brief.shell || brief.roomShell || brief.room?.shell || brief.room || {};
  return {
    length: number(shell.lengthM ?? shell.length ?? shell.bbox?.w ?? shell.dimensions?.[0], 10),
    width: number(shell.widthM ?? shell.width ?? shell.bbox?.d ?? shell.dimensions?.[1], 5),
    height: number(shell.clearHeightM ?? shell.height ?? shell.bbox?.h ?? shell.dimensions?.[2], 3.2),
  };
}

function normalizeObject(item, index) {
  const bbox = item.bbox || item.size || {};
  const position = item.position || item.center || [0, 0];
  const semanticTag = String(item.semanticTag || item.tag || item.type || "furniture").toLowerCase();
  const x = number(Array.isArray(position) ? position[0] : position.x, 0);
  const z = number(Array.isArray(position) ? (position.length > 2 ? position[2] : position[1]) : position.z, 0);
  const w = Math.max(0.02, number(Array.isArray(bbox) ? bbox[0] : bbox.w ?? bbox.width, 0.6));
  const d = Math.max(0.02, number(Array.isArray(bbox) ? bbox[1] : bbox.d ?? bbox.depth, 0.6));
  const h = Math.max(0.02, number(Array.isArray(bbox) ? bbox[2] : bbox.h ?? bbox.height, 0.75));
  return {
    ...item,
    id: item.id || `object-${index + 1}`,
    semanticTag,
    x,
    z,
    w,
    d,
    h,
    y: number(item.elevation ?? item.positionY, h / 2),
    rotation: number(item.rotation ?? item.rotationY, 0),
  };
}

function normalizeBrief(brief = {}) {
  const objects = brief.objects || brief.scene?.objects || brief.items || [];
  const seats = brief.seats || brief.scene?.seats || [];
  const seatObjects = seats.map((seat, index) => ({ semanticTag: "seat", id: seat.id || `seat-${index + 1}`, bbox: { w: 0.46, d: 0.5, h: 0.82 }, ...seat }));
  return { shell: normalizeShell(brief), objects: [...objects, ...seatObjects].map(normalizeObject), raw: brief };
}

function semanticGroup(tag) {
  if (/wall|door|partition|window|wc|toilet|architecture/.test(tag)) return "architecture";
  if (/counter|bar|service|espresso|pickup|order/.test(tag)) return "service";
  if (/route|turn|clearance|access/.test(tag)) return "accessibility";
  return "furniture";
}

function materialFor(tag, style) {
  const materials = style.materials;
  if (/counter|clay|terracotta/.test(tag)) return materials.terracotta;
  if (/chair|bench|sofa|seat|fabric/.test(tag)) return materials.linen;
  if (/table|wood|timber|shelf/.test(tag)) return materials.timber;
  if (/plant/.test(tag)) return materials.plant;
  if (/glass|window/.test(tag)) return materials.glass;
  if (/toilet|sink|ceramic/.test(tag)) return materials.ceramic;
  if (/wall|partition/.test(tag)) return materials.wall;
  return materials.metal;
}

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function boxObject(item, material) {
  const mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h, item.d), material));
  mesh.position.set(item.x, item.y, item.z);
  mesh.rotation.y = item.rotation;
  mesh.name = item.id;
  mesh.userData.semanticTag = item.semanticTag;
  return mesh;
}

function tableObject(item, style) {
  const group = new THREE.Group();
  const round = /round/.test(item.semanticTag) || Math.abs(item.w - item.d) < 0.08;
  const top = shadow(new THREE.Mesh(
    round ? new THREE.CylinderGeometry(item.w / 2, item.w / 2, Math.min(0.07, item.h * 0.12), 28) : new THREE.BoxGeometry(item.w, Math.min(0.07, item.h * 0.12), item.d),
    style.materials.timber,
  ));
  top.position.y = item.h - 0.04;
  const stem = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, Math.max(0.1, item.h - 0.08), 12), style.materials.metal));
  stem.position.y = (item.h - 0.08) / 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(item.w, item.d) * 0.28, Math.min(item.w, item.d) * 0.3, 0.035, 18), style.materials.metal);
  foot.position.y = 0.018;
  group.add(top, stem, foot);
  group.position.set(item.x, item.y - item.h / 2, item.z);
  group.rotation.y = item.rotation;
  group.name = item.id;
  group.userData.semanticTag = item.semanticTag;
  return group;
}

function chairObject(item, style) {
  const group = new THREE.Group();
  const seatHeight = Math.min(0.46, item.h * 0.58);
  const seat = shadow(new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.08, item.d * 0.82), style.materials.linen));
  seat.position.y = seatHeight;
  const back = shadow(new THREE.Mesh(new THREE.BoxGeometry(item.w, Math.max(0.22, item.h - seatHeight), 0.07), style.materials.linen));
  back.position.set(0, seatHeight + (item.h - seatHeight) / 2, item.d * 0.4);
  [[-1,-1], [1,-1], [-1,1], [1,1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, seatHeight, 8), style.materials.metal);
    leg.position.set(sx * item.w * 0.38, seatHeight / 2, sz * item.d * 0.3);
    group.add(leg);
  });
  group.add(seat, back);
  group.position.set(item.x, item.y - item.h / 2, item.z);
  group.rotation.y = item.rotation;
  group.name = item.id;
  group.userData.semanticTag = item.semanticTag;
  return group;
}

function plantObject(item, style) {
  const group = new THREE.Group();
  const pot = shadow(new THREE.Mesh(new THREE.CylinderGeometry(item.w * 0.32, item.w * 0.25, item.h * 0.35, 16), style.materials.terracotta));
  pot.position.y = item.h * 0.175;
  for (let index = 0; index < 7; index += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(item.w * 0.16, 10, 8), style.materials.plant);
    const angle = index / 7 * Math.PI * 2;
    leaf.scale.set(0.55, 1.6, 0.45);
    leaf.position.set(Math.cos(angle) * item.w * 0.16, item.h * (0.55 + (index % 2) * 0.12), Math.sin(angle) * item.d * 0.16);
    group.add(leaf);
  }
  group.add(pot);
  group.position.set(item.x, item.y - item.h / 2, item.z);
  group.name = item.id;
  return group;
}

function createObject(item, style) {
  if (/table/.test(item.semanticTag)) return tableObject(item, style);
  if (/chair|seat|stool/.test(item.semanticTag)) return chairObject(item, style);
  if (/plant/.test(item.semanticTag)) return plantObject(item, style);
  return boxObject(item, materialFor(item.semanticTag, style));
}

function buildShell(group, shell, style) {
  const floor = shadow(new THREE.Mesh(new THREE.BoxGeometry(shell.length, 0.12, shell.width), style.materials.floor));
  floor.name = `floor_${shell.length}x${shell.width}m`;
  floor.position.y = -0.06;
  const back = shadow(new THREE.Mesh(new THREE.BoxGeometry(shell.length, shell.height, 0.1), style.materials.wall));
  back.position.set(0, shell.height / 2, -shell.width / 2);
  back.name = "rear_wall";
  const left = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, shell.height, shell.width), style.materials.wall));
  left.position.set(-shell.length / 2, shell.height / 2, 0);
  left.name = "left_wall";
  group.add(floor, back, left);

  const points = [];
  for (let x = -shell.length / 2; x <= shell.length / 2 + 0.01; x += 1) points.push(x, 0.012, -shell.width / 2, x, 0.012, shell.width / 2);
  for (let z = -shell.width / 2; z <= shell.width / 2 + 0.01; z += 1) points.push(-shell.length / 2, 0.012, z, shell.length / 2, 0.012, z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const grid = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x39352f, transparent: true, opacity: 0.15 }));
  grid.material.userData.room50Owned = true;
  grid.name = "one_metre_grid";
  group.add(grid);
}

function reportChecks(report) {
  const source = report?.checks || report?.results || report?.validationResults || report?.report?.checks || [];
  if (Array.isArray(source)) return source;
  return Object.entries(source).map(([checkId, check]) => ({ checkId, ...check }));
}

function geometryItems(report) {
  const checks = reportChecks(report);
  const items = [];
  checks.forEach((check) => {
    const geometry = check.violationGeometry || check.evidenceGeometry || check.geometry || [];
    const list = Array.isArray(geometry) ? geometry : [geometry];
    list.filter(Boolean).forEach((shape) => items.push({ shape, status: check.status || "pass", checkId: check.checkId || check.id }));
  });
  return items;
}

function statusColor(status) {
  if (status === "fail" || status === "error") return FAIL;
  if (status === "warning" || status === "warn") return WARNING;
  return PASS;
}

function xz(point) {
  if (Array.isArray(point)) return [number(point[0], 0), number(point.length > 2 ? point[2] : point[1], 0)];
  return [number(point?.x, 0), number(point?.z ?? point?.y, 0)];
}

function overlayShape(parent, entry) {
  const { shape, status, checkId } = entry;
  const type = String(shape.type || shape.kind || "").toLowerCase();
  const color = statusColor(status);
  const fillMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: status === "pass" ? 0.18 : 0.28, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
  let object;

  if (/circle|turn/.test(type) || shape.radius || shape.diameter) {
    const [x, z] = xz(shape.center || shape.position || [shape.x, shape.z]);
    const radius = number(shape.radius, number(shape.diameter, 1.5) / 2);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.025, radius + 0.025, 64), fillMaterial.clone());
    ring.material.opacity = 0.95;
    ring.rotation.x = -Math.PI / 2;
    object = new THREE.Group();
    object.add(fill, ring);
    object.position.set(x, 0.035, z);
  } else if (/box|rect|bbox/.test(type) || shape.bbox) {
    const bounds = shape.bbox || shape;
    const [x, z] = xz(shape.center || shape.position || [bounds.x, bounds.z]);
    const width = number(bounds.w ?? bounds.width, 0.5);
    const depth = number(bounds.d ?? bounds.depth ?? bounds.h, 0.5);
    object = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), fillMaterial);
    object.rotation.x = -Math.PI / 2;
    object.position.set(x, 0.04, z);
  } else {
    const source = shape.points || shape.path || shape.segment || [shape.start, shape.end].filter(Boolean);
    const points = (source || []).map((point) => {
      const [x, z] = xz(point);
      return new THREE.Vector3(x, 0.05, z);
    });
    if (points.length < 2) {
      fillMaterial.dispose();
      return;
    }
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.2);
    object = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 12), 0.035, 8, false), fillMaterial);
  }
  object.name = `validator_${checkId || type || "evidence"}`;
  object.traverse((child) => { child.renderOrder = 1000; });
  parent.add(object);
}

function clearGroup(group, { disposeMaterials = false } = {}) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.traverse?.((object) => {
      object.geometry?.dispose?.();
      object.shadow?.map?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        if (disposeMaterials || material.userData?.room50Owned) material.dispose?.();
      });
    });
  }
}

function clearGroupExcept(group, childToKeep, options) {
  group.remove(childToKeep);
  clearGroup(group, options);
  group.add(childToKeep);
}

async function readJson(source) {
  if (!source) return null;
  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Could not load ${source} (${response.status})`);
    return response.json();
  }
  return source;
}

export async function createStarterScene(options) {
  const container = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
  if (!container) throw new Error("createStarterScene requires a container element");

  let brief = normalizeBrief(await readJson(options.brief));
  let report = await readJson(options.report);
  let presetId = options.preset || "hearth";
  let lightingMode = options.lighting || "day";
  let visualSource = options.visual || null;
  let loadRevision = 0;
  let style = createStylePreset(THREE, presetId);

  const scene = new THREE.Scene();
  scene.name = "room50_starter_scene";
  scene.background = new THREE.Color(style.colors.background);
  scene.fog = new THREE.Fog(style.colors.background, 16, 30);
  const groups = Object.fromEntries([...GROUPS, VISUAL_GROUP].map((name) => {
    const group = new THREE.Group(); group.name = name; scene.add(group); return [name, group];
  }));
  const validatorOverlay = new THREE.Group();
  validatorOverlay.name = "validator_evidence_overlay";
  groups.accessibility.add(validatorOverlay);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = lightingMode === "night" ? 0.92 : 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.replaceChildren(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;

  function setProceduralVisibility(visible) {
    PROCEDURAL_GROUPS.forEach((name) => { groups[name].visible = visible; });
  }

  const archviz = createArchvizLayer({
    renderer,
    parent: groups.visual,
    onState(state) {
      const ready = state.status === "ready";
      setProceduralVisibility(!ready);
      setLighting(lightingMode);
      options.onVisualState?.({ ...state, mode: ready ? "archviz" : "procedural" });
    },
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.minDistance = 5;
  controls.maxDistance = 28;
  const views = {};
  let activeTween;
  let destroyed = false;

  function setView(name = "perspective", immediate = false) {
    const view = views[name] || views.perspective;
    groups.accessibility.visible = name === "accessibility";
    if (immediate) {
      camera.position.copy(view.position);
      controls.target.copy(view.target);
      controls.update();
      return;
    }
    activeTween = {
      fromPosition: camera.position.clone(), toPosition: view.position.clone(),
      fromTarget: controls.target.clone(), toTarget: view.target.clone(), start: performance.now(), duration: 600,
    };
  }

  function rebuild() {
    GROUPS.filter((name) => name !== "accessibility" && name !== "lighting").forEach((name) => clearGroup(groups[name]));
    clearGroupExcept(groups.accessibility, validatorOverlay);
    clearGroup(validatorOverlay, { disposeMaterials: true });
    clearGroup(groups.lighting);
    buildShell(groups.shell, brief.shell, style);
    brief.objects.forEach((item) => groups[semanticGroup(item.semanticTag)].add(createObject(item, style)));
    geometryItems(report).forEach((entry) => overlayShape(validatorOverlay, entry));
    groups.lighting.add(createLightingRig(THREE, presetId, lightingMode));
    const extent = Math.max(brief.shell.length, brief.shell.width);
    views.perspective = { position: new THREE.Vector3(extent * 0.88, extent * 0.70, extent * 0.92), target: new THREE.Vector3(0, 0.55, 0) };
    views.top = { position: new THREE.Vector3(0.01, extent * 1.7, 0.01), target: new THREE.Vector3(0, 0, 0) };
    views.accessibility = { position: new THREE.Vector3(extent * 0.65, extent * 1.12, extent * 0.82), target: new THREE.Vector3(0, 0, 0) };
    options.onStatus?.({ brief: brief.raw, report, checks: reportChecks(report), overlayCount: validatorOverlay.children.length });
  }

  function setPreset(nextPreset) {
    presetId = nextPreset;
    disposeStylePreset(style);
    style = createStylePreset(THREE, presetId);
    scene.background.setHex(style.colors.background);
    scene.fog.color.setHex(style.colors.background);
    rebuild();
  }

  function setLighting(nextMode) {
    lightingMode = nextMode === "night" ? "night" : "day";
    const rig = groups.lighting.getObjectByName("lighting_rig");
    const hasArchviz = groups.visual.children.length > 0;
    if (rig) {
      setLightingMode(THREE, rig, presetId, lightingMode);
      if (hasArchviz) rig.traverse((object) => { if (object.isLight) object.intensity *= 0.78; });
    }
    renderer.toneMappingExposure = lightingMode === "night" ? (hasArchviz ? 0.86 : 0.92) : (hasArchviz ? 0.96 : 1.02);
  }

  async function load({ brief: nextBrief, report: nextReport, visual: nextVisual } = {}) {
    const revision = ++loadRevision;
    const resolvedVisual = nextVisual === undefined ? visualSource : nextVisual;
    const [resolvedBrief, resolvedReport] = await Promise.all([
      nextBrief ? readJson(nextBrief).then(normalizeBrief) : Promise.resolve(brief),
      nextReport === undefined ? Promise.resolve(report) : readJson(nextReport),
    ]);
    if (revision !== loadRevision || destroyed) return { status: "superseded" };
    brief = resolvedBrief;
    report = resolvedReport;
    visualSource = resolvedVisual;
    rebuild();
    const visualState = await archviz.load(visualSource);
    if (revision !== loadRevision || destroyed) return { status: "superseded" };
    setView("perspective", true);
    return { status: "ready", visual: visualState };
  }

  async function loadVisual(nextVisual) {
    loadRevision += 1;
    visualSource = nextVisual;
    return archviz.load(visualSource);
  }

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  rebuild();
  setView(options.view || "perspective", true);

  function animate(time) {
    if (destroyed) return;
    if (activeTween) {
      const progress = Math.min(1, (time - activeTween.start) / activeTween.duration);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      camera.position.lerpVectors(activeTween.fromPosition, activeTween.toPosition, eased);
      controls.target.lerpVectors(activeTween.fromTarget, activeTween.toTarget, eased);
      if (progress === 1) activeTween = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(animate);
  const visualReady = archviz.load(visualSource);

  return {
    scene, camera, renderer, groups, load, loadVisual, setView, setPreset, setLighting, visualReady,
    dispose() {
      destroyed = true;
      loadRevision += 1;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      archviz.dispose();
      GROUPS.filter((name) => name !== "accessibility").forEach((name) => clearGroup(groups[name]));
      clearGroupExcept(groups.accessibility, validatorOverlay);
      clearGroup(validatorOverlay, { disposeMaterials: true });
      groups.accessibility.remove(validatorOverlay);
      environment.dispose();
      renderer.dispose();
      disposeStylePreset(style);
      container.replaceChildren();
    },
  };
}
