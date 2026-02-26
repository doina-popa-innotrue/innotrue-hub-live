import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * submit-wheel-intent — Public edge function (no JWT required)
 * Handles Wheel of Life assessment intent submission using service role.
 * WheelAssessment.tsx calls this instead of inserting directly into ac_signup_intents
 * (which would fail due to RLS requiring authentication).
 */

interface WheelIntentRequest {
  email: string;
  name?: string;
  ratings: Record<string, number>;
  notes?: string;
  subscribe_newsletter?: boolean;
  plan_interest?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body: WheelIntentRequest = await req.json();
    const { email, name, ratings, notes, subscribe_newsletter, plan_interest } = body;

    if (!email) {
      return errorResponse.badRequest("Email is required", cors);
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse.badRequest("Invalid email format", cors);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const normalizedEmail = email.trim().toLowerCase();

    // Upsert into ac_signup_intents — update if email already exists
    const { error } = await supabaseAdmin
      .from("ac_signup_intents")
      .upsert(
        {
          email: normalizedEmail,
          name: name?.trim() || null,
          status: plan_interest ? "plan_selected" : "wheel_completed",
          plan_interest: plan_interest || null,
          notes: JSON.stringify({
            wheel_ratings: ratings,
            notes: notes || null,
            subscribe_newsletter: subscribe_newsletter ?? false,
          }),
          consent_given: subscribe_newsletter ?? false,
        },
        { onConflict: "email" }
      );

    if (error) {
      console.error("Error saving wheel intent:", error);
      return errorResponse.serverError("submit-wheel-intent", error, cors);
    }

    return successResponse.ok({ success: true }, cors);
  } catch (error) {
    return errorResponse.serverError("submit-wheel-intent", error, cors);
  }
};

serve(handler);
