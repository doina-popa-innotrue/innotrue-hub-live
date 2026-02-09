import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface AuthEmailRequest {
  user: {
    email: string;
    id: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

// Default templates as fallback
const defaultTemplates: Record<string, { subject: string; html: string }> = {
  signup: {
    subject: "Confirm your email address",
    html: `<h1>Welcome to InnoTrue Hub!</h1>
<p>Please confirm your email address by clicking the link below:</p>
<p><a href="{{confirmationLink}}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">Confirm Email</a></p>
<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all;">{{confirmationLink}}</p>`,
  },
  magiclink: {
    subject: "Your magic link to sign in",
    html: `<h1>Sign in to InnoTrue Hub</h1>
<p>Click the link below to sign in:</p>
<p><a href="{{confirmationLink}}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">Sign In</a></p>
<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all;">{{confirmationLink}}</p>`,
  },
  recovery: {
    subject: "Reset your password",
    html: `<h1>Reset your password</h1>
<p>Click the link below to reset your password:</p>
<p><a href="{{confirmationLink}}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all;">{{confirmationLink}}</p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
  },
  email_change: {
    subject: "Confirm your new email address",
    html: `<h1>Confirm Email Change</h1>
<p>You requested to change your email address. Click the link below to confirm this change:</p>
<p><a href="{{confirmationLink}}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">Confirm Email Change</a></p>
<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all;">{{confirmationLink}}</p>
<p>If you didn't request this change, please contact support immediately.</p>`,
  },
};

// Map email action types to template keys
const templateKeyMap: Record<string, string> = {
  signup: "auth_signup_confirm",
  magiclink: "auth_magic_link",
  recovery: "auth_password_recovery",
  email_change: "auth_email_change",
};

const handler = async (req: Request): Promise<Response> => {
  try {
    // Validate request is from Supabase Auth (must include valid service role key ONLY)
    // SECURITY: Do NOT accept anon key - it's public and would allow anyone to trigger auth emails
    const authHeader = req.headers.get('Authorization');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const providedToken = authHeader?.replace('Bearer ', '');
    if (providedToken !== supabaseServiceKey) {
      console.error('Unauthorized: Invalid or missing service role key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload: AuthEmailRequest = await req.json();
    const { user, email_data } = payload;
    const { email_action_type, token_hash, redirect_to } = email_data;

    console.log(`Processing ${email_action_type} email for ${user.email}`);

    // Create Supabase client to fetch templates
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch system logo for template variable
    const { data: logoData } = await supabaseAdmin
      .from('email_template_assets')
      .select('file_url, name')
      .eq('is_system_logo', true)
      .single();
    
    const systemLogoHtml = logoData 
      ? `<img src="${logoData.file_url}" alt="${logoData.name}" style="max-width: 200px; height: auto;" />`
      : '';

    // Build confirmation link
    const confirmationLink = `${email_data.site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

    // Get template key for this action type
    const templateKey = templateKeyMap[email_action_type];
    let subject = "";
    let htmlContent = "";

    if (templateKey) {
      // Try to fetch template from database
      const { data: template, error: templateError } = await supabaseAdmin
        .from("email_templates")
        .select("subject, html_content")
        .eq("template_key", templateKey)
        .single();

      if (template && !templateError) {
        subject = template.subject;
        htmlContent = template.html_content;
        console.log(`Using database template: ${templateKey}`);
      } else {
        // Use default template
        const defaultTemplate = defaultTemplates[email_action_type];
        if (defaultTemplate) {
          subject = defaultTemplate.subject;
          htmlContent = defaultTemplate.html;
          console.log(`Using default template for: ${email_action_type}`);
        } else {
          throw new Error(`Unknown email action type: ${email_action_type}`);
        }
      }
    } else {
      throw new Error(`Unknown email action type: ${email_action_type}`);
    }

    // Replace template variables
    htmlContent = htmlContent
      .replace(/\{\{confirmationLink\}\}/g, confirmationLink)
      .replace(/\{\{systemLogo\}\}/g, systemLogoHtml);

    const emailResponse = await resend.emails.send({
      from: "InnoTrue Hub <noreply@mail.innotrue.com>",
      to: [getStagingRecipient(user.email)],
      subject: getStagingSubject(subject, user.email),
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-auth-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
