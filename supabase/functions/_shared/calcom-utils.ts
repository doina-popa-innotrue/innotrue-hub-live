/**
 * Shared Cal.com API utilities for edge functions.
 *
 * cancelCalcomBooking – cancels a booking via the Cal.com v2 API so that
 * orphaned bookings don't accumulate when the database write fails.
 */

export interface CancelResult {
  success: boolean;
  error?: string;
}

/**
 * Cancel a Cal.com booking by its UID.
 *
 * Uses the Cal.com v2 `POST /v2/bookings/{uid}/cancel` endpoint.
 * Swallows errors so callers can fire-and-forget when appropriate.
 */
export async function cancelCalcomBooking(
  bookingUid: string,
  reason?: string,
): Promise<CancelResult> {
  const calcomApiKey = Deno.env.get("CALCOM_API_KEY");
  if (!calcomApiKey) {
    console.error("cancelCalcomBooking: CALCOM_API_KEY not configured");
    return { success: false, error: "CALCOM_API_KEY not configured" };
  }

  try {
    console.log(`cancelCalcomBooking: cancelling booking ${bookingUid}`);

    const response = await fetch(
      `https://api.cal.com/v2/bookings/${bookingUid}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${calcomApiKey}`,
          "cal-api-version": "2024-08-13",
        },
        body: JSON.stringify({
          cancellationReason: reason || "Automatic cleanup — database sync failed",
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `cancelCalcomBooking: Cal.com API returned ${response.status}: ${text}`,
      );
      return { success: false, error: `Cal.com ${response.status}: ${text}` };
    }

    console.log(`cancelCalcomBooking: successfully cancelled ${bookingUid}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`cancelCalcomBooking: exception — ${msg}`);
    return { success: false, error: msg };
  }
}
