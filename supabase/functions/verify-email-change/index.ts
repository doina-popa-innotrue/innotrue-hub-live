import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface VerifyRequest {
  token: string;
}

// Helper function to hash tokens consistently
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

    console.log("Processing email change verification");

    if (!token) {
      return delayResponse(new Response(
        JSON.stringify({ error: "Verification token is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Hash the provided token for lookup
    const tokenHash = await hashToken(token);

    // Look up the request using the hashed token
    const { data: hashResult } = await supabaseAdmin
      .from('email_change_requests')
      .select('*')
      .eq('verification_token', tokenHash)
      .single();

    let request = hashResult;

    // Fallback for legacy tokens (to be deprecated after migration period)
    if (!request) {
      const { data: legacyResult } = await supabaseAdmin
        .from('email_change_requests')
        .select('*')
        .eq('verification_token', token)
        .single();
      
      if (legacyResult) {
        request = legacyResult;
        // Migrate legacy token to hashed version
        await supabaseAdmin
          .from('email_change_requests')
          .update({ verification_token: tokenHash })
          .eq('id', legacyResult.id);
        console.log("Migrated legacy token to hashed version");
      }
    }

    if (!request) {
      console.error("Email change request not found");
      return delayResponse(new Response(
        JSON.stringify({ error: "Invalid or expired verification token" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    // Check if already verified
    if (request.verified_at) {
      return delayResponse(new Response(
        JSON.stringify({ error: "This email change has already been verified" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    // Check if token is expired
    if (new Date(request.expires_at) < new Date()) {
      // Clean up expired request
      await supabaseAdmin
        .from('email_change_requests')
        .delete()
        .eq('id', request.id);
      
      return delayResponse(new Response(
        JSON.stringify({ error: "Verification token has expired. Please request a new email change." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    // Update user's email in auth.users
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      request.user_id,
      { email: request.new_email, email_confirm: true }
    );

    if (updateAuthError) {
      console.error("Error updating auth email:", updateAuthError);
      return delayResponse(new Response(
        JSON.stringify({ error: "Failed to update email. Please try again." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      ));
    }

    // Update profile username if it matches the old email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', request.user_id)
      .single();

    if (profile?.username === request.current_email) {
      await supabaseAdmin
        .from('profiles')
        .update({ username: request.new_email })
        .eq('id', request.user_id);
    }

    // Mark request as verified
    await supabaseAdmin
      .from('email_change_requests')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', request.id);

    console.log(`Email changed successfully for user ${request.user_id}: ${request.current_email} -> ${request.new_email}`);

    return delayResponse(new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email updated successfully. Please log in with your new email address.",
        new_email: request.new_email
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    ));

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in verify-email-change:", errorMessage);
    return delayResponse(new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    ));
  }
};

serve(handler);
