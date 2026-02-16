import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// HMAC-SHA256 signing for secure token verification
async function verifyHmacSignature(
  uid: string,
  ts: string,
  sig: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const message = `${uid}:${ts}`;
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const expectedHex = bytesToHex(new Uint8Array(expectedSig));
  
  // Constant-time comparison
  if (sig.length !== expectedHex.length) return false;
  let result = 0;
  for (let i = 0; i < sig.length; i++) {
    result |= sig.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return result === 0;
}

// Token expiration: 30 days
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

interface EventParams {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  allDay?: boolean;
}

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatDate(date: Date, allDay?: boolean): string {
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function createEvent(params: EventParams): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
  ];

  if (params.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(params.start, true)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(params.end, true)}`);
  } else {
    lines.push(`DTSTART:${formatDate(params.start)}`);
    lines.push(`DTEND:${formatDate(params.end)}`);
  }

  lines.push(`SUMMARY:${escapeIcal(params.summary)}`);

  if (params.description) {
    lines.push(`DESCRIPTION:${escapeIcal(params.description)}`);
  }

  if (params.location) {
    lines.push(`LOCATION:${escapeIcal(params.location)}`);
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const url = new URL(req.url);
    const hmacSecret = Deno.env.get('CALENDAR_HMAC_SECRET');
    
    // Support both old token-based and new HMAC-signed URLs
    const legacyToken = url.searchParams.get('token');
    const paramUserId = url.searchParams.get('uid');
    const paramTimestamp = url.searchParams.get('ts');
    const paramSignature = url.searchParams.get('sig');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let profile: { id: string; full_name: string | null; calendar_sync_enabled: boolean } | null = null;

    // New HMAC-signed URL format
    if (paramUserId && paramTimestamp && paramSignature && hmacSecret) {
      console.log('Verifying HMAC-signed calendar URL');
      
      // Check token expiration
      const tokenTime = parseInt(paramTimestamp, 10);
      if (isNaN(tokenTime) || Date.now() - tokenTime > TOKEN_EXPIRY_MS) {
        console.log('Calendar token expired');
        return new Response('Token expired. Please regenerate your calendar URL.', { 
          status: 401, 
          headers: cors 
        });
      }

      // Verify HMAC signature
      const isValid = await verifyHmacSignature(paramUserId, paramTimestamp, paramSignature, hmacSecret);
      if (!isValid) {
        console.log('Invalid HMAC signature');
        return new Response('Invalid token signature', { status: 401, headers: cors });
      }

      // Fetch profile by user ID
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, calendar_sync_enabled')
        .eq('id', paramUserId)
        .single();

      if (error || !data) {
        console.log('User not found:', error?.message);
        return new Response('Invalid token', { status: 401, headers: cors });
      }
      profile = data;
    }
    // Legacy token-based URL (for backwards compatibility)
    else if (legacyToken) {
      console.log('Using legacy token-based calendar URL');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, calendar_sync_enabled')
        .eq('calendar_token', legacyToken)
        .single();

      if (error || !data) {
        return new Response('Invalid token', { status: 401, headers: cors });
      }
      profile = data;
    } else {
      return new Response('Missing authentication parameters', { status: 400, headers: cors });
    }

    if (!profile.calendar_sync_enabled) {
      return new Response('Calendar sync is disabled', { status: 403, headers: cors });
    }

    const currentUserId = profile.id;
    const userName = profile.full_name || 'User';

    // Fetch events from various sources
    const [sessionsResult, groupSessionsResult, assignmentsResult] = await Promise.all([
      // Individual sessions
      supabase
        .from('client_sessions')
        .select(`
          id, 
          scheduled_at, 
          duration_minutes,
          session_types (name),
          instructor:profiles!client_sessions_instructor_id_fkey (full_name)
        `)
        .eq('client_id', currentUserId)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at'),
      
      // Group sessions
      supabase
        .from('group_sessions')
        .select(`
          id,
          scheduled_at,
          duration_minutes,
          title,
          groups!inner (
            id,
            name,
            group_members!inner (user_id)
          )
        `)
        .eq('groups.group_members.user_id', currentUserId)
        .gte('scheduled_at', new Date().toISOString()),
      
      // Assignment due dates
      supabase
        .from('module_assignments')
        .select(`
          id,
          due_date,
          module_assignment_types (name),
          modules (title)
        `)
        .eq('client_id', currentUserId)
        .not('due_date', 'is', null)
        .gte('due_date', new Date().toISOString()),
    ]);

    // Build iCal content
    const events: string[] = [];

    // Add individual sessions
    if (sessionsResult.data) {
      for (const session of sessionsResult.data) {
        const start = new Date(session.scheduled_at);
        const end = new Date(start.getTime() + (session.duration_minutes || 60) * 60000);
        
        const sessionType = (session.session_types as any)?.name || 'Session';
        const instructor = (session.instructor as any)?.full_name || 'Instructor';
        
        events.push(createEvent({
          uid: `session-${session.id}@innotruehub`,
          summary: `${sessionType} with ${instructor}`,
          start,
          end,
          description: `Your scheduled ${sessionType.toLowerCase()} session`,
        }));
      }
    }

    // Add group sessions
    if (groupSessionsResult.data) {
      for (const session of groupSessionsResult.data) {
        const start = new Date(session.scheduled_at);
        const end = new Date(start.getTime() + (session.duration_minutes || 60) * 60000);
        
        const groupName = (session.groups as any)?.name || 'Group';
        
        events.push(createEvent({
          uid: `group-session-${session.id}@innotruehub`,
          summary: session.title || `${groupName} Session`,
          start,
          end,
          description: `Group session for ${groupName}`,
        }));
      }
    }

    // Add assignment due dates
    if (assignmentsResult.data) {
      for (const assignment of assignmentsResult.data) {
        const dueDate = new Date(assignment.due_date!);
        
        const assignmentType = (assignment.module_assignment_types as any)?.name || 'Assignment';
        const moduleName = (assignment.modules as any)?.title || 'Module';
        
        events.push(createEvent({
          uid: `assignment-${assignment.id}@innotruehub`,
          summary: `${assignmentType} Due: ${moduleName}`,
          start: dueDate,
          end: dueDate,
          allDay: true,
          description: `${assignmentType} due for ${moduleName}`,
        }));
      }
    }

    // Build complete iCal
    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//InnoTrue Hub//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${userName}'s InnoTrue Hub`,
      'X-WR-TIMEZONE:UTC',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    return new Response(ical, {
      headers: {
        ...cors,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="innotruehub.ics"',
      },
    });
  } catch (error) {
    console.error('Calendar feed error:', error);
    return new Response('Internal server error', { status: 500, headers: cors });
  }
});
