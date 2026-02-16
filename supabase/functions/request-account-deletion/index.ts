import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface RequestBody {
  reason?: string;
}

// Simple in-memory rate limiting (per user, per minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 3; // max requests
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(userId);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

// Input validation
function validateReason(reason: unknown): string | null {
  if (reason === undefined || reason === null) {
    return null;
  }
  if (typeof reason !== 'string') {
    return null;
  }
  // Limit reason length to prevent abuse
  return reason.slice(0, 2000);
}

// Default templates as fallback
const defaultUserTemplate = {
  subject: "Account Deletion Request Received",
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">Account Deletion Request Received</h2>
  <p>Dear {{userName}},</p>
  <p>We have received your request to delete your InnoTrue Hub account. Our team will review your request and process it in accordance with our data retention policies.</p>
  <p>If you did not make this request or have changed your mind, please contact us immediately at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
  <p>Please note that account deletion is permanent and all your data including:</p>
  <ul>
    <li>Program enrollments and progress</li>
    <li>Goals and milestones</li>
    <li>Decisions and reflections</li>
    <li>All other associated data</li>
  </ul>
  <p>will be permanently removed and cannot be recovered.</p>
  <p>Best regards,<br>The InnoTrue Hub Team</p>
</body>
</html>`,
};

const defaultAdminTemplate = {
  subject: "Account Deletion Request from {{userName}}",
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">New Account Deletion Request</h2>
  <p>A user has requested to delete their account.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Name:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{userName}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{userEmail}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>User ID:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{userId}}</td>
    </tr>
    {{reasonRow}}
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Requested at:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{requestedAt}}</td>
    </tr>
  </table>
  <p>Please review and process this request in the admin dashboard.</p>
</body>
</html>`,
};

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify the caller
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      console.warn(`Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          headers: { ...cors, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    const body = await req.json();
    const reason = validateReason(body?.reason);

    console.log(`User ${user.id} requesting account deletion`);

    // Check if there's already a pending request
    const { data: existingRequest, error: checkError } = await supabaseAdmin
      .from('account_deletion_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing requests:', checkError);
      throw checkError;
    }

    if (existingRequest) {
      return new Response(
        JSON.stringify({ error: 'You already have a pending deletion request' }),
        {
          headers: { ...cors, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Create the deletion request
    const { data: request, error: insertError } = await supabaseAdmin
      .from('account_deletion_requests')
      .insert({
        user_id: user.id,
        reason: reason,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating deletion request:', insertError);
      throw insertError;
    }

    console.log(`Created deletion request ${request.id} for user ${user.id}`);

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const userName = profile?.name || 'User';

    // Get support email from system settings
    const { data: supportEmailSetting } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'support_email')
      .single();

    const supportEmail = supportEmailSetting?.value || 'hubadmin@innotrue.com';

    // Get all admin emails
    const { data: adminRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const adminIds = adminRoles?.map(r => r.user_id) || [];
    
    let adminEmails: string[] = [];
    if (adminIds.length > 0) {
      const { data: adminUsers } = await supabaseAdmin.auth.admin.listUsers();
      adminEmails = adminUsers?.users
        .filter(u => adminIds.includes(u.id) && u.email)
        .map(u => u.email!) || [];
    }

    // Fetch email templates from database
    const { data: userTemplate } = await supabaseAdmin
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "account_deletion_user")
      .single();

    const { data: adminTemplate } = await supabaseAdmin
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "account_deletion_admin")
      .single();

    const userEmailTemplate = userTemplate || defaultUserTemplate;
    const adminEmailTemplate = adminTemplate || defaultAdminTemplate;

    const requestedAt = new Date().toLocaleString();

    // Send confirmation email to user
    try {
      const userHtmlContent = userEmailTemplate.html_content
        .replace(/\{\{userName\}\}/g, userName)
        .replace(/\{\{supportEmail\}\}/g, supportEmail);

      await resend.emails.send({
        from: 'InnoTrue Hub <noreply@mail.innotrue.com>',
        to: [getStagingRecipient(user.email!)],
        subject: getStagingSubject(userEmailTemplate.subject, user.email!),
        html: userHtmlContent,
      });
      console.log('Confirmation email sent to user');
    } catch (emailError) {
      console.error('Failed to send confirmation email to user:', emailError);
      // Don't fail the whole request if email fails
    }

    // Send notification email to admins
    for (const adminEmail of adminEmails) {
      try {
        // Build reason row for admin email
        const reasonRow = reason 
          ? `<tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${reason}</td>
            </tr>`
          : '';

        const adminHtmlContent = adminEmailTemplate.html_content
          .replace(/\{\{userName\}\}/g, userName)
          .replace(/\{\{userEmail\}\}/g, user.email!)
          .replace(/\{\{userId\}\}/g, user.id)
          .replace(/\{\{reasonRow\}\}/g, reasonRow)
          .replace(/\{\{requestedAt\}\}/g, requestedAt);

        const adminSubject = adminEmailTemplate.subject
          .replace(/\{\{userName\}\}/g, userName);

        await resend.emails.send({
          from: 'InnoTrue Hub <noreply@mail.innotrue.com>',
          to: [getStagingRecipient(adminEmail)],
          subject: getStagingSubject(adminSubject, adminEmail),
          html: adminHtmlContent,
        });
        console.log(`Notification email sent to admin: ${adminEmail}`);
      } catch (emailError) {
        console.error(`Failed to send notification email to admin ${adminEmail}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Deletion request submitted successfully' }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in request-account-deletion function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: errorMessage === 'Unauthorized' ? 403 : 500,
      }
    );
  }
});
