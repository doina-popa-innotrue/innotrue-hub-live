/**
 * Pure helpers for staging email overrides (recipient redirect, subject prefix).
 * Mirrors the logic in supabase/functions/_shared/email-utils.ts for unit testing.
 * Edge functions use Deno.env; this module takes options so tests can run in Node.
 */

export interface StagingEmailOptions {
  isProduction: boolean;
  stagingOverride: string | null;
}

/**
 * Apply staging email override to a single recipient.
 * Returns the (possibly redirected) email address.
 */
export function getStagingRecipient(
  realEmail: string,
  options: StagingEmailOptions,
): string {
  if (options.isProduction || !options.stagingOverride) {
    return realEmail;
  }
  return options.stagingOverride;
}

/**
 * Apply staging email override to an array of recipients.
 * De-duplicates to a single override address when active.
 */
export function getStagingRecipients(
  realEmails: string[],
  options: StagingEmailOptions,
): string[] {
  if (options.isProduction || !options.stagingOverride) {
    return realEmails;
  }
  return [options.stagingOverride];
}

/**
 * Apply staging prefix to email subject so you can see who the real
 * recipient would have been.
 */
export function getStagingSubject(
  subject: string,
  realRecipient: string | string[],
  options: StagingEmailOptions,
): string {
  if (options.isProduction || !options.stagingOverride) {
    return subject;
  }
  const recipients = Array.isArray(realRecipient)
    ? realRecipient.filter(Boolean).join(", ")
    : realRecipient;
  return `[STAGING → ${recipients}] ${subject}`;
}
