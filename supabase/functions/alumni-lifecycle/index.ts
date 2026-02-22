import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * 2B.1: Alumni Lifecycle — Cron-based nurture email scheduler
 *
 * Runs daily (via pg_cron or manual invocation). Sends nurture emails at:
 * - 0 days: Completion congratulations
 * - 30 days: 30-day nurture
 * - 60 days: 60-day nurture
 * - 90 days: 90-day nurture
 * - Grace period expired: Access ended notification + re-enrollment CTA
 *
 * Each touchpoint is recorded in alumni_touchpoints to prevent duplicates.
 */

interface TouchpointConfig {
  type: string;
  daysAfterCompletion: number;
  emailSubject: string;
  emailTemplate: string;
}

const TOUCHPOINTS: TouchpointConfig[] = [
  {
    type: "completion_congratulations",
    daysAfterCompletion: 0,
    emailSubject: "Congratulations on completing {program_name}!",
    emailTemplate: "You have successfully completed **{program_name}**. Your accomplishment reflects dedication and hard work. You'll continue to have read-only access to your program content for {grace_days} days.",
  },
  {
    type: "nurture_30d",
    daysAfterCompletion: 30,
    emailSubject: "How are you applying what you learned? — {program_name}",
    emailTemplate: "It's been 30 days since you completed **{program_name}**. We'd love to hear how you're applying what you learned. Your read-only access to program content continues for {days_remaining} more days.",
  },
  {
    type: "nurture_60d",
    daysAfterCompletion: 60,
    emailSubject: "Check in: {program_name} alumni",
    emailTemplate: "It's been 60 days since you completed **{program_name}**. Remember, you still have {days_remaining} days of read-only access to review your program materials.",
  },
  {
    type: "nurture_90d",
    daysAfterCompletion: 90,
    emailSubject: "Your {program_name} journey continues",
    emailTemplate: "It's been 90 days since you completed **{program_name}**. Your read-only access period is coming to an end soon. Consider re-enrolling to continue your growth journey.",
  },
  {
    type: "access_expired",
    daysAfterCompletion: -1, // Computed dynamically from grace period setting
    emailSubject: "Your alumni access to {program_name} has ended",
    emailTemplate: "Your read-only alumni access to **{program_name}** has ended. If you'd like to continue learning, consider re-enrolling in the program.",
  },
];

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Get grace period setting
    const { data: graceSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "alumni_grace_period_days")
      .single();
    const graceDays = parseInt(graceSetting?.value || "90");

    let totalSent = 0;
    const results: { type: string; sent: number; errors: number }[] = [];

    // Process each touchpoint type
    for (const touchpoint of TOUCHPOINTS) {
      let sent = 0;
      let errors = 0;

      const effectiveDays =
        touchpoint.type === "access_expired" ? graceDays : touchpoint.daysAfterCompletion;

      // Query enrollments that qualify for this touchpoint
      // completed_at + daysAfterCompletion should be within last 24h (daily cron window)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - effectiveDays);
      const windowStart = new Date(targetDate);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(targetDate);
      windowEnd.setHours(23, 59, 59, 999);

      // Special case: completion_congratulations — completed within last 24h
      let query = supabase
        .from("client_enrollments")
        .select(`
          id,
          client_user_id,
          program_id,
          completed_at,
          programs:program_id(name, slug)
        `)
        .eq("status", "completed")
        .not("completed_at", "is", null);

      if (touchpoint.type === "completion_congratulations") {
        // Completed within last 24h
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        query = query.gte("completed_at", oneDayAgo.toISOString());
      } else {
        // Completed around N days ago (within a 24h window)
        query = query
          .gte("completed_at", windowStart.toISOString())
          .lte("completed_at", windowEnd.toISOString());
      }

      const { data: eligibleEnrollments, error: queryError } = await query;

      if (queryError) {
        console.error(`Error querying for ${touchpoint.type}:`, queryError);
        results.push({ type: touchpoint.type, sent: 0, errors: 1 });
        continue;
      }

      if (!eligibleEnrollments || eligibleEnrollments.length === 0) {
        results.push({ type: touchpoint.type, sent: 0, errors: 0 });
        continue;
      }

      // Process each eligible enrollment
      for (const enrollment of eligibleEnrollments) {
        try {
          // Check if touchpoint already sent (UNIQUE constraint will catch this too)
          const { data: existing } = await supabase
            .from("alumni_touchpoints")
            .select("id")
            .eq("enrollment_id", enrollment.id)
            .eq("touchpoint_type", touchpoint.type)
            .maybeSingle();

          if (existing) continue; // Already sent

          const programName = (enrollment as any).programs?.name || "your program";
          const completedAt = new Date(enrollment.completed_at!);
          const graceExpiresAt = new Date(completedAt);
          graceExpiresAt.setDate(graceExpiresAt.getDate() + graceDays);
          const daysRemaining = Math.max(
            0,
            Math.ceil((graceExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          );

          // Render email content
          const subject = touchpoint.emailSubject
            .replace("{program_name}", programName);
          const body = touchpoint.emailTemplate
            .replace(/{program_name}/g, programName)
            .replace("{grace_days}", String(graceDays))
            .replace("{days_remaining}", String(daysRemaining));

          // Send notification email
          await supabase.functions.invoke("send-notification-email", {
            body: {
              userId: enrollment.client_user_id,
              subject,
              body,
              type: `alumni_${touchpoint.type}`,
            },
          });

          // Record touchpoint
          const { error: insertError } = await supabase
            .from("alumni_touchpoints")
            .insert({
              enrollment_id: enrollment.id,
              touchpoint_type: touchpoint.type,
            });

          if (insertError) {
            // Likely UNIQUE constraint violation = already processed
            console.warn(`Touchpoint insert error for ${enrollment.id}:`, insertError.message);
          } else {
            sent++;
          }

          // Also create an in-app notification
          try {
            await supabase.rpc("create_notification", {
              p_user_id: enrollment.client_user_id,
              p_type_key: `alumni_${touchpoint.type}`,
              p_title: subject,
              p_message: body,
              p_link: `/programs/${(enrollment as any).programs?.slug || enrollment.program_id}`,
              p_metadata: {
                enrollment_id: enrollment.id,
                touchpoint_type: touchpoint.type,
                program_name: programName,
              },
            });
          } catch {
            // Non-fatal
          }
        } catch (err) {
          console.error(`Error processing ${touchpoint.type} for ${enrollment.id}:`, err);
          errors++;
        }
      }

      results.push({ type: touchpoint.type, sent, errors });
      totalSent += sent;
    }

    console.log(`Alumni lifecycle complete: ${totalSent} emails sent`, results);

    return successResponse.ok({ success: true, totalSent, results }, cors);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in alumni-lifecycle:", errorMessage);
    return errorResponse.serverError("alumni-lifecycle", error, cors);
  }
});
