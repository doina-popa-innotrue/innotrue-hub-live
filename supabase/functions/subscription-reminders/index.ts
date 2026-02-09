import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SUBSCRIPTION-REMINDERS] ${step}${detailsStr}`);
};

// Default template as fallback
const defaultTemplate = {
  subject: "Your InnoTrue Hub subscription renews in {{timeframe}}",
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">InnoTrue Hub</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Hi {{userName}},</h2>
    
    <p>This is a friendly reminder that your InnoTrue Hub subscription will renew in <strong>{{timeframe}}</strong>.</p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 16px;">
        <strong>Renewal Date:</strong> {{renewalDate}}
      </p>
    </div>
    
    <p>If you'd like to make any changes to your subscription, you can do so from your account settings.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{subscriptionLink}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Manage Subscription
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      If you have any questions, please don't hesitate to reach out to our support team.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      © {{currentYear}} InnoTrue Hub. All rights reserved.
    </p>
  </div>
</body>
</html>`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is not set");

    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const resend = new Resend(resendKey);

    // Create Supabase client to fetch templates
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch email template from database
    const { data: template } = await supabaseAdmin
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "subscription_reminder")
      .single();

    const emailTemplate = template || defaultTemplate;

    // Get current time and calculate reminder windows
    const now = Math.floor(Date.now() / 1000);
    const oneMonthFromNow = now + (30 * 24 * 60 * 60); // 30 days
    const twoWeeksFromNow = now + (14 * 24 * 60 * 60); // 14 days
    const oneDayBuffer = 24 * 60 * 60; // 1 day window to avoid duplicate emails

    logStep("Checking for subscriptions ending soon", {
      oneMonthWindow: new Date(oneMonthFromNow * 1000).toISOString(),
      twoWeeksWindow: new Date(twoWeeksFromNow * 1000).toISOString(),
    });

    // Fetch all active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
    });

    logStep("Found active subscriptions", { count: subscriptions.data.length });

    const emailsSent: string[] = [];
    const errors: string[] = [];

    for (const subscription of subscriptions.data) {
      const endDate = subscription.current_period_end;
      const customerEmail = typeof subscription.customer === 'string' 
        ? null 
        : (subscription.customer as Stripe.Customer).email;

      // Skip if we can't get email
      if (!customerEmail) {
        // Try to fetch customer details
        const customer = await stripe.customers.retrieve(
          typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id
        ) as Stripe.Customer;
        
        if (!customer.email) {
          logStep("Skipping subscription - no customer email", { subscriptionId: subscription.id });
          continue;
        }
        
        await sendReminderIfNeeded(
          resend,
          customer.email,
          customer.name || "Valued Customer",
          endDate,
          now,
          oneMonthFromNow,
          twoWeeksFromNow,
          oneDayBuffer,
          siteUrl,
          emailTemplate,
          emailsSent,
          errors
        );
      } else {
        const customer = await stripe.customers.retrieve(
          typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id
        ) as Stripe.Customer;

        await sendReminderIfNeeded(
          resend,
          customerEmail,
          customer.name || "Valued Customer",
          endDate,
          now,
          oneMonthFromNow,
          twoWeeksFromNow,
          oneDayBuffer,
          siteUrl,
          emailTemplate,
          emailsSent,
          errors
        );
      }
    }

    logStep("Completed", { emailsSent: emailsSent.length, errors: errors.length });

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        errors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function sendReminderIfNeeded(
  resend: InstanceType<typeof Resend>,
  email: string,
  name: string,
  endDate: number,
  now: number,
  oneMonthFromNow: number,
  twoWeeksFromNow: number,
  oneDayBuffer: number,
  siteUrl: string,
  emailTemplate: { subject: string; html_content: string },
  emailsSent: string[],
  errors: string[]
) {
  const endDateFormatted = new Date(endDate * 1000).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let reminderType: "one_month" | "two_weeks" | null = null;

  // Check if subscription ends in ~1 month (within a 1-day window)
  if (endDate >= oneMonthFromNow - oneDayBuffer && endDate <= oneMonthFromNow + oneDayBuffer) {
    reminderType = "one_month";
  }
  // Check if subscription ends in ~2 weeks (within a 1-day window)
  else if (endDate >= twoWeeksFromNow - oneDayBuffer && endDate <= twoWeeksFromNow + oneDayBuffer) {
    reminderType = "two_weeks";
  }

  if (!reminderType) return;

  const timeframe = reminderType === "one_month" ? "one month" : "two weeks";
  const currentYear = new Date().getFullYear().toString();

  // Replace template variables
  const subject = emailTemplate.subject
    .replace(/\{\{timeframe\}\}/g, timeframe);

  const htmlContent = emailTemplate.html_content
    .replace(/\{\{userName\}\}/g, name)
    .replace(/\{\{timeframe\}\}/g, timeframe)
    .replace(/\{\{renewalDate\}\}/g, endDateFormatted)
    .replace(/\{\{subscriptionLink\}\}/g, `${siteUrl}/subscription`)
    .replace(/\{\{currentYear\}\}/g, currentYear);

  try {
    logStep(`Sending ${reminderType} reminder`, { email, endDate: endDateFormatted });

    const { error } = await resend.emails.send({
      from: "InnoTrue Hub <notifications@mail.innotrue.com>",
      to: [getStagingRecipient(email)],
      subject: getStagingSubject(subject, email),
      html: htmlContent,
    });

    if (error) {
      errors.push(`Failed to send to ${email}: ${error.message}`);
      logStep("Email send failed", { email, error: error.message });
    } else {
      emailsSent.push(email);
      logStep("Email sent successfully", { email });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to send to ${email}: ${errorMsg}`);
    logStep("Email send error", { email, error: errorMsg });
  }
}
