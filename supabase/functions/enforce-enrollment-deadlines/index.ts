import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * 2B.10: Enrollment Duration — Deadline Enforcement Cron
 *
 * Runs daily at 5 AM UTC. Three phases:
 * 1. Send 30-day warning for active enrollments expiring ~30 days from now
 * 2. Send 7-day warning for active enrollments expiring ~7 days from now
 * 3. Auto-complete active enrollments past end_date (triggers alumni lifecycle)
 *
 * Each touchpoint is recorded in enrollment_deadline_touchpoints to prevent duplicates.
 */

interface TouchpointConfig {
  type: string;
  daysBeforeExpiry: number;
  emailSubject: string;
  emailTemplate: string;
  isExpiry: boolean;
}

const TOUCHPOINTS: TouchpointConfig[] = [
  {
    type: "deadline_warning_30d",
    daysBeforeExpiry: 30,
    isExpiry: false,
    emailSubject: "Your {program_name} enrollment expires in {days_remaining} days",
    emailTemplate:
      "Your enrollment in **{program_name}** will expire on **{end_date_formatted}**. " +
      "You have **{days_remaining} days** to complete the program. " +
      "After expiry, you'll transition to alumni status with read-only access for a limited grace period.",
  },
  {
    type: "deadline_warning_7d",
    daysBeforeExpiry: 7,
    isExpiry: false,
    emailSubject: "7 days left: {program_name} enrollment expiring soon",
    emailTemplate:
      "Your enrollment in **{program_name}** expires on **{end_date_formatted}**. " +
      "You have only **{days_remaining} days** remaining. " +
      "Complete your modules before the deadline to finish the program on your own terms.",
  },
  {
    type: "deadline_expired",
    daysBeforeExpiry: 0,
    isExpiry: true,
    emailSubject: "Your {program_name} enrollment has ended",
    emailTemplate:
      "Your enrollment in **{program_name}** has reached its deadline and has been marked as completed. " +
      "You now have alumni access with read-only content access for {grace_days} days. " +
      "If you'd like to continue learning with full access, consider re-enrolling.",
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

    // Get alumni grace period for expiry message
    const { data: graceSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "alumni_grace_period_days")
      .single();
    const graceDays = parseInt(graceSetting?.value || "90");

    let totalProcessed = 0;
    const results: { type: string; sent: number; transitioned: number; errors: number }[] = [];

    for (const touchpoint of TOUCHPOINTS) {
      let sent = 0;
      let transitioned = 0;
      let errors = 0;

      // Build the query for eligible enrollments
      let eligibleEnrollments;

      if (touchpoint.isExpiry) {
        // Expiry: find active enrollments where end_date has passed
        const { data, error } = await supabase
          .from("client_enrollments")
          .select(`
            id,
            client_user_id,
            program_id,
            end_date,
            programs:program_id(name, slug)
          `)
          .eq("status", "active")
          .not("end_date", "is", null)
          .lt("end_date", new Date().toISOString());

        if (error) {
          console.error(`Error querying expired enrollments:`, error);
          results.push({ type: touchpoint.type, sent: 0, transitioned: 0, errors: 1 });
          continue;
        }
        eligibleEnrollments = data;
      } else {
        // Warning: find active enrollments expiring approximately N days from now
        // Use a 24-hour window centered on the target date
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + touchpoint.daysBeforeExpiry);
        const windowStart = new Date(targetDate);
        windowStart.setHours(0, 0, 0, 0);
        const windowEnd = new Date(targetDate);
        windowEnd.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from("client_enrollments")
          .select(`
            id,
            client_user_id,
            program_id,
            end_date,
            programs:program_id(name, slug)
          `)
          .eq("status", "active")
          .not("end_date", "is", null)
          .gte("end_date", windowStart.toISOString())
          .lte("end_date", windowEnd.toISOString());

        if (error) {
          console.error(`Error querying for ${touchpoint.type}:`, error);
          results.push({ type: touchpoint.type, sent: 0, transitioned: 0, errors: 1 });
          continue;
        }
        eligibleEnrollments = data;
      }

      if (!eligibleEnrollments || eligibleEnrollments.length === 0) {
        results.push({ type: touchpoint.type, sent: 0, transitioned: 0, errors: 0 });
        continue;
      }

      for (const enrollment of eligibleEnrollments) {
        try {
          // Check if touchpoint already sent (UNIQUE constraint is safety net)
          const { data: existing } = await supabase
            .from("enrollment_deadline_touchpoints")
            .select("id")
            .eq("enrollment_id", enrollment.id)
            .eq("touchpoint_type", touchpoint.type)
            .maybeSingle();

          if (existing) continue;

          // For expiry: transition enrollment to completed first
          if (touchpoint.isExpiry) {
            const { error: updateError } = await supabase
              .from("client_enrollments")
              .update({ status: "completed" })
              .eq("id", enrollment.id);

            if (updateError) {
              console.error(`Failed to complete enrollment ${enrollment.id}:`, updateError);
              errors++;
              continue;
            }
            transitioned++;
          }

          const programName = (enrollment as any).programs?.name || "your program";
          const programSlug = (enrollment as any).programs?.slug || enrollment.program_id;
          const endDate = new Date(enrollment.end_date!);
          const daysRemaining = Math.max(
            0,
            Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          );
          const endDateFormatted = endDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });

          // Render email content
          const subject = touchpoint.emailSubject
            .replace("{program_name}", programName)
            .replace("{days_remaining}", String(daysRemaining));
          const body = touchpoint.emailTemplate
            .replace(/{program_name}/g, programName)
            .replace(/{end_date_formatted}/g, endDateFormatted)
            .replace(/{days_remaining}/g, String(daysRemaining))
            .replace("{grace_days}", String(graceDays));

          // Send notification email
          await supabase.functions.invoke("send-notification-email", {
            body: {
              userId: enrollment.client_user_id,
              subject,
              body,
              type: `enrollment_${touchpoint.type}`,
            },
          });

          // Record touchpoint (UNIQUE constraint prevents duplicates)
          const { error: insertError } = await supabase
            .from("enrollment_deadline_touchpoints")
            .insert({
              enrollment_id: enrollment.id,
              touchpoint_type: touchpoint.type,
            });

          if (insertError) {
            console.warn(`Touchpoint insert error for ${enrollment.id}:`, insertError.message);
          } else {
            sent++;
          }

          // Also create an in-app notification
          try {
            await supabase.rpc("create_notification", {
              p_user_id: enrollment.client_user_id,
              p_type_key: touchpoint.type === "deadline_expired"
                ? "enrollment_deadline_expired"
                : touchpoint.type === "deadline_warning_7d"
                  ? "enrollment_deadline_7d"
                  : "enrollment_deadline_30d",
              p_title: subject,
              p_message: body,
              p_link: `/programs/${programSlug}`,
              p_metadata: {
                enrollment_id: enrollment.id,
                touchpoint_type: touchpoint.type,
                program_name: programName,
                days_remaining: daysRemaining,
              },
            });
          } catch {
            // Non-fatal — in-app notification is best-effort
          }
        } catch (err) {
          console.error(`Error processing ${touchpoint.type} for ${enrollment.id}:`, err);
          errors++;
        }
      }

      results.push({ type: touchpoint.type, sent, transitioned, errors });
      totalProcessed += sent + transitioned;
    }

    console.log(`Enrollment deadline enforcement complete: ${totalProcessed} processed`, results);

    return successResponse.ok({ success: true, totalProcessed, results }, cors);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in enforce-enrollment-deadlines:", errorMessage);
    return errorResponse.serverError("enforce-enrollment-deadlines", error, cors);
  }
});
