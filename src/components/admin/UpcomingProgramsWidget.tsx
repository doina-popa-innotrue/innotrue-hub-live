import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, AlertTriangle } from "lucide-react";
import { format, isWithinInterval, addDays, parseISO } from "date-fns";
import { Link } from "react-router-dom";

interface ScheduledDate {
  id: string;
  title: string;
  date: string;
  capacity?: number;
  enrolled_count?: number;
}

interface ProgramWithSchedule {
  id: string;
  name: string;
  category: string;
  slug: string;
  scheduled_dates: ScheduledDate[];
}

interface UpcomingSession extends ScheduledDate {
  programName: string;
  programSlug: string;
  category: string;
  daysUntil: number;
  capacityPercentage: number;
  isNearlyFull: boolean;
}

export function UpcomingProgramsWidget() {
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingSessions();
  }, []);

  async function fetchUpcomingSessions() {
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);

    const { data: programs, error } = await supabase
      .from("programs")
      .select("id, name, category, slug, scheduled_dates")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching programs:", error);
      setLoading(false);
      return;
    }

    const sessions: UpcomingSession[] = [];

    programs?.forEach((program) => {
      const scheduledDates = program.scheduled_dates as unknown as ScheduledDate[] | null;
      if (!scheduledDates || !Array.isArray(scheduledDates)) return;

      scheduledDates.forEach((schedule) => {
        try {
          const scheduleDate = parseISO(schedule.date);

          if (isWithinInterval(scheduleDate, { start: now, end: thirtyDaysFromNow })) {
            const daysUntil = Math.ceil(
              (scheduleDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );
            const enrolledCount = schedule.enrolled_count || 0;
            const capacity = schedule.capacity || 0;
            const capacityPercentage = capacity > 0 ? (enrolledCount / capacity) * 100 : 0;
            const isNearlyFull = capacityPercentage >= 80;

            sessions.push({
              ...schedule,
              programName: program.name,
              programSlug: program.slug,
              category: program.category,
              daysUntil,
              capacityPercentage,
              isNearlyFull,
            });
          }
        } catch (err) {
          console.error("Error parsing date:", schedule.date, err);
        }
      });
    });

    // Sort by date (soonest first)
    sessions.sort((a, b) => a.daysUntil - b.daysUntil);

    setUpcomingSessions(sessions);
    setLoading(false);
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      cta: "bg-blue-500/10 text-blue-500",
      leadership: "bg-purple-500/10 text-purple-500",
      executive: "bg-amber-500/10 text-amber-500",
      ai: "bg-green-500/10 text-green-500",
      "deep-dive": "bg-pink-500/10 text-pink-500",
    };
    return colors[category] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Programs (30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Programs (30 Days)
        </CardTitle>
        <CardDescription>
          {upcomingSessions.length} scheduled session{upcomingSessions.length !== 1 ? "s" : ""} in
          the next 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming scheduled sessions</p>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <Link
                key={`${session.programSlug}-${session.id}`}
                to={`/admin/programs/${session.programSlug}`}
                className="block"
              >
                <div className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-accent transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{session.programName}</p>
                      <Badge variant="outline" className={getCategoryColor(session.category)}>
                        {session.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {session.title || "Scheduled Session"}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(session.date), "MMM dd, yyyy")} ({session.daysUntil} day
                        {session.daysUntil !== 1 ? "s" : ""})
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {session.enrolled_count || 0}/{session.capacity || 0}
                      </span>
                    </div>
                  </div>
                  {session.isNearlyFull && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {Math.round(session.capacityPercentage)}% Full
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
