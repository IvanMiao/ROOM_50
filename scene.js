import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.querySelector("#sceneCanvas");
const stage = document.querySelector("#sceneStage");

if (container && stage) {
  try {
    initScene(container, stage);
  } catch (error) {
    console.warn("ROOM/50 Three.js preview could not start; keeping the plan fallback visible.", error);
    stage.querySelector(".scene-fallback span").textContent = "3D 不可用 · 显示平面图";
  }
}

function initScene(target, sceneStage) {
  const scene = new THREE.Scene();
  scene.name = "room50_accessible_cafe_preview";

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(10.8, 8.6, 11.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(target.clientWidth, target.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  target.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(0, 0.65, 0);
  controls.minDistance = 7;
  controls.maxDistance = 28;
  controls.maxPolarAngle = Math.PI / 2.03;

  const palette = {
    floor: new THREE.MeshStandardMaterial({ color: 0xcbbfa7, roughness: 0.88, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xf2eee3, roughness: 0.92 }),
    wallEdge: new THREE.MeshStandardMaterial({ color: 0xded6c8, roughness: 0.9 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xad4f37, roughness: 0.82 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x9d7452, roughness: 0.78 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x262824, roughness: 0.75 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x718a91, roughness: 0.94 }),
    plant: new THREE.MeshStandardMaterial({ color: 0x456f4a, roughness: 0.9 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xd9d8d0, roughness: 0.48 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcde0df, roughness: 0.15, transmission: 0.32, transparent: true, opacity: 0.68 }),
    access: new THREE.MeshBasicMaterial({ color: 0xd7ff3f, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
    accessSoft: new THREE.MeshBasicMaterial({ color: 0xd7ff3f, transparent: true, opacity: 0.19, depthWrite: false, side: THREE.DoubleSide }),
  };

  const shell = new THREE.Group();
  shell.name = "shell";
  scene.add(shell);

  const architecture = new THREE.Group();
  architecture.name = "architecture";
  scene.add(architecture);

  const service = new THREE.Group();
  service.name = "service";
  scene.add(service);

  const furniture = new THREE.Group();
  furniture.name = "furniture";
  scene.add(furniture);

  const accessibility = new THREE.Group();
  accessibility.name = "accessibility";
  scene.add(accessibility);

  const lighting = new THREE.Group();
  lighting.name = "lighting";
  scene.add(lighting);

  addBox(shell, "floor_10x5m", [10, 0.14, 5], [0, -0.07, 0], palette.floor, true);
  addBox(shell, "rear_wall", [10, 3.2, 0.14], [0, 1.6, -2.5], palette.wall, true);
  addBox(shell, "left_wall", [0.14, 3.2, 5], [-5, 1.6, 0], palette.wall, true);
  addBox(shell, "right_low_wall", [0.14, 1.05, 5], [5, 0.525, 0], palette.wallEdge, true);

  addFloorLines(shell);
  addEntrance(architecture, palette);
  addAccessibleWc(architecture, palette);
  addServiceCounter(service, palette);
  addFurniture(furniture, palette);
  addPlants(furniture, palette);
  addAccessibilityEvidence(accessibility, palette);
  addLighting(lighting);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 10),
    new THREE.ShadowMaterial({ color: 0x3c382d, transparent: true, opacity: 0.16 }),
  );
  contactShadow.name = "contact_shadow_plane";
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -0.085;
  contactShadow.receiveShadow = true;
  scene.add(contactShadow);

  sceneStage.classList.add("is-3d-ready");

  const views = {
    perspective: { position: new THREE.Vector3(10.8, 8.6, 11.8), target: new THREE.Vector3(0, 0.65, 0), access: true },
    top: { position: new THREE.Vector3(0.01, 16.5, 0.01), target: new THREE.Vector3(0, 0, 0), access: false },
    access: { position: new THREE.Vector3(7.8, 11.5, 9.4), target: new THREE.Vector3(-0.5, 0, 0), access: true },
  };

  let activeTween = null;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      const next = views[button.dataset.view];
      accessibility.visible = next.access;
      activeTween = {
        fromPosition: camera.position.clone(),
        toPosition: next.position.clone(),
        fromTarget: controls.target.clone(),
        toTarget: next.target.clone(),
        startedAt: performance.now(),
        duration: 650,
      };
    });
  });

  const resize = () => {
    const width = Math.max(target.clientWidth, 1);
    const height = Math.max(target.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(target);
  resize();

  const easeInOutCubic = (value) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);

  function animate(time) {
    if (activeTween) {
      const progress = Math.min((time - activeTween.startedAt) / activeTween.duration, 1);
      const eased = easeInOutCubic(progress);
      camera.position.lerpVectors(activeTween.fromPosition, activeTween.toPosition, eased);
      controls.target.lerpVectors(activeTween.fromTarget, activeTween.toTarget, eased);
      if (progress >= 1) activeTween = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);
}

function addBox(parent, name, size, position, material, shadow = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

function addFloorLines(parent) {
  const points = [];
  for (let x = -5; x <= 5; x += 1) points.push(x, 0.012, -2.5, x, 0.012, 2.5);
  for (let z = -2.5; z <= 2.5; z += 1) points.push(-5, 0.012, z, 5, 0.012, z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x857d6f, transparent: true, opacity: 0.18 }),
  );
  lines.name = "one_metre_floor_grid";
  parent.add(lines);
}

function addEntrance(parent, palette) {
  const mat = addBox(parent, "step_free_entry_mat", [1.65, 0.025, 0.78], [-3.3, 0.018, 2.13], palette.dark);
  mat.receiveShadow = true;

  const threshold = addBox(parent, "flush_entry_threshold", [2.1, 0.035, 0.16], [-3.3, 0.02, 2.48], palette.terracotta);
  threshold.receiveShadow = true;

  const jambLeft = addBox(parent, "entry_jamb_left", [0.11, 2.65, 0.11], [-4.38, 1.325, 2.43], palette.dark, true);
  const jambRight = jambLeft.clone();
  jambRight.name = "entry_jamb_right";
  jambRight.position.x = -2.22;
  parent.add(jambRight);
  addBox(parent, "entry_header", [2.27, 0.11, 0.11], [-3.3, 2.61, 2.43], palette.dark, true);

  const glass = addBox(parent, "open_glass_door_leaf", [0.04, 2.45, 1.03], [-4.33, 1.28, 1.92], palette.glass);
  glass.rotation.y = Math.PI / 2;
}

function addAccessibleWc(parent, palette) {
  addBox(parent, "wc_partition_front", [2.3, 2.6, 0.1], [-3.8, 1.3, -0.25], palette.wallEdge, true);
  addBox(parent, "wc_partition_side", [0.1, 2.6, 2.15], [-2.65, 1.3, -1.32], palette.wallEdge, true);

  const openingMarker = addBox(parent, "wc_door_clear_opening_0_9m", [0.9, 0.025, 0.18], [-3.35, 0.025, -0.19], palette.terracotta);
  openingMarker.rotation.y = 0;

  const toilet = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.46, 24), palette.ceramic);
  toilet.name = "accessible_wc_fixture_concept";
  toilet.position.set(-4.22, 0.23, -1.72);
  toilet.castShadow = true;
  parent.add(toilet);

  addBox(parent, "wc_grab_rail_hint", [0.72, 0.045, 0.045], [-4.35, 0.73, -2.34], palette.dark);
}

function addServiceCounter(parent, palette) {
  addBox(parent, "back_bar", [3.75, 0.93, 0.62], [2.68, 0.465, -2.05], palette.dark, true);
  addBox(parent, "main_service_counter", [2.45, 0.91, 0.72], [3.54, 0.455, -0.88], palette.terracotta, true);
  addBox(parent, "lowered_counter_0_76m", [1.08, 0.76, 0.72], [1.77, 0.38, -0.88], palette.timber, true);

  const top = addBox(parent, "counter_top", [3.68, 0.07, 0.82], [2.93, 0.95, -0.88], palette.ceramic, true);
  top.rotation.y = 0;

  const lowerTop = addBox(parent, "lowered_counter_top", [1.08, 0.06, 0.82], [1.77, 0.79, -0.88], palette.ceramic, true);
  lowerTop.rotation.y = 0;

  const machine = addBox(parent, "espresso_machine", [0.74, 0.48, 0.43], [2.7, 1.19, -2.05], palette.dark, true);
  machine.geometry.translate(0, 0, 0);

  for (let index = 0; index < 3; index += 1) {
    const pendant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.22, 16), palette.dark);
    pendant.name = `counter_pendant_${index + 1}`;
    pendant.position.set(1.55 + index * 1.25, 2.55, -1.25);
    parent.add(pendant);
  }
}

function addFurniture(parent, palette) {
  const tablePositions = [
    [-0.55, 0.95],
    [1.95, 1.4],
    [3.8, 1.35],
    [0.2, -0.25],
  ];

  tablePositions.forEach(([x, z], index) => {
    const table = new THREE.Group();
    table.name = index === 0 ? "accessible_table_with_knee_clearance" : `movable_two_person_table_${index}`;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.055, 28), palette.timber);
    top.position.y = 0.735;
    top.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.69, 12), palette.dark);
    stem.position.y = 0.36;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.035, 20), palette.dark);
    base.position.y = 0.02;
    table.add(top, stem, base);
    table.position.set(x, 0, z);
    parent.add(table);

    if (index !== 0) {
      addChair(parent, `${table.name}_chair_a`, x - 0.7, z, 0, palette);
      addChair(parent, `${table.name}_chair_b`, x + 0.7, z, Math.PI, palette);
    } else {
      addChair(parent, "accessible_table_companion_chair", x + 0.72, z, Math.PI, palette);
    }
  });

  const bench = addBox(parent, "wall_bench", [2.6, 0.47, 0.58], [3.55, 0.235, 2.05], palette.fabric, true);
  bench.rotation.y = 0;
  addBox(parent, "wall_bench_back", [2.6, 0.62, 0.13], [3.55, 0.72, 2.31], palette.fabric, true);
}

function addChair(parent, name, x, z, rotation, palette) {
  const chair = new THREE.Group();
  chair.name = name;
  addBox(chair, "seat", [0.42, 0.08, 0.42], [0, 0.45, 0], palette.fabric, true);
  addBox(chair, "back", [0.42, 0.5, 0.07], [0, 0.73, 0.2], palette.fabric, true);
  [
    [-0.16, -0.16],
    [0.16, -0.16],
    [-0.16, 0.16],
    [0.16, 0.16],
  ].forEach(([legX, legZ], index) => {
    addBox(chair, `leg_${index + 1}`, [0.035, 0.43, 0.035], [legX, 0.215, legZ], palette.dark);
  });
  chair.position.set(x, 0, z);
  chair.rotation.y = rotation;
  parent.add(chair);
}

function addPlants(parent, palette) {
  [
    [4.45, -1.85, 1.0],
    [-4.48, 1.85, 0.75],
  ].forEach(([x, z, scale], index) => {
    const plant = new THREE.Group();
    plant.name = `plant_${index + 1}`;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.35, 18), palette.terracotta);
    pot.position.y = 0.175;
    pot.castShadow = true;
    plant.add(pot);
    for (let leafIndex = 0; leafIndex < 7; leafIndex += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), palette.plant);
      const angle = (leafIndex / 7) * Math.PI * 2;
      leaf.scale.set(0.5, 1.5, 0.45);
      leaf.position.set(Math.cos(angle) * 0.17, 0.58 + (leafIndex % 2) * 0.15, Math.sin(angle) * 0.17);
      leaf.rotation.z = Math.cos(angle) * 0.45;
      leaf.castShadow = true;
      plant.add(leaf);
    }
    plant.position.set(x, 0, z);
    plant.scale.setScalar(scale);
    parent.add(plant);
  });
}

function addAccessibilityEvidence(parent, palette) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.3, 0.035, 2.45),
    new THREE.Vector3(-3.3, 0.035, 1.35),
    new THREE.Vector3(-1.9, 0.035, 0.65),
    new THREE.Vector3(0.95, 0.035, -0.5),
    new THREE.Vector3(-0.45, 0.035, 0.65),
    new THREE.Vector3(-2.0, 0.035, -0.05),
    new THREE.Vector3(-3.45, 0.035, -0.45),
  ]);
  const route = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 8, false), palette.access);
  route.name = "continuous_accessible_route_target_1_2m_clear";
  parent.add(route);

  [
    ["turning_zone_entry_1_5m", -3.3, 1.55],
    ["turning_zone_counter_1_5m", 0.72, -0.38],
    ["turning_zone_wc_1_5m", -3.75, -1.35],
  ].forEach(([name, x, z]) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), palette.accessSoft);
    disc.name = name;
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.028, z);
    parent.add(disc);

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.77, 48), palette.access);
    ring.name = `${name}_outline`;
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.032, z);
    parent.add(ring);
  });

  const entryClear = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), palette.accessSoft);
  entryClear.name = "entry_route_width_1_2m";
  entryClear.rotation.x = -Math.PI / 2;
  entryClear.position.set(-3.3, 0.026, 1.55);
  parent.add(entryClear);
}

function addLighting(parent) {
  const ambient = new THREE.HemisphereLight(0xfff6de, 0x80776a, 2.2);
  ambient.name = "warm_hemisphere_light";
  parent.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2d5, 3.3);
  sun.name = "daylight_key";
  sun.position.set(4.5, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.0002;
  parent.add(sun);

  const fill = new THREE.DirectionalLight(0xbcd2dd, 1.2);
  fill.name = "cool_fill";
  fill.position.set(-6, 5, -2);
  parent.add(fill);
}
