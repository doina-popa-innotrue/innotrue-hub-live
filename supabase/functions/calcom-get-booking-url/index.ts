import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface GetBookingUrlRequest {
  eventTypeId: number;
}

interface CalcomEventTypeResponse {
  status: string;
  data: {
    id: number;
    slug: string;
    title: string;
    lengthInMinutes: number;
    ownerId?: number;
    teamId?: number;
    schedulingType?: string;
    // Cal.com returns various URL formats depending on event type
    links?: {
      self: string;
      booking?: string;
    };
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const calcomApiKey = Deno.env.get("CALCOM_API_KEY");

  if (!calcomApiKey) {
    console.error("CALCOM_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Cal.com API key not configured" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: GetBookingUrlRequest = await req.json();
    console.log("=== Cal.com Get Booking URL Request ===");
    console.log("Event Type ID:", body.eventTypeId);

    if (!body.eventTypeId) {
      return new Response(
        JSON.stringify({ error: "eventTypeId is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Fetch event type details from Cal.com API v2
    const calcomResponse = await fetch(
      `https://api.cal.com/v2/event-types/${body.eventTypeId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${calcomApiKey}`,
          "cal-api-version": "2024-08-13",
        },
      }
    );

    const responseText = await calcomResponse.text();
    console.log("Cal.com API response status:", calcomResponse.status);
    console.log("Cal.com API response:", responseText);

    if (!calcomResponse.ok) {
      console.error("Cal.com API error:", responseText);
      
      // Handle 404 specifically - event type may not exist or be accessible
      if (calcomResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "event_type_not_found",
            message: `Cal.com event type ${body.eventTypeId} was not found. Please verify the event type ID in Cal.com Mappings.`,
            eventTypeId: body.eventTypeId,
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "calcom_api_error", 
          message: "Failed to fetch Cal.com event type",
          details: responseText 
        }),
        { status: calcomResponse.status, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const calcomData: CalcomEventTypeResponse = JSON.parse(responseText);
    const eventType = calcomData.data;

    console.log("Event Type:", eventType.title);
    console.log("Slug:", eventType.slug);

    // Cal.com API v2 may return the booking link directly, or we construct it
    // For team events, the URL format is different than personal events
    let bookingUrl: string | null = null;

    if (eventType.links?.booking) {
      bookingUrl = eventType.links.booking;
    } else if (eventType.links?.self) {
      // Some API responses include a self link we can derive from
      bookingUrl = eventType.links.self;
    }

    // If no direct link, we need to fetch additional details to construct URL
    // This typically requires knowing the username or team slug
    // For now, return what we have

    return new Response(
      JSON.stringify({
        success: true,
        eventTypeId: eventType.id,
        slug: eventType.slug,
        title: eventType.title,
        lengthInMinutes: eventType.lengthInMinutes,
        bookingUrl: bookingUrl,
        teamId: eventType.teamId || null,
        schedulingType: eventType.schedulingType || null,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching Cal.com event type:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
