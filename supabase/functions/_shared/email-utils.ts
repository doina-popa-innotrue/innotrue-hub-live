import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface UserEmailStatus {
  canReceiveEmails: boolean;
  reason?: 'disabled' | 'inactive' | 'not_found';
  email?: string;
  name?: string;
}

/**
 * Centralized check for whether a user can receive emails.
 * Checks both profiles.is_disabled and client_profiles.status.
 * 
 * @param supabase - Supabase client with service role
 * @param userId - The user ID to check
 * @returns UserEmailStatus indicating if user can receive emails
 */
export async function checkUserEmailStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<UserEmailStatus> {
  try {
    // Get user from auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      console.log(`User ${userId} not found in auth`);
      return { canReceiveEmails: false, reason: 'not_found' };
    }

    // Check profiles.is_disabled
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, is_disabled')
      .eq('id', userId)
      .single();

    if (profile?.is_disabled) {
      console.log(`User ${userId} is disabled, blocking email`);
      return { 
        canReceiveEmails: false, 
        reason: 'disabled',
        email: user.email,
        name: profile?.name 
      };
    }

    // Check client_profiles.status
    const { data: clientProfile } = await supabase
      .from('client_profiles')
      .select('status')
      .eq('user_id', userId)
      .single();

    if (clientProfile?.status === 'inactive') {
      console.log(`User ${userId} is inactive, blocking email`);
      return { 
        canReceiveEmails: false, 
        reason: 'inactive',
        email: user.email,
        name: profile?.name 
      };
    }

    return { 
      canReceiveEmails: true,
      email: user.email,
      name: profile?.name || user.email?.split('@')[0]
    };
  } catch (error) {
    console.error(`Error checking user email status for ${userId}:`, error);
    // Default to allowing emails on error to avoid blocking legitimate notifications
    // Log the error for investigation
    return { canReceiveEmails: true };
  }
}

/**
 * Check if an email address belongs to a disabled/inactive user.
 * Useful when you only have the email, not the user ID.
 * 
 * @param supabase - Supabase client with service role
 * @param email - The email address to check
 * @returns UserEmailStatus indicating if user can receive emails
 */
export async function checkEmailRecipientStatus(
  supabase: SupabaseClient,
  email: string
): Promise<UserEmailStatus> {
  try {
    // Find user by email in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, is_disabled')
      .eq('email', email)
      .single();

    if (!profile) {
      // User not in our system - allow email (could be external recipient)
      return { canReceiveEmails: true, email };
    }

    if (profile.is_disabled) {
      console.log(`Email recipient ${email} is disabled, blocking email`);
      return { 
        canReceiveEmails: false, 
        reason: 'disabled',
        email,
        name: profile.name 
      };
    }

    // Check client_profiles.status
    const { data: clientProfile } = await supabase
      .from('client_profiles')
      .select('status')
      .eq('user_id', profile.id)
      .single();

    if (clientProfile?.status === 'inactive') {
      console.log(`Email recipient ${email} is inactive, blocking email`);
      return { 
        canReceiveEmails: false, 
        reason: 'inactive',
        email,
        name: profile.name 
      };
    }

    return { 
      canReceiveEmails: true,
      email,
      name: profile.name
    };
  } catch (error) {
    console.error(`Error checking email recipient status for ${email}:`, error);
    return { canReceiveEmails: true, email };
  }
}

/**
 * List of admin notification types that should always be delivered
 * regardless of user status (admins need to know about inactive users too)
 */
export const ADMIN_NOTIFICATION_TYPES = [
  'coach_instructor_request',
  'account_deletion_request',
  'interest_registration',
  'new_enrollment',
  'assignment_submitted',
  'session_request',
  'badge_request',
  'support_request',
  'system_alert'
];

/**
 * Check if a notification type is admin-targeted and should bypass inactive checks
 */
export function isAdminNotificationType(notificationType: string): boolean {
  return ADMIN_NOTIFICATION_TYPES.includes(notificationType);
}

/**
 * Check if global email mute is enabled via system_settings.
 * When muted, ALL outbound emails are suppressed platform-wide.
 *
 * @param supabase - Supabase client with service role
 * @returns true if emails are globally muted
 */
export async function isGlobalEmailMuted(
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'global_email_mute')
      .single();

    return data?.value === 'true';
  } catch (error) {
    console.error('Error checking global email mute:', error);
    // Default to NOT muted on error to avoid blocking legitimate emails
    return false;
  }
}

// ---------------------------------------------------------------------------
// Staging Email Override
// ---------------------------------------------------------------------------
// In non-production environments, redirect all emails to a catch-all address
// so you can test email flows without emailing real users.
//
// Setup: In your staging Supabase project, set these secrets:
//   STAGING_EMAIL_OVERRIDE = your-test-inbox@example.com
//   APP_ENV = staging   (or development, preprod — anything except "production")
//
// When active:
//   - All emails go to the override address instead of the real recipient
//   - Subject is prefixed with [STAGING → real@email.com] for debugging
//   - Console logs every redirect for audit trail
// ---------------------------------------------------------------------------

const STAGING_OVERRIDE = Deno.env.get("STAGING_EMAIL_OVERRIDE");
const APP_ENV = Deno.env.get("APP_ENV") || "production";
const IS_PRODUCTION = APP_ENV === "production";

/**
 * Apply staging email override to a single recipient.
 * Returns the (possibly redirected) email address.
 */
export function getStagingRecipient(realEmail: string): string {
  if (IS_PRODUCTION || !STAGING_OVERRIDE) {
    return realEmail;
  }
  console.log(`[STAGING] Redirecting email from ${realEmail} → ${STAGING_OVERRIDE}`);
  return STAGING_OVERRIDE;
}

/**
 * Apply staging email override to an array of recipients.
 * De-duplicates to avoid sending the same override address multiple times.
 */
export function getStagingRecipients(realEmails: string[]): string[] {
  if (IS_PRODUCTION || !STAGING_OVERRIDE) {
    return realEmails;
  }
  const originals = realEmails.filter(Boolean).join(", ");
  console.log(`[STAGING] Redirecting ${realEmails.length} recipient(s) (${originals}) → ${STAGING_OVERRIDE}`);
  return [STAGING_OVERRIDE];
}

/**
 * Apply staging prefix to email subject so you can see who the real
 * recipient would have been.
 */
export function getStagingSubject(subject: string, realRecipient: string | string[]): string {
  if (IS_PRODUCTION || !STAGING_OVERRIDE) {
    return subject;
  }
  const recipients = Array.isArray(realRecipient)
    ? realRecipient.filter(Boolean).join(", ")
    : realRecipient;
  return `[STAGING → ${recipients}] ${subject}`;
}
