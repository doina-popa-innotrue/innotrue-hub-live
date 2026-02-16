import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";
import { isValidEmail, validatePassword, validateName } from "../_shared/validation.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MINUTES = 5;
const MAX_ATTEMPTS_PER_IP = 5;

// Default template as fallback
const defaultTemplate = {
  subject: "Confirm your email address - InnoTrue Hub",
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #333; margin-bottom: 24px;">Welcome to InnoTrue Hub!</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Hi {{userName}},</p>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Thank you for signing up! Please confirm your email address by clicking the button below:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{verificationLink}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm Email Address</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.5;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px;">{{verificationLink}}</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
  </div>
</body>
</html>`,
};

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  const startTime = Date.now();
  const MIN_RESPONSE_TIME = 500; // Minimum response time to prevent timing attacks

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    console.log(`Signup attempt from IP: ${clientIp}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check rate limit - count recent signup attempts from this IP
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    
    const { count: recentAttempts } = await supabaseAdmin
      .from("signup_verification_requests")
      .select("*", { count: "exact", head: true })
      .gte("created_at", windowStart)
      .eq("ip_address", clientIp);

    if (recentAttempts !== null && recentAttempts >= MAX_ATTEMPTS_PER_IP) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}, attempts: ${recentAttempts}`);
      
      // Ensure minimum response time
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      
      return new Response(
        JSON.stringify({ error: "Too many signup attempts. Please try again later." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { email, password, name }: SignupRequest = await req.json();

    console.log(`Processing signup for email: ${email}`);

    // Validate required fields
    if (!email || !password || !name) {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      return new Response(
        JSON.stringify({ error: "Email, password, and name are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      return new Response(
        JSON.stringify({ error: passwordError }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Validate name
    const validatedName = validateName(name);
    if (!validatedName) {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      return new Response(
        JSON.stringify({ error: "Please enter a valid name (max 200 characters)" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      // Ensure minimum response time to prevent email enumeration
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Create unconfirmed user via admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name: validatedName }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      
      // Ensure minimum response time
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Generate verification token and hash it for secure storage
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Hash the token before storing (same pattern as email change requests)
    const encoder = new TextEncoder();
    const data = encoder.encode(verificationToken);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Store verification request with hashed token and IP address for rate limiting
    const { error: insertError } = await supabaseAdmin
      .from("signup_verification_requests")
      .insert({
        user_id: userId,
        email,
        name: validatedName,
        verification_token: tokenHash, // Store the hash, not the plain token
        expires_at: expiresAt.toISOString(),
        ip_address: clientIp
      });

    if (insertError) {
      console.error("Error storing verification request:", insertError);
      // Clean up: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      // Ensure minimum response time
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to create verification request" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Build verification link
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    // Use the actual app URL from the request origin or fallback
    const appUrl = req.headers.get("origin") || siteUrl;
    const verificationLink = `${appUrl}/verify-signup?token=${verificationToken}`;

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
      .eq("template_key", "signup_verification")
      .single();

    const emailTemplate = template || defaultTemplate;

    // Replace template variables
    const htmlContent = emailTemplate.html_content
      .replace(/\{\{userName\}\}/g, validatedName)
      .replace(/\{\{verificationLink\}\}/g, verificationLink)
      .replace(/\{\{systemLogo\}\}/g, systemLogoHtml);

    const subject = emailTemplate.subject
      .replace(/\{\{userName\}\}/g, validatedName);

    // Send verification email
    const { error: emailError } = await resend.emails.send({
      from: "InnoTrue Hub <noreply@mail.innotrue.com>",
      to: [getStagingRecipient(email)],
      subject: getStagingSubject(subject, email),
      html: htmlContent,
    });

    if (emailError) {
      console.error("Error sending verification email:", emailError);
      // Clean up
      await supabaseAdmin.from("signup_verification_requests").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      // Ensure minimum response time
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to send verification email" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verification email sent to ${email}`);

    // Ensure minimum response time
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME) {
      await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
    }

    return new Response(
      JSON.stringify({ success: true, message: "Verification email sent" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in signup-user function:", error);
    
    // Ensure minimum response time
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME) {
      await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
