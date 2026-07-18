import { InputValidationError } from "./errors.mjs";
import { parseSceneBriefFile } from "./parse.mjs";
import { validateSceneBriefStructure } from "./schema-validation.mjs";
import { validateSceneBriefSemantics } from "./semantic-validation.mjs";

export async function loadValidSceneBrief(inputPath) {
  const candidate = await parseSceneBriefFile(inputPath);
  const structuralIssues = await validateSceneBriefStructure(candidate);
  if (structuralIssues.length > 0) throw new InputValidationError(structuralIssues);

  const semanticIssues = validateSceneBriefSemantics(candidate);
  if (semanticIssues.length > 0) throw new InputValidationError(semanticIssues);

  return candidate;
}
