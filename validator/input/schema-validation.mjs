import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { appendPath, inputIssue } from "./errors.mjs";

const schemaPath = fileURLToPath(new URL("../../agent/scene-brief.schema.json", import.meta.url));
let schemaPromise;

function loadSchema() {
  schemaPromise ??= readFile(schemaPath, "utf8").then(JSON.parse);
  return schemaPromise;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameJsonValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function resolveReference(rootSchema, reference) {
  if (!reference.startsWith("#/$defs/")) {
    throw new Error(`Unsupported schema reference: ${reference}`);
  }

  const name = reference.slice("#/$defs/".length);
  const resolved = rootSchema.$defs?.[name];
  if (!resolved) throw new Error(`Unresolved schema reference: ${reference}`);
  return resolved;
}

function matchesType(value, type) {
  if (type === "object") return isObject(value);
  if (type === "array") return Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "null") return value === null;
  return false;
}

function validateNode(value, schema, path, rootSchema, issues) {
  if (schema === true) return;
  if (schema === false) {
    issues.push(inputIssue("SCHEMA_DISALLOWED", path, "value is not allowed."));
    return;
  }

  if (schema.$ref) {
    validateNode(value, resolveReference(rootSchema, schema.$ref), path, rootSchema, issues);
  }

  if (schema.allOf) {
    for (const childSchema of schema.allOf) {
      validateNode(value, childSchema, path, rootSchema, issues);
    }
  }

  if (schema.const !== undefined && !sameJsonValue(value, schema.const)) {
    issues.push(
      inputIssue("SCHEMA_CONST", path, `must equal ${JSON.stringify(schema.const)}.`),
    );
    return;
  }

  if (schema.enum && !schema.enum.some((item) => sameJsonValue(value, item))) {
    issues.push(
      inputIssue("SCHEMA_ENUM", path, `must be one of ${schema.enum.map(JSON.stringify).join(", ")}.`),
    );
    return;
  }

  if (schema.type && !matchesType(value, schema.type)) {
    issues.push(inputIssue("SCHEMA_TYPE", path, `must be ${schema.type}.`));
    return;
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push(
        inputIssue("SCHEMA_MIN_LENGTH", path, `must contain at least ${schema.minLength} character(s).`),
      );
    }
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
      issues.push(inputIssue("SCHEMA_PATTERN", path, `must match ${schema.pattern}.`));
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push(inputIssue("SCHEMA_MINIMUM", path, `must be at least ${schema.minimum}.`));
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      issues.push(
        inputIssue("SCHEMA_EXCLUSIVE_MINIMUM", path, `must be greater than ${schema.exclusiveMinimum}.`),
      );
    }
  }

  if (isObject(value)) {
    const properties = schema.properties ?? {};
    for (const requiredKey of schema.required ?? []) {
      if (!Object.hasOwn(value, requiredKey)) {
        issues.push(
          inputIssue(
            "SCHEMA_REQUIRED",
            appendPath(path, requiredKey),
            `required property “${requiredKey}” is missing.`,
          ),
        );
      }
    }

    for (const [key, childValue] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        validateNode(childValue, properties[key], appendPath(path, key), rootSchema, issues);
      } else if (schema.additionalProperties === false) {
        issues.push(
          inputIssue(
            "SCHEMA_ADDITIONAL_PROPERTY",
            appendPath(path, key),
            `property “${key}” is not allowed.`,
          ),
        );
      }
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issues.push(inputIssue("SCHEMA_MIN_ITEMS", path, `must contain at least ${schema.minItems} item(s).`));
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      issues.push(inputIssue("SCHEMA_MAX_ITEMS", path, `must contain at most ${schema.maxItems} item(s).`));
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      value.forEach((item, index) => {
        const key = canonicalJson(item);
        if (seen.has(key)) {
          issues.push(inputIssue("SCHEMA_UNIQUE_ITEMS", appendPath(path, index), "must be unique."));
        }
        seen.add(key);
      });
    }

    const prefixItems = schema.prefixItems ?? [];
    for (let index = 0; index < Math.min(prefixItems.length, value.length); index += 1) {
      validateNode(value[index], prefixItems[index], appendPath(path, index), rootSchema, issues);
    }

    if (schema.items === false && value.length > prefixItems.length) {
      for (let index = prefixItems.length; index < value.length; index += 1) {
        issues.push(inputIssue("SCHEMA_DISALLOWED_ITEM", appendPath(path, index), "item is not allowed."));
      }
    } else if (isObject(schema.items) || schema.items === true) {
      const startIndex = prefixItems.length;
      for (let index = startIndex; index < value.length; index += 1) {
        validateNode(value[index], schema.items, appendPath(path, index), rootSchema, issues);
      }
    }

    if (schema.contains) {
      let matchCount = 0;
      for (let index = 0; index < value.length; index += 1) {
        const matchIssues = [];
        validateNode(value[index], schema.contains, appendPath(path, index), rootSchema, matchIssues);
        if (matchIssues.length === 0) matchCount += 1;
      }
      const minimum = schema.minContains ?? 1;
      const maximum = schema.maxContains ?? Number.POSITIVE_INFINITY;
      if (matchCount < minimum || matchCount > maximum) {
        issues.push(
          inputIssue(
            "SCHEMA_CONTAINS",
            path,
            `must contain between ${minimum} and ${Number.isFinite(maximum) ? maximum : "unlimited"} matching item(s); found ${matchCount}.`,
          ),
        );
      }
    }
  }
}

export async function validateSceneBriefStructure(candidate) {
  const schema = await loadSchema();
  const issues = [];
  validateNode(candidate, schema, "", schema, issues);
  return issues;
}
