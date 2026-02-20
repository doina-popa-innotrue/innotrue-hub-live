/**
 * xapi-launch — Creates or resumes an xAPI session and returns xAPI config for the frontend
 *
 * POST /xapi-launch
 *   Body: { moduleId: string }
 *   Auth: Bearer JWT (user must be enrolled or staff)
 *
 * If an active (non-terminated, non-completed) session exists for this user+module,
 * it is resumed — returning the saved bookmark and suspend_data so Rise can restore
 * the learner's position. Otherwise, a new session is created.
 *
 * Returns:
 *   {
 *     sessionId: string,
 *     resumed: boolean,         // true if resuming an existing session
 *     bookmark: string,         // saved scroll/page position (empty if new)
 *     suspendData: string,      // saved course state (empty if new)
 *     xapiConfig: {
 *       endpoint: string,       // LRS statements endpoint URL
 *       auth: string,           // Authorization header value (Basic <base64>)
 *       actor: object,          // xAPI Agent identifying the learner
 *       activityId: string      // IRI identifying this activity/module
 *     }
 *   }
 *
 * The frontend installs an LMS API mock on the parent window using xapiConfig.
 * Rise content in the blob iframe calls window.parent.IsLmsPresent() etc.
 * xAPI statements are sent from the parent window (app origin) to avoid CORS.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return errorResponse.badRequest("Only POST requests are supported", cors);
  }

  // ─── Auth: verify JWT ─────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse.unauthorized("Missing Authorization header", cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return errorResponse.unauthorized("Invalid or expired token", cors);
  }

  // ─── Parse body ───────────────────────────────────────────────
  let body: { moduleId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse.badRequest("Invalid JSON body", cors);
  }

  const { moduleId } = body;
  if (!moduleId) {
    return errorResponse.badRequest("Missing required field: moduleId", cors);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // ─── Get module + verify content package ──────────────────────
  const { data: moduleData, error: moduleError } = await serviceClient
    .from("program_modules")
    .select("id, program_id, title, content_package_path, content_package_type, content_package_id, content_packages(storage_path, package_type)")
    .eq("id", moduleId)
    .single();

  if (moduleError || !moduleData) {
    return errorResponse.notFound("Module not found", cors);
  }

  // Resolve effective content path: content_package_id (shared) takes precedence over legacy
  const effectiveContentPath = (moduleData.content_package_id && moduleData.content_packages?.storage_path)
    ? moduleData.content_packages.storage_path
    : moduleData.content_package_path;

  const effectivePackageType = (moduleData.content_package_id && moduleData.content_packages?.package_type)
    ? moduleData.content_packages.package_type
    : moduleData.content_package_type;

  if (!effectiveContentPath) {
    return errorResponse.badRequest("Module has no content package", cors);
  }

  if (effectivePackageType !== "xapi") {
    return errorResponse.badRequest(
      "Module is not configured for xAPI launch (content_package_type must be 'xapi')",
      cors,
    );
  }

  // ─── Access check: enrolled or staff ──────────────────────────
  const { data: roles } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const userRoles = (roles || []).map((r: { role: string }) => r.role);
  const isStaff =
    userRoles.includes("admin") ||
    userRoles.includes("instructor") ||
    userRoles.includes("coach");

  let enrollmentId: string | null = null;

  if (!isStaff) {
    const { data: enrollment } = await serviceClient
      .from("client_enrollments")
      .select("id")
      .eq("client_user_id", user.id)
      .eq("program_id", moduleData.program_id)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!enrollment) {
      return errorResponse.forbidden("Not enrolled in this program", cors);
    }
    enrollmentId = enrollment.id;
  } else {
    // Staff: find or create a synthetic enrollment for tracking
    const { data: enrollment } = await serviceClient
      .from("client_enrollments")
      .select("id")
      .eq("client_user_id", user.id)
      .eq("program_id", moduleData.program_id)
      .limit(1)
      .single();

    enrollmentId = enrollment?.id || null;

    // Staff without enrollment — skip progress tracking but still allow launch
    if (!enrollmentId) {
      // Try to resume an existing active session for staff
      const { resumed, response } = await tryResumeSession(
        serviceClient, supabaseUrl, user, moduleId,
        "00000000-0000-0000-0000-000000000000", cors,
      );
      if (resumed) return response!;

      // Create a minimal session without enrollment
      const authToken = generateToken();
      const { data: session, error: sessionError } = await serviceClient
        .from("xapi_sessions")
        .insert({
          user_id: user.id,
          module_id: moduleId,
          enrollment_id: "00000000-0000-0000-0000-000000000000", // placeholder
          auth_token: authToken,
          status: "launched",
        })
        .select("id")
        .single();

      if (sessionError) {
        return errorResponse.serverError("xapi-launch-session", sessionError, cors);
      }

      const xapiConfig = buildXapiConfig(supabaseUrl, authToken, user, moduleId);

      return successResponse.ok({
        sessionId: session.id, resumed: false, bookmark: "", suspendData: "", xapiConfig,
      }, cors);
    }
  }

  // ─── Try to resume an existing active session ──────────────────
  const { resumed, response } = await tryResumeSession(
    serviceClient, supabaseUrl, user, moduleId, enrollmentId!, cors,
  );
  if (resumed) return response!;

  // ─── Create new xAPI session ──────────────────────────────────
  const authToken = generateToken();

  const { data: session, error: sessionError } = await serviceClient
    .from("xapi_sessions")
    .insert({
      user_id: user.id,
      module_id: moduleId,
      enrollment_id: enrollmentId,
      auth_token: authToken,
      status: "launched",
    })
    .select("id")
    .single();

  if (sessionError) {
    return errorResponse.serverError("xapi-launch-session", sessionError, cors);
  }

  // ─── Auto-set module progress to in_progress ──────────────────
  await serviceClient
    .from("module_progress")
    .upsert(
      {
        enrollment_id: enrollmentId,
        module_id: moduleId,
        status: "in_progress",
      },
      { onConflict: "enrollment_id,module_id", ignoreDuplicates: true },
    );

  // ─── Build xAPI config for the frontend ─────────────────────
  const xapiConfig = buildXapiConfig(supabaseUrl, authToken, user, moduleId);

  return successResponse.ok({
    sessionId: session.id, resumed: false, bookmark: "", suspendData: "", xapiConfig,
  }, cors);
});

/**
 * Try to find and resume an existing active session for this user + module.
 * Returns { resumed: true, response } if a session was found, or { resumed: false }.
 *
 * An active session is one with status in ('launched', 'initialized') — i.e. not
 * completed, terminated, or abandoned. We reuse its auth_token and return the
 * saved bookmark/suspend_data so the frontend can restore the learner's position.
 */
async function tryResumeSession(
  serviceClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  user: { id: string; email?: string; user_metadata?: { full_name?: string } },
  moduleId: string,
  enrollmentId: string,
  cors: Record<string, string>,
): Promise<{ resumed: boolean; response?: Response }> {
  const { data: existingSession } = await serviceClient
    .from("xapi_sessions")
    .select("id, auth_token, bookmark, suspend_data, status")
    .eq("user_id", user.id)
    .eq("module_id", moduleId)
    .in("status", ["launched", "initialized"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingSession) return { resumed: false };

  // Reuse the existing session — reset status to initialized for the new page load
  await serviceClient
    .from("xapi_sessions")
    .update({ status: "initialized", initialized_at: new Date().toISOString() })
    .eq("id", existingSession.id);

  const xapiConfig = buildXapiConfig(supabaseUrl, existingSession.auth_token, user, moduleId);

  return {
    resumed: true,
    response: successResponse.ok({
      sessionId: existingSession.id,
      resumed: true,
      bookmark: existingSession.bookmark || "",
      suspendData: existingSession.suspend_data || "",
      xapiConfig,
    }, cors),
  };
}

/**
 * Generate a secure random auth token for xAPI session.
 * Uses base64url encoding for URL safety.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Build the xAPI configuration object for the frontend.
 *
 * The frontend installs an LMS API mock on window using these values.
 * Rise content in the blob iframe calls window.parent.IsLmsPresent() etc.
 * xAPI statements are sent from the app origin to avoid CORS issues.
 */
function buildXapiConfig(
  supabaseUrl: string,
  authToken: string,
  user: { id: string; email?: string; user_metadata?: { full_name?: string } },
  moduleId: string,
): {
  endpoint: string;
  auth: string;
  actor: { objectType: string; account: { homePage: string; name: string }; name: string };
  activityId: string;
} {
  // The xAPI statements endpoint on our edge function
  const endpoint = `${supabaseUrl}/functions/v1/xapi-statements`;

  // Authorization header value — Basic auth format: "Basic <base64(token:)>"
  const auth = `Basic ${btoa(authToken + ":")}`;

  // xAPI Actor — identifies the learner
  const actor = {
    objectType: "Agent",
    account: {
      homePage: supabaseUrl,
      name: user.id,
    },
    name: user.user_metadata?.full_name || user.email || user.id,
  };

  // Activity ID — unique IRI for this module
  const activityId = `${supabaseUrl}/modules/${moduleId}`;

  return { endpoint, auth, actor, activityId };
}
