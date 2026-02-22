import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * Notify users on a cohort waitlist when spots become available.
 *
 * Input: { cohortId: string }
 * - Checks available spots via check_cohort_capacity
 * - Notifies the next N unnotified users (by position)
 * - Marks them as notified
 */

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // Validate authorization (anon key or service role key)
    const authHeader = req.headers.get("Authorization");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const providedToken = authHeader?.replace("Bearer ", "");
    if (providedToken !== supabaseAnonKey && providedToken !== supabaseServiceKey) {
      return errorResponse.unauthorized("Invalid or missing authorization token", cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { cohortId } = await req.json();

    if (!cohortId) {
      return errorResponse.badRequest("cohortId is required", cors);
    }

    console.log(`Checking cohort waitlist for cohort ${cohortId}`);

    // Get cohort details + program name
    const { data: cohort, error: cohortError } = await supabase
      .from("program_cohorts")
      .select("id, name, capacity, program_id, programs:program_id(name)")
      .eq("id", cohortId)
      .single();

    if (cohortError || !cohort) {
      return errorResponse.notFound("Cohort not found", cors);
    }

    const programName = (cohort.programs as any)?.name || "Unknown Program";

    // Check available spots
    const { data: capacityCheck, error: capError } = await supabase.rpc(
      "check_cohort_capacity",
      { p_cohort_id: cohortId },
    );

    if (capError) {
      return errorResponse.serverError("notify-cohort-waitlist", capError, cors);
    }

    const availableSpots = capacityCheck?.available_spots ?? 0;

    if (availableSpots <= 0) {
      return successResponse.ok(
        { success: true, notifiedCount: 0, message: "No spots available yet" },
        cors,
      );
    }

    // Get unnotified waitlist entries, ordered by position
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from("cohort_waitlist")
      .select("id, user_id, position")
      .eq("cohort_id", cohortId)
      .eq("notified", false)
      .order("position")
      .limit(availableSpots);

    if (waitlistError) {
      return errorResponse.serverError("notify-cohort-waitlist", waitlistError, cors);
    }

    let notifiedCount = 0;

    for (const entry of waitlistEntries || []) {
      try {
        // Get user email
        const { data: userData } = await supabase.auth.admin.getUserById(entry.user_id);
        if (!userData?.user?.email) continue;

        // Get user name from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", entry.user_id)
          .single();

        // Send notification email (reuses existing waitlist_spot_available template)
        const { error: emailError } = await supabase.functions.invoke(
          "send-notification-email",
          {
            body: {
              email: userData.user.email,
              name: profile?.name || "User",
              type: "waitlist_spot_available",
              timestamp: new Date().toISOString(),
              programName: programName,
              scheduleTitle: cohort.name,
              waitlistPosition: entry.position,
            },
          },
        );

        if (emailError) {
          console.error("Error sending email:", emailError);
          continue;
        }

        // Mark as notified
        await supabase
          .from("cohort_waitlist")
          .update({ notified: true, updated_at: new Date().toISOString() })
          .eq("id", entry.id);

        notifiedCount++;
        console.log(
          `Notified user ${userData.user.email} (position ${entry.position}) for cohort ${cohort.name}`,
        );
      } catch (error) {
        console.error("Error processing waitlist entry:", error);
      }
    }

    console.log(`Notified ${notifiedCount} user(s) from cohort waitlist`);

    return successResponse.ok(
      {
        success: true,
        notifiedCount,
        message: `Notified ${notifiedCount} user(s) from the waitlist for ${cohort.name}`,
      },
      cors,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in notify-cohort-waitlist:", errorMessage);
    return errorResponse.serverError("notify-cohort-waitlist", error, cors);
  }
});
