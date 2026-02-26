import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * send-coach-invite — Coaches/instructors invite clients to the platform.
 * Creates an invite record, sends an email, and optionally auto-links
 * if the client already exists.
 */

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface InviteRequest {
  email: string;
  name?: string;
  message?: string;
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

    // Auth check — require coach or instructor role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("Missing authorization header", cors);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return errorResponse.unauthorized("Invalid token", cors);
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    if (!userRoles.includes("coach") && !userRoles.includes("instructor")) {
      return errorResponse.forbidden("Coach or instructor role required", cors);
    }

    const { email, name, message }: InviteRequest = await req.json();

    if (!email?.trim()) {
      return errorResponse.badRequest("Email is required", cors);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if this email already has an account
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      // User already exists — auto-link as client_coaches/client_instructors
      const linked: string[] = [];

      if (userRoles.includes("coach")) {
        const { error: coachErr } = await supabaseAdmin
          .from("client_coaches")
          .upsert(
            { client_id: existingProfile.id, coach_id: user.id },
            { onConflict: "client_id,coach_id" }
          );
        if (!coachErr) linked.push("coach");
      }

      if (userRoles.includes("instructor")) {
        const { error: instrErr } = await supabaseAdmin
          .from("client_instructors")
          .upsert(
            { client_id: existingProfile.id, instructor_id: user.id },
            { onConflict: "client_id,instructor_id" }
          );
        if (!instrErr) linked.push("instructor");
      }

      // Record the invite as already_linked
      await supabaseAdmin.from("coach_client_invites").insert({
        coach_id: user.id,
        email: normalizedEmail,
        name: name?.trim() || existingProfile.name,
        message: message?.trim() || null,
        status: "accepted",
        linked_user_id: existingProfile.id,
      });

      // Notify the existing user
      await supabaseAdmin.rpc("create_notification", {
        p_user_id: existingProfile.id,
        p_title: "New coach/instructor connection",
        p_message: `You've been connected with a new ${linked.join(" and ")}. Check your programs and assignments.`,
        p_type: "coach_client_linked",
        p_category: "teaching",
      });

      return successResponse.ok({
        success: true,
        already_exists: true,
        linked: linked,
        message: `${existingProfile.name || normalizedEmail} already has an account and has been linked to you.`,
      }, cors);
    }

    // User doesn't exist — create invite and send email
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // Check for duplicate pending invite from same coach
    const { data: existingInvite } = await supabaseAdmin
      .from("coach_client_invites")
      .select("id, status")
      .eq("coach_id", user.id)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return errorResponse.badRequest("You already have a pending invite for this email", cors);
    }

    const { error: insertError } = await supabaseAdmin
      .from("coach_client_invites")
      .insert({
        coach_id: user.id,
        email: normalizedEmail,
        name: name?.trim() || null,
        message: message?.trim() || null,
        token: inviteToken,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      });

    if (insertError) {
      console.error("Error creating invite:", insertError);
      return errorResponse.serverError("send-coach-invite", insertError, cors);
    }

    // Get coach name for the email
    const { data: coachProfile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    const coachName = coachProfile?.name || "Your coach";
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    const appUrl = req.headers.get("origin") || siteUrl;
    const inviteLink = `${appUrl}/auth?invite=${inviteToken}&email=${encodeURIComponent(normalizedEmail)}&default_to_signup=true`;

    // Send invite email
    const { error: emailError } = await resend.emails.send({
      from: "InnoTrue Hub <noreply@mail.innotrue.com>",
      to: [getStagingRecipient(normalizedEmail)],
      subject: getStagingSubject(`${coachName} invited you to InnoTrue Hub`, normalizedEmail),
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #333; margin-bottom: 16px;">You've been invited!</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Hi${name ? ` ${name.trim()}` : ""},</p>
    <p style="color: #666; font-size: 16px; line-height: 1.5;"><strong>${coachName}</strong> has invited you to join InnoTrue Hub as their client.</p>
    ${message ? `<div style="background-color: #f9f9f9; border-left: 3px solid #dc2626; padding: 12px 16px; margin: 20px 0; border-radius: 4px;"><p style="color: #555; font-size: 14px; margin: 0; font-style: italic;">"${message.trim()}"</p></div>` : ""}
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Create your free account to get started with personalized coaching and development:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept Invitation</a>
    </div>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">This invitation expires in 14 days. If you didn't expect this, you can safely ignore this email.</p>
  </div>
</body>
</html>`,
    });

    if (emailError) {
      console.error("Error sending invite email:", emailError);
      // Don't fail — invite is saved, email can be resent
    }

    return successResponse.ok({
      success: true,
      already_exists: false,
      message: `Invitation sent to ${normalizedEmail}`,
    }, cors);
  } catch (error) {
    return errorResponse.serverError("send-coach-invite", error, cors);
  }
};

serve(handler);
