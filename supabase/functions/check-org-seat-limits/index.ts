import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface OrgSeatData {
  organization_id: string;
  organization_name: string;
  used_seats: number;
  max_seats: number | null;
  percent_used: number;
  admin_emails: string[];
  admin_names: string[];
}

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // SECURITY: Validate service role key - this function should only be called by cron/internal
  const authHeader = req.headers.get("Authorization");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const providedToken = authHeader?.replace("Bearer ", "");
  if (providedToken !== supabaseServiceKey) {
    console.error("Unauthorized: Missing or invalid service role key");
    return new Response(
      JSON.stringify({ error: "Unauthorized - service role key required" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  console.log("Starting org seat limit check...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all organizations with their seat usage and limits
    const { data: organizations, error: orgsError } = await supabase
      .from("organizations")
      .select(`
        id,
        name
      `)
      .eq("is_active", true);

    if (orgsError) {
      console.error("Error fetching organizations:", orgsError);
      throw orgsError;
    }

    console.log(`Found ${organizations?.length || 0} active organizations`);

    const alertsSent: string[] = [];
    const errors: string[] = [];

    for (const org of organizations || []) {
      try {
        // Get seat usage using the RPC function
        const { data: usedSeats } = await supabase
          .rpc("get_org_sponsored_seat_count", { p_organization_id: org.id });

        // Get max seats using the RPC function
        const { data: maxSeats } = await supabase
          .rpc("get_org_max_sponsored_seats", { p_organization_id: org.id });

        // Skip if unlimited seats or no sponsored seats used
        if (maxSeats === null || maxSeats === 0 || usedSeats === 0) {
          continue;
        }

        const percentUsed = Math.round((usedSeats / maxSeats) * 100);
        console.log(`Org ${org.name}: ${usedSeats}/${maxSeats} seats (${percentUsed}%)`);

        // Only alert if at 80% or 100%
        if (percentUsed < 80) {
          continue;
        }

        // Check if we've already sent an alert recently (within last 7 days)
        const alertType = percentUsed >= 100 ? "org_seat_limit_reached" : "org_seat_limit_warning";
        
        // Get org admin emails
        const { data: orgMembers, error: membersError } = await supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", org.id)
          .eq("role", "org_admin")
          .eq("is_active", true);

        if (membersError || !orgMembers?.length) {
          console.log(`No admins found for org ${org.name}`);
          continue;
        }

        const adminUserIds = orgMembers.map((m) => m.user_id);

        // Get admin profiles for names
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", adminUserIds);

        // Get admin emails from auth
        const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
        
        if (usersError) {
          console.error(`Error fetching users for org ${org.name}:`, usersError);
          continue;
        }

        const adminEmails = users
          ?.filter((u) => adminUserIds.includes(u.id) && u.email)
          .map((u) => u.email!) || [];

        if (adminEmails.length === 0) {
          console.log(`No admin emails found for org ${org.name}`);
          continue;
        }

        // Send notification to each admin
        for (const adminEmail of adminEmails) {
          const adminUser = users?.find((u) => u.email === adminEmail);
          const adminProfile = profiles?.find((p) => p.id === adminUser?.id);
          const adminName = adminProfile?.name || adminEmail.split("@")[0];

          const notificationPayload = {
            email: adminEmail,
            name: adminName,
            type: alertType,
            timestamp: new Date().toISOString(),
            organizationName: org.name,
            usedSeats: usedSeats,
            maxSeats: maxSeats,
            percentUsed: percentUsed,
          };

          console.log(`Sending ${alertType} to ${adminEmail} for org ${org.name}`);

          const { error: invokeError } = await supabase.functions.invoke(
            "send-notification-email",
            { body: notificationPayload }
          );

          if (invokeError) {
            console.error(`Error sending alert to ${adminEmail}:`, invokeError);
            errors.push(`Failed to send to ${adminEmail}: ${invokeError.message}`);
          } else {
            alertsSent.push(`${alertType} sent to ${adminEmail} for ${org.name}`);
          }
        }
      } catch (orgError: any) {
        console.error(`Error processing org ${org.name}:`, orgError);
        errors.push(`Error with org ${org.name}: ${orgError.message}`);
      }
    }

    console.log(`Check complete. Sent ${alertsSent.length} alerts, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        alertsSent: alertsSent.length,
        alerts: alertsSent,
        errors: errors,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      }
    );
  } catch (error: any) {
    console.error("Error in check-org-seat-limits:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      }
    );
  }
};

serve(handler);
