import type * as THREE from "three";

export type ArchvizVector3 = readonly [number, number, number];

export interface ArchvizDescriptor {
  url: string;
  name?: string;
  variant?: string;
  position?: ArchvizVector3;
  rotation?: ArchvizVector3;
  scale?: ArchvizVector3;
  envMapIntensity?: number;
  maxExtentM?: number;
}

export interface ArchvizDiagnostics {
  meshCount: number;
  sizeM: [number, number, number];
}

export interface ArchvizLoadingState {
  status: "loading";
  url: string;
  progress: number | null;
}

export interface ArchvizReadyState {
  status: "ready";
  url: string;
  root: THREE.Object3D;
  diagnostics: ArchvizDiagnostics;
}

export interface ArchvizFallbackState {
  status: "fallback";
  reason: "no-visual-source" | "load-error" | "cleared";
  url?: string;
  error?: unknown;
}

export interface ArchvizSupersededState {
  status: "superseded";
  url: string;
}

export type ArchvizObservedState =
  | ArchvizLoadingState
  | ArchvizReadyState
  | ArchvizFallbackState;

export type ArchvizLoadResult = ArchvizObservedState | ArchvizSupersededState;

export interface ArchvizLayerOptions {
  renderer: THREE.WebGLRenderer;
  parent: THREE.Object3D;
  onState?: (state: ArchvizObservedState) => void;
  dracoPath?: string;
  basisPath?: string;
  timeoutMs?: number;
}

export interface ArchvizLayer {
  load(source?: string | ArchvizDescriptor | null): Promise<ArchvizLoadResult>;
  clear(): ArchvizFallbackState;
  dispose(): void;
}

export function createArchvizLayer(options: ArchvizLayerOptions): ArchvizLayer;
