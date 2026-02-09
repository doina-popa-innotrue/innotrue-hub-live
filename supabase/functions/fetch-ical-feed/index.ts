import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ICalEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: string;
  dtend?: string;
  location?: string;
  allDay: boolean;
}

function parseICalDate(dateStr: string): { date: Date; allDay: boolean } {
  // Handle VALUE=DATE (all-day events) vs DATETIME
  const isAllDay = dateStr.length === 8;
  
  let date: Date;
  if (isAllDay) {
    // Format: YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    date = new Date(year, month, day);
  } else {
    // Format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    const cleanStr = dateStr.replace(/[TZ]/g, '');
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    const hour = parseInt(cleanStr.substring(8, 10)) || 0;
    const minute = parseInt(cleanStr.substring(10, 12)) || 0;
    const second = parseInt(cleanStr.substring(12, 14)) || 0;
    
    if (dateStr.endsWith('Z')) {
      date = new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      date = new Date(year, month, day, hour, minute, second);
    }
  }
  
  return { date, allDay: isAllDay };
}

function parseICalFeed(icalData: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = icalData.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r?\n/);
  
  let currentEvent: Partial<ICalEvent> | null = null;
  
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.uid && currentEvent.summary && currentEvent.dtstart) {
        events.push(currentEvent as ICalEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      // Handle properties with parameters (e.g., DTSTART;VALUE=DATE:20240101)
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const keyPart = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      const key = keyPart.split(';')[0];
      
      switch (key) {
        case 'UID':
          currentEvent.uid = value;
          break;
        case 'SUMMARY':
          currentEvent.summary = value;
          break;
        case 'DESCRIPTION':
          currentEvent.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
          break;
        case 'DTSTART':
          const startResult = parseICalDate(value);
          currentEvent.dtstart = startResult.date.toISOString();
          currentEvent.allDay = startResult.allDay;
          break;
        case 'DTEND':
          const endResult = parseICalDate(value);
          currentEvent.dtend = endResult.date.toISOString();
          break;
        case 'LOCATION':
          currentEvent.location = value.replace(/\\,/g, ',');
          break;
      }
    }
  }
  
  return events;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { calendarId, startDate, endDate, testUrl, testOnly } = await req.json();
    
    // Test mode: validate URL without saving
    if (testOnly && testUrl) {
      console.log(`Testing iCal URL: ${testUrl.substring(0, 50)}...`);
      
      const testResponse = await fetch(testUrl, {
        headers: {
          'Accept': 'text/calendar, text/plain',
          'User-Agent': 'InnoTrue-Hub-Calendar/1.0',
        },
      });
      
      if (!testResponse.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to fetch URL: HTTP ${testResponse.status}`,
            errorType: 'fetch_failed'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const contentType = testResponse.headers.get('content-type') || '';
      const testData = await testResponse.text();
      
      console.log(`Test response: ${testData.length} bytes, Content-Type: ${contentType}`);
      
      // Check if it looks like HTML (wrong URL type)
      if (testData.trim().startsWith('<!DOCTYPE') || testData.trim().startsWith('<html') || testData.includes('<head>')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'This URL returns a web page, not an iCal feed. Please use the "Secret address in iCal format" from your calendar settings.',
            errorType: 'html_response'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check for valid iCal format
      if (!testData.includes('BEGIN:VCALENDAR')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'This URL does not return a valid iCal feed. The response should start with BEGIN:VCALENDAR.',
            errorType: 'invalid_format'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Parse and count events
      const testEvents = parseICalFeed(testData);
      console.log(`Test found ${testEvents.length} events`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          eventCount: testEvents.length,
          message: testEvents.length > 0 
            ? `Found ${testEvents.length} events in the calendar feed.`
            : 'Valid iCal feed, but no events found in the current period.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Normal mode: fetch calendar by ID
    const { data: calendar, error: calError } = await supabase
      .from('user_external_calendars')
      .select('*')
      .eq('id', calendarId)
      .eq('user_id', user.id)
      .single();
    
    if (calError || !calendar) {
      console.error('Calendar fetch error:', calError);
      return new Response(
        JSON.stringify({ error: 'Calendar not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching iCal feed for calendar: ${calendar.name} (${calendar.id})`);
    
    // Fetch the iCal feed
    const icalResponse = await fetch(calendar.ical_url, {
      headers: {
        'Accept': 'text/calendar, text/plain',
        'User-Agent': 'InnoTrue-Hub-Calendar/1.0',
      },
    });
    
    if (!icalResponse.ok) {
      console.error(`Failed to fetch iCal feed: ${icalResponse.status}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch calendar feed: ${icalResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const icalData = await icalResponse.text();
    console.log(`Received iCal data: ${icalData.length} bytes`);
    
    // Validate the response is actually iCal format
    if (icalData.trim().startsWith('<!DOCTYPE') || icalData.trim().startsWith('<html') || icalData.includes('<head>')) {
      console.error('Received HTML instead of iCal data');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Calendar URL returns a web page instead of iCal data. Please update with the correct iCal feed URL.',
          errorType: 'html_response'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!icalData.includes('BEGIN:VCALENDAR')) {
      console.error('Invalid iCal format - missing BEGIN:VCALENDAR');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid calendar format. Please check the URL is a valid iCal feed.',
          errorType: 'invalid_format'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse the iCal data
    const allEvents = parseICalFeed(icalData);
    console.log(`Parsed ${allEvents.length} events from feed`);
    
    // Filter events by date range if provided
    let filteredEvents = allEvents;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date(8640000000000000);
      
      filteredEvents = allEvents.filter(event => {
        const eventDate = new Date(event.dtstart);
        return eventDate >= start && eventDate <= end;
      });
    }
    
    // Update last_synced_at
    await supabase
      .from('user_external_calendars')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', calendarId);

    return new Response(
      JSON.stringify({
        success: true,
        calendar: {
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
        },
        events: filteredEvents,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in fetch-ical-feed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
