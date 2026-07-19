import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const DEFAULT_DRACO_PATH = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/";
const DEFAULT_BASIS_PATH = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/";

function vector3(value, fallback) {
  if (!Array.isArray(value)) return fallback.clone();
  return new THREE.Vector3(
    Number.isFinite(Number(value[0])) ? Number(value[0]) : fallback.x,
    Number.isFinite(Number(value[1])) ? Number(value[1]) : fallback.y,
    Number.isFinite(Number(value[2])) ? Number(value[2]) : fallback.z,
  );
}

function normalizeDescriptor(source) {
  if (!source) return null;
  if (typeof source === "string") return { url: source };
  if (!source.url) return null;
  return source;
}

function disposeObject(root) {
  root?.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose?.();
      });
      material.dispose?.();
    });
  });
}

function validateRoot(root, descriptor) {
  let meshCount = 0;
  const bounds = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh) return;
    let ancestor = object;
    while (ancestor) {
      if (!ancestor.visible) return;
      ancestor = ancestor.parent;
    }
    const geometry = object.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    meshCount += 1;
    bounds.union(geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  if (!meshCount) throw new Error("ArchViz model contains no meshes");

  const size = bounds.getSize(new THREE.Vector3());
  const values = [...bounds.min.toArray(), ...bounds.max.toArray(), ...size.toArray()];
  if (bounds.isEmpty() || values.some((value) => !Number.isFinite(value))) {
    throw new Error("ArchViz model has invalid bounds");
  }
  const maxExtentM = descriptor.maxExtentM ?? 25;
  if (Math.max(size.x, size.y, size.z) > maxExtentM || size.lengthSq() < 0.0001) {
    throw new Error(`ArchViz model scale is outside the accepted range (max ${maxExtentM} m)`);
  }
  return { meshCount, sizeM: size.toArray() };
}

export function createArchvizLayer({
  renderer,
  parent,
  onState,
  dracoPath = DEFAULT_DRACO_PATH,
  basisPath = DEFAULT_BASIS_PATH,
  timeoutMs = 15000,
} = {}) {
  if (!renderer || !parent) throw new Error("createArchvizLayer requires a renderer and parent group");

  const draco = new DRACOLoader();
  draco.setDecoderPath(dracoPath);
  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(basisPath);
  ktx2.detectSupport(renderer);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);

  const cache = new Map();
  let activeRoot = null;
  let requestId = 0;

  function fetchGltf(url, ownRequest) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = timeoutMs > 0 ? globalThis.setTimeout(() => {
        settled = true;
        reject(new Error(`ArchViz model timed out after ${timeoutMs} ms`));
      }, timeoutMs) : null;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        if (timer) globalThis.clearTimeout(timer);
        callback(value);
      };
      loader.load(
        url,
        (gltf) => finish(resolve, gltf),
        (event) => {
          if (settled || ownRequest !== requestId) return;
          const progress = event.total ? event.loaded / event.total : null;
          emit("loading", { url, progress });
        },
        (error) => finish(reject, error),
      );
    });
  }

  function emit(status, detail = {}) {
    const state = { status, ...detail };
    try {
      onState?.(state);
    } catch (error) {
      console.error("ROOM/50 visual-state observer failed", error);
    }
    return state;
  }

  function configure(root, descriptor) {
    root.name = descriptor.name || `archviz_${descriptor.variant || "scene"}`;
    root.position.copy(vector3(descriptor.position, new THREE.Vector3()));
    root.rotation.setFromVector3(vector3(descriptor.rotation, new THREE.Vector3()));
    root.scale.copy(vector3(descriptor.scale, new THREE.Vector3(1, 1, 1)));
    root.traverse((object) => {
      if (object.isLight || object.isCamera) object.visible = false;
      if (object.name === "04_ACCESSIBILITY" || /^ACCESS_/.test(object.name)) {
        object.visible = false;
      }
      if (!object.isMesh) return;
      object.castShadow = object.userData.castShadow !== false;
      object.receiveShadow = object.userData.receiveShadow !== false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        if ("envMapIntensity" in material) material.envMapIntensity = descriptor.envMapIntensity ?? 0.85;
      });
    });
    return root;
  }

  function detachActive() {
    if (!activeRoot) return;
    parent.remove(activeRoot);
    activeRoot = null;
  }

  async function load(source) {
    const descriptor = normalizeDescriptor(source);
    const ownRequest = ++requestId;
    detachActive();
    if (!descriptor) return emit("fallback", { reason: "no-visual-source" });

    emit("loading", { url: descriptor.url, progress: 0 });
    try {
      let root = cache.get(descriptor.url);
      let fresh = false;
      if (!root) {
        const gltf = await fetchGltf(descriptor.url, ownRequest);
        root = gltf.scene;
        fresh = true;
      }
      if (ownRequest !== requestId) return { status: "superseded", url: descriptor.url };
      const configuredRoot = configure(root, descriptor);
      const diagnostics = validateRoot(configuredRoot, descriptor);
      if (fresh) cache.set(descriptor.url, root);
      activeRoot = configuredRoot;
      parent.add(activeRoot);
      return emit("ready", { url: descriptor.url, root: activeRoot, diagnostics });
    } catch (error) {
      if (ownRequest !== requestId) return { status: "superseded", url: descriptor.url };
      console.warn(`ROOM/50 ArchViz model could not load: ${descriptor.url}`, error);
      return emit("fallback", { url: descriptor.url, reason: "load-error", error });
    }
  }

  return {
    load,
    clear() {
      requestId += 1;
      detachActive();
      return emit("fallback", { reason: "cleared" });
    },
    dispose() {
      requestId += 1;
      detachActive();
      cache.forEach(disposeObject);
      cache.clear();
      draco.dispose();
      ktx2.dispose();
    },
  };
}
