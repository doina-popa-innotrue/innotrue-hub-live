import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

// getCorsHeaders(req) from _shared/cors.ts handles origin + standard headers

interface CreateEventRequest {
  summary: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  timezone?: string;
  attendeeEmails?: string[];
  memberUserIds?: string[]; // Alternative: fetch emails server-side from auth.users
  sessionId?: string; // Optional: update group_sessions with meeting link
  calendarId?: string; // Optional: defaults to primary
  // Recurrence support
  recurrencePattern?: string; // 'daily' | 'weekly' | 'biweekly' | 'monthly'
  recurrenceEndDate?: string; // ISO date string
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface GoogleCalendarEvent {
  id: string;
  htmlLink: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
    conferenceId?: string;
    conferenceSolution?: {
      name: string;
      iconUri: string;
    };
  };
}

/**
 * Get access token from Google Service Account using JWT assertion
 * Uses Domain-Wide Delegation to impersonate a Workspace user for Meet link creation
 */
async function getServiceAccountAccessToken(serviceAccountJson: string, impersonateEmail?: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour
  
  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  
  // Create JWT claims - add 'sub' for Domain-Wide Delegation impersonation
  const claims: Record<string, unknown> = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
  };
  
  // Add subject claim for DWD impersonation (required for Meet link creation)
  if (impersonateEmail) {
    claims.sub = impersonateEmail;
    console.log(`Using Domain-Wide Delegation to impersonate: ${impersonateEmail}`);
  }
  
  // Base64url encode header and claims
  const encoder = new TextEncoder();
  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const claimsB64 = base64urlEncode(encoder.encode(JSON.stringify(claims)));
  const signatureInput = `${headerB64}.${claimsB64}`;
  
  // Sign with private key
  const privateKeyPem = serviceAccount.private_key;
  const signature = await signWithRSA(signatureInput, privateKeyPem);
  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  
  const jwt = `${signatureInput}.${signatureB64}`;
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Token exchange failed:', error);
    throw new Error(`Failed to get access token: ${error}`);
  }
  
  const tokenData: GoogleTokenResponse = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Base64url encode without padding
 */
function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign data with RSA-SHA256 using the private key
 */
async function signWithRSA(data: string, privateKeyPem: string): Promise<ArrayBuffer> {
  // Remove PEM headers and decode
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  // Import the private key
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  // Sign the data
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(data)
  );
  
  return signature;
}

/**
 * Convert app recurrence pattern to Google Calendar RRULE
 */
function buildRecurrenceRule(pattern: string, endDate?: string): string[] {
  let freq = '';
  let interval = 1;
  
  switch (pattern) {
    case 'daily':
      freq = 'DAILY';
      break;
    case 'weekly':
      freq = 'WEEKLY';
      break;
    case 'biweekly':
      freq = 'WEEKLY';
      interval = 2;
      break;
    case 'monthly':
      freq = 'MONTHLY';
      break;
    default:
      return []; // No recurrence
  }
  
  let rrule = `RRULE:FREQ=${freq}`;
  if (interval > 1) {
    rrule += `;INTERVAL=${interval}`;
  }
  
  // Add end date if provided (format: YYYYMMDD)
  if (endDate) {
    const untilDate = new Date(endDate);
    const until = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    rrule += `;UNTIL=${until}`;
  }
  
  console.log(`Built recurrence rule: ${rrule}`);
  return [rrule];
}

/**
 * Create a Google Calendar event, optionally with Google Meet and recurrence
 * Note: Meet link creation only works with Google Workspace accounts
 */
async function createCalendarEvent(
  accessToken: string,
  request: CreateEventRequest
): Promise<GoogleCalendarEvent> {
  const calendarId = request.calendarId || 'primary';
  
  // Base event body without conference data
  const eventBody: Record<string, unknown> = {
    summary: request.summary,
    description: request.description || '',
    start: {
      dateTime: request.startTime,
      timeZone: request.timezone || 'UTC',
    },
    end: {
      dateTime: request.endTime,
      timeZone: request.timezone || 'UTC',
    },
  };

  // Add attendees so the event appears on participants' calendars.
  // Note: This is critical when the organizer is an impersonated Workspace user.
  if (request.attendeeEmails && request.attendeeEmails.length > 0) {
    eventBody.attendees = request.attendeeEmails.map((email) => ({ email }));
  }
  
  // Add recurrence if pattern provided
  if (request.recurrencePattern) {
    const recurrence = buildRecurrenceRule(request.recurrencePattern, request.recurrenceEndDate);
    if (recurrence.length > 0) {
      eventBody.recurrence = recurrence;
      console.log(`Creating recurring event with pattern: ${request.recurrencePattern}`);
    }
  }
  
  // Try creating with Google Meet first (works for Workspace accounts)
  const eventBodyWithMeet = {
    ...eventBody,
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  };
  
  let response = await fetch(
    // sendUpdates=all ensures attendee invitations are emailed + appear on their calendars
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBodyWithMeet),
    }
  );
  
  // If Meet creation fails (non-Workspace account), retry without conference data
  if (!response.ok) {
    const errorText = await response.text();
    console.warn('Google Meet creation failed, retrying without conference:', errorText);
    
    // Retry without conference data
    response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Google Calendar API error:', error);
      throw new Error(`Failed to create calendar event: ${error}`);
    }
    
    console.log('Event created without Google Meet (Workspace account required for Meet links)');
  }
  
  return await response.json();
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }
  
  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get service account credentials
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      console.error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
      return new Response(
        JSON.stringify({ error: 'Google Calendar integration not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    
    const body: CreateEventRequest = await req.json();
    const { summary, description, startTime, endTime, timezone, attendeeEmails, memberUserIds, sessionId, calendarId, recurrencePattern, recurrenceEndDate } = body;
    
    // Validate required fields
    if (!summary || !startTime || !endTime) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: summary, startTime, endTime' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolve attendee emails - prefer provided emails, otherwise fetch from memberUserIds
    let resolvedEmails: string[] = attendeeEmails || [];
    
    if ((!resolvedEmails || resolvedEmails.length === 0) && memberUserIds && memberUserIds.length > 0) {
      console.log(`Fetching emails for ${memberUserIds.length} user IDs`);
      
      for (const userId of memberUserIds) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
          if (userError) {
            console.error(`Failed to fetch user ${userId}:`, userError);
            continue;
          }
          if (userData?.user?.email) {
            resolvedEmails.push(userData.user.email);
          }
        } catch (err) {
          console.error(`Error fetching user ${userId}:`, err);
        }
      }
      
      console.log(`Resolved ${resolvedEmails.length} emails from ${memberUserIds.length} user IDs`);
    }
    
    console.log(`Creating Google Calendar event for user ${user.id}:`, { summary, startTime, endTime, attendeeCount: resolvedEmails.length });
    
    // Get impersonation email for Domain-Wide Delegation (required for Meet links)
    const impersonateEmail = Deno.env.get('GOOGLE_CALENDAR_IMPERSONATE_EMAIL');
    if (!impersonateEmail) {
      console.warn('GOOGLE_CALENDAR_IMPERSONATE_EMAIL not set - Meet link creation may fail');
    }
    
    // Get access token from service account with DWD impersonation
    const accessToken = await getServiceAccountAccessToken(serviceAccountJson, impersonateEmail);
    
    // Create the calendar event (with recurrence if provided)
    const event = await createCalendarEvent(accessToken, {
      summary,
      description,
      startTime,
      endTime,
      timezone,
      attendeeEmails: resolvedEmails,
      calendarId,
      recurrencePattern,
      recurrenceEndDate,
    });
    
    // Extract the Google Meet link
    const meetLink = event.conferenceData?.entryPoints?.find(
      ep => ep.entryPointType === 'video'
    )?.uri || event.hangoutLink;
    
    console.log(`Created event ${event.id} with Meet link: ${meetLink}`);
    
    // If sessionId provided, update the group_sessions table with the meeting link
    if (sessionId && meetLink) {
      // Update the master session
      const { error: updateError } = await supabase
        .from('group_sessions')
        .update({
          meeting_link: meetLink,
          booking_source: 'google_calendar',
        })
        .eq('id', sessionId);
      
      if (updateError) {
        console.error('Failed to update master session with meeting link:', updateError);
      } else {
        console.log(`Updated master session ${sessionId} with meeting link`);
      }
      
      // Also update all child sessions (recurring instances) with the same meeting link
      const { data: childSessions, error: childQueryError } = await supabase
        .from('group_sessions')
        .select('id')
        .eq('parent_session_id', sessionId);
      
      if (childQueryError) {
        console.error('Failed to query child sessions:', childQueryError);
      } else if (childSessions && childSessions.length > 0) {
        const childIds = childSessions.map(s => s.id);
        console.log(`Updating ${childIds.length} child sessions with meeting link`);
        
        const { error: childUpdateError } = await supabase
          .from('group_sessions')
          .update({
            meeting_link: meetLink,
            booking_source: 'google_calendar',
          })
          .in('id', childIds);
        
        if (childUpdateError) {
          console.error('Failed to update child sessions with meeting link:', childUpdateError);
        } else {
          console.log(`Updated ${childIds.length} child sessions with meeting link`);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        eventId: event.id,
        eventLink: event.htmlLink,
        meetingLink: meetLink,
        conferenceId: event.conferenceData?.conferenceId,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Google Calendar create event error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
