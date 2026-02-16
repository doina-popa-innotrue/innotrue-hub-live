import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { cancelCalcomBooking } from "../_shared/calcom-utils.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface CreateBookingRequest {
  eventTypeId: number;
  startTime: string; // ISO 8601 format
  // Option 1: Pre-built attendees (used by module sessions)
  attendees?: Array<{
    email: string;
    name: string;
    timeZone: string;
  }>;
  // Option 2: User IDs to fetch emails server-side (used by group sessions)
  memberUserIds?: string[];
  timezone?: string; // Required when using memberUserIds
  metadata?: Record<string, string>;
  sessionId: string; // The pre-created session ID to update
  sessionType: "module_session" | "group_session";
  title?: string;
  description?: string;
}

interface CalcomBookingResponse {
  status: string;
  data: {
    id: number;
    uid: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    status: string;
    location?: string;
    meetingUrl?: string;
    metadata?: Record<string, unknown>;
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const calcomApiKey = Deno.env.get("CALCOM_API_KEY");

  if (!calcomApiKey) {
    console.error("CALCOM_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Cal.com API key not configured" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // === AUTHORIZATION CHECK ===
  // Verify the calling user has permission to create bookings
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Create a user client to get the calling user
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    console.error("Failed to get calling user:", userError);
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const callingUserId = userData.user.id;
  console.log("Calling user ID:", callingUserId);

  // Check if caller has admin, instructor, or coach role
  const { data: roles, error: rolesError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callingUserId);

  if (rolesError) {
    console.error("Role lookup error:", rolesError);
    return new Response(
      JSON.stringify({ error: "Failed to verify permissions" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const hasStaffRole = roles?.some((r) => 
    r.role === "admin" || r.role === "instructor" || r.role === "coach"
  );

  if (!hasStaffRole) {
    console.error("Access denied - user lacks required role:", callingUserId);
    return new Response(
      JSON.stringify({ error: "Access denied: Admin, instructor, or coach role required" }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  console.log("Authorization verified - user has staff role");
  // === END AUTHORIZATION CHECK ===

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: CreateBookingRequest = await req.json();
    console.log("=== Cal.com Create Booking Request ===");
    console.log("Event Type ID:", body.eventTypeId);
    console.log("Start Time:", body.startTime);
    console.log("Session ID:", body.sessionId);
    console.log("Session Type:", body.sessionType);
    
    // Build attendees list - either from provided attendees or by fetching from user IDs
    let attendees: Array<{ email: string; name: string; timeZone: string }> = [];
    
    if (body.attendees && body.attendees.length > 0) {
      // Use pre-built attendees (module sessions)
      attendees = body.attendees;
      console.log("Using provided attendees:", attendees.length);
    } else if (body.memberUserIds && body.memberUserIds.length > 0) {
      // Fetch emails from auth.users server-side (group sessions)
      console.log("Fetching emails for", body.memberUserIds.length, "user IDs");
      
      for (const userId of body.memberUserIds) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
          if (userError) {
            console.error(`Failed to fetch user ${userId}:`, userError);
            continue;
          }
          if (userData?.user?.email) {
            // Get name from profiles table
            const { data: profile } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", userId)
              .single();
            
            attendees.push({
              email: userData.user.email,
              name: profile?.name || userData.user.email,
              timeZone: body.timezone || "UTC",
            });
          }
        } catch (err) {
          console.error(`Error fetching user ${userId}:`, err);
        }
      }
      console.log("Built attendees from user IDs:", attendees.length);
    }
    
    if (attendees.length === 0) {
      console.error("No valid attendees found");
      return new Response(
        JSON.stringify({ error: "No valid attendees found for booking" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Final attendees count:", attendees.length);

    // Create booking via Cal.com API v2
    const calcomResponse = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${calcomApiKey}`,
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify({
        start: body.startTime,
        eventTypeId: body.eventTypeId,
        attendee: attendees[0], // Cal.com v2 uses single attendee for standard bookings
        metadata: {
          ...body.metadata,
          session_id: body.sessionId,
          session_type: body.sessionType,
        },
      }),
    });

    const responseText = await calcomResponse.text();
    console.log("Cal.com API response status:", calcomResponse.status);
    console.log("Cal.com API response:", responseText);

    if (!calcomResponse.ok) {
      console.error("Cal.com API error:", responseText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create Cal.com booking", 
          details: responseText 
        }),
        { status: calcomResponse.status, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const calcomData: CalcomBookingResponse = JSON.parse(responseText);
    const booking = calcomData.data;

    console.log("Booking created:", booking.uid);
    console.log("Meeting URL:", booking.meetingUrl || booking.location);

    // Update the session with the booking details
    const meetingLink = booking.meetingUrl || booking.location || null;
    const updateData = {
      calcom_booking_id: booking.id?.toString(),
      calcom_booking_uid: booking.uid,
      session_date: booking.startTime,
      start_time: booking.startTime,
      end_time: booking.endTime,
      meeting_link: meetingLink,
      status: "scheduled",
      booking_source: "calcom",
    };

    let updateError;
    if (body.sessionType === "module_session") {
      const { error } = await supabase
        .from("module_sessions")
        .update(updateData)
        .eq("id", body.sessionId);
      updateError = error;
    } else if (body.sessionType === "group_session") {
      const { error } = await supabase
        .from("group_sessions")
        .update(updateData)
        .eq("id", body.sessionId);
      updateError = error;
    }

    if (updateError) {
      console.error("Failed to update session:", updateError);

      // Cancel the Cal.com booking to prevent orphaned bookings
      console.log("Cancelling orphaned Cal.com booking:", booking.uid);
      const cancelResult = await cancelCalcomBooking(
        booking.uid,
        "Session update failed — booking auto-cancelled to prevent orphan",
      );
      if (!cancelResult.success) {
        console.error("Failed to cancel orphaned booking:", cancelResult.error);
      }

      return new Response(
        JSON.stringify({
          error: "Booking created but failed to update session. Cal.com booking has been cancelled.",
          booking_uid: booking.uid,
          booking_cancelled: cancelResult.success,
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    console.log("Session updated successfully");

    // Send notifications to participants
    const notificationTimezone = attendees[0]?.timeZone || body.timezone || "UTC";
    
    if (body.sessionType === "module_session") {
      await notifyModuleSessionParticipants(
        supabase,
        body.sessionId,
        booking.startTime,
        booking.endTime,
        notificationTimezone,
        meetingLink || ""
      );
    } else if (body.sessionType === "group_session") {
      await notifyGroupSessionParticipants(
        supabase,
        body.sessionId,
        booking.startTime,
        booking.endTime,
        notificationTimezone,
        meetingLink || ""
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_uid: booking.uid,
        booking_id: booking.id,
        meeting_url: meetingLink,
        start_time: booking.startTime,
        end_time: booking.endTime,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating Cal.com booking:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Notify module session participants with session details and send email
 */
async function notifyModuleSessionParticipants(
  supabase: SupabaseClient,
  sessionId: string,
  startTime: string,
  endTime: string,
  timezone: string,
  meetingLink: string
) {
  try {
    // Get session details with module info and instructor
    const { data: session } = await supabase
      .from("module_sessions")
      .select(`
        id, title, description, module_id, instructor_id,
        program_modules!inner(title, programs!inner(title, id))
      `)
      .eq("id", sessionId)
      .single();

    if (!session) {
      console.log("Session not found for notification:", sessionId);
      return;
    }

    // Get participants with their profile info
    const { data: participants } = await supabase
      .from("module_session_participants")
      .select("user_id, profiles!inner(email, name)")
      .eq("session_id", sessionId);

    if (!participants || participants.length === 0) {
      console.log("No participants to notify for session:", sessionId);
      return;
    }

    const sessionData = session as unknown as {
      id: string;
      title: string;
      description: string | null;
      module_id: string;
      instructor_id: string | null;
      program_modules: { title: string; programs: { title: string; id: string } };
    };

    // Get instructor name if available
    let instructorName = "TBD";
    if (sessionData.instructor_id) {
      const { data: instructorProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", sessionData.instructor_id)
        .single();
      if (instructorProfile?.name) {
        instructorName = instructorProfile.name;
      }
    }

    const moduleName = sessionData.program_modules?.title || "Module";
    const programName = sessionData.program_modules?.programs?.title || "Program";
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    const baseEntityLink = `${siteUrl}/client/module/${sessionData.module_id}`;

    console.log(`Sending notifications to ${participants.length} participants`);

    // Get notification type ID for session_scheduled
    const { data: notificationType } = await supabase
      .from("notification_types")
      .select("id")
      .eq("key", "session_scheduled")
      .single();

    for (const participant of participants) {
      const p = participant as unknown as { user_id: string; profiles: { email: string; name: string } };
      
      // Build entity link with SSO params for this specific user
      const entityLink = `${baseEntityLink}?expected_user=${p.user_id}&login_hint=${encodeURIComponent(p.profiles.email || '')}`;
      
      // Create in-app notification with proper notification_type_id
      if (notificationType?.id) {
        await supabase.from("notifications").insert({
          user_id: p.user_id,
          notification_type_id: notificationType.id,
          title: "Session Scheduled",
          message: `Your session "${sessionData.title}" has been scheduled for ${new Date(startTime).toLocaleString()}`,
          metadata: {
            session_id: sessionId,
            session_type: "module_session",
            start_time: startTime,
            end_time: endTime,
            meeting_link: meetingLink,
            module_name: moduleName,
            program_name: programName,
          },
          link: entityLink,
        });
      }

      // Send email notification with proper session date
      try {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            email: p.profiles.email,
            userId: p.user_id,
            name: p.profiles.name || "there",
            type: "session_scheduled",
            timestamp: new Date().toISOString(),
            programName: programName,
            moduleName: moduleName,
            sessionTitle: sessionData.title,
            sessionDate: startTime,
            scheduledDate: startTime,
            meetingUrl: meetingLink,
            instructorName: instructorName,
            entityLink: entityLink,
          },
        });
        console.log(`Email sent to ${p.profiles.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${p.profiles.email}:`, emailError);
      }
    }

    console.log("Notifications sent successfully");
  } catch (error) {
    console.error("Error notifying participants:", error);
  }
}

/**
 * Notify group session participants with session details and send email
 */
async function notifyGroupSessionParticipants(
  supabase: SupabaseClient,
  sessionId: string,
  startTime: string,
  endTime: string,
  timezone: string,
  meetingLink: string
) {
  try {
    // Get session details with group info
    const { data: session } = await supabase
      .from("group_sessions")
      .select("id, title, description, group_id, groups!inner(name, id)")
      .eq("id", sessionId)
      .single();

    if (!session) {
      console.log("Group session not found for notification:", sessionId);
      return;
    }

    // Get participants with their profile info
    const { data: participants } = await supabase
      .from("group_session_participants")
      .select("user_id, profiles!inner(email, name)")
      .eq("session_id", sessionId);

    if (!participants || participants.length === 0) {
      console.log("No participants to notify for group session:", sessionId);
      return;
    }

    const sessionData = session as unknown as {
      id: string;
      title: string;
      description: string | null;
      group_id: string;
      groups: { name: string; id: string };
    };

    const groupName = sessionData.groups?.name || "Group";
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    const baseEntityLink = `${siteUrl}/groups/${sessionData.groups?.id || sessionData.group_id}`;

    console.log(`Sending notifications to ${participants.length} group session participants`);

    // Get notification type ID for group_session_scheduled
    const { data: notificationType } = await supabase
      .from("notification_types")
      .select("id")
      .eq("key", "group_session_scheduled")
      .single();

    for (const participant of participants) {
      const p = participant as unknown as { user_id: string; profiles: { email: string; name: string } };
      
      // Build entity link with SSO params for this specific user
      const entityLink = `${baseEntityLink}?expected_user=${p.user_id}&login_hint=${encodeURIComponent(p.profiles.email || '')}`;
      
      // Create in-app notification with proper notification_type_id
      if (notificationType?.id) {
        await supabase.from("notifications").insert({
          user_id: p.user_id,
          notification_type_id: notificationType.id,
          title: "Group Session Scheduled",
          message: `Your group session "${sessionData.title}" has been scheduled for ${new Date(startTime).toLocaleString()}`,
          metadata: {
            session_id: sessionId,
            session_type: "group_session",
            group_id: sessionData.group_id,
            group_name: groupName,
            start_time: startTime,
            end_time: endTime,
            meeting_link: meetingLink,
          },
          link: entityLink,
        });
      }

      // Send email notification with proper session date
      try {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            email: p.profiles.email,
            userId: p.user_id,
            name: p.profiles.name || "there",
            type: "session_scheduled",
            timestamp: new Date().toISOString(),
            groupName: groupName,
            sessionTitle: sessionData.title,
            sessionDate: startTime,
            scheduledDate: startTime,
            meetingUrl: meetingLink,
            entityLink: entityLink,
          },
        });
        console.log(`Email sent to ${p.profiles.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${p.profiles.email}:`, emailError);
      }
    }

    console.log("Group session notifications sent successfully");
  } catch (error) {
    console.error("Error notifying group session participants:", error);
  }
}
