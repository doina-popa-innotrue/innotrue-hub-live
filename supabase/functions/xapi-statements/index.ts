/**
 * xapi-statements — Lightweight LRS endpoint for Rise xAPI content
 *
 * POST /xapi-statements — Store xAPI statement(s) from Rise AU
 * GET  /xapi-statements — Retrieve statements (for LMS querying)
 *
 * Auth: Bearer token from xapi_sessions (issued by xapi-launch)
 * Follows xAPI 1.0.3 Communication spec for the Statements Resource.
 *
 * On completion/passed verbs, auto-updates module_progress to "completed".
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

// Verbs that indicate the learner has finished the content
const COMPLETION_VERBS = new Set([
  "http://adlnet.gov/expapi/verbs/completed",
  "http://adlnet.gov/expapi/verbs/passed",
  "http://adlnet.gov/expapi/verbs/mastered",
]);

const VERB_INITIALIZED = "http://adlnet.gov/expapi/verbs/initialized";
const VERB_TERMINATED = "http://adlnet.gov/expapi/verbs/terminated";

interface XAPIStatement {
  id?: string;
  actor: {
    mbox?: string;
    account?: { name: string; homePage: string };
    name?: string;
  };
  verb: {
    id: string;
    display?: Record<string, string>;
  };
  object: {
    id: string;
    definition?: {
      name?: Record<string, string>;
      type?: string;
    };
    objectType?: string;
  };
  result?: {
    completion?: boolean;
    success?: boolean;
    score?: { scaled?: number; raw?: number; min?: number; max?: number };
    duration?: string;
  };
  context?: {
    registration?: string;
    extensions?: Record<string, unknown>;
  };
  timestamp?: string;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    // xAPI requires X-Experience-API-Version in CORS preflight
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, X-Experience-API-Version",
        "X-Experience-API-Version": "1.0.3",
      },
    });
  }

  // ─── Validate auth token ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse.unauthorized("Missing Authorization header", cors);
  }

  // Extract the raw auth token from the Authorization header.
  // The frontend sends "Basic <base64(rawToken:)>" (standard Basic auth format).
  // We need to decode the base64 to get the raw token that matches xapi_sessions.auth_token.
  let token = "";
  if (authHeader.toLowerCase().startsWith("basic ")) {
    const base64Part = authHeader.substring(6).trim();
    try {
      const decoded = atob(base64Part); // "rawToken:"
      token = decoded.replace(/:$/, ""); // strip trailing colon
    } catch {
      return errorResponse.unauthorized("Invalid Basic auth encoding", cors);
    }
  } else if (authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    token = authHeader.trim();
  }
  if (!token) {
    return errorResponse.unauthorized("Invalid Authorization token", cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // Look up the session by auth token
  const { data: session, error: sessionError } = await serviceClient
    .from("xapi_sessions")
    .select("id, user_id, module_id, enrollment_id, status")
    .eq("auth_token", token)
    .single();

  if (sessionError || !session) {
    return errorResponse.unauthorized("Invalid or expired session token", cors);
  }

  // Reject statements for already-terminated sessions
  if (session.status === "terminated" || session.status === "abandoned") {
    return errorResponse.badRequest(
      `Session already ${session.status}; no more statements accepted`,
      cors,
    );
  }

  // ─── PUT with stateId: Save session state (bookmark / suspend_data) ──
  const requestUrl = new URL(req.url);
  const stateId = requestUrl.searchParams.get("stateId");

  if (req.method === "PUT" && stateId) {
    let stateBody: { value?: string };
    try {
      stateBody = await req.json();
    } catch {
      return errorResponse.badRequest("Invalid JSON body", cors);
    }

    const value = stateBody.value ?? "";
    const updateFields: Record<string, string> = {};

    if (stateId === "bookmark") {
      updateFields.bookmark = value;
    } else if (stateId === "suspend_data") {
      updateFields.suspend_data = value;
    } else {
      return errorResponse.badRequest(`Unknown stateId: ${stateId}`, cors);
    }

    const { error: updateError } = await serviceClient
      .from("xapi_sessions")
      .update(updateFields)
      .eq("id", session.id);

    if (updateError) {
      console.error(`[xapi-statements] State update error (${stateId}):`, updateError);
      return errorResponse.serverError("xapi-statements-state", updateError, cors);
    }

    const responseHeaders = { ...cors, "X-Experience-API-Version": "1.0.3" };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...responseHeaders },
    });
  }

  // ─── POST: Store statement(s) ─────────────────────────────────
  if (req.method === "POST" || req.method === "PUT") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse.badRequest("Invalid JSON body", cors);
    }

    const statements: XAPIStatement[] = Array.isArray(body)
      ? body
      : [body as XAPIStatement];

    if (statements.length === 0) {
      return errorResponse.badRequest("No statements provided", cors);
    }

    const storedIds: string[] = [];

    for (const stmt of statements) {
      if (!stmt.verb?.id || !stmt.object?.id) {
        continue; // Skip malformed statements
      }

      const verbId = stmt.verb.id;
      const verbDisplay =
        stmt.verb.display?.["en-US"] ||
        stmt.verb.display?.["en"] ||
        Object.values(stmt.verb.display || {})[0] ||
        verbId.split("/").pop() ||
        "";
      const objectName =
        stmt.object.definition?.name?.["en-US"] ||
        stmt.object.definition?.name?.["en"] ||
        Object.values(stmt.object.definition?.name || {})[0] ||
        "";

      // Store the statement
      const { data: inserted, error: insertError } = await serviceClient
        .from("xapi_statements")
        .insert({
          session_id: session.id,
          user_id: session.user_id,
          module_id: session.module_id,
          statement_id: stmt.id || crypto.randomUUID(),
          verb_id: verbId,
          verb_display: verbDisplay,
          object_id: stmt.object.id,
          object_name: objectName,
          result_completion: stmt.result?.completion ?? null,
          result_success: stmt.result?.success ?? null,
          result_score_scaled: stmt.result?.score?.scaled ?? null,
          result_score_raw: stmt.result?.score?.raw ?? null,
          result_duration: stmt.result?.duration ?? null,
          raw_statement: stmt,
          statement_timestamp: stmt.timestamp || new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[xapi-statements] Insert error:", insertError);
        continue;
      }

      storedIds.push(inserted.id);

      // ── Update session status based on verb ──
      if (verbId === VERB_INITIALIZED && session.status === "launched") {
        await serviceClient
          .from("xapi_sessions")
          .update({ status: "initialized", initialized_at: new Date().toISOString() })
          .eq("id", session.id);
        session.status = "initialized";
      }

      if (verbId === VERB_TERMINATED) {
        await serviceClient
          .from("xapi_sessions")
          .update({ status: "terminated", terminated_at: new Date().toISOString() })
          .eq("id", session.id);
        session.status = "terminated";
      }

      // ── Auto-complete module on completion verbs ──
      if (COMPLETION_VERBS.has(verbId) || stmt.result?.completion === true) {
        await serviceClient
          .from("xapi_sessions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", session.id);

        // Update module_progress to completed
        const { error: progressError } = await serviceClient
          .from("module_progress")
          .upsert(
            {
              enrollment_id: session.enrollment_id,
              module_id: session.module_id,
              status: "completed",
              completed_at: new Date().toISOString(),
              notes: `Auto-completed via xAPI: ${verbDisplay}`,
            },
            { onConflict: "enrollment_id,module_id" },
          );

        if (progressError) {
          console.error("[xapi-statements] Progress update error:", progressError);
        } else {
          console.log(
            `[xapi-statements] Module ${session.module_id} auto-completed for user ${session.user_id}`,
          );
        }

        // ── CT3: Write content-level completion for cross-program tracking ──
        const { data: moduleInfo } = await serviceClient
          .from("program_modules")
          .select("content_package_id")
          .eq("id", session.module_id)
          .single();

        if (moduleInfo?.content_package_id) {
          const { error: contentCompletionError } = await serviceClient
            .from("content_completions")
            .upsert(
              {
                user_id: session.user_id,
                content_package_id: moduleInfo.content_package_id,
                completed_at: new Date().toISOString(),
                source_module_id: session.module_id,
                source_enrollment_id: session.enrollment_id,
                result_score_scaled: stmt.result?.score?.scaled ?? null,
              },
              { onConflict: "user_id,content_package_id" },
            );

          if (contentCompletionError) {
            console.error("[xapi-statements] Content completion insert error:", contentCompletionError);
          } else {
            console.log(
              `[xapi-statements] Content completion recorded for package ${moduleInfo.content_package_id}, user ${session.user_id}`,
            );
          }
        }
      }
    }

    // xAPI spec: return array of statement IDs
    const responseHeaders = { ...cors, "X-Experience-API-Version": "1.0.3" };
    return new Response(JSON.stringify(storedIds), {
      status: 200,
      headers: { "Content-Type": "application/json", ...responseHeaders },
    });
  }

  // ─── GET: Query statements ────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);

    const { data: statements, error: queryError } = await serviceClient
      .from("xapi_statements")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (queryError) {
      return errorResponse.serverError("xapi-statements-query", queryError, cors);
    }

    const responseHeaders = { ...cors, "X-Experience-API-Version": "1.0.3" };
    return new Response(JSON.stringify({ statements: statements || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...responseHeaders },
    });
  }

  return errorResponse.badRequest("Method not supported", cors);
});
