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

function colorChannels(hex) {
  return {
    red: (hex >> 16) & 255,
    green: (hex >> 8) & 255,
    blue: hex & 255,
  };
}

function shiftedColor(hex, shift) {
  const { red, green, blue } = colorChannels(hex);
  const channel = (value) => Math.max(0, Math.min(255, Math.round(value + shift)));
  return `rgb(${channel(red)}, ${channel(green)}, ${channel(blue)})`;
}

function makeFloorTexture(THREE, base) {
  const random = seededNoise(50);
  return canvasTexture(THREE, {
    repeat: [4, 2],
    paint(context, size) {
      context.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
      context.fillRect(0, 0, size, size);
      const boardHeight = 16;
      for (let y = 0; y < size; y += boardHeight) {
        const tone = (random() - 0.5) * 13;
        context.fillStyle = shiftedColor(base, tone);
        context.fillRect(0, y + 1, size, boardHeight - 1);

        context.fillStyle = "rgba(47, 28, 15, 0.14)";
        context.fillRect(0, y, size, 1);

        const jointOffset = 59 + Math.floor(random() * 110);
        for (let x = jointOffset; x < size; x += 115 + Math.floor(random() * 45)) {
          context.fillStyle = "rgba(50, 30, 16, 0.1)";
          context.fillRect(x, y + 1, 1, boardHeight - 1);
        }

        for (let strand = 0; strand < 5; strand += 1) {
          const baseline = y + 5 + random() * (boardHeight - 10);
          context.beginPath();
          context.moveTo(-8, baseline);
          context.bezierCurveTo(
            size * 0.28,
            baseline + (random() - 0.5) * 5,
            size * 0.7,
            baseline + (random() - 0.5) * 5,
            size + 8,
            baseline + (random() - 0.5) * 3,
          );
          context.strokeStyle = random() > 0.36
            ? `rgba(255, 241, 217, ${0.018 + random() * 0.022})`
            : `rgba(61, 35, 18, ${0.018 + random() * 0.018})`;
          context.lineWidth = 0.65 + random() * 0.55;
          context.stroke();
        }
      }
    },
  });
}

function makeTimberTexture(THREE, base) {
  const random = seededNoise(137);
  return canvasTexture(THREE, {
    repeat: [1.6, 1.6],
    paint(context, size) {
      context.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
      context.fillRect(0, 0, size, size);
      for (let line = 0; line < 28; line += 1) {
        const y = random() * size;
        context.beginPath();
        context.moveTo(-12, y);
        context.bezierCurveTo(
          size * 0.32,
          y + (random() - 0.5) * 15,
          size * 0.68,
          y + (random() - 0.5) * 15,
          size + 12,
          y + (random() - 0.5) * 9,
        );
        context.strokeStyle = random() > 0.4
          ? `rgba(255, 238, 207, ${0.018 + random() * 0.025})`
          : `rgba(45, 25, 13, ${0.025 + random() * 0.028})`;
        context.lineWidth = 0.7 + random() * 1.1;
        context.stroke();
      }
      for (let pore = 0; pore < 180; pore += 1) {
        context.fillStyle = `rgba(48, 27, 14, ${0.018 + random() * 0.02})`;
        context.fillRect(random() * size, random() * size, 0.5 + random(), 0.5 + random() * 0.7);
      }
    },
  });
}

function makeLinenTexture(THREE, base) {
  const random = seededNoise(91);
  return canvasTexture(THREE, {
    repeat: [4, 4],
    paint(context, size) {
      context.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
      context.fillRect(0, 0, size, size);
      context.lineWidth = 0.55;
      for (let n = 0; n < size; n += 2) {
        const drift = (random() - 0.5) * 0.7;
        context.strokeStyle = `rgba(255, 255, 255, ${0.025 + random() * 0.018})`;
        context.beginPath(); context.moveTo(n + drift, 0); context.lineTo(n - drift, size); context.stroke();
        context.strokeStyle = `rgba(25, 30, 27, ${0.018 + random() * 0.015})`;
        context.beginPath(); context.moveTo(0, n - drift); context.lineTo(size, n + drift); context.stroke();
      }
      for (let nub = 0; nub < 240; nub += 1) {
        const light = random() > 0.48;
        context.fillStyle = light
          ? `rgba(255, 255, 255, ${0.018 + random() * 0.02})`
          : `rgba(27, 30, 27, ${0.014 + random() * 0.018})`;
        context.fillRect(random() * size, random() * size, 0.5 + random() * 0.8, 0.5 + random() * 0.8);
      }
    },
  });
}

function makeTerracottaTexture(THREE, base) {
  const random = seededNoise(76);
  return canvasTexture(THREE, {
    repeat: [2.5, 2.5],
    paint(context, size) {
      context.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
      context.fillRect(0, 0, size, size);
      for (let bloom = 0; bloom < 36; bloom += 1) {
        const radius = 4 + random() * 11;
        const x = random() * size;
        const y = random() * size;
        const gradient = context.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          radius,
        );
        gradient.addColorStop(0, random() > 0.5 ? "rgba(255, 229, 199, 0.018)" : "rgba(63, 31, 20, 0.014)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
      }
      for (let index = 0; index < 380; index += 1) {
        const alpha = 0.018 + random() * 0.028;
        context.fillStyle = random() > 0.54 ? `rgba(255, 232, 205, ${alpha})` : `rgba(58, 29, 19, ${alpha})`;
        const radius = 0.25 + random() * 0.75;
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
  const floor = makeFloorTexture(THREE, colors.floor);
  const timber = makeTimberTexture(THREE, colors.timber);
  const linen = makeLinenTexture(THREE, colors.textile);
  const clay = makeTerracottaTexture(THREE, colors.textileAlt);
  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: 0xffffff, map: floor, roughness: 0.82, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ color: colors.wall, roughness: 0.92 }),
    trim: new THREE.MeshStandardMaterial({ color: colors.trim, roughness: 0.72 }),
    timber: new THREE.MeshStandardMaterial({ color: 0xffffff, map: timber, roughness: 0.72, metalness: 0 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xffffff, map: linen, roughness: 0.94, metalness: 0 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xffffff, map: clay, roughness: 0.95, metalness: 0 }),
    ceramic: new THREE.MeshStandardMaterial({ color: colors.ceramic, roughness: 0.46, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ color: colors.metal, roughness: 0.6, metalness: 0.2 }),
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
