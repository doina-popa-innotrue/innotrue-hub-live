/**
 * Builds a Cal.com booking URL with context metadata for automatic session linking.
 *
 * Cal.com supports prefilling booking data via URL query parameters:
 * - metadata[key]=value - Custom metadata passed through to webhooks
 * - email=value - Prefill attendee email
 * - name=value - Prefill attendee name
 */

interface BookingContext {
  /** The Cal.com scheduling URL (base URL) */
  schedulingUrl: string;

  /** Client's enrollment ID for linking the session */
  enrollmentId?: string;

  /** Module ID to associate the session with */
  moduleId?: string;

  /** User ID of the person booking */
  userId?: string;

  /** Group ID for group sessions */
  groupId?: string;

  /** Session type (individual or group) */
  sessionType?: "individual" | "group";

  /** Prefill attendee email */
  email?: string;

  /** Prefill attendee name */
  name?: string;

  /** Pre-created session ID for hybrid flow (session created first, then linked via Cal.com) */
  pendingSessionId?: string;

  /** URL to redirect to after successful booking */
  redirectUrl?: string;
}

/**
 * Builds a Cal.com booking URL with embedded metadata for automatic session linking.
 * The webhook will read this metadata to link the created session to the correct enrollment/module.
 */
export function buildCalcomBookingUrl(context: BookingContext): string {
  if (!context.schedulingUrl) {
    throw new Error("Scheduling URL is required");
  }

  const url = new URL(context.schedulingUrl);

  // Add metadata parameters that Cal.com passes through to webhooks
  if (context.enrollmentId) {
    url.searchParams.set("metadata[enrollment_id]", context.enrollmentId);
  }

  if (context.moduleId) {
    url.searchParams.set("metadata[module_id]", context.moduleId);
  }

  if (context.userId) {
    url.searchParams.set("metadata[user_id]", context.userId);
  }

  if (context.groupId) {
    url.searchParams.set("metadata[group_id]", context.groupId);
  }

  if (context.sessionType) {
    url.searchParams.set("metadata[session_type]", context.sessionType);
  }

  // Pre-created session ID for hybrid flow (update existing session instead of creating new)
  if (context.pendingSessionId) {
    url.searchParams.set("metadata[pending_session_id]", context.pendingSessionId);
  }

  // Prefill attendee info for better UX
  if (context.email) {
    url.searchParams.set("email", context.email);
  }

  if (context.name) {
    url.searchParams.set("name", context.name);
  }

  // Redirect back to origin after booking
  if (context.redirectUrl) {
    url.searchParams.set("successUrl", context.redirectUrl);
  }

  return url.toString();
}

/**
 * Validates a Cal.com URL format
 */
export function isValidCalcomUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // Cal.com URLs typically use cal.com domain or custom domains
    // We'll be permissive and allow any valid URL
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Extracts the event type slug from a Cal.com URL
 * e.g., https://cal.com/username/event-type -> event-type
 */
export function extractEventTypeSlug(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    // Cal.com URLs are typically /{username}/{event-type}
    if (pathParts.length >= 2) {
      return pathParts[pathParts.length - 1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Builds a Cal.com reschedule URL for an existing booking.
 * Cal.com reschedule URLs follow the pattern: https://cal.com/reschedule/{bookingUid}
 *
 * @param bookingUid - The unique identifier of the Cal.com booking (calcom_booking_uid)
 * @param baseUrl - Optional base URL (defaults to https://cal.com)
 * @param redirectUrl - Optional URL to redirect to after rescheduling
 */
export function buildCalcomRescheduleUrl(
  bookingUid: string,
  baseUrl: string = "https://cal.com",
  redirectUrl?: string,
): string {
  if (!bookingUid) {
    throw new Error("Booking UID is required for rescheduling");
  }

  const url = new URL(`/reschedule/${bookingUid}`, baseUrl);

  // Redirect back to origin after rescheduling
  if (redirectUrl) {
    url.searchParams.set("successUrl", redirectUrl);
  }

  return url.toString();
}
