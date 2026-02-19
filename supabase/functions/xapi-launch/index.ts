/**
 * xapi-launch — Creates an xAPI session and returns the launch URL
 *
 * POST /xapi-launch
 *   Body: { moduleId: string }
 *   Auth: Bearer JWT (user must be enrolled or staff)
 *
 * Creates an xapi_sessions record with a unique auth token, then returns:
 *   { launchUrl: "https://storage.../indexapi.html?endpoint=...&auth=...&actor=..." }
 *
 * The launchUrl is what the frontend loads in an iframe or new window.
 * Rise xAPI content will send statements to our xapi-statements endpoint
 * using the provided auth token.
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
    .select("id, program_id, title, content_package_path, content_package_type")
    .eq("id", moduleId)
    .single();

  if (moduleError || !moduleData) {
    return errorResponse.notFound("Module not found", cors);
  }

  if (!moduleData.content_package_path) {
    return errorResponse.badRequest("Module has no content package", cors);
  }

  if (moduleData.content_package_type !== "xapi") {
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

      const launchUrl = buildLaunchUrl(
        supabaseUrl,
        moduleData.content_package_path,
        authToken,
        user,
        moduleId,
      );

      return successResponse.ok({ launchUrl, sessionId: session.id }, cors);
    }
  }

  // ─── Create xAPI session ──────────────────────────────────────
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

  // ─── Build launch URL ─────────────────────────────────────────
  const launchUrl = buildLaunchUrl(
    supabaseUrl,
    moduleData.content_package_path,
    authToken,
    user,
    moduleId,
  );

  return successResponse.ok({ launchUrl, sessionId: session.id }, cors);
});

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
 * Build the Rise xAPI launch URL with required query parameters.
 *
 * Rise xAPI (Tin Can) exports expect:
 *   - endpoint: LRS statements endpoint URL
 *   - auth: Authorization header value (Basic <base64>)
 *   - actor: JSON-encoded xAPI Agent object
 *   - activity_id: (optional) IRI identifying this activity
 */
function buildLaunchUrl(
  supabaseUrl: string,
  contentPackagePath: string,
  authToken: string,
  user: { id: string; email?: string; user_metadata?: { full_name?: string } },
  moduleId: string,
): string {
  // The xAPI statements endpoint on our edge function
  const endpoint = `${supabaseUrl}/functions/v1/xapi-statements`;

  // Rise sends this value in the Authorization header of xAPI requests.
  // We use Basic auth format: "Basic <base64(token:)>"
  const basicAuth = `Basic ${btoa(authToken + ":")}`;

  // xAPI Actor — identifies the learner
  const actor = JSON.stringify({
    objectType: "Agent",
    account: {
      homePage: supabaseUrl,
      name: user.id,
    },
    name: user.user_metadata?.full_name || user.email || user.id,
  });

  // Activity ID — unique IRI for this module
  const activityId = `${supabaseUrl}/modules/${moduleId}`;

  // Content is served from private storage via serve-content-package proxy
  // The xAPI export uses indexapi.html as its entry point
  const contentUrl = `${supabaseUrl}/functions/v1/serve-content-package?module=${moduleId}&path=indexapi.html`;

  // Build the launch URL with all xAPI query params
  const params = new URLSearchParams({
    endpoint: endpoint,
    auth: basicAuth,
    actor: actor,
    activity_id: activityId,
  });

  return `${contentUrl}&${params.toString()}`;
}
