import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  userId: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Default template if database template is not found
const defaultTemplate = {
  subject: "Welcome to InnoTrue Hub - Set Up Your Account",
  html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to InnoTrue Hub!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">Your account has been created and you're ready to begin your journey with us!</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0; color: #666;"><strong>To get started, please set up your password:</strong></p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{passwordSetupLink}}" 
         style="background: #667eea; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
        Set Up Your Password
      </a>
    </div>
    
    <p style="color: #999; font-size: 12px;">Or copy and paste this link into your browser:</p>
    <p style="color: #999; font-size: 12px; word-break: break-all;">{{passwordSetupLink}}</p>
    
    <hr style="border: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #666;">Once you've set your password, you can log in and explore:</p>
    <ul style="font-size: 14px; color: #666;">
      <li>Your assigned programs and modules</li>
      <li>Track your progress and achievements</li>
      <li>Connect with your coaches and instructors</li>
    </ul>
    
    <p style="font-size: 14px; color: #999; margin-top: 30px;">
      <em>This link will expire in 24 hours. If you need a new link, please contact your administrator.</em>
    </p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>`
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the request is from an authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";

    // Create client with user's token to verify they're an admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callingUser } } = await userClient.auth.getUser();
    if (!callingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if calling user is admin
    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only admins can send welcome emails" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const { userId }: WelcomeEmailRequest = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the target user's info
    const { data: { user: targetUser }, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !targetUser) {
      console.error("Error fetching user:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's profile for their name and disabled status
    const { data: profile } = await adminClient
      .from("profiles")
      .select("name, is_disabled")
      .eq("id", userId)
      .single();

    // Block sending welcome email to disabled users
    if (profile?.is_disabled) {
      return new Response(
        JSON.stringify({ error: "Cannot send welcome email to a disabled user. Enable the user first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = profile?.name || targetUser.email?.split("@")[0] || "User";

    // Get email template from database
    const { data: template } = await adminClient
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "welcome_email")
      .single();

    const emailTemplate = template || defaultTemplate;

    // Generate a password reset link using Supabase Auth
    const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: targetUser.email!,
      options: {
        redirectTo: `${siteUrl}/auth?mode=reset`,
      },
    });

    if (resetError || !resetData) {
      console.error("Error generating reset link:", resetError);
      return new Response(
        JSON.stringify({ error: "Failed to generate password setup link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The recovery link is in resetData.properties.action_link
    const passwordSetupLink = resetData.properties?.action_link;

    // Replace template variables
    const htmlContent = emailTemplate.html_content
      .replace(/\{\{userName\}\}/g, userName)
      .replace(/\{\{passwordSetupLink\}\}/g, passwordSetupLink || "");

    const subject = emailTemplate.subject
      .replace(/\{\{userName\}\}/g, userName);

    // Send welcome email with Resend
    const emailResponse = await resend.emails.send({
      from: "InnoTrue Hub <noreply@mail.innotrue.com>",
      to: [getStagingRecipient(targetUser.email!)],
      subject: getStagingSubject(subject, targetUser.email!),
      html: htmlContent,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Welcome email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
