import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";

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

    let profile: { id: string; name: string | null; calendar_sync_enabled: boolean } | null = null;

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
        .select('id, name, calendar_sync_enabled')
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
        .select('id, name, calendar_sync_enabled')
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
    const userName = profile.name || 'User';

    const now = new Date().toISOString();

    // Step 1: Get user context — session participations, group memberships, cohort enrollments
    const [participationsResult, groupMembershipsResult, enrollmentsResult] = await Promise.all([
      supabase
        .from('module_session_participants')
        .select('session_id')
        .eq('user_id', currentUserId),
      supabase
        .from('group_memberships')
        .select('group_id')
        .eq('user_id', currentUserId)
        .eq('status', 'active'),
      supabase
        .from('client_enrollments')
        .select('cohort_id')
        .eq('client_user_id', currentUserId)
        .not('cohort_id', 'is', null)
        .in('status', ['active', 'enrolled']),
    ]);

    const sessionIds = participationsResult.data?.map((p) => p.session_id) || [];
    const groupIds = groupMembershipsResult.data?.map((g) => g.group_id) || [];
    const cohortIds = enrollmentsResult.data?.map((e) => e.cohort_id!).filter(Boolean) || [];

    // Step 2: Fetch actual sessions from all three session tables
    const [moduleSessionsResult, groupSessionsResult, cohortSessionsResult] = await Promise.all([
      // Module sessions (1:1 coaching + group module sessions)
      sessionIds.length > 0
        ? supabase
            .from('module_sessions')
            .select('id, session_date, duration_minutes, title, session_type, instructor_id, status')
            .in('id', sessionIds)
            .not('session_date', 'is', null)
            .gte('session_date', now)
            .neq('status', 'cancelled')
        : Promise.resolve({ data: [] as any[] }),

      // Group sessions (peer groups, study groups)
      groupIds.length > 0
        ? supabase
            .from('group_sessions')
            .select('id, session_date, duration_minutes, title, group_id, groups(name)')
            .in('group_id', groupIds)
            .gte('session_date', now)
            .neq('status', 'cancelled')
        : Promise.resolve({ data: [] as any[] }),

      // Cohort sessions (cohort-level scheduled sessions)
      cohortIds.length > 0
        ? supabase
            .from('cohort_sessions')
            .select('id, session_date, title, description, instructor_id, cohort:program_cohorts(name)')
            .in('cohort_id', cohortIds)
            .gte('session_date', now)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Step 3: Batch-fetch instructor names for module + cohort sessions
    const instructorIds = new Set<string>();
    for (const s of moduleSessionsResult.data || []) {
      if (s.instructor_id) instructorIds.add(s.instructor_id);
    }
    for (const s of cohortSessionsResult.data || []) {
      if (s.instructor_id) instructorIds.add(s.instructor_id);
    }

    const instructorMap = new Map<string, string>();
    if (instructorIds.size > 0) {
      const { data: instructors } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', [...instructorIds]);
      for (const p of instructors || []) {
        instructorMap.set(p.id, p.name || 'Instructor');
      }
    }

    // Build iCal events
    const events: string[] = [];

    // Module sessions
    for (const session of moduleSessionsResult.data || []) {
      const start = new Date(session.session_date);
      const end = new Date(start.getTime() + (session.duration_minutes || 60) * 60000);
      const instructor = session.instructor_id
        ? instructorMap.get(session.instructor_id) || 'Instructor'
        : '';
      const summary = instructor
        ? `${session.title || session.session_type || 'Session'} with ${instructor}`
        : session.title || session.session_type || 'Session';

      events.push(createEvent({
        uid: `module-session-${session.id}@innotruehub`,
        summary,
        start,
        end,
        description: `Your scheduled ${(session.session_type || 'coaching').toLowerCase()} session`,
      }));
    }

    // Group sessions
    for (const session of groupSessionsResult.data || []) {
      const start = new Date(session.session_date);
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

    // Cohort sessions
    for (const session of cohortSessionsResult.data || []) {
      const start = new Date(session.session_date);
      const end = new Date(start.getTime() + 90 * 60000);
      const cohortName = (session.cohort as any)?.name || 'Cohort';
      const instructor = session.instructor_id
        ? instructorMap.get(session.instructor_id) || ''
        : '';
      const summary = instructor
        ? `${session.title} with ${instructor}`
        : session.title;

      events.push(createEvent({
        uid: `cohort-session-${session.id}@innotruehub`,
        summary,
        start,
        end,
        description: session.description || `Cohort session for ${cohortName}`,
      }));
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
