import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Calendar as CalendarIcon,
  Users,
  MapPin,
  Clock,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  format,
  isSameDay,
  isBefore,
  startOfDay,
  addDays,
  addWeeks,
  addMonths,
  isAfter,
  endOfMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ExternalCalendarManager } from "@/components/calendar/ExternalCalendarManager";
import {
  useExternalCalendarEvents,
  ExternalCalendarEvent,
} from "@/hooks/useExternalCalendarEvents";
import { PageLoadingState } from "@/components/ui/page-loading-state";

/**
 * Calculate next occurrences for a recurring session
 */
function getRecurringOccurrences(session: any, now: Date, maxOccurrences: number = 12): Date[] {
  if (!session.is_recurring || !session.recurrence_pattern) {
    return [];
  }

  const sessionDate = new Date(session.session_date);
  const endDate = session.recurrence_end_date
    ? new Date(session.recurrence_end_date)
    : addMonths(now, 6);
  const dates: Date[] = [];
  let currentDate = new Date(sessionDate);

  // Find the first occurrence >= today
  while (isBefore(currentDate, startOfDay(now)) && dates.length < maxOccurrences) {
    switch (session.recurrence_pattern.toLowerCase()) {
      case "daily":
        currentDate = addDays(currentDate, 1);
        break;
      case "weekly":
        currentDate = addWeeks(currentDate, 1);
        break;
      case "bi-weekly":
        currentDate = addWeeks(currentDate, 2);
        break;
      case "monthly":
        currentDate = addMonths(currentDate, 1);
        break;
      default:
        return [];
    }
  }

  // Now collect future occurrences
  while (dates.length < maxOccurrences) {
    if (isAfter(currentDate, endDate)) {
      break;
    }
    dates.push(new Date(currentDate));

    switch (session.recurrence_pattern.toLowerCase()) {
      case "daily":
        currentDate = addDays(currentDate, 1);
        break;
      case "weekly":
        currentDate = addWeeks(currentDate, 1);
        break;
      case "bi-weekly":
        currentDate = addWeeks(currentDate, 2);
        break;
      case "monthly":
        currentDate = addMonths(currentDate, 1);
        break;
      default:
        break;
    }
  }

  return dates;
}
interface CalendarEvent {
  id: string;
  originalId: string;
  title: string;
  description?: string;
  date: Date;
  type:
    | "group_session"
    | "program_schedule"
    | "module_session"
    | "individual_session"
    | "cohort_session"
    | "external";
  location?: string;
  duration_minutes?: number;
  metadata: {
    groupId?: string;
    groupName?: string;
    programId?: string;
    programName?: string;
    moduleId?: string;
    enrollmentId?: string;
    cohortId?: string;
    cohortName?: string;
    capacity?: number;
    enrolled_count?: number;
    meetingLink?: string;
    // External calendar metadata
    calendarName?: string;
    calendarColor?: string;
    allDay?: boolean;
  };
}

export default function ClientCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Date range: ±3 months from selected month
  const rangeStart = useMemo(() => startOfMonth(subMonths(selectedMonth, 3)), [selectedMonth]);
  const rangeEnd = useMemo(() => endOfMonth(addMonths(selectedMonth, 3)), [selectedMonth]);

  // External calendar events - fetch for the same window
  const externalStartDate = useMemo(() => rangeStart, [rangeStart]);
  const externalEndDate = useMemo(() => rangeEnd, [rangeEnd]);
  const {
    events: externalEvents,
    loading: externalLoading,
    refresh: refreshExternalEvents,
  } = useExternalCalendarEvents(externalStartDate, externalEndDate);

  const {
    data: events = [],
    isLoading: loading,
  } = useQuery({
    queryKey: ["client-calendar-events", user?.id, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (!user) return [];

      const now = new Date();
      const rangeStartISO = rangeStart.toISOString();
      const rangeEndISO = rangeEnd.toISOString();

      // First get user's enrollments (needed by multiple queries)
      const { data: userEnrollments } = await supabase
        .from("client_enrollments")
        .select("id, program_id, cohort_id, programs(id, name), program_cohorts(id, name, program_id, programs(id, name))")
        .eq("client_user_id", user.id)
        .eq("status", "active");

      const enrollmentIds = userEnrollments?.map((e) => e.id) || [];

      // Run all queries in parallel
      const [groupSessionsResult, individualSessionsResult, groupModuleSessionsResult, cohortSessionsResult] =
        await Promise.all([
          // 1. Group sessions
          supabase
            .from("group_sessions")
            .select(
              `
              id, title, description, session_date, duration_minutes, location, status,
              parent_session_id, is_recurring, recurrence_pattern, recurrence_end_date,
              groups!inner (
                id, name,
                group_memberships!inner (user_id, status)
              )
            `,
            )
            .eq("groups.group_memberships.user_id", user.id)
            .eq("groups.group_memberships.status", "active")
            .neq("status", "cancelled")
            .order("session_date", { ascending: true }),

          // 2. Individual module sessions
          enrollmentIds.length > 0
            ? supabase
                .from("module_sessions")
                .select("id, title, session_date, duration_minutes, location, status, session_type, module_id, enrollment_id")
                .eq("session_type", "individual")
                .in("enrollment_id", enrollmentIds)
                .neq("status", "cancelled")
                .not("session_date", "is", null)
                .gte("session_date", rangeStartISO)
                .lte("session_date", rangeEndISO)
                .order("session_date", { ascending: true })
            : Promise.resolve({ data: [] as any[], error: null }),

          // 3. Group module sessions (user is participant)
          supabase
            .from("module_session_participants")
            .select(
              `
              session_id,
              module_sessions!inner (
                id, title, session_date, duration_minutes, location, status,
                session_type, module_id, program_id,
                programs (id, name)
              )
            `,
            )
            .eq("user_id", user.id)
            .neq("module_sessions.status", "cancelled")
            .not("module_sessions.session_date", "is", null)
            .gte("module_sessions.session_date", rangeStartISO),

          // 4. Cohort sessions
          (() => {
            const cohortIds = (userEnrollments || [])
              .filter((e: any) => e.cohort_id)
              .map((e: any) => e.cohort_id);
            if (cohortIds.length === 0) return Promise.resolve({ data: [] as any[], error: null });
            return supabase
              .from("cohort_sessions")
              .select("*")
              .in("cohort_id", cohortIds)
              .gte("session_date", rangeStart.toISOString().split("T")[0])
              .lte("session_date", rangeEnd.toISOString().split("T")[0])
              .order("session_date", { ascending: true });
          })(),
        ]);

      const allEvents: CalendarEvent[] = [];

      // Process group sessions
      if (groupSessionsResult.data) {
        const addedSessionIds = new Set<string>();

        groupSessionsResult.data.forEach((session: any) => {
          const sessionDate = new Date(session.session_date);

          if (session.is_recurring && session.recurrence_pattern) {
            const occurrences = getRecurringOccurrences(session, now, 12);
            occurrences.forEach((occDate, index) => {
              const eventId = `gs-${session.id}-occ-${index}`;
              if (!addedSessionIds.has(eventId)) {
                addedSessionIds.add(eventId);
                allEvents.push({
                  id: eventId,
                  originalId: session.id,
                  title: session.title,
                  description: session.description,
                  date: occDate,
                  type: "group_session",
                  location: session.location,
                  duration_minutes: session.duration_minutes,
                  metadata: {
                    groupId: session.groups?.id,
                    groupName: session.groups?.name,
                  },
                });
              }
            });
          } else if (!isBefore(sessionDate, startOfDay(now))) {
            const eventId = `gs-${session.id}`;
            if (!addedSessionIds.has(eventId)) {
              addedSessionIds.add(eventId);
              allEvents.push({
                id: eventId,
                originalId: session.id,
                title: session.title,
                description: session.description,
                date: sessionDate,
                type: "group_session",
                location: session.location,
                duration_minutes: session.duration_minutes,
                metadata: {
                  groupId: session.groups?.id,
                  groupName: session.groups?.name,
                },
              });
            }
          }
        });
      }

      // Process individual sessions
      if (individualSessionsResult.data) {
        individualSessionsResult.data.forEach((session: any) => {
          const enrollment = userEnrollments?.find((e) => e.id === session.enrollment_id);
          allEvents.push({
            id: `is-${session.id}`,
            originalId: session.id,
            title: session.title || "Individual Session",
            date: new Date(session.session_date),
            type: "individual_session",
            location: session.location,
            duration_minutes: session.duration_minutes,
            metadata: {
              moduleId: session.module_id,
              enrollmentId: session.enrollment_id,
              programId: enrollment?.programs?.id,
              programName: enrollment?.programs?.name,
            },
          });
        });
      }

      // Process group module sessions
      if (groupModuleSessionsResult.data) {
        groupModuleSessionsResult.data.forEach((participant: any) => {
          const session = participant.module_sessions;
          if (session) {
            allEvents.push({
              id: `ms-${session.id}`,
              originalId: session.id,
              title: session.title || "Group Module Session",
              date: new Date(session.session_date),
              type: "module_session",
              location: session.location,
              duration_minutes: session.duration_minutes,
              metadata: {
                moduleId: session.module_id,
                programId: session.programs?.id,
                programName: session.programs?.name,
              },
            });
          }
        });
      }

      // Process cohort sessions
      if (cohortSessionsResult.data) {
        cohortSessionsResult.data.forEach((session: any) => {
          const enrollment = (userEnrollments || []).find(
            (e: any) => e.cohort_id === session.cohort_id,
          );
          const cohort = enrollment?.program_cohorts as any;
          allEvents.push({
            id: `cs-${session.id}`,
            originalId: session.id,
            title: session.title,
            description: session.description,
            date: new Date(session.session_date),
            type: "cohort_session",
            location: session.location,
            metadata: {
              cohortId: session.cohort_id,
              cohortName: cohort?.name,
              programId: cohort?.programs?.id,
              programName: cohort?.programs?.name,
              moduleId: session.module_id,
              meetingLink: session.meeting_link,
            },
          });
        });
      }

      // Sort all events by date
      allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
      return allEvents;
    },
    enabled: !!user,
  });

  // Real-time subscription for module sessions - invalidate query when sessions change
  const channelRef = useMemo(() => {
    if (!user) return null;

    const channel = supabase
      .channel("calendar-module-sessions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "module_sessions",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["client-calendar-events"] });
        },
      )
      .subscribe();

    return channel;
  }, [user, queryClient]);

  // Auto-select first event date or today
  const autoSelectedDate = useMemo(() => {
    if (selectedDate) {
      const hasEventsOnSelectedDay = events.some((e) => isSameDay(e.date, selectedDate));
      if (hasEventsOnSelectedDay) return selectedDate;
    }
    const firstEventDate = events[0]?.date;
    return firstEventDate || new Date();
  }, [events, selectedDate]);

  const effectiveSelectedDate = selectedDate ?? autoSelectedDate;

  // Combine internal events with external calendar events
  const allEventsWithExternal = useMemo(() => {
    const externalMapped: CalendarEvent[] = externalEvents.map((ext) => ({
      id: ext.id,
      originalId: ext.id,
      title: ext.title,
      description: ext.description,
      date: ext.start,
      type: "external" as const,
      location: ext.location,
      duration_minutes: ext.end
        ? Math.round((ext.end.getTime() - ext.start.getTime()) / 60000)
        : undefined,
      metadata: {
        calendarName: ext.calendarName,
        calendarColor: ext.calendarColor,
        allDay: ext.allDay,
      },
    }));

    return [...events, ...externalMapped].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, externalEvents]);

  // Get dates that have events for calendar highlighting (including external)
  const eventDates = useMemo(() => {
    return allEventsWithExternal.map((event) => event.date);
  }, [allEventsWithExternal]);

  // Filter events for selected date (including external)
  const selectedDateEvents = useMemo(() => {
    if (!effectiveSelectedDate) return [];
    return allEventsWithExternal.filter((event) => isSameDay(event.date, effectiveSelectedDate));
  }, [allEventsWithExternal, effectiveSelectedDate]);

  // Get upcoming events (next 5, internal only for actionable items)
  const upcomingEvents = useMemo(() => {
    return events.slice(0, 5);
  }, [events]);

  const getEventTypeColor = (type: CalendarEvent["type"], metadata?: CalendarEvent["metadata"]) => {
    switch (type) {
      case "group_session":
        return "bg-primary/10 text-primary";
      case "individual_session":
        return "bg-chart-4/10 text-chart-4";
      case "module_session":
        return "bg-chart-2/10 text-chart-2";
      case "cohort_session":
        return "bg-chart-1/10 text-chart-1";
      case "program_schedule":
        return "bg-secondary/50 text-secondary-foreground";
      case "external":
        return "bg-muted/50 text-muted-foreground border-l-2";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getEventTypeLabel = (type: CalendarEvent["type"], metadata?: CalendarEvent["metadata"]) => {
    switch (type) {
      case "group_session":
        return "Group Session";
      case "individual_session":
        return "1:1 Session";
      case "module_session":
        return "Module Session";
      case "cohort_session":
        return "Live Workshop";
      case "program_schedule":
        return "Program";
      case "external":
        return metadata?.calendarName || "External";
      default:
        return "Event";
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    switch (event.type) {
      case "group_session":
        if (event.metadata.groupId) {
          navigate(`/groups/${event.metadata.groupId}/sessions/${event.originalId}`);
        }
        break;
      case "individual_session":
        if (event.metadata.programId && event.metadata.moduleId) {
          navigate(`/programs/${event.metadata.programId}/modules/${event.metadata.moduleId}`);
        } else if (event.metadata.moduleId) {
          navigate(`/modules/${event.metadata.moduleId}`);
        }
        break;
      case "module_session":
        if (event.metadata.moduleId) {
          navigate(`/modules/${event.metadata.moduleId}`);
        }
        break;
      case "program_schedule":
        if (event.metadata.programId) {
          navigate(`/programs/${event.metadata.programId}`);
        }
        break;
      case "cohort_session":
        if (event.metadata.programId) {
          navigate(`/programs/${event.metadata.programId}/cohort`);
        }
        break;
    }
  };

  const EventCard = ({ event, showDate = true }: { event: CalendarEvent; showDate?: boolean }) => {
    const isExternal = event.type === "external";
    const borderStyle =
      isExternal && event.metadata.calendarColor
        ? { borderLeftColor: event.metadata.calendarColor }
        : undefined;

    return (
      <div
        onClick={() => !isExternal && handleEventClick(event)}
        className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 p-4 rounded-lg border bg-card transition-colors ${
          isExternal ? "border-l-4 opacity-80" : "hover:bg-accent/50 cursor-pointer group"
        }`}
        style={borderStyle}
      >
        {/* Mobile: Date/time at top */}
        <div className="flex sm:hidden items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {showDate && <span className="font-medium">{format(event.date, "EEE, MMM d")}</span>}
            {!event.metadata.allDay && (
              <span className="text-muted-foreground">{format(event.date, "h:mm a")}</span>
            )}
            {event.metadata.allDay && (
              <Badge variant="secondary" className="text-xs">
                All day
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {event.duration_minutes && !event.metadata.allDay && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.duration_minutes}min
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            {isExternal && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />}
            <div className="flex-1 min-w-0">
              <div
                className={`font-medium ${!isExternal ? "group-hover:text-primary" : ""} transition-colors line-clamp-2`}
              >
                {event.title}
              </div>
            </div>
            <Badge
              className={`${getEventTypeColor(event.type, event.metadata)} shrink-0 text-xs`}
              variant="outline"
            >
              {getEventTypeLabel(event.type, event.metadata)}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-0.5">
            {event.metadata.groupName && (
              <div className="flex items-center gap-1 line-clamp-1">
                <Users className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.metadata.groupName}</span>
              </div>
            )}
            {event.metadata.cohortName && (
              <div className="flex items-center gap-1 line-clamp-1">
                <Users className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.metadata.cohortName}</span>
              </div>
            )}
            {event.metadata.programName && (
              <div className="line-clamp-1 truncate">{event.metadata.programName}</div>
            )}
            {event.description && <div className="line-clamp-1">{event.description}</div>}
          </div>
        </div>

        {/* Desktop: Date/time on right */}
        <div className="hidden sm:flex flex-col items-end gap-2 text-right shrink-0">
          {showDate && (
            <div>
              <div className="font-medium">{format(event.date, "EEE, MMM d")}</div>
              {!event.metadata.allDay && (
                <div className="text-xs text-muted-foreground">{format(event.date, "h:mm a")}</div>
              )}
            </div>
          )}
          {!showDate && !event.metadata.allDay && (
            <div className="text-sm font-medium">{format(event.date, "h:mm a")}</div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {event.duration_minutes && !event.metadata.allDay && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.duration_minutes}min
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate max-w-[100px]">{event.location}</span>
              </div>
            )}
          </div>

          {!isExternal && (
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>

        {/* Mobile: Location and chevron */}
        {(event.location || !isExternal) && (
          <div className="flex sm:hidden items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
            {event.location ? (
              <div className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            ) : (
              <span />
            )}
            {!isExternal && (
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <PageLoadingState message="Loading calendar..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Calendar</h1>
        <p className="text-muted-foreground">
          View your upcoming sessions, program schedules, and coaching appointments
        </p>
      </div>

      {/* External Calendar Manager */}
      <ExternalCalendarManager onCalendarsChange={refreshExternalEvents} />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        {/* Calendar Widget */}
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Calendar
              mode="single"
              selected={effectiveSelectedDate}
              onSelect={setSelectedDate}
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              modifiers={{
                hasEvent: eventDates,
              }}
              modifiersClassNames={{
                hasEvent: "bg-primary/20 font-semibold",
              }}
              className="rounded-md border"
            />
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded bg-primary/20" />
              <span>Days with events</span>
            </div>
          </CardContent>
        </Card>

        {/* Events for Selected Date */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {effectiveSelectedDate ? format(effectiveSelectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
            </CardTitle>
            <CardDescription>
              {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""}{" "}
              scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No events on this day</p>
                <p className="text-sm mt-1">Select another date or check upcoming events below</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map((event) => (
                  <EventCard key={event.id} event={event} showDate={false} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Events
          </CardTitle>
          <CardDescription>Your next scheduled sessions and appointments</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No upcoming events</p>
              <p className="text-sm mt-1">
                Your scheduled sessions and program dates will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
