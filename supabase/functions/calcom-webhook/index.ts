import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cal-signature-256",
};

interface CalcomBookingPayload {
  triggerEvent: string;
  createdAt: string;
  payload: {
    uid: string;
    bookingId?: number;
    eventTypeId?: number;
    eventTypeSlug?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    location?: string;
    meetingUrl?: string;
    rescheduleUid?: string;
    organizer?: {
      id?: number;
      email?: string;
      name?: string;
      timeZone?: string;
    };
    attendees?: Array<{
      email?: string;
      name?: string;
      timeZone?: string;
    }>;
    responses?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
}

interface BookingMetadata {
  enrollment_id?: string;
  module_id?: string;
  user_id?: string;
  session_type?: 'individual' | 'group';
  group_id?: string;
  pending_session_id?: string; // Pre-created session ID for hybrid flow
}

interface CalcomMapping {
  id: string;
  calcom_event_type_id: number;
  calcom_event_type_slug: string | null;
  calcom_event_type_name: string | null;
  session_target: string;
  default_program_id: string | null;
  default_group_id: string | null;
  default_module_id: string | null;
  module_type: string | null;
  scheduling_url: string | null;
  is_active: boolean;
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    console.log("Missing signature or secret");
    return false;
  }
  
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  
  const isValid = signature === expectedSignature;
  console.log(`Signature verification: ${isValid ? "PASSED" : "FAILED"}`);
  return isValid;
}

function extractMetadataFromBooking(payload: CalcomBookingPayload["payload"]): BookingMetadata {
  const metadata: BookingMetadata = {};
  
  // Check metadata field first (preferred)
  if (payload.metadata) {
    if (payload.metadata.enrollment_id) metadata.enrollment_id = String(payload.metadata.enrollment_id);
    if (payload.metadata.module_id) metadata.module_id = String(payload.metadata.module_id);
    if (payload.metadata.user_id) metadata.user_id = String(payload.metadata.user_id);
    if (payload.metadata.session_type) metadata.session_type = payload.metadata.session_type as 'individual' | 'group';
    if (payload.metadata.group_id) metadata.group_id = String(payload.metadata.group_id);
    if (payload.metadata.pending_session_id) metadata.pending_session_id = String(payload.metadata.pending_session_id);
  }
  
  // Also check responses for custom question fields
  if (payload.responses) {
    const responses = payload.responses as Record<string, unknown>;
    if (responses.enrollment_id) metadata.enrollment_id = String(responses.enrollment_id);
    if (responses.module_id) metadata.module_id = String(responses.module_id);
    if (responses.user_id) metadata.user_id = String(responses.user_id);
    if (responses.session_type) metadata.session_type = responses.session_type as 'individual' | 'group';
    if (responses.group_id) metadata.group_id = String(responses.group_id);
    if (responses.pending_session_id) metadata.pending_session_id = String(responses.pending_session_id);
  }
  
  return metadata;
}

/**
 * Look up metadata from a previous BOOKING_REQUESTED event for the same booking UID.
 * Cal.com doesn't persist URL metadata when the host confirms, so we retrieve it from the log.
 * 
 * SAFETY: We filter directly by booking_uid using JSONB query to ensure exact match.
 * No risk of mixing up sessions between clients.
 */
async function retrieveMetadataFromPreviousRequest(
  supabase: SupabaseClient,
  bookingUid: string
): Promise<BookingMetadata> {
  // Query directly by booking UID using JSONB filter for exact match
  // This ensures we only get the specific booking's metadata
  const { data: previousLog, error } = await supabase
    .from("calcom_webhook_logs")
    .select("payload")
    .eq("event_type", "BOOKING_REQUESTED")
    .filter("payload->payload->>uid", "eq", bookingUid)
    .order("created_at", { ascending: false })
    .limit(1);
  
  if (error) {
    console.error("Error querying previous BOOKING_REQUESTED:", error);
    return {};
  }
  
  if (!previousLog || previousLog.length === 0) {
    console.log("No previous BOOKING_REQUESTED found for UID:", bookingUid);
    return {};
  }
  
  const logPayload = previousLog[0].payload as CalcomBookingPayload;
  if (logPayload?.payload?.metadata) {
    console.log("Found previous BOOKING_REQUESTED with metadata for UID:", bookingUid);
    return extractMetadataFromBooking(logPayload.payload);
  }
  
  return {};
}

async function findEnrollmentByEmail(
  supabase: SupabaseClient,
  email: string,
  programId: string | null
): Promise<string | null> {
  // Find user by email
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  
  if (!profile) {
    console.log(`No profile found for email: ${email}`);
    return null;
  }
  
  // Find active enrollment
  let query = supabase
    .from("client_enrollments")
    .select("id")
    .eq("client_user_id", profile.id)
    .in("status", ["active", "in_progress"]);
  
  if (programId) {
    query = query.eq("program_id", programId);
  }
  
  const { data: enrollment } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  
  return enrollment?.id || null;
}

async function addGroupSessionParticipants(
  supabase: SupabaseClient,
  sessionId: string,
  groupId: string,
  bookerId?: string
) {
  // Get all members of the group
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  
  if (membersError) {
    console.error("Error fetching group members:", membersError);
    return;
  }
  
  if (!members || members.length === 0) {
    console.log("No group members found for group:", groupId);
    return;
  }
  
  // Create participant records
  const participants = (members as { user_id: string }[]).map((m) => ({
    session_id: sessionId,
    user_id: m.user_id,
    response_status: m.user_id === bookerId ? "accepted" : "pending",
  }));
  
  // Insert participants
  const { error: insertError } = await supabase
    .from("module_session_participants")
    .upsert(participants, { onConflict: "session_id,user_id" });
  
  if (insertError) {
    console.error("Error adding group session participants:", insertError);
  } else {
    console.log(`Added ${participants.length} participants to session`);
  }
}

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
    
    console.log(`Sending notifications to ${participants.length} participants for session:`, sessionId);
    
    // Get notification type ID for session_scheduled
    const { data: notificationType } = await supabase
      .from("notification_types")
      .select("id")
      .eq("key", "session_scheduled")
      .single();
    
    // Send notification and email to each participant
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
            sessionDate: startTime, // Actual scheduled date/time
            scheduledDate: startTime, // Also set scheduledDate for template
            meetingUrl: meetingLink,
            instructorName: instructorName,
            entityLink: entityLink,
            // Do NOT pass schedulingUrl - the session is already scheduled
          },
        });
        console.log(`Email sent to ${p.profiles.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${p.profiles.email}:`, emailError);
      }
    }
    
    console.log("Notifications sent successfully");
  } catch (error) {
    console.error("Error notifying module session participants:", error);
  }
}

/**
 * Notify group session participants with session details and send email
 */
async function notifyGroupSessionParticipants(
  supabase: SupabaseClient,
  sessionId: string,
  groupId: string,
  startTime: string,
  endTime: string,
  timezone: string,
  meetingLink: string
) {
  try {
    // Get session details with group info
    const { data: session } = await supabase
      .from("group_sessions")
      .select("id, title, description, groups!inner(name, id)")
      .eq("id", sessionId)
      .single();
    
    if (!session) {
      console.log("Group session not found for notification:", sessionId);
      return;
    }
    
    // Get all group members with their profile info
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id, profiles!inner(email, name)")
      .eq("group_id", groupId);
    
    if (!members || members.length === 0) {
      console.log("No group members to notify for session:", sessionId);
      return;
    }
    
    const sessionData = session as unknown as {
      id: string;
      title: string;
      description: string | null;
      groups: { name: string; id: string };
    };
    
    const groupName = sessionData.groups?.name || "Group";
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    const baseEntityLink = `${siteUrl}/groups/${sessionData.groups?.id || groupId}`;
    
    console.log(`Sending notifications to ${members.length} group members for session:`, sessionId);
    
    // Get notification type ID for session_scheduled
    const { data: notificationType } = await supabase
      .from("notification_types")
      .select("id")
      .eq("key", "group_session_scheduled")
      .single();
    
    // Send notification and email to each member
    for (const member of members) {
      const m = member as unknown as { user_id: string; profiles: { email: string; name: string } };
      
      // Build entity link with SSO params for this specific user
      const entityLink = `${baseEntityLink}?expected_user=${m.user_id}&login_hint=${encodeURIComponent(m.profiles.email || '')}`;
      
      // Create in-app notification with proper notification_type_id
      if (notificationType?.id) {
        await supabase.from("notifications").insert({
          user_id: m.user_id,
          notification_type_id: notificationType.id,
          title: "Group Session Scheduled",
          message: `A session "${sessionData.title}" has been scheduled for ${new Date(startTime).toLocaleString()}`,
          metadata: {
            session_id: sessionId,
            session_type: "group_session",
            group_id: groupId,
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
            email: m.profiles.email,
            userId: m.user_id,
            name: m.profiles.name || "there",
            type: "session_scheduled",
            timestamp: new Date().toISOString(),
            groupName: groupName,
            sessionTitle: sessionData.title,
            sessionDate: startTime, // Actual scheduled date/time
            scheduledDate: startTime, // Also set scheduledDate for template
            meetingUrl: meetingLink,
            entityLink: entityLink,
            // Do NOT pass schedulingUrl - the session is already scheduled
          },
        });
        console.log(`Email sent to ${m.profiles.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${m.profiles.email}:`, emailError);
      }
    }
    
    console.log("Group session notifications sent successfully");
  } catch (error) {
    console.error("Error notifying group session participants:", error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookSecret = Deno.env.get("CALCOM_WEBHOOK_SECRET");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-cal-signature-256") || "";
    
    console.log("=== Cal.com Webhook Received ===");
    console.log("Signature header:", signature ? "present" : "missing");

    // Verify webhook signature
    if (webhookSecret && !verifySignature(rawBody, signature, webhookSecret)) {
      console.error("Invalid webhook signature");
      
      await supabase.from("calcom_webhook_logs").insert({
        event_type: "SIGNATURE_VERIFICATION_FAILED",
        payload: { signature_present: !!signature },
        processed: false,
        error_message: "Invalid webhook signature",
      });
      
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: CalcomBookingPayload = JSON.parse(rawBody);
    const { triggerEvent, payload } = data;
    
    console.log("Event type:", triggerEvent);
    console.log("Booking UID:", payload.uid);
    console.log("Event Type ID:", payload.eventTypeId);

    // Extract metadata from booking payload
    let bookingMetadata = extractMetadataFromBooking(payload);
    
    // If metadata is empty (common for BOOKING_CREATED after host confirms),
    // try to retrieve it from the previous BOOKING_REQUESTED event
    if (Object.keys(bookingMetadata).length === 0 && payload.uid) {
      console.log("No metadata in payload, checking previous BOOKING_REQUESTED...");
      bookingMetadata = await retrieveMetadataFromPreviousRequest(supabase, payload.uid);
    }
    
    console.log("Booking metadata:", JSON.stringify(bookingMetadata));

    // Log the webhook event
    const { data: logEntry, error: logError } = await supabase
      .from("calcom_webhook_logs")
      .insert({
        event_type: triggerEvent,
        payload: data,
        processed: false,
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to log webhook:", logError);
    } else {
      console.log("Webhook logged with ID:", logEntry?.id);
    }

    // Find matching event type mapping
    let mapping: CalcomMapping | null = null;
    
    if (payload.eventTypeId) {
      // First, try direct lookup in event_type_mappings (for parent event IDs)
      const { data: mappingData } = await supabase
        .from("calcom_event_type_mappings")
        .select("*")
        .eq("calcom_event_type_id", payload.eventTypeId)
        .eq("is_active", true)
        .maybeSingle();
      
      mapping = mappingData as CalcomMapping | null;
      
      // If no direct mapping found, check if this is a child event ID
      // and look up its module_type to find a matching mapping
      if (!mapping) {
        const { data: instructorMapping } = await supabase
          .from("instructor_calcom_event_types")
          .select("module_type")
          .eq("child_event_type_id", payload.eventTypeId)
          .maybeSingle();
        
        if (instructorMapping?.module_type) {
          console.log("Found instructor mapping for child ID, module_type:", instructorMapping.module_type);
          // Find a mapping that handles this module type
          const { data: typeMapping } = await supabase
            .from("calcom_event_type_mappings")
            .select("*")
            .eq("module_type", instructorMapping.module_type)
            .eq("is_active", true)
            .maybeSingle();
          
          mapping = typeMapping as CalcomMapping | null;
        }
      }
    }

    if (!mapping && payload.eventTypeSlug) {
      const { data: mappingData } = await supabase
        .from("calcom_event_type_mappings")
        .select("*")
        .eq("calcom_event_type_slug", payload.eventTypeSlug)
        .eq("is_active", true)
        .maybeSingle();
      
      mapping = mappingData as CalcomMapping | null;
    }

    console.log("Found mapping:", mapping ? mapping.session_target : "none");

    // Resolve enrollment from metadata or attendee email
    let resolvedEnrollmentId = bookingMetadata.enrollment_id || null;
    let resolvedUserId = bookingMetadata.user_id || null;
    
    if (!resolvedEnrollmentId && payload.attendees?.[0]?.email) {
      const attendeeEmail = payload.attendees[0].email;
      console.log("Attempting to resolve enrollment from attendee email:", attendeeEmail);
      resolvedEnrollmentId = await findEnrollmentByEmail(
        supabase,
        attendeeEmail,
        mapping?.default_program_id || null
      );
      
      if (resolvedEnrollmentId) {
        const { data: enrollment } = await supabase
          .from("client_enrollments")
          .select("client_user_id")
          .eq("id", resolvedEnrollmentId)
          .single();
        resolvedUserId = (enrollment as { client_user_id: string } | null)?.client_user_id || null;
      }
    }
    
    console.log("Resolved enrollment_id:", resolvedEnrollmentId);
    console.log("Resolved user_id:", resolvedUserId);

    // Resolve instructor/staff ID from organizer email
    // This works for both instructors and coaches - anyone who can host Cal.com bookings
    let resolvedInstructorId: string | null = null;
    if (payload.organizer?.email) {
      const { data: staffProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", payload.organizer.email)
        .maybeSingle();
      
      if (staffProfile?.id) {
        resolvedInstructorId = staffProfile.id;
        console.log("Resolved instructor/staff ID from organizer:", resolvedInstructorId);
      } else {
        console.log("No profile found for organizer email:", payload.organizer.email);
      }
    }

    // Process booking events
    let processed = false;
    let errorMessage: string | null = null;
    let createdSessionId: string | null = null;

    if (["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"].includes(triggerEvent)) {
      try {
        if (mapping) {
          const sessionData = {
            calcom_booking_id: payload.bookingId?.toString(),
            calcom_booking_uid: payload.uid,
            calcom_event_type_id: payload.eventTypeId,
            calcom_event_type_slug: payload.eventTypeSlug,
            calcom_reschedule_uid: payload.rescheduleUid,
            booking_source: "calcom",
            enrollment_id: resolvedEnrollmentId,
            instructor_id: resolvedInstructorId, // Set instructor (works for both instructors and coaches)
          };

          if (triggerEvent === "BOOKING_CREATED") {
            // HYBRID FLOW: Check for pending_session_id first (pre-created session)
            if (bookingMetadata.pending_session_id) {
              console.log("Hybrid flow: updating pending session:", bookingMetadata.pending_session_id);
              
              // Calculate duration from start/end times
              const startDate = payload.startTime ? new Date(payload.startTime) : null;
              const endDate = payload.endTime ? new Date(payload.endTime) : null;
              const durationMinutes = startDate && endDate 
                ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
                : null;
              
              const updateData = {
                session_date: payload.startTime,
                duration_minutes: durationMinutes,
                timezone: payload.organizer?.timeZone || "UTC",
                meeting_url: payload.meetingUrl || payload.location,
                status: "scheduled",
                client_response: "accepted", // Auto-accept all Cal.com bookings
                calcom_booking_id: payload.bookingId?.toString(),
                calcom_booking_uid: payload.uid,
                calcom_event_type_id: payload.eventTypeId,
                calcom_event_type_slug: payload.eventTypeSlug,
                booking_source: "calcom",
                instructor_id: resolvedInstructorId, // Set instructor (works for both instructors and coaches)
              };
              
              // Try to update module_sessions first
              const { data: updatedModuleSession, error: moduleUpdateError } = await supabase
                .from("module_sessions")
                .update(updateData)
                .eq("id", bookingMetadata.pending_session_id)
                .select("id, module_id, session_type")
                .maybeSingle();
              
              if (updatedModuleSession) {
                createdSessionId = (updatedModuleSession as { id: string }).id;
                console.log("Updated pending module_session:", createdSessionId);
                processed = true;
                
                // Send notifications to all participants
                await notifyModuleSessionParticipants(
                  supabase,
                  createdSessionId,
                  payload.startTime || "",
                  payload.endTime || "",
                  payload.organizer?.timeZone || "UTC",
                  payload.meetingUrl || payload.location || ""
                );
              } else {
                // Try group_sessions as fallback
                const { data: updatedGroupSession, error: groupUpdateError } = await supabase
                  .from("group_sessions")
                  .update(updateData)
                  .eq("id", bookingMetadata.pending_session_id)
                  .select("id, group_id")
                  .maybeSingle();
                
                if (updatedGroupSession) {
                  createdSessionId = (updatedGroupSession as { id: string }).id;
                  console.log("Updated pending group_session:", createdSessionId);
                  processed = true;
                  
                  // Send notifications to all group participants
                  await notifyGroupSessionParticipants(
                    supabase,
                    createdSessionId,
                    (updatedGroupSession as { group_id: string }).group_id,
                    payload.startTime || "",
                    payload.endTime || "",
                    payload.organizer?.timeZone || "UTC",
                    payload.meetingUrl || payload.location || ""
                  );
                } else {
                  console.error("Could not find pending session to update:", bookingMetadata.pending_session_id);
                  errorMessage = "Pending session not found";
                }
              }
            }
            // STANDARD FLOW: Create new session
            else if (mapping.session_target === "module_session" && (mapping.default_module_id || bookingMetadata.module_id)) {
              const moduleId = bookingMetadata.module_id || mapping.default_module_id;
              const isIndividual = (bookingMetadata.session_type || "individual") === "individual";
              
              // Calculate duration from start/end times
              const startDate = payload.startTime ? new Date(payload.startTime) : null;
              const endDate = payload.endTime ? new Date(payload.endTime) : null;
              const durationMinutes = startDate && endDate 
                ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
                : null;

              // IMPORTANT: For individual module sessions, we enforce a single active session per
              // (module_id, enrollment_id). If a booking comes in for an enrollment that already
              // has a session, we must update that existing session instead of inserting a new row.
              // This prevents unique constraint errors (module_sessions_unique_individual) and
              // makes "rebook" overwrite the original session timing.
              if (isIndividual && resolvedEnrollmentId) {
                const { data: existingSession, error: existingError } = await supabase
                  .from("module_sessions")
                  .select("id")
                  .eq("module_id", moduleId)
                  .eq("enrollment_id", resolvedEnrollmentId)
                  .neq("status", "cancelled")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (existingError) throw existingError;

                if (existingSession?.id) {
                  const { data: updatedExisting, error: updateExistingError } = await supabase
                    .from("module_sessions")
                    .update({
                      module_id: moduleId,
                      title: payload.title || "Cal.com Booking",
                      description: payload.description,
                      session_date: payload.startTime,
                      duration_minutes: durationMinutes,
                      timezone: payload.organizer?.timeZone || "UTC",
                      meeting_url: payload.meetingUrl || payload.location,
                      session_type: "individual",
                      status: "scheduled",
                      client_response: "accepted", // Auto-accept all Cal.com bookings
                      ...sessionData,
                    })
                    .eq("id", existingSession.id)
                    .select("id")
                    .single();

                  if (updateExistingError) throw updateExistingError;

                  createdSessionId = (updatedExisting as { id: string } | null)?.id || null;
                  console.log("Updated existing individual module_session:", createdSessionId);
                  processed = true;
                }
              }

              // If no existing session was found/updated, fall back to inserting a new record
              // (used for group sessions or rare edge cases).
              if (processed) {
                // nothing else to do
              }
              else {
              
              const { data: newSession, error: insertError } = await supabase
                .from("module_sessions")
                .insert({
                  module_id: moduleId,
                  title: payload.title || "Cal.com Booking",
                  description: payload.description,
                  session_date: payload.startTime,
                  duration_minutes: durationMinutes,
                  timezone: payload.organizer?.timeZone || "UTC",
                  meeting_url: payload.meetingUrl || payload.location,
                  session_type: bookingMetadata.session_type || "individual",
                  status: "scheduled",
                  client_response: "accepted", // Auto-accept all Cal.com bookings
                  ...sessionData,
                })
                .select("id")
                .single();

              if (insertError) throw insertError;
              
              createdSessionId = (newSession as { id: string } | null)?.id || null;
              console.log("Created module_session:", createdSessionId);
              processed = true;
              
              // For group sessions, auto-add participants
              if (bookingMetadata.session_type === "group" && bookingMetadata.group_id && createdSessionId) {
                await addGroupSessionParticipants(
                  supabase,
                  createdSessionId,
                  bookingMetadata.group_id,
                  resolvedUserId || undefined
                );
              }
              }
            } else if (mapping.session_target === "group_session" && (mapping.default_group_id || bookingMetadata.group_id)) {
              const groupId = bookingMetadata.group_id || mapping.default_group_id;
              
              const { data: newSession, error: insertError } = await supabase
                .from("group_sessions")
                .insert({
                  group_id: groupId,
                  title: payload.title || "Cal.com Booking",
                  description: payload.description,
                  session_date: payload.startTime ? new Date(payload.startTime).toISOString().split("T")[0] : null,
                  start_time: payload.startTime,
                  end_time: payload.endTime,
                  timezone: payload.organizer?.timeZone || "UTC",
                  meeting_link: payload.meetingUrl || payload.location,
                  ...sessionData,
                })
                .select("id")
                .single();

              if (insertError) throw insertError;
              
              createdSessionId = (newSession as { id: string } | null)?.id || null;
              console.log("Created group_session:", createdSessionId);
              processed = true;
              
              // Auto-add all group members as participants
              if (groupId && createdSessionId) {
                const { data: members } = await supabase
                  .from("group_members")
                  .select("user_id")
                  .eq("group_id", groupId);
                
                if (members && members.length > 0) {
                  const participants = (members as { user_id: string }[]).map((m) => ({
                    session_id: createdSessionId,
                    group_id: groupId,
                    user_id: m.user_id,
                    response_status: m.user_id === resolvedUserId ? 'accepted' : 'pending',
                    responded_at: m.user_id === resolvedUserId ? new Date().toISOString() : null,
                  }));
                  
                  await supabase
                    .from("group_session_participants")
                    .upsert(participants, { onConflict: "session_id,user_id", ignoreDuplicates: true });
                  
                  console.log(`Added ${members.length} group members as participants`);
                }
              }
            }
          } else if (triggerEvent === "BOOKING_RESCHEDULED") {
            // Calculate new duration from start/end times
            const startDate = payload.startTime ? new Date(payload.startTime) : null;
            const endDate = payload.endTime ? new Date(payload.endTime) : null;
            const newDuration = startDate && endDate 
              ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
              : undefined;

            // IMPORTANT: When a booking is rescheduled, Cal.com sends a NEW booking UID
            // The rescheduleUid field contains the ORIGINAL booking's UID
            // We need to find the session using the original UID (rescheduleUid) and update
            // it with the new UID and timing data
            const originalBookingUid = payload.rescheduleUid || payload.uid;
            console.log("Reschedule: looking for original UID:", originalBookingUid, "new UID:", payload.uid);

            if (mapping.session_target === "module_session") {
              const moduleUpdateData = {
                session_date: payload.startTime,
                duration_minutes: newDuration,
                timezone: payload.organizer?.timeZone || undefined,
                meeting_url: payload.meetingUrl || payload.location,
                calcom_booking_uid: payload.uid, // Update to new UID
                calcom_reschedule_uid: payload.rescheduleUid,
                status: "scheduled", // Ensure status is scheduled (not rescheduled which might hide it)
              };
              
              // Try to find by original UID first (rescheduleUid), then by new UID as fallback
              let updateResult = await supabase
                .from("module_sessions")
                .update(moduleUpdateData)
                .eq("calcom_booking_uid", originalBookingUid)
                .select("id");

              if (!updateResult.data || updateResult.data.length === 0) {
                // Fallback: try matching by booking ID if available
                if (payload.bookingId) {
                  updateResult = await supabase
                    .from("module_sessions")
                    .update(moduleUpdateData)
                    .eq("calcom_booking_id", payload.bookingId.toString())
                    .select("id");
                }
              }

              if (updateResult.error) throw updateResult.error;
              
              if (updateResult.data && updateResult.data.length > 0) {
                console.log("Updated module_session from reschedule, session ID:", updateResult.data[0].id);
                processed = true;
              } else {
                console.log("No module_session found to update for reschedule");
                errorMessage = "No session found for reschedule";
              }
            } else if (mapping.session_target === "group_session") {
              const groupUpdateData = {
                session_date: payload.startTime,
                start_time: payload.startTime,
                end_time: payload.endTime,
                timezone: payload.organizer?.timeZone || undefined,
                meeting_link: payload.meetingUrl || payload.location,
                calcom_booking_uid: payload.uid, // Update to new UID
                calcom_reschedule_uid: payload.rescheduleUid,
              };
              
              // Try to find by original UID first (rescheduleUid), then by new UID as fallback
              let updateResult = await supabase
                .from("group_sessions")
                .update(groupUpdateData)
                .eq("calcom_booking_uid", originalBookingUid)
                .select("id");

              if (!updateResult.data || updateResult.data.length === 0) {
                // Fallback: try matching by booking ID if available
                if (payload.bookingId) {
                  updateResult = await supabase
                    .from("group_sessions")
                    .update(groupUpdateData)
                    .eq("calcom_booking_id", payload.bookingId.toString())
                    .select("id");
                }
              }

              if (updateResult.error) throw updateResult.error;
              
              if (updateResult.data && updateResult.data.length > 0) {
                console.log("Updated group_session from reschedule, session ID:", updateResult.data[0].id);
                processed = true;
              } else {
                console.log("No group_session found to update for reschedule");
                errorMessage = "No session found for reschedule";
              }
            }
          }
        } else {
          console.log("No mapping found for event type, booking logged but not synced to session");
          processed = true;
        }
      } catch (processError) {
        console.error("Error processing booking:", processError);
        errorMessage = processError instanceof Error ? processError.message : "Unknown error";
        
        // Notify the user about the failed session creation
        if (resolvedUserId && triggerEvent === "BOOKING_CREATED") {
          try {
            await supabase.from("notifications").insert({
              user_id: resolvedUserId,
              type: "session_error",
              title: "Session Booking Failed",
              message: `Your Cal.com booking "${payload.title || 'Session'}" was received but could not be synced. Please contact support or try booking again.`,
              data: {
                booking_uid: payload.uid,
                booking_id: payload.bookingId,
                error: errorMessage,
                event_type_id: payload.eventTypeId,
              },
            });
            console.log("Error notification sent to user:", resolvedUserId);
          } catch (notifyError) {
            console.error("Failed to send error notification:", notifyError);
          }
        }
      }
    } else {
      console.log(`Event ${triggerEvent} logged but not processed (informational only)`);
      processed = true;
    }

    // Update log entry with processing result
    if (logEntry?.id) {
      await supabase
        .from("calcom_webhook_logs")
        .update({ 
          processed, 
          error_message: errorMessage 
        })
        .eq("id", logEntry.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        event: triggerEvent,
        booking_uid: payload.uid,
        session_id: createdSessionId,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Webhook handler error:", error);
    
    try {
      await supabase.from("calcom_webhook_logs").insert({
        event_type: "ERROR",
        payload: { error: error instanceof Error ? error.message : "Unknown error" },
        processed: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (logErr) {
      console.error("Failed to log error:", logErr);
    }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
