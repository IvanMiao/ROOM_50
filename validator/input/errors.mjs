function escapeJsonPointerToken(token) {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1");
}

export function appendPath(path, token) {
  return `${path}/${escapeJsonPointerToken(token)}`;
}

export function inputIssue(code, path, message) {
  return Object.freeze({
    code,
    path: path || "/",
    message,
  });
}

export class InputValidationError extends Error {
  constructor(issues) {
    const normalizedIssues = [...issues];
    super(normalizedIssues[0]?.message ?? "Scene brief input is invalid.");
    this.name = "InputValidationError";
    this.code = "SCENE_BRIEF_INVALID";
    this.issues = Object.freeze(normalizedIssues);
  }
}

export function formatInputValidationError(error) {
  return error.issues
    .map((issue) => `Input error [${issue.code}] ${issue.path}: ${issue.message}`)
    .join("\n");
}
