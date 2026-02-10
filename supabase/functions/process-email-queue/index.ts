import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkEmailRecipientStatus, getStagingRecipient, getStagingSubject } from '../_shared/email-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending emails
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', 3)
      .order('created_at')
      .limit(50);

    if (fetchError) throw fetchError;

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending emails' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const email of pendingEmails) {
      try {
        // Use centralized check for user email status
        const userStatus = await checkEmailRecipientStatus(supabase, email.recipient_email);
        
        if (!userStatus.canReceiveEmails) {
          const reason = userStatus.reason === 'disabled' 
            ? 'User is disabled' 
            : userStatus.reason === 'inactive' 
              ? 'Client profile is inactive'
              : 'User not eligible for emails';
          
          console.log(`Skipping email ${email.id} to ${email.recipient_email}: ${reason}`);
          
          await supabase
            .from('email_queue')
            .update({ 
              status: 'skipped_inactive',
              error_message: reason,
            })
            .eq('id', email.id);

          if (email.notification_id) {
            await supabase
              .from('notifications')
              .update({ email_error: `Skipped: ${reason}` })
              .eq('id', email.notification_id);
          }

          skipped++;
          continue;
        }

        // Update attempts
        await supabase
          .from('email_queue')
          .update({ 
            attempts: email.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        // Generate email content from template
        const emailContent = generateEmailContent(email.template_key, email.template_data);

        if (!RESEND_API_KEY) {
          throw new Error('RESEND_API_KEY not configured');
        }

        // Send via Resend
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'InnoTrue Hub <notifications@mail.innotrue.com>',
            to: getStagingRecipient(email.recipient_email),
            subject: getStagingSubject(emailContent.subject, email.recipient_email),
            html: emailContent.html,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Resend API error: ${errorData}`);
        }

        // Mark as sent
        await supabase
          .from('email_queue')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        // Update notification if linked
        if (email.notification_id) {
          await supabase
            .from('notifications')
            .update({ 
              email_sent: true,
              email_sent_at: new Date().toISOString(),
            })
            .eq('id', email.notification_id);
        }

        sent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to send email ${email.id}:`, error);
        
        const newStatus = email.attempts + 1 >= email.max_attempts ? 'failed' : 'pending';
        
        await supabase
          .from('email_queue')
          .update({ 
            status: newStatus,
            error_message: errorMessage,
          })
          .eq('id', email.id);

        if (email.notification_id) {
          await supabase
            .from('notifications')
            .update({ email_error: errorMessage })
            .eq('id', email.notification_id);
        }

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Email queue processed',
        sent,
        failed,
        skipped,
        total: pendingEmails.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing email queue:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface EmailContent {
  subject: string;
  html: string;
}

function generateEmailContent(templateKey: string, data: Record<string, any>): EmailContent {
  const userName = data.user_name || 'there';
  const title = data.title || '';
  const message = data.message || '';
  const link = data.link || '';

  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
  `;

  const buttonStyles = `
    display: inline-block;
    padding: 12px 24px;
    background-color: #6366f1;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 500;
  `;

  const wrapHtml = (content: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${baseStyles} margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 24px;">InnoTrue Hub</h1>
        </div>
        ${content}
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center; color: #666; font-size: 12px;">
          <p>You received this email because you have notifications enabled for this type of activity.</p>
          <p><a href="${Deno.env.get('SITE_URL') || 'https://app.innotrue.com'}/settings/notifications" style="color: #6366f1;">Manage notification preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const templates: Record<string, () => EmailContent> = {
    welcome: () => ({
      subject: 'Welcome to InnoTrue Hub!',
      html: wrapHtml(`
        <h2 style="margin-top: 0;">Welcome, ${userName}!</h2>
        <p>We're excited to have you on board. InnoTrue Hub is your platform for professional development and growth.</p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${Deno.env.get('SITE_URL') || 'https://app.innotrue.com'}/dashboard" style="${buttonStyles}">Get Started</a>
        </p>
      `),
    }),

    program_enrollment: () => ({
      subject: `You've been enrolled in ${data.program_name || 'a new program'}`,
      html: wrapHtml(`
        <h2 style="margin-top: 0;">Hi ${userName}!</h2>
        <p>${title}</p>
        <p>${message}</p>
        ${link ? `<p style="text-align: center; margin-top: 24px;"><a href="${link}" style="${buttonStyles}">View Program</a></p>` : ''}
      `),
    }),

    session_scheduled: () => ({
      subject: 'New Session Scheduled',
      html: wrapHtml(`
        <h2 style="margin-top: 0;">Hi ${userName}!</h2>
        <p>${title}</p>
        <p>${message}</p>
        ${link ? `<p style="text-align: center; margin-top: 24px;"><a href="${link}" style="${buttonStyles}">View Session Details</a></p>` : ''}
      `),
    }),

    session_reminder: () => ({
      subject: 'Session Reminder',
      html: wrapHtml(`
        <h2 style="margin-top: 0;">Hi ${userName}!</h2>
        <p>${title}</p>
        <p>${message}</p>
        ${link ? `<p style="text-align: center; margin-top: 24px;"><a href="${link}" style="${buttonStyles}">View Session</a></p>` : ''}
      `),
    }),

    assignment_graded: () => ({
      subject: 'Your Assignment Has Been Graded',
      html: wrapHtml(`
        <h2 style="margin-top: 0;">Hi ${userName}!</h2>
        <p>${title}</p>
        <p>${message}</p>
        ${link ? `<p style="text-align: center; margin-top: 24px;"><a href="${link}" style="${buttonStyles}">View Feedback</a></p>` : ''}
      `),
    }),

    credits_low: () => ({
      subject: 'Low Credit Balance Alert',
      html: wrapHtml(`
        <h2 style="margin-top: 0;">Hi ${userName}!</h2>
        <p>${title}</p>
        <p>${message}</p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${Deno.env.get('SITE_URL') || 'https://app.innotrue.com'}/credits" style="${buttonStyles}">Top Up Credits</a>
        </p>
      `),
    }),

    decision_reminder: () => ({
      subject: 'Decision Follow-up Reminder',
      html: wrapHtml(`
        <h2 style="margin-top: 0;">Hi ${userName}!</h2>
        <p>${title}</p>
        <p>${message}</p>
        ${link ? `<p style="text-align: center; margin-top: 24px;"><a href="${link}" style="${buttonStyles}">Review Decision</a></p>` : ''}
      `),
    }),

    security_alert: () => ({
      subject: '⚠️ Security Alert',
      html: wrapHtml(`
        <h2 style="margin-top: 0; color: #dc2626;">Security Alert</h2>
        <p>Hi ${userName},</p>
        <p>${title}</p>
        <p>${message}</p>
        <p>If this wasn't you, please contact support immediately.</p>
      `),
    }),

    // Default template for any other type
    default: () => ({
      subject: title || 'Notification from InnoTrue Hub',
      html: wrapHtml(`
        <h2 style="margin-top: 0;">Hi ${userName}!</h2>
        <p>${title}</p>
        ${message ? `<p>${message}</p>` : ''}
        ${link ? `<p style="text-align: center; margin-top: 24px;"><a href="${link}" style="${buttonStyles}">View Details</a></p>` : ''}
      `),
    }),
  };

  const templateFn = templates[templateKey] || templates.default;
  return templateFn();
}