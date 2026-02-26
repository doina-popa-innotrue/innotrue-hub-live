import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * bulk-create-users — Admin-only edge function
 * Creates multiple users from a CSV import batch.
 * Max 200 users per request. Returns per-row results.
 */

interface UserRow {
  name: string;
  email: string;
  role?: string; // comma-separated roles, default: "client"
  plan?: string; // plan key name, default: "free"
  is_placeholder?: boolean;
  real_email?: string;
}

interface RowResult {
  email: string;
  status: "created" | "error";
  error?: string;
  userId?: string;
}

const MAX_BATCH_SIZE = 200;

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const special = "!@#$%&*";
  const all = chars + upper + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const required = [pick(chars), pick(upper), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Auth check — require admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("Missing authorization header", cors);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return errorResponse.unauthorized("Invalid token", cors);
    }

    // Check admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles?.length) {
      return errorResponse.forbidden("Admin role required", cors);
    }

    const { users: userRows }: { users: UserRow[] } = await req.json();

    if (!Array.isArray(userRows) || userRows.length === 0) {
      return errorResponse.badRequest("No users provided", cors);
    }

    if (userRows.length > MAX_BATCH_SIZE) {
      return errorResponse.badRequest(`Maximum ${MAX_BATCH_SIZE} users per batch`, cors);
    }

    // Fetch free plan ID for default assignment
    const { data: freePlan } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("key", "free")
      .single();

    // Fetch all plans for plan name lookup
    const { data: allPlans } = await supabaseAdmin
      .from("plans")
      .select("id, key, name");

    const plansByKey = new Map(allPlans?.map(p => [p.key.toLowerCase(), p.id]) ?? []);

    const results: RowResult[] = [];

    for (const row of userRows) {
      try {
        if (!row.name?.trim()) {
          results.push({ email: row.email || "unknown", status: "error", error: "Name is required" });
          continue;
        }

        const isPlaceholder = row.is_placeholder === true;
        const finalEmail = isPlaceholder
          ? `placeholder_${crypto.randomUUID()}@system.internal`
          : row.email?.trim().toLowerCase();

        if (!isPlaceholder && (!finalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail))) {
          results.push({ email: row.email || "unknown", status: "error", error: "Invalid email" });
          continue;
        }

        const password = generatePassword();

        // Create auth user
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: finalEmail,
          password,
          email_confirm: true,
          user_metadata: { name: row.name.trim() },
        });

        if (createError) {
          results.push({ email: row.email || finalEmail!, status: "error", error: createError.message });
          continue;
        }

        const userId = userData.user.id;

        // Set profile
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          name: row.name.trim(),
          username: finalEmail,
          registration_status: "complete",
          ...(isPlaceholder && row.real_email ? { real_email: row.real_email.trim().toLowerCase() } : {}),
          ...(isPlaceholder ? { is_hidden: false } : {}),
        }, { onConflict: "id" });

        // Parse roles
        const roleStr = row.role?.trim().toLowerCase() || "client";
        const roleList = roleStr.split(",").map(r => r.trim()).filter(r =>
          ["admin", "client", "coach", "instructor"].includes(r)
        );
        if (roleList.length === 0) roleList.push("client");

        // Assign roles
        for (const role of roleList) {
          await supabaseAdmin.from("user_roles").upsert(
            { user_id: userId, role: role as "admin" | "client" | "coach" | "instructor" },
            { onConflict: "user_id,role" }
          );
        }

        // Create client_profiles if client role
        if (roleList.includes("client")) {
          await supabaseAdmin.from("client_profiles").upsert(
            { user_id: userId, status: isPlaceholder ? "inactive" : "active" },
            { onConflict: "user_id" }
          );
        }

        // Assign plan
        const planKey = row.plan?.trim().toLowerCase() || "free";
        const planId = plansByKey.get(planKey) || freePlan?.id;
        if (planId) {
          await supabaseAdmin.from("profiles").update({ plan_id: planId }).eq("id", userId);
        }

        // Create notification preferences
        await supabaseAdmin.from("notification_preferences").upsert(
          { user_id: userId },
          { onConflict: "user_id" }
        );

        // Disable placeholder users
        if (isPlaceholder) {
          await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
        }

        results.push({
          email: row.email || finalEmail!,
          status: "created",
          userId,
        });
      } catch (rowError: any) {
        results.push({
          email: row.email || "unknown",
          status: "error",
          error: rowError.message || "Unknown error",
        });
      }
    }

    const created = results.filter(r => r.status === "created").length;
    const errors = results.filter(r => r.status === "error").length;

    return successResponse.ok({
      success: true,
      summary: { total: results.length, created, errors },
      results,
    }, cors);
  } catch (error) {
    return errorResponse.serverError("bulk-create-users", error, cors);
  }
};

serve(handler);
