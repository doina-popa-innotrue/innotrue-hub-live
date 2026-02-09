import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: VerifyRequest = await req.json();

    console.log("Processing signup verification");

    if (!token) {
      return delayResponse(new Response(
        JSON.stringify({ error: "Verification token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ));
    }

    // Create profile for the user (trigger may not fire for admin-created users)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: verificationRequest.user_id,
        name: verificationRequest.name,
        username: verificationRequest.email
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Non-fatal, continue
    }

    // Assign default client role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: verificationRequest.user_id,
        role: "client"
      }, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("Error assigning role:", roleError);
      // Non-fatal, continue
    }

    // Create notification preferences
    const { error: prefsError } = await supabaseAdmin
      .from("notification_preferences")
      .upsert({
        user_id: verificationRequest.user_id
      }, { onConflict: "user_id" });

    if (prefsError) {
      console.error("Error creating notification preferences:", prefsError);
      // Non-fatal, continue
    }

    // Link placeholder user if one exists with matching real_email AND is not hidden
    const { data: placeholderProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, real_email, is_hidden")
      .eq("real_email", verificationRequest.email)
      .neq("id", verificationRequest.user_id)
      .maybeSingle();

    if (placeholderProfile) {
      if (placeholderProfile.is_hidden) {
        // Admin has hidden this placeholder - skip auto-transfer
        console.log(`Found placeholder profile ${placeholderProfile.id} but it is hidden - skipping auto-transfer`);
      } else {
        console.log(`Found placeholder profile ${placeholderProfile.id} with real_email matching ${verificationRequest.email}`);
        // Transfer any existing enrollments from placeholder to new user
        const { error: transferError } = await supabaseAdmin
          .from("client_enrollments")
          .update({ client_user_id: verificationRequest.user_id })
          .eq("client_user_id", placeholderProfile.id);

        if (transferError) {
          console.error("Error transferring enrollments from placeholder:", transferError);
        } else {
          console.log("Transferred enrollments from placeholder to new user account");
        }
      }
    }

    // Delete verification request
    await supabaseAdmin
      .from("signup_verification_requests")
      .delete()
      .eq("id", verificationRequest.id);

    console.log(`User ${verificationRequest.email} verified successfully`);

    return delayResponse(new Response(
      JSON.stringify({ success: true, message: "Email verified successfully. You can now log in." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    ));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in verify-signup function:", errorMessage);
    return delayResponse(new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    ));
  }
};

serve(handler);
