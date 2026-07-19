import { readFile } from "node:fs/promises";
import { InputValidationError, inputIssue } from "./errors.mjs";

export async function parseSceneBriefFile(inputPath) {
  let source;

  try {
    source = await readFile(inputPath, "utf8");
  } catch (error) {
    throw new InputValidationError([
      inputIssue(
        "INPUT_READ_ERROR",
        "/",
        `cannot read “${inputPath}” (${error.code ?? "unknown error"}).`,
      ),
    ]);
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new InputValidationError([
      inputIssue("INVALID_JSON", "/", `“${inputPath}” is not valid JSON (${error.message}).`),
    ]);
  }
}
