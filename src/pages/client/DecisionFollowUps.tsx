import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Bell, Check, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, isFuture } from "date-fns";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { CapabilityGate } from "@/components/decisions/CapabilityGate";

export default function DecisionFollowUps() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders, isLoading } = useQuery({
    queryKey: ["all-reminders"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("decision_reminders")
        .select(
          `
          *,
          decisions (
            id,
            title,
            status
          )
        `,
        )
        .eq("user_id", user.id)
        .order("reminder_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const completeReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("decision_reminders")
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reminders"] });
      toast({ title: "Reminder marked as complete" });
    },
  });

  const pendingReminders = reminders?.filter((r) => !r.is_completed) || [];
  const overdueReminders = pendingReminders.filter(
    (r) => isPast(new Date(r.reminder_date)) && !isToday(new Date(r.reminder_date)),
  );
  const todayReminders = pendingReminders.filter((r) => isToday(new Date(r.reminder_date)));
  const upcomingReminders = pendingReminders.filter(
    (r) => isFuture(new Date(r.reminder_date)) && !isToday(new Date(r.reminder_date)),
  );
  const completedReminders = reminders?.filter((r) => r.is_completed) || [];

  if (isLoading) {
    return <PageLoadingState message="Loading reminders..." />;
  }

  return (
    <CapabilityGate capability="reminders_followups">
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate("/decisions")} className="cursor-pointer">
                Decisions
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Follow-Ups</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 className="text-3xl font-bold">Decision Follow-Ups</h1>
          <p className="text-muted-foreground">Track scheduled check-ins and reflections</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{overdueReminders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayReminders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingReminders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedReminders.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Reminders */}
        {overdueReminders.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Overdue Check-ins ({overdueReminders.length})
            </h2>
            {overdueReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onComplete={() => completeReminder.mutate(reminder.id)}
                onViewDecision={() => navigate(`/decisions/${reminder.decisions?.id}`)}
                variant="overdue"
              />
            ))}
          </div>
        )}

        {/* Today's Reminders */}
        {todayReminders.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Due Today ({todayReminders.length})
            </h2>
            {todayReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onComplete={() => completeReminder.mutate(reminder.id)}
                onViewDecision={() => navigate(`/decisions/${reminder.decisions?.id}`)}
                variant="today"
              />
            ))}
          </div>
        )}

        {/* Upcoming Reminders */}
        {upcomingReminders.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Check-ins ({upcomingReminders.length})
            </h2>
            {upcomingReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onComplete={() => completeReminder.mutate(reminder.id)}
                onViewDecision={() => navigate(`/decisions/${reminder.decisions?.id}`)}
                variant="upcoming"
              />
            ))}
          </div>
        )}

        {/* Completed Reminders */}
        {completedReminders.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Check className="h-5 w-5" />
              Completed Check-ins ({completedReminders.length})
            </h2>
            {completedReminders.slice(0, 5).map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onViewDecision={() => navigate(`/decisions/${reminder.decisions?.id}`)}
                variant="completed"
              />
            ))}
          </div>
        )}

        {reminders?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">No reminders yet</p>
              <p className="text-sm mb-4">Schedule follow-ups to track decision outcomes</p>
              <Button onClick={() => navigate("/decisions")}>Go to Decisions</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </CapabilityGate>
  );
}

interface ReminderCardProps {
  reminder: any;
  onComplete?: () => void;
  onViewDecision: () => void;
  variant: "overdue" | "today" | "upcoming" | "completed";
}

function ReminderCard({ reminder, onComplete, onViewDecision, variant }: ReminderCardProps) {
  const variantStyles = {
    overdue: "border-l-4 border-l-destructive",
    today: "border-l-4 border-l-primary",
    upcoming: "",
    completed: "opacity-60",
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{reminder.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(reminder.reminder_date), "MMMM d, yyyy")}
              {reminder.email_sent && (
                <Badge variant="secondary" className="text-xs">
                  Email Sent
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onViewDecision}>
              View Decision
            </Button>
            {onComplete && variant !== "completed" && (
              <Button size="sm" onClick={onComplete}>
                <Check className="h-4 w-4 mr-1" />
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {reminder.description && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{reminder.description}</p>
          <div className="mt-3 p-3 bg-muted/50 rounded-md">
            <p className="text-sm font-medium">Decision: {reminder.decisions?.title}</p>
            <Badge variant="outline" className="text-xs mt-1">
              {reminder.decisions?.status}
            </Badge>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
