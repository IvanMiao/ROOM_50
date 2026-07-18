export const ARCHVIZ_ASSET_VERSION = "phase1-2026-07-18";

export function versionedArchvizUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(ARCHVIZ_ASSET_VERSION)}`;
}
