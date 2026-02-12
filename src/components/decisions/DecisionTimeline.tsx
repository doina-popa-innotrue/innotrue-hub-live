import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Circle, Clock, BookOpen, Bell, Lightbulb } from "lucide-react";
import { format } from "date-fns";

interface DecisionTimelineProps {
  decisionId: string;
}

interface TimelineEvent {
  date: Date;
  type: "created" | "journal" | "reminder" | "status_change" | "reflection";
  title: string;
  description?: string;
  icon: React.ReactNode;
  color: string;
}

export function DecisionTimeline({ decisionId }: DecisionTimelineProps) {
  const { data: decision } = useQuery({
    queryKey: ["decision", decisionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decisions")
        .select("*")
        .eq("id", decisionId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: journalEntries } = useQuery({
    queryKey: ["decision-journal", decisionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_journal_entries")
        .select("*")
        .eq("decision_id", decisionId)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: reminders } = useQuery({
    queryKey: ["decision-reminders", decisionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_reminders")
        .select("*")
        .eq("decision_id", decisionId)
        .order("reminder_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: reflection } = useQuery({
    queryKey: ["decision-reflection", decisionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_reflections")
        .select("*")
        .eq("decision_id", decisionId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Build timeline events
  const events: TimelineEvent[] = [];

  // Add creation event
  if (decision) {
    events.push({
      date: new Date(decision.created_at ?? new Date().toISOString()),
      type: "created",
      title: "Decision Created",
      description: `Started tracking: "${decision.title}"`,
      icon: <Circle className="h-4 w-4" />,
      color: "text-blue-500",
    });
  }

  // Add journal entries
  journalEntries?.forEach((entry) => {
    events.push({
      date: new Date(entry.entry_date),
      type: "journal",
      title: entry.title,
      description: entry.content.substring(0, 100) + (entry.content.length > 100 ? "..." : ""),
      icon: <BookOpen className="h-4 w-4" />,
      color: "text-purple-500",
    });
  });

  // Add reminders
  reminders?.forEach((reminder) => {
    events.push({
      date: new Date(reminder.reminder_date),
      type: "reminder",
      title: reminder.title,
      description: reminder.description || undefined,
      icon: <Bell className="h-4 w-4" />,
      color: reminder.is_completed ? "text-green-500" : "text-orange-500",
    });
  });

  // Add status changes
  if (decision?.status === "made" && decision.decision_date) {
    events.push({
      date: new Date(decision.decision_date),
      type: "status_change",
      title: "Decision Made",
      description: decision.expected_outcome || undefined,
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: "text-green-500",
    });
  }

  // Add reflection
  if (reflection) {
    events.push({
      date: new Date(reflection.created_at ?? new Date().toISOString()),
      type: "reflection",
      title: "Reflection Added",
      description: `Satisfaction: ${reflection.satisfaction_score}/10`,
      icon: <Lightbulb className="h-4 w-4" />,
      color: "text-yellow-500",
    });
  }

  // Sort events by date (most recent first)
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Decision Timeline</h3>
      </div>

      {events.length > 0 ? (
        <div className="relative space-y-4 pl-6">
          {/* Timeline line */}
          <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

          {events.map((event, index) => (
            <div key={index} className="relative">
              {/* Timeline dot */}
              <div className={`absolute -left-6 mt-1.5 ${event.color}`}>{event.icon}</div>

              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium">{event.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(event.date, "PPP")}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {event.type.replace("_", " ")}
                      </Badge>
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No timeline events yet. Start by adding journal entries or reminders!
          </CardContent>
        </Card>
      )}
    </div>
  );
}
