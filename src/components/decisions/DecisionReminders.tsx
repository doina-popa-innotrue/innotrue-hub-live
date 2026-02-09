import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Bell, Check, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, addMonths, addYears } from "date-fns";

interface DecisionRemindersProps {
  decisionId: string;
}

export function DecisionReminders({ decisionId }: DecisionRemindersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reminderType, setReminderType] = useState<string>("custom");
  const [newReminder, setNewReminder] = useState({
    title: "",
    description: "",
    reminderDate: "",
  });

  const { data: reminders } = useQuery({
    queryKey: ["decision-reminders", decisionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_reminders")
        .select("*")
        .eq("decision_id", decisionId)
        .order("reminder_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const createReminder = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("decision_reminders").insert({
        decision_id: decisionId,
        user_id: user.id,
        ...data,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-reminders", decisionId] });
      toast({ title: "Reminder created" });
      setDialogOpen(false);
      setNewReminder({ title: "", description: "", reminderDate: "" });
      setReminderType("custom");
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
      queryClient.invalidateQueries({ queryKey: ["decision-reminders", decisionId] });
      toast({ title: "Reminder marked as complete" });
    },
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("decision_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-reminders", decisionId] });
      toast({ title: "Reminder deleted" });
    },
  });

  const handleReminderTypeChange = (type: string) => {
    setReminderType(type);
    const today = new Date();

    switch (type) {
      case "short_term":
        setNewReminder({
          ...newReminder,
          title: "Short-term check-in (1 week)",
          reminderDate: format(addDays(today, 7), "yyyy-MM-dd"),
        });
        break;
      case "medium_term":
        setNewReminder({
          ...newReminder,
          title: "Medium-term check-in (1 month)",
          reminderDate: format(addMonths(today, 1), "yyyy-MM-dd"),
        });
        break;
      case "long_term":
        setNewReminder({
          ...newReminder,
          title: "Long-term check-in (6 months)",
          reminderDate: format(addMonths(today, 6), "yyyy-MM-dd"),
        });
        break;
      default:
        setNewReminder({
          ...newReminder,
          title: "",
          reminderDate: "",
        });
    }
  };

  const pendingReminders = reminders?.filter(r => !r.is_completed) || [];
  const completedReminders = reminders?.filter(r => r.is_completed) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Follow-Up Reminders</h3>
          <p className="text-sm text-muted-foreground">
            Schedule check-ins to track outcomes and reflections
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Reminder
        </Button>
      </div>

      {/* Pending Reminders */}
      {pendingReminders.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Upcoming Check-ins
          </h4>
          {pendingReminders.map((reminder) => (
            <Card key={reminder.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{reminder.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(reminder.reminder_date), "MMMM d, yyyy")}
                      {reminder.email_sent && (
                        <Badge variant="secondary" className="text-xs">Email Sent</Badge>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completeReminder.mutate(reminder.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteReminder.mutate(reminder.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {reminder.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{reminder.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Completed Reminders */}
      {completedReminders.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Check className="h-4 w-4" />
            Completed Check-ins
          </h4>
          {completedReminders.map((reminder) => (
            <Card key={reminder.id} className="opacity-60">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base line-through">{reminder.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(reminder.reminder_date), "MMMM d, yyyy")}
                      <Badge variant="outline" className="text-xs">Completed</Badge>
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteReminder.mutate(reminder.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {reminders?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No reminders set yet</p>
            <p className="text-sm mt-1">Schedule check-ins to track decision outcomes</p>
          </CardContent>
        </Card>
      )}

      {/* Create Reminder Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-Up Reminder</DialogTitle>
            <DialogDescription>
              Set a reminder to check in on this decision's outcomes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reminder-type">Reminder Type</Label>
              <Select value={reminderType} onValueChange={handleReminderTypeChange}>
                <SelectTrigger id="reminder-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_term">Short-term (1 week)</SelectItem>
                  <SelectItem value="medium_term">Medium-term (1 month)</SelectItem>
                  <SelectItem value="long_term">Long-term (6 months)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reminder-title">Title</Label>
              <Input
                id="reminder-title"
                value={newReminder.title}
                onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                placeholder="e.g., Check career progress"
              />
            </div>
            <div>
              <Label htmlFor="reminder-date">Reminder Date</Label>
              <Input
                id="reminder-date"
                type="date"
                value={newReminder.reminderDate}
                onChange={(e) => setNewReminder({ ...newReminder, reminderDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="reminder-description">Description (optional)</Label>
              <Textarea
                id="reminder-description"
                value={newReminder.description}
                onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                placeholder="What should you reflect on?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createReminder.mutate({
                title: newReminder.title,
                description: newReminder.description,
                reminder_date: newReminder.reminderDate,
                reminder_type: reminderType,
              })}
              disabled={!newReminder.title || !newReminder.reminderDate || createReminder.isPending}
            >
              Create Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
