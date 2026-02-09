import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  organization_id: string;
  email: string;
  role: 'org_admin' | 'org_manager' | 'org_member';
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Default template as fallback
const defaultTemplate = {
  subject: "You've been invited to join {{organizationName}}",
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hello,</p>
    <p style="font-size: 16px;">You've been invited to join <strong>{{organizationName}}</strong> as a <strong>{{roleDisplay}}</strong> on InnoTrue Hub.</p>
    <p style="font-size: 16px;">Click the button below to accept this invitation:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{inviteLink}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
    </div>
    <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
    <p style="font-size: 14px; color: #666; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">{{inviteLink}}</p>
    <p style="font-size: 14px; color: #999; margin-top: 30px;">This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© {{currentYear}} InnoTrue Hub. All rights reserved.</p>
  </div>
</body>
</html>`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the user from the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Invalid auth token");
    }

    const { organization_id, email, role }: InviteRequest = await req.json();

    if (!organization_id || !email) {
      throw new Error("organization_id and email are required");
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Check if user is org admin/manager for this org (or platform admin)
    const { data: membership } = await supabaseClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .single();

    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);

    const isPlatformAdmin = userRoles?.some(r => r.role === 'admin');
    const isOrgAdmin = membership?.role === 'org_admin';
    const isOrgManager = membership?.role === 'org_manager';

    if (!isPlatformAdmin && !isOrgAdmin && !isOrgManager) {
      throw new Error("You don't have permission to invite members to this organization");
    }

    // For managers, check if allowMemberInvites is enabled
    if (isOrgManager && !isPlatformAdmin && !isOrgAdmin) {
      const { data: org } = await supabaseClient
        .from('organizations')
        .select('settings')
        .eq('id', organization_id)
        .single();

      const settings = org?.settings as { allowMemberInvites?: boolean } | null;
      if (!settings?.allowMemberInvites) {
        throw new Error("Member invitations are disabled for this organization. Only admins can invite members.");
      }
    }

    // Get organization name for the email
    const { data: org } = await supabaseClient
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .single();

    const orgName = org?.name || 'the organization';

    // Check for existing pending invite
    const { data: existingInvite } = await supabaseClient
      .from('organization_invites')
      .select('id, expires_at, accepted_at, token')
      .eq('organization_id', organization_id)
      .ilike('email', email)
      .single();

    let inviteToken: string;

    if (existingInvite) {
      if (existingInvite.accepted_at) {
        throw new Error("This invitation has already been accepted");
      }
      
      // Generate new token for resend
      inviteToken = crypto.randomUUID();
      
      // Update existing invite
      const { error: updateError } = await supabaseClient
        .from('organization_invites')
        .update({
          role,
          invited_by: userData.user.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          token: inviteToken,
        })
        .eq('id', existingInvite.id);

      if (updateError) throw updateError;
    } else {
      // Create new invite
      const { data: invite, error: insertError } = await supabaseClient
        .from('organization_invites')
        .insert({
          organization_id,
          email: email.toLowerCase(),
          role,
          invited_by: userData.user.id,
        })
        .select('token')
        .single();

      if (insertError) throw insertError;
      inviteToken = invite.token;
    }

    // Send invitation email
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    const inviteLink = `${siteUrl}/accept-invite?token=${inviteToken}`;
    const roleDisplay = role === 'org_admin' ? 'Admin' : role === 'org_manager' ? 'Manager' : 'Member';
    const currentYear = new Date().getFullYear().toString();

    // Fetch system logo for template variable
    const { data: logoData } = await supabaseClient
      .from('email_template_assets')
      .select('file_url, name')
      .eq('is_system_logo', true)
      .single();
    
    const systemLogoHtml = logoData 
      ? `<img src="${logoData.file_url}" alt="${logoData.name}" style="max-width: 200px; height: auto;" />`
      : '';

    // Fetch email template from database
    const { data: template } = await supabaseClient
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "org_invite")
      .single();

    const emailTemplate = template || defaultTemplate;

    // Replace template variables
    const htmlContent = emailTemplate.html_content
      .replace(/\{\{organizationName\}\}/g, orgName)
      .replace(/\{\{roleDisplay\}\}/g, roleDisplay)
      .replace(/\{\{inviteLink\}\}/g, inviteLink)
      .replace(/\{\{currentYear\}\}/g, currentYear)
      .replace(/\{\{systemLogo\}\}/g, systemLogoHtml);

    const subject = emailTemplate.subject
      .replace(/\{\{organizationName\}\}/g, orgName);

    // Track email sending result
    let emailSent = false;
    let emailError: string | null = null;

    try {
      const emailResult = await resend.emails.send({
        from: "InnoTrue Hub <onboarding@mail.innotrue.com>",
        to: [getStagingRecipient(email)],
        subject: getStagingSubject(subject, email),
        html: htmlContent,
      });

      console.log(`Invitation email sent to ${email} for organization ${orgName}`, emailResult);
      emailSent = true;
    } catch (err: unknown) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error(`Failed to send invitation email to ${email}:`, emailError);
    }

    // Return response with email status
    const response = new Response(
      JSON.stringify({ 
        success: true, 
        message: existingInvite ? "Invitation resent successfully" : "Invitation sent successfully",
        emailSent,
        emailError: emailError || undefined,
        warning: emailError ? "Invitation was created but the email could not be sent. Please share the invitation link manually." : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    return delayResponse(response);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-org-invite:", errorMessage);
    
    const response = new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );

    return delayResponse(response);
  }
});
