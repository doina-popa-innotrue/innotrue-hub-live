import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ExternalCalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  location?: string;
  allDay: boolean;
}

export function useExternalCalendarEvents(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  const [events, setEvents] = useState<ExternalCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchExternalEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        // First, get all active calendars
        const { data: calendars, error: calError } = await supabase
          .from('user_external_calendars')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (calError) throw calError;

        if (!calendars || calendars.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        // Fetch events from each calendar in parallel
        const eventPromises = calendars.map(async (calendar) => {
          try {
            const { data, error } = await supabase.functions.invoke('fetch-ical-feed', {
              body: {
                calendarId: calendar.id,
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString(),
              },
            });

            if (error) {
              console.error(`Error fetching calendar ${calendar.name}:`, error);
              return [];
            }

            if (!data?.success || !data?.events) {
              return [];
            }

            return data.events.map((event: any) => ({
              id: `${calendar.id}-${event.uid}`,
              calendarId: calendar.id,
              calendarName: calendar.name,
              calendarColor: calendar.color,
              title: event.summary,
              description: event.description,
              start: new Date(event.dtstart),
              end: event.dtend ? new Date(event.dtend) : undefined,
              location: event.location,
              allDay: event.allDay,
            }));
          } catch (err) {
            console.error(`Failed to fetch calendar ${calendar.name}:`, err);
            return [];
          }
        });

        const results = await Promise.all(eventPromises);
        const allEvents = results.flat();
        
        // Sort by start date
        allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
        
        setEvents(allEvents);
      } catch (err: any) {
        console.error('Error fetching external calendar events:', err);
        setError(err.message || 'Failed to fetch external calendar events');
      } finally {
        setLoading(false);
      }
    };

    fetchExternalEvents();
  }, [user, startDate?.toISOString(), endDate?.toISOString(), refreshKey]);

  return { events, loading, error, refresh };
}
