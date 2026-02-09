import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, Video, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TimezoneSelect } from "@/components/profile/TimezoneSelect";
import { useUserTimezone } from "@/hooks/useUserTimezone";

interface ClientSessionFormProps {
  moduleId: string;
  enrollmentId: string;
  moduleName: string;
  defaultDuration?: number;
  schedulingUrl?: string;
}

export function ClientSessionForm({
  moduleId,
  enrollmentId,
  moduleName,
  defaultDuration = 60,
}: ClientSessionFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Get user's timezone with fallback
  const { timezone: userTimezone } = useUserTimezone();
  const [selectedTimezone, setSelectedTimezone] = useState(userTimezone);

  // Update selected timezone when user timezone loads
  useEffect(() => {
    if (userTimezone) {
      setSelectedTimezone(userTimezone);
    }
  }, [userTimezone]);

  // External booking form state
  const [externalDate, setExternalDate] = useState("");
  const [externalTime, setExternalTime] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [externalNotes, setExternalNotes] = useState("");

  const createSessionMutation = useMutation({
    mutationFn: async (params: {
      sessionDate: string;
      meetingUrl?: string;
      notes?: string;
      timezone?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      if (!enrollmentId) throw new Error("Enrollment not found for this module");

      const sessionData = {
        module_id: moduleId,
        enrollment_id: enrollmentId,
        title: `${moduleName} Session`,
        duration_minutes: defaultDuration,
        session_type: "individual" as const,
        status: "scheduled" as const,
        source: "client_external" as const,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
        request_notes: params.notes || null,
        session_date: params.sessionDate,
        meeting_url: params.meetingUrl || null,
        client_response: "accepted" as const,
        timezone: params.timezone || 'UTC',
      };

      const { error } = await supabase
        .from("module_sessions")
        .insert(sessionData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-sessions-client", moduleId] });
      toast.success("External session logged successfully!");
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Error creating session:", error);
      toast.error("Failed to create session", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const resetForm = () => {
    setExternalDate("");
    setExternalTime("");
    setMeetingUrl("");
    setExternalNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalDate || !externalTime) {
      toast.error("Please enter the session date and time");
      return;
    }

    const sessionDateTime = new Date(`${externalDate}T${externalTime}`).toISOString();

    createSessionMutation.mutate({
      sessionDate: sessionDateTime,
      meetingUrl: meetingUrl || undefined,
      notes: externalNotes,
      timezone: selectedTimezone,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log External Session</DialogTitle>
          <DialogDescription>
            Already booked a session externally? Log it here to keep track.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground">
            Session duration: <span className="font-medium text-foreground">{defaultDuration} minutes</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="external-date" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Session Date *
              </Label>
              <Input
                id="external-date"
                type="date"
                value={externalDate}
                onChange={(e) => setExternalDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-time" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Session Time *
              </Label>
              <Input
                id="external-time"
                type="time"
                value={externalTime}
                onChange={(e) => setExternalTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Timezone Selection */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <TimezoneSelect 
              value={selectedTimezone || ''} 
              onChange={setSelectedTimezone} 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-url" className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              Meeting Link (optional)
            </Label>
            <Input
              id="meeting-url"
              type="url"
              placeholder="https://meet.google.com/..."
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="external-notes">Notes (optional)</Label>
            <Textarea
              id="external-notes"
              placeholder="What you plan to discuss..."
              value={externalNotes}
              onChange={(e) => setExternalNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSessionMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              {createSessionMutation.isPending ? "Saving..." : "Log Session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
