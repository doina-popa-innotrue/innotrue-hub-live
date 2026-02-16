/**
 * Shared error & success response utilities for edge functions.
 * Provides consistent JSON response format with CORS headers.
 *
 * Usage:
 *   import { errorResponse, successResponse } from "../_shared/error-response.ts";
 *   import { getCorsHeaders } from "../_shared/cors.ts";
 *
 *   const cors = getCorsHeaders(req);
 *   return errorResponse.badRequest("Missing required field: email", cors);
 *   return successResponse({ data: result }, cors);
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

function makeResponse(
  status: number,
  body: Record<string, unknown>,
  cors?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(cors ?? {}) },
  });
}

// ─── Error Responses ─────────────────────────────────────────────

/** 400 — Validation errors, missing fields, bad format */
function badRequest(message: string, cors?: Record<string, string>): Response {
  return makeResponse(400, { error: message }, cors);
}

/** 401 — Missing or invalid authentication */
function unauthorized(
  message = "Unauthorized",
  cors?: Record<string, string>,
): Response {
  return makeResponse(401, { error: message }, cors);
}

/** 403 — Authenticated but insufficient permissions */
function forbidden(
  message = "Forbidden",
  cors?: Record<string, string>,
): Response {
  return makeResponse(403, { error: message }, cors);
}

/** 404 — Resource not found */
function notFound(message: string, cors?: Record<string, string>): Response {
  return makeResponse(404, { error: message }, cors);
}

/** 429 — Rate limit exceeded */
function rateLimit(
  message = "Too many requests. Please try again later.",
  cors?: Record<string, string>,
): Response {
  return makeResponse(429, { error: message }, cors);
}

/** 500 — Internal server error. Logs the real error, returns a safe message. */
function serverError(
  logLabel: string,
  error?: unknown,
  cors?: Record<string, string>,
): Response {
  console.error(`[${logLabel}] Internal error:`, error);
  return makeResponse(500, { error: "Internal server error" }, cors);
}

/**
 * 500 — Internal server error with the actual error message exposed.
 * Use only when the error message is safe for the client (e.g. DB constraint names).
 */
function serverErrorWithMessage(
  message: string,
  cors?: Record<string, string>,
): Response {
  return makeResponse(500, { error: message }, cors);
}

export const errorResponse = {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  rateLimit,
  serverError,
  serverErrorWithMessage,
} as const;

// ─── Success Responses ───────────────────────────────────────────

/** 200 — Standard success response */
function ok(data: unknown, cors?: Record<string, string>): Response {
  return makeResponse(200, data as Record<string, unknown>, cors);
}

/** 201 — Created */
function created(data: unknown, cors?: Record<string, string>): Response {
  return makeResponse(201, data as Record<string, unknown>, cors);
}

/** 204 — No content (empty body) */
function noContent(cors?: Record<string, string>): Response {
  return new Response(null, { status: 204, headers: cors ?? {} });
}

export const successResponse = {
  ok,
  created,
  noContent,
} as const;
