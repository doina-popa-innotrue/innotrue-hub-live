import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_EVENTS_PER_WINDOW = 30; // Max 30 events per minute per session
const MAX_CONSENT_PER_WINDOW = 5; // Max 5 consent records per minute per session

// Simple in-memory rate limiter (resets on function cold start)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// Validation constraints
const MAX_STRING_LENGTH = 500;
const MAX_JSONB_SIZE = 4096; // 4KB max for event properties

function validateString(value: unknown, maxLength = MAX_STRING_LENGTH): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value.slice(0, maxLength);
}

function validateEventProperties(properties: unknown): Record<string, unknown> {
  if (!properties || typeof properties !== "object") return {};
  
  const serialized = JSON.stringify(properties);
  if (serialized.length > MAX_JSONB_SIZE) {
    console.warn("Event properties exceeded size limit, truncating");
    return { _truncated: true };
  }
  
  // Sanitize: only allow primitive values
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
    const cleanKey = String(key).slice(0, 100);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[cleanKey] = typeof value === "string" ? value.slice(0, MAX_STRING_LENGTH) : value;
    }
  }
  return sanitized;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { type, payload } = body;

    if (!type || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing type or payload" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Get client IP for additional rate limiting context
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (type === "analytics_event") {
      const { session_id, event_name, event_category, event_properties, page_url, referrer, user_agent, user_id } = payload;

      // Validate required fields
      if (!session_id || typeof session_id !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid session_id" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      if (!event_name || typeof event_name !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid event_name" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // Server-side exclusion check (GDPR compliance - ensures tracking is blocked
      // even if client-side checks are bypassed or localStorage is manipulated)
      if (user_id) {
        const { data: excludedUser } = await supabase
          .from("analytics_excluded_users")
          .select("id")
          .eq("user_id", user_id)
          .maybeSingle();

        if (excludedUser) {
          console.log(`Blocking analytics event for excluded user ${user_id}`);
          return new Response(
            JSON.stringify({ success: true, blocked: true }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      }

      // Rate limit check
      const rateLimitKey = `analytics:${session_id}:${clientIp}`;
      if (!checkRateLimit(rateLimitKey, MAX_EVENTS_PER_WINDOW)) {
        console.warn(`Rate limit exceeded for session ${session_id}`);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // Insert validated event
      const { error } = await supabase.from("analytics_events").insert({
        user_id: user_id || null,
        session_id: validateString(session_id, 100),
        event_name: validateString(event_name, 100),
        event_category: validateString(event_category, 50),
        event_properties: validateEventProperties(event_properties),
        page_url: validateString(page_url, 2048),
        referrer: validateString(referrer, 2048),
        user_agent: validateString(user_agent, 500),
      });

      if (error) {
        console.error("Failed to insert analytics event:", error);
        return new Response(
          JSON.stringify({ error: "Failed to record event" }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      console.log(`Analytics event recorded: ${event_name} for session ${session_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );

    } else if (type === "cookie_consent") {
      const { session_id, user_id, necessary, analytics, marketing, user_agent } = payload;

      // Validate required fields
      if (!session_id || typeof session_id !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid session_id" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // Rate limit check (more restrictive for consent)
      const rateLimitKey = `consent:${session_id}:${clientIp}`;
      if (!checkRateLimit(rateLimitKey, MAX_CONSENT_PER_WINDOW)) {
        console.warn(`Consent rate limit exceeded for session ${session_id}`);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // Insert validated consent
      const { error } = await supabase.from("cookie_consent").insert({
        user_id: user_id || null,
        session_id: validateString(session_id, 100),
        necessary: Boolean(necessary),
        analytics: Boolean(analytics),
        marketing: Boolean(marketing),
        user_agent: validateString(user_agent, 500),
        ip_address: clientIp !== "unknown" ? clientIp.slice(0, 45) : null,
      });

      if (error) {
        console.error("Failed to insert cookie consent:", error);
        return new Response(
          JSON.stringify({ error: "Failed to record consent" }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      console.log(`Cookie consent recorded for session ${session_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid type" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error in track-analytics:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
