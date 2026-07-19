import { createHash, randomUUID } from "node:crypto";

import { getStore } from "@netlify/blobs";
import { createRemoteJWKSet, jwtVerify } from "jose";

import {
  PUBLIC_ORIGIN,
  SchemaValidationError,
  assertValidOutput,
  createRoom50Output,
  requestFingerprint,
  validateInput,
  type Room50Output,
} from "./lib/room50-brief.mts";

const GINSE_ISSUER = "https://api.ginse.ai";
const GINSE_JWKS_URL = new URL(`${GINSE_ISSUER}/.well-known/jwks.json`);
const GINSE_JWKS = createRemoteJWKSet(GINSE_JWKS_URL);
const GINSE_ACTION_DISABLED = true;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;
const STORE_NAME = "room50-ginse-runs";

interface StoredRun {
  record_version: 1;
  request_fingerprint: string;
  provider_operation_id: string;
  status: "succeeded";
  output: Room50Output;
  created_at: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: string[],
): Response {
  console.warn(
    JSON.stringify({
      event: "ginse_provider_rejection",
      status,
      code,
      ...(details && details.length > 0 ? { details } : {}),
    }),
  );
  return jsonResponse(
    {
      error: {
        code,
        message,
        ...(details && details.length > 0 ? { details } : {}),
      },
    },
    status,
  );
}

function unauthorized(message: string): Response {
  const response = errorResponse(401, "unauthorized", message);
  response.headers.set("WWW-Authenticate", "Bearer");
  return response;
}

async function authenticateGinse(request: Request): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);

  if (!match) return false;

  try {
    const { protectedHeader } = await jwtVerify(match[1], GINSE_JWKS, {
      algorithms: ["EdDSA"],
      issuer: GINSE_ISSUER,
      clockTolerance: 5,
    });

    return protectedHeader.alg === "EdDSA" && typeof protectedHeader.kid === "string";
  } catch {
    return false;
  }
}

function storageKey(idempotencyKey: string): string {
  const digest = createHash("sha256").update(idempotencyKey).digest("hex");
  return `run-${digest}`;
}

function isValidIdempotencyKey(value: string | null): value is string {
  return value !== null && value.length >= 1 && value.length <= 200;
}

function isStoredRun(value: unknown): value is StoredRun {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StoredRun>;

  if (
    candidate.record_version !== 1 ||
    candidate.status !== "succeeded" ||
    typeof candidate.request_fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(candidate.request_fingerprint) ||
    typeof candidate.provider_operation_id !== "string" ||
    !OPERATION_ID_PATTERN.test(candidate.provider_operation_id) ||
    typeof candidate.created_at !== "string"
  ) {
    return false;
  }

  try {
    assertValidOutput(candidate.output);
    return true;
  } catch {
    return false;
  }
}

function successResponse(run: StoredRun, replayed: boolean): Response {
  return jsonResponse(
    {
      status: "succeeded",
      provider_operation_id: run.provider_operation_id,
      replayed,
      output: run.output,
    },
    200,
  );
}

function replayOrConflict(
  stored: unknown,
  requestFingerprintValue: string,
): Response | null {
  if (stored === null) return null;

  if (!isStoredRun(stored)) {
    return errorResponse(
      503,
      "idempotency_state_unavailable",
      "The durable operation state could not be read safely.",
    );
  }

  if (stored.request_fingerprint !== requestFingerprintValue) {
    return errorResponse(
      409,
      "idempotency_conflict",
      "This Idempotency-Key is already bound to a different request.",
    );
  }

  return successResponse(stored, true);
}

async function parseJson(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length === 0 || body.length > 32_000) {
    throw new SchemaValidationError("Request body must contain a small JSON object.", []);
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new SchemaValidationError("Request body is not valid JSON.", []);
  }
}

function extractAdvertisedInput(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return payload;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "input")) {
    return (payload as { input: unknown }).input;
  }

  return payload;
}

export default async function handler(request: Request): Promise<Response> {
  if (GINSE_ACTION_DISABLED) {
    return errorResponse(
      410,
      "action_disabled",
      "The ROOM/50 Ginse action has been disabled by its owner.",
    );
  }

  if (request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use POST /run.");
  }

  if (!(await authenticateGinse(request))) {
    return unauthorized("A valid short-lived Ginse Ed25519 bearer token is required.");
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return errorResponse(
      400,
      "invalid_idempotency_key",
      "Idempotency-Key must contain 1–200 characters.",
    );
  }

  let input: ReturnType<typeof validateInput>;
  let output: Room50Output;

  try {
    input = validateInput(extractAdvertisedInput(await parseJson(request)));
    output = createRoom50Output(input, PUBLIC_ORIGIN);
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return errorResponse(400, "invalid_input", error.message, error.details);
    }
    return errorResponse(400, "invalid_input", "The request could not be validated.");
  }

  const requestFingerprintValue = requestFingerprint(input);
  const candidate: StoredRun = {
    record_version: 1,
    request_fingerprint: requestFingerprintValue,
    provider_operation_id: `room50_${randomUUID()}`,
    status: "succeeded",
    output,
    created_at: new Date().toISOString(),
  };

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const key = storageKey(idempotencyKey);
    const existing = (await store.get(key, {
      consistency: "strong",
      type: "json",
    })) as unknown;
    const existingResponse = replayOrConflict(existing, requestFingerprintValue);

    if (existingResponse) return existingResponse;

    const claim = await store.setJSON(key, candidate, { onlyIfNew: true });

    if (claim.modified) {
      return successResponse(candidate, false);
    }

    const stored = (await store.get(key, {
      consistency: "strong",
      type: "json",
    })) as unknown;

    return (
      replayOrConflict(stored, requestFingerprintValue) ??
      errorResponse(
        503,
        "idempotency_state_unavailable",
        "The durable operation state could not be read safely.",
      )
    );
  } catch {
    return errorResponse(
      503,
      "durable_store_unavailable",
      "The request was not accepted because durable idempotency storage is unavailable.",
    );
  }
}

export const config = {
  path: "/run",
};
