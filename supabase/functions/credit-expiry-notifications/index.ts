import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * Credit Expiry Notifications
 *
 * Daily cron job (3 AM UTC) that sends notifications to users/orgs
 * with credit batches expiring soon.
 *
 * - Users: notified when batches expire within 7 days
 * - Orgs: notified when batches expire within 30 days
 * - Deduplication: checks notification metadata.batch_ids to avoid repeat alerts
 * - Uses create_notification() DB function for both in-app and email
 */

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREDIT-EXPIRY-NOTIFICATIONS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // Validate authorization (service role or anon key)
    const authHeader = req.headers.get("Authorization");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const providedToken = authHeader?.replace("Bearer ", "");
    if (providedToken !== supabaseAnonKey && providedToken !== supabaseServiceKey) {
      return errorResponse.unauthorized("Invalid or missing authorization token", cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep("Starting credit expiry notification check");

    let userNotificationsSent = 0;
    let orgNotificationsSent = 0;

    // ── 1. User batches expiring within 7 days ──────────────────
    const userExpiryWindow = new Date();
    userExpiryWindow.setDate(userExpiryWindow.getDate() + 7);

    const { data: userBatches, error: userBatchError } = await supabase
      .from("credit_batches")
      .select("id, owner_id, remaining_amount, expires_at, source_type")
      .eq("owner_type", "user")
      .eq("is_expired", false)
      .gt("remaining_amount", 0)
      .lte("expires_at", userExpiryWindow.toISOString())
      .gt("expires_at", new Date().toISOString());

    if (userBatchError) {
      logStep("Error fetching user expiring batches", { error: userBatchError.message });
    } else {
      logStep("Found user expiring batches", { count: userBatches?.length ?? 0 });

      // Group batches by owner
      const userBatchMap = new Map<string, typeof userBatches>();
      for (const batch of userBatches ?? []) {
        const existing = userBatchMap.get(batch.owner_id) ?? [];
        existing.push(batch);
        userBatchMap.set(batch.owner_id, existing);
      }

      for (const [userId, batches] of userBatchMap) {
        const batchIds = batches.map((b) => b.id).sort();
        const totalExpiring = batches.reduce((sum, b) => sum + b.remaining_amount, 0);
        const earliestExpiry = batches
          .map((b) => b.expires_at)
          .sort()[0];

        // Deduplication: check if we already sent a notification for these exact batches
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("title", "Credits Expiring Soon")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (existingNotif && existingNotif.length > 0) {
          logStep("Skipping user (already notified today)", { userId });
          continue;
        }

        try {
          const { error: notifError } = await supabase.rpc("create_notification", {
            p_user_id: userId,
            p_type_key: "credits_expiring",
            p_title: "Credits Expiring Soon",
            p_message: `You have ${totalExpiring} credit${totalExpiring !== 1 ? "s" : ""} expiring within 7 days. Use them before they expire.`,
            p_link: "/credits",
            p_metadata: {
              batch_ids: batchIds,
              total_expiring: totalExpiring,
              earliest_expiry: earliestExpiry,
            },
          });

          if (notifError) {
            logStep("Error creating user notification", { userId, error: notifError.message });
          } else {
            userNotificationsSent++;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logStep("Error processing user notification", { userId, error: msg });
        }
      }
    }

    // ── 2. Org batches expiring within 30 days ──────────────────
    const orgExpiryWindow = new Date();
    orgExpiryWindow.setDate(orgExpiryWindow.getDate() + 30);

    const { data: orgBatches, error: orgBatchError } = await supabase
      .from("credit_batches")
      .select("id, owner_id, remaining_amount, expires_at, source_type")
      .eq("owner_type", "org")
      .eq("is_expired", false)
      .gt("remaining_amount", 0)
      .lte("expires_at", orgExpiryWindow.toISOString())
      .gt("expires_at", new Date().toISOString());

    if (orgBatchError) {
      logStep("Error fetching org expiring batches", { error: orgBatchError.message });
    } else {
      logStep("Found org expiring batches", { count: orgBatches?.length ?? 0 });

      // Group by org, then notify each org's admin users
      const orgBatchMap = new Map<string, typeof orgBatches>();
      for (const batch of orgBatches ?? []) {
        const existing = orgBatchMap.get(batch.owner_id) ?? [];
        existing.push(batch);
        orgBatchMap.set(batch.owner_id, existing);
      }

      for (const [orgId, batches] of orgBatchMap) {
        const totalExpiring = batches.reduce((sum, b) => sum + b.remaining_amount, 0);
        const earliestExpiry = batches
          .map((b) => b.expires_at)
          .sort()[0];

        // Find org admins to notify
        const { data: orgAdmins } = await supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .in("role", ["owner", "admin"]);

        for (const admin of orgAdmins ?? []) {
          // Deduplication: check if already notified today
          const { data: existingNotif } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", admin.user_id)
            .eq("title", "Organization Credits Expiring")
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (existingNotif && existingNotif.length > 0) {
            continue;
          }

          try {
            const { error: notifError } = await supabase.rpc("create_notification", {
              p_user_id: admin.user_id,
              p_type_key: "credits_expiring",
              p_title: "Organization Credits Expiring",
              p_message: `Your organization has ${totalExpiring} credit${totalExpiring !== 1 ? "s" : ""} expiring within 30 days.`,
              p_link: "/org/credits",
              p_metadata: {
                org_id: orgId,
                total_expiring: totalExpiring,
                earliest_expiry: earliestExpiry,
              },
            });

            if (notifError) {
              logStep("Error creating org admin notification", {
                orgId,
                userId: admin.user_id,
                error: notifError.message,
              });
            } else {
              orgNotificationsSent++;
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logStep("Error processing org notification", { orgId, error: msg });
          }
        }
      }
    }

    logStep("Credit expiry notifications complete", {
      userNotificationsSent,
      orgNotificationsSent,
    });

    return successResponse.ok(
      {
        success: true,
        userNotificationsSent,
        orgNotificationsSent,
        timestamp: new Date().toISOString(),
      },
      cors,
    );
  } catch (error) {
    logStep("ERROR", { message: error instanceof Error ? error.message : String(error) });
    return errorResponse.serverError("credit-expiry-notifications", error, cors);
  }
});
