import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface VerifyRequest {
  token: string;
}

// Helper function to hash tokens consistently (matches signup-user function)
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  // Minimum response time to prevent timing attacks
  const minResponseTime = 500;
  const startTime = Date.now();

  async function delayResponse<T>(response: T): Promise<T> {
    const elapsed = Date.now() - startTime;
    if (elapsed < minResponseTime) {
      await new Promise(resolve => setTimeout(resolve, minResponseTime - elapsed));
    }
    return response;
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { token }: VerifyRequest = await req.json();

    console.log("Processing signup verification");

    if (!token) {
      return delayResponse(new Response(
        JSON.stringify({ error: "Verification token is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Hash the incoming token to compare against stored hash
    const tokenHash = await hashToken(token);

    // Look up verification request using hashed token
    const { data: hashResult } = await supabaseAdmin
      .from("signup_verification_requests")
      .select("*")
      .eq("verification_token", tokenHash)
      .single();

    let verificationRequest = hashResult;

    // Fallback for legacy plain-text tokens (to be deprecated after migration period)
    if (!verificationRequest) {
      const { data: legacyResult } = await supabaseAdmin
        .from("signup_verification_requests")
        .select("*")
        .eq("verification_token", token)
        .single();
      
      if (legacyResult) {
        verificationRequest = legacyResult;
        // Migrate legacy token to hashed version
        await supabaseAdmin
          .from("signup_verification_requests")
          .update({ verification_token: tokenHash })
          .eq("id", legacyResult.id);
        console.log("Migrated legacy signup token to hashed version");
      }
    }

    if (!verificationRequest) {
      console.error("Verification request not found");
      return delayResponse(new Response(
        JSON.stringify({ error: "Invalid or expired verification token" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    // Check if token is expired
    if (new Date(verificationRequest.expires_at) < new Date()) {
      // Clean up expired request
      await supabaseAdmin
        .from("signup_verification_requests")
        .delete()
        .eq("id", verificationRequest.id);
      
      return delayResponse(new Response(
        JSON.stringify({ error: "Verification token has expired. Please sign up again." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    // Confirm user's email via admin API
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      verificationRequest.user_id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error("Error confirming user:", confirmError);
      return delayResponse(new Response(
        JSON.stringify({ error: "Failed to confirm email" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    // Create profile with pending_role_selection status
    // User will complete registration (choose role) at /complete-registration
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: verificationRequest.user_id,
        name: verificationRequest.name,
        username: verificationRequest.email,
        registration_status: "pending_role_selection",
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Non-fatal, continue
    }

    // Phase 5: Do NOT auto-assign client role here.
    // Role assignment happens in complete-registration edge function after user chooses their path.
    // Exception: non-hidden placeholder matches get roles + data transferred below.

    // Link placeholder user if one exists with matching real_email AND is not hidden
    const { data: placeholderProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, real_email, is_hidden, plan_id")
      .eq("real_email", verificationRequest.email)
      .neq("id", verificationRequest.user_id)
      .maybeSingle();

    if (placeholderProfile) {
      if (placeholderProfile.is_hidden) {
        // Admin has hidden this placeholder - skip auto-transfer
        console.log(`Found placeholder profile ${placeholderProfile.id} but it is hidden - skipping auto-transfer`);
      } else {
        console.log(`Found placeholder profile ${placeholderProfile.id} with real_email matching ${verificationRequest.email}`);

        // Enhanced 7-table transfer (matches transfer-placeholder-data pattern)
        const transferResults: Record<string, number> = {};

        // Transfer client_enrollments
        const { data: enrollments } = await supabaseAdmin
          .from("client_enrollments")
          .update({ client_user_id: verificationRequest.user_id })
          .eq("client_user_id", placeholderProfile.id)
          .select("id");
        transferResults.enrollments = enrollments?.length ?? 0;

        // Transfer capability_snapshots
        const { data: snapshots } = await supabaseAdmin
          .from("capability_snapshots")
          .update({ user_id: verificationRequest.user_id })
          .eq("user_id", placeholderProfile.id)
          .select("id");
        transferResults.capability_snapshots = snapshots?.length ?? 0;

        // Transfer client_badges
        const { data: badges } = await supabaseAdmin
          .from("client_badges")
          .update({ user_id: verificationRequest.user_id })
          .eq("user_id", placeholderProfile.id)
          .select("id");
        transferResults.badges = badges?.length ?? 0;

        // Transfer client_coaches
        const { data: coachRels } = await supabaseAdmin
          .from("client_coaches")
          .update({ client_id: verificationRequest.user_id })
          .eq("client_id", placeholderProfile.id)
          .select("id");
        transferResults.coach_relationships = coachRels?.length ?? 0;

        // Transfer client_instructors
        const { data: instructorRels } = await supabaseAdmin
          .from("client_instructors")
          .update({ client_id: verificationRequest.user_id })
          .eq("client_id", placeholderProfile.id)
          .select("id");
        transferResults.instructor_relationships = instructorRels?.length ?? 0;

        // Transfer assessment_responses
        const { data: assessments } = await supabaseAdmin
          .from("assessment_responses")
          .update({ user_id: verificationRequest.user_id })
          .eq("user_id", placeholderProfile.id)
          .select("id");
        transferResults.assessment_responses = assessments?.length ?? 0;

        // Transfer client_profiles (merge notes if both exist)
        const { data: placeholderClientProfile } = await supabaseAdmin
          .from("client_profiles")
          .select("*")
          .eq("user_id", placeholderProfile.id)
          .single();

        if (placeholderClientProfile) {
          const { data: targetClientProfile } = await supabaseAdmin
            .from("client_profiles")
            .select("*")
            .eq("user_id", verificationRequest.user_id)
            .single();

          if (targetClientProfile) {
            const mergedNotes = [targetClientProfile.notes, placeholderClientProfile.notes]
              .filter(Boolean)
              .join("\n\n--- Transferred from placeholder ---\n\n");
            await supabaseAdmin
              .from("client_profiles")
              .update({ notes: mergedNotes || null, tags: placeholderClientProfile.tags || targetClientProfile.tags })
              .eq("user_id", verificationRequest.user_id);
          } else {
            await supabaseAdmin
              .from("client_profiles")
              .insert({
                user_id: verificationRequest.user_id,
                status: placeholderClientProfile.status,
                notes: placeholderClientProfile.notes,
                tags: placeholderClientProfile.tags,
              });
          }
          transferResults.client_profile = 1;
        }

        // Copy placeholder's roles to new user
        const { data: placeholderRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", placeholderProfile.id);

        if (placeholderRoles?.length) {
          for (const r of placeholderRoles) {
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: verificationRequest.user_id, role: r.role }, { onConflict: "user_id,role" });
          }
          transferResults.roles_copied = placeholderRoles.length;
        }

        // Copy placeholder's plan_id
        if (placeholderProfile.plan_id) {
          await supabaseAdmin
            .from("profiles")
            .update({ plan_id: placeholderProfile.plan_id })
            .eq("id", verificationRequest.user_id);
        }

        // Create notification preferences for transferred user
        await supabaseAdmin
          .from("notification_preferences")
          .upsert({ user_id: verificationRequest.user_id }, { onConflict: "user_id" });

        // Mark registration as complete — placeholder had pre-staged data
        await supabaseAdmin
          .from("profiles")
          .update({ registration_status: "complete" })
          .eq("id", verificationRequest.user_id);

        console.log(`Placeholder transfer complete for ${verificationRequest.email}:`, transferResults);
      }
    }

    // Delete verification request
    await supabaseAdmin
      .from("signup_verification_requests")
      .delete()
      .eq("id", verificationRequest.id);

    // Trigger welcome email (non-blocking — don't fail verification if email fails)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ userId: verificationRequest.user_id }),
      }).catch(err => console.error("Welcome email trigger failed:", err));
    } catch (welcomeError) {
      console.error("Error triggering welcome email:", welcomeError);
      // Non-fatal — verification succeeded regardless
    }

    console.log(`User ${verificationRequest.email} verified successfully`);

    return delayResponse(new Response(
      JSON.stringify({ success: true, message: "Email verified successfully. You can now log in." }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    ));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in verify-signup function:", errorMessage);
    return delayResponse(new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    ));
  }
};

serve(handler);
