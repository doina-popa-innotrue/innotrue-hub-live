/**
 * Sentry utilities for consistent error tracking and breadcrumbs.
 *
 * Provides:
 * - captureSupabaseError() — wraps Supabase function invoke errors with context
 * - addBreadcrumb() — typed breadcrumb helper for key user flows
 * - withSpan() — wraps async operations in Sentry performance spans
 */

import * as Sentry from "@sentry/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BreadcrumbCategory =
  | "auth"
  | "enrollment"
  | "payment"
  | "navigation"
  | "content"
  | "assessment"
  | "admin"
  | "feature-gate";

export type BreadcrumbLevel = "info" | "warning" | "error" | "debug";

// ---------------------------------------------------------------------------
// Supabase Error Capture
// ---------------------------------------------------------------------------

/**
 * Captures a Supabase error with structured context.
 *
 * Handles both:
 * - PostgREST errors (from `.from()` queries) — `{ message, code, details }`
 * - Edge function errors (from `.functions.invoke()`) — error body in `error.context`
 *
 * @param error - The error object from Supabase
 * @param context - Description of what was being attempted
 * @param extra - Additional metadata to attach to the Sentry event
 */
export function captureSupabaseError(
  error: unknown,
  context: string,
  extra?: Record<string, unknown>,
): string | undefined {
  if (!error) return undefined;

  // Extract meaningful error info
  const errorObj = error instanceof Error ? error : new Error(String(error));

  const tags: Record<string, string> = {
    source: "supabase",
    context,
  };

  // PostgREST errors have `code` and `message`
  const pgError = error as { code?: string; message?: string; details?: string; hint?: string };
  if (pgError.code) {
    tags["pg.code"] = pgError.code;
  }

  // Edge function errors have the body in error.context (a Response object)
  const fnError = error as { context?: Response };
  if (fnError.context instanceof Response) {
    tags["fn.status"] = String(fnError.context.status);
  }

  return Sentry.captureException(errorObj, {
    tags,
    extra: {
      ...extra,
      supabase_details: pgError.details,
      supabase_hint: pgError.hint,
    },
  });
}

/**
 * Extract a user-friendly error message from a Supabase edge function error.
 * Supabase puts the actual error body in `error.context` (Response object),
 * NOT in `error.message` or `data`.
 *
 * @param error - The error from supabase.functions.invoke()
 * @returns A user-friendly error message
 */
export async function extractFunctionError(
  error: unknown,
  fallbackMessage = "An unexpected error occurred",
): Promise<string> {
  if (!error) return fallbackMessage;

  // Edge function errors: body is in error.context
  const fnError = error as { context?: Response; message?: string };
  if (fnError.context instanceof Response) {
    try {
      const body = await fnError.context.json();
      return body?.error || body?.message || fallbackMessage;
    } catch {
      return fnError.message || fallbackMessage;
    }
  }

  // Standard errors
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  return fallbackMessage;
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

/**
 * Add a typed breadcrumb to Sentry for tracing user journeys.
 *
 * Categories:
 * - auth: login, signup, signout, role switch
 * - enrollment: program enrollment, cohort join, waitlist
 * - payment: checkout, credit top-up, installment
 * - navigation: page transitions, deep links
 * - content: module launch, xAPI events, content completion
 * - assessment: start, submit, view results
 * - admin: CRUD operations, configuration changes
 * - feature-gate: access granted/denied, upgrade prompt shown
 */
export function addBreadcrumb(
  category: BreadcrumbCategory,
  message: string,
  data?: Record<string, unknown>,
  level: BreadcrumbLevel = "info",
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

// Convenience helpers for common flows

export const authBreadcrumb = (message: string, data?: Record<string, unknown>) =>
  addBreadcrumb("auth", message, data);

export const enrollmentBreadcrumb = (message: string, data?: Record<string, unknown>) =>
  addBreadcrumb("enrollment", message, data);

export const paymentBreadcrumb = (message: string, data?: Record<string, unknown>) =>
  addBreadcrumb("payment", message, data);

export const contentBreadcrumb = (message: string, data?: Record<string, unknown>) =>
  addBreadcrumb("content", message, data);

export const assessmentBreadcrumb = (message: string, data?: Record<string, unknown>) =>
  addBreadcrumb("assessment", message, data);

// ---------------------------------------------------------------------------
// Performance Spans
// ---------------------------------------------------------------------------

/**
 * Wrap an async operation in a Sentry performance span.
 * Returns the result of the operation.
 *
 * @example
 * const result = await withSpan("enrollment", "enroll-with-credits", async () => {
 *   return supabase.rpc("enroll_with_credits", params);
 * });
 */
export async function withSpan<T>(
  op: string,
  description: string,
  fn: () => Promise<T>,
  data?: Record<string, unknown>,
): Promise<T> {
  return Sentry.startSpan(
    {
      op,
      name: description,
      attributes: data as Record<string, string | number | boolean | undefined>,
    },
    async () => {
      return fn();
    },
  );
}

// ---------------------------------------------------------------------------
// Error Fingerprinting Helpers
// ---------------------------------------------------------------------------

/**
 * Group common Supabase errors by category for cleaner Sentry issue grouping.
 * Use in Sentry.init({ beforeSend }) to customize fingerprints.
 */
export function getErrorFingerprint(error: Error): string[] | undefined {
  const msg = error.message || "";

  // Network errors — group all together
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ERR_NETWORK")) {
    return ["network-error"];
  }

  // Auth session errors — group together
  if (msg.includes("JWT expired") || msg.includes("Invalid Refresh Token") || msg.includes("Auth session missing")) {
    return ["auth-session-error"];
  }

  // Supabase rate limiting
  if (msg.includes("Too many requests") || msg.includes("rate limit")) {
    return ["rate-limit-error"];
  }

  // PostgREST constraint violations
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
    return ["db-constraint-violation"];
  }

  // RLS policy denials
  if (msg.includes("new row violates row-level security") || msg.includes("permission denied")) {
    return ["rls-policy-error"];
  }

  // Timeouts
  if (msg.includes("timed out") || msg.includes("timeout")) {
    return ["timeout-error"];
  }

  // Let Sentry use default grouping
  return undefined;
}
