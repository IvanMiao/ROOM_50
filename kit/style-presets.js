const PRESETS = Object.freeze({
  hearth: {
    label: "Hearth / warm clay",
    colors: {
      background: 0xe7e0d2,
      floor: 0xa87345,
      wall: 0xf1eadc,
      trim: 0x342f2a,
      timber: 0x8b5b37,
      textile: 0xb6573f,
      textileAlt: 0x6b7c71,
      ceramic: 0xd9d0be,
      metal: 0x2e312d,
      foliage: 0x435d44,
    },
    day: { sky: 0xfff3d7, ground: 0x5f5548, key: 0xffe4b2, fill: 0xa9c7c8 },
    night: { sky: 0x303843, ground: 0x16191b, key: 0xffae62, fill: 0x55719a },
  },
  linen: {
    label: "Linen / quiet blue",
    colors: {
      background: 0xdde2df,
      floor: 0xb9a681,
      wall: 0xf4f1e9,
      trim: 0x273238,
      timber: 0x9a7652,
      textile: 0x567983,
      textileAlt: 0xb86f4f,
      ceramic: 0xdcded7,
      metal: 0x273238,
      foliage: 0x476753,
    },
    day: { sky: 0xf4ead4, ground: 0x6f756e, key: 0xffe9c0, fill: 0xadcbd2 },
    night: { sky: 0x24303b, ground: 0x12191e, key: 0xffb66d, fill: 0x6687a5 },
  },
});

function seededNoise(seed = 50) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function canvasTexture(THREE, { size = 256, paint, repeat = [1, 1] }) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  paint(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeWoodTexture(THREE, base) {
  const random = seededNoise(50);
  return canvasTexture(THREE, {
    repeat: [5, 2.5],
    paint(context, size) {
      context.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
      context.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 32) {
        context.fillStyle = `rgba(35,20,10,${0.055 + random() * 0.04})`;
        context.fillRect(0, y, size, 2);
        for (let x = -20; x < size; x += 55 + Math.floor(random() * 35)) {
          context.beginPath();
          context.moveTo(x, y + 5 + random() * 10);
          context.bezierCurveTo(x + 28, y + 2, x + 58, y + 27, x + 96, y + 17);
          context.strokeStyle = `rgba(255,239,211,${0.035 + random() * 0.045})`;
          context.lineWidth = 1;
          context.stroke();
        }
      }
    },
  });
}

function makeLinenTexture(THREE, base) {
  return canvasTexture(THREE, {
    repeat: [3, 3],
    paint(context, size) {
      context.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
      context.fillRect(0, 0, size, size);
      context.strokeStyle = "rgba(255,255,255,.09)";
      context.lineWidth = 1;
      for (let n = 0; n < size; n += 4) {
        context.beginPath(); context.moveTo(n, 0); context.lineTo(n, size); context.stroke();
        context.beginPath(); context.moveTo(0, n); context.lineTo(size, n); context.stroke();
      }
      context.strokeStyle = "rgba(20,25,22,.055)";
      for (let n = 2; n < size; n += 8) {
        context.beginPath(); context.moveTo(n, 0); context.lineTo(n, size); context.stroke();
        context.beginPath(); context.moveTo(0, n); context.lineTo(size, n); context.stroke();
      }
    },
  });
}

function makeTerracottaTexture(THREE, base) {
  const random = seededNoise(76);
  return canvasTexture(THREE, {
    repeat: [2, 2],
    paint(context, size) {
      context.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
      context.fillRect(0, 0, size, size);
      for (let index = 0; index < 900; index += 1) {
        const alpha = 0.025 + random() * 0.045;
        context.fillStyle = random() > 0.5 ? `rgba(255,230,200,${alpha})` : `rgba(50,20,10,${alpha})`;
        const radius = 0.4 + random() * 1.4;
        context.beginPath();
        context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
        context.fill();
      }
    },
  });
}

export function listStylePresets() {
  return Object.entries(PRESETS).map(([id, preset]) => ({ id, label: preset.label }));
}

export function createStylePreset(THREE, presetId = "hearth") {
  const preset = PRESETS[presetId] || PRESETS.hearth;
  const { colors } = preset;
  const wood = makeWoodTexture(THREE, colors.floor);
  const linen = makeLinenTexture(THREE, colors.textile);
  const clay = makeTerracottaTexture(THREE, colors.textileAlt);
  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: 0xffffff, map: wood, roughness: 0.84, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ color: colors.wall, roughness: 0.92 }),
    trim: new THREE.MeshStandardMaterial({ color: colors.trim, roughness: 0.72 }),
    timber: new THREE.MeshStandardMaterial({ color: colors.timber, roughness: 0.68 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xffffff, map: linen, roughness: 0.96 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xffffff, map: clay, roughness: 0.9 }),
    ceramic: new THREE.MeshStandardMaterial({ color: colors.ceramic, roughness: 0.42 }),
    metal: new THREE.MeshStandardMaterial({ color: colors.metal, roughness: 0.58, metalness: 0.16 }),
    plant: new THREE.MeshStandardMaterial({ color: colors.foliage, roughness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xc8dcdd, roughness: 0.18, transmission: 0.35, transparent: true, opacity: 0.7 }),
  };
  return { id: presetId in PRESETS ? presetId : "hearth", ...preset, materials };
}

export function createLightingRig(THREE, presetId = "hearth", mode = "day") {
  const preset = PRESETS[presetId] || PRESETS.hearth;
  const rig = new THREE.Group();
  rig.name = "lighting_rig";

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x333333, 1.8);
  hemisphere.name = "ambient_bounce";
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.name = "warm_sun_key";
  key.position.set(4.5, 8.5, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7 });
  key.shadow.bias = -0.00025;
  const fill = new THREE.DirectionalLight(0xffffff, 1.05);
  fill.name = "soft_window_fill";
  fill.position.set(-6, 4.5, -3);
  const practical = new THREE.PointLight(0xffae62, 0, 8, 2);
  practical.name = "night_practical";
  practical.position.set(1.8, 2.45, -0.8);

  rig.add(hemisphere, key, fill, practical);
  setLightingMode(THREE, rig, presetId, mode);
  return rig;
}

export function setLightingMode(THREE, rig, presetId = "hearth", mode = "day") {
  const preset = PRESETS[presetId] || PRESETS.hearth;
  const values = preset[mode === "night" ? "night" : "day"];
  const hemisphere = rig.getObjectByName("ambient_bounce");
  const key = rig.getObjectByName("warm_sun_key");
  const fill = rig.getObjectByName("soft_window_fill");
  const practical = rig.getObjectByName("night_practical");
  hemisphere.color.setHex(values.sky);
  hemisphere.groundColor.setHex(values.ground);
  hemisphere.intensity = mode === "night" ? 0.7 : 1.8;
  key.color.setHex(values.key);
  key.intensity = mode === "night" ? 1.35 : 3.4;
  fill.color.setHex(values.fill);
  fill.intensity = mode === "night" ? 0.45 : 1.05;
  practical.intensity = mode === "night" ? 18 : 0;
  return values;
}

export function disposeStylePreset(style) {
  Object.values(style?.materials || {}).forEach((material) => {
    material.map?.dispose();
    material.dispose?.();
  });
}
