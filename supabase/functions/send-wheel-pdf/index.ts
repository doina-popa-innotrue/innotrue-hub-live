import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";
import { isValidEmail, validateName } from "../_shared/validation.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface WheelPdfRequest {
  email: string;
  name: string;
  ratings: Record<string, number>;
  notes?: string;
}

const WHEEL_CATEGORIES: Record<string, string> = {
  health_fitness: 'Health & Fitness',
  career_business: 'Career & Business',
  finances: 'Finances',
  relationships: 'Relationships',
  personal_growth: 'Personal Growth',
  fun_recreation: 'Fun & Recreation',
  physical_environment: 'Physical Environment',
  family_friends: 'Family & Friends',
  romance: 'Romance',
  contribution: 'Contribution',
};

// Default template as fallback
const defaultTemplate = {
  subject: "🎯 Your Wheel of Life Results - {{userName}}",
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Wheel of Life Results</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎯 Wheel of Life Results</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your personal life balance assessment</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #374151;">Hello {{userName}},</p>
    <p style="font-size: 16px; color: #374151;">Thank you for completing the Wheel of Life assessment. Here's a summary of your results:</p>
    
    <!-- Summary Stats -->
    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; display: flex; justify-content: space-around; text-align: center;">
      <div>
        <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">{{average}}</div>
        <div style="font-size: 12px; color: #6b7280;">Average</div>
      </div>
      <div>
        <div style="font-size: 24px; font-weight: 700; color: #22c55e;">{{highest}}</div>
        <div style="font-size: 12px; color: #6b7280;">Highest</div>
      </div>
      <div>
        <div style="font-size: 24px; font-weight: 700; color: #ef4444;">{{lowest}}</div>
        <div style="font-size: 12px; color: #6b7280;">Lowest</div>
      </div>
    </div>

    <!-- All Ratings -->
    <h3 style="color: #1f2937; margin: 30px 0 15px 0;">Your Ratings</h3>
    <table style="width: 100%; border-collapse: collapse;">
      {{ratingsHtml}}
    </table>

    <!-- Growth Areas -->
    <h3 style="color: #1f2937; margin: 30px 0 15px 0;">🌱 Areas for Growth</h3>
    <ul style="padding-left: 20px; color: #374151;">
      {{growthAreasHtml}}
    </ul>

    <!-- Strengths -->
    <h3 style="color: #1f2937; margin: 30px 0 15px 0;">💪 Your Strengths</h3>
    <ul style="padding-left: 20px; color: #374151;">
      {{strengthsHtml}}
    </ul>

    {{notesSection}}

    <!-- CTA -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 25px; border-radius: 8px; text-align: center; margin-top: 30px;">
      <h3 style="color: white; margin: 0 0 10px 0;">Ready to improve your life balance?</h3>
      <p style="color: rgba(255,255,255,0.9); margin: 0 0 15px 0;">Join InnoTrue Hub to track your progress and receive personalized guidance.</p>
      <a href="{{ctaLink}}" style="display: inline-block; background: white; color: #3b82f6; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">Get Started</a>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>InnoTrue Hub - Your Personal Development Partner</p>
    <p>If you have any questions, reply to this email.</p>
  </div>
</body>
</html>`,
};

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return errorResponse.serverErrorWithMessage("Email service not configured", cors);
    }

    const resend = new Resend(resendApiKey);
    const { email, name, ratings, notes }: WheelPdfRequest = await req.json();

    // Validate required fields
    if (!email || !name || !ratings) {
      return errorResponse.badRequest("Email, name, and ratings are required", cors);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return errorResponse.badRequest("Please enter a valid email address", cors);
    }

    // Validate name
    const validatedName = validateName(name);
    if (!validatedName) {
      return errorResponse.badRequest("Please enter a valid name", cors);
    }

    // Validate ratings: must be an object with numeric values between 0-10
    if (typeof ratings !== "object" || Array.isArray(ratings)) {
      return errorResponse.badRequest("Ratings must be an object", cors);
    }
    for (const [key, value] of Object.entries(ratings)) {
      if (typeof value !== "number" || value < 0 || value > 10 || !isFinite(value)) {
        return errorResponse.badRequest(`Invalid rating value for ${key}: must be a number between 0 and 10`, cors);
      }
    }

    // Validate notes length if provided
    if (notes && (typeof notes !== "string" || notes.length > 5000)) {
      return errorResponse.badRequest("Notes must be a string of at most 5,000 characters", cors);
    }

    // HTML-escape helper to prevent XSS in email templates
    const escapeHtml = (str: string): string =>
      str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    // Sanitize user inputs for HTML embedding
    const safeName = escapeHtml(validatedName);
    const safeNotes = notes ? escapeHtml(notes) : "";

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

    // Fetch email template from database
    const { data: template } = await supabaseAdmin
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "wheel_of_life_results")
      .single();

    const emailTemplate = template || defaultTemplate;

    // Calculate stats
    const values = Object.values(ratings);
    const average = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    const highest = Math.max(...values);
    const lowest = Math.min(...values);

    // Sort categories
    const sortedCategories = Object.entries(ratings)
      .sort(([, a], [, b]) => a - b);
    const growthAreas = sortedCategories.slice(0, 3);
    const strengthAreas = sortedCategories.slice(-3).reverse();

    // Build ratings HTML
    const ratingsHtml = Object.entries(WHEEL_CATEGORIES)
      .map(([key, label]) => {
        const score = ratings[key] || 0;
        const percentage = (score / 10) * 100;
        const color = score <= 4 ? '#ef4444' : score <= 6 ? '#f59e0b' : '#22c55e';
        return `
          <tr>
            <td style="padding: 8px 0; color: #374151; font-size: 14px;">${label}</td>
            <td style="padding: 8px 0; width: 150px;">
              <div style="background: #e5e7eb; border-radius: 4px; height: 12px; overflow: hidden;">
                <div style="background: ${color}; height: 100%; width: ${percentage}%;"></div>
              </div>
            </td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937; width: 40px;">${score}</td>
          </tr>
        `;
      })
      .join('');

    // Build growth areas HTML
    const growthAreasHtml = growthAreas
      .map(([key, score]) => `<li style="margin: 8px 0;">${WHEEL_CATEGORIES[key] || key} (${score}/10)</li>`)
      .join('');

    // Build strengths HTML
    const strengthsHtml = strengthAreas
      .map(([key, score]) => `<li style="margin: 8px 0;">${WHEEL_CATEGORIES[key] || key} (${score}/10)</li>`)
      .join('');

    // Build notes section (using HTML-escaped notes)
    const notesSection = safeNotes
      ? `<h3 style="color: #1f2937; margin: 30px 0 15px 0;">📝 Your Notes</h3>
         <p style="color: #6b7280; font-style: italic; background: #f9fafb; padding: 15px; border-radius: 8px;">${safeNotes}</p>`
      : '';

    // Replace template variables (using HTML-escaped name)
    const subject = emailTemplate.subject
      .replace(/\{\{userName\}\}/g, safeName);

    const htmlContent = emailTemplate.html_content
      .replace(/\{\{userName\}\}/g, safeName)
      .replace(/\{\{average\}\}/g, average)
      .replace(/\{\{highest\}\}/g, highest.toString())
      .replace(/\{\{lowest\}\}/g, lowest.toString())
      .replace(/\{\{ratingsHtml\}\}/g, ratingsHtml)
      .replace(/\{\{growthAreasHtml\}\}/g, growthAreasHtml)
      .replace(/\{\{strengthsHtml\}\}/g, strengthsHtml)
      .replace(/\{\{notesSection\}\}/g, notesSection)
      .replace(/\{\{ctaLink\}\}/g, Deno.env.get("SITE_URL") || "https://app.innotrue.com")
      .replace(/\{\{systemLogo\}\}/g, systemLogoHtml);

    const emailResponse = await resend.emails.send({
      from: "InnoTrue Hub <hello@mail.innotrue.com>",
      to: [getStagingRecipient(email)],
      subject: getStagingSubject(subject, email),
      html: htmlContent,
    });

    console.log("Wheel PDF email sent successfully:", emailResponse);

    return successResponse.ok({ success: true }, cors);
  } catch (error: any) {
    return errorResponse.serverError("send-wheel-pdf", error, cors);
  }
};

serve(handler);
