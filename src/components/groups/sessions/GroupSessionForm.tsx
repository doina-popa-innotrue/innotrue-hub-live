import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { SessionFormData } from "@/hooks/useGroupSessionMutations";
import { TimezoneSelect } from "@/components/profile/TimezoneSelect";

interface GroupSessionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionForm: SessionFormData;
  setSessionForm: (form: SessionFormData) => void;
  onSubmit: () => void;
  isPending: boolean;
  editingSession?: any;
  updateAllFuture?: boolean;
  setUpdateAllFuture?: (value: boolean) => void;
  // Admin-specific props
  showTimezone?: boolean;
  timezone?: string;
  setTimezone?: (tz: string) => void;
  showGoogleCalendarOption?: boolean;
  useGoogleCalendar?: boolean;
  setUseGoogleCalendar?: (value: boolean) => void;
}

export function GroupSessionForm({
  open,
  onOpenChange,
  sessionForm,
  setSessionForm,
  onSubmit,
  isPending,
  editingSession,
  updateAllFuture = false,
  setUpdateAllFuture,
  showTimezone = false,
  timezone,
  setTimezone,
  showGoogleCalendarOption = false,
  useGoogleCalendar = true,
  setUseGoogleCalendar,
}: GroupSessionFormProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  const isEditing = !!editingSession;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Session" : "Add Session"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update session details"
              : "Schedule a new group session. Supports recurring sessions."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={sessionForm.title}
              onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
              placeholder="e.g., Weekly Sync"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={sessionForm.session_date}
                onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={sessionForm.session_time || ""}
                onChange={(e) => setSessionForm({ ...sessionForm, session_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Select
              value={sessionForm.duration_minutes}
              onValueChange={(val) => setSessionForm({ ...sessionForm, duration_minutes: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showTimezone && setTimezone && (
            <div className="space-y-2">
              <Label>Timezone</Label>
              <TimezoneSelect value={timezone || ""} onChange={setTimezone} />
            </div>
          )}

          {showGoogleCalendarOption && setUseGoogleCalendar && !isEditing && (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
              <input
                type="checkbox"
                id="use_google_calendar"
                checked={useGoogleCalendar}
                onChange={(e) => setUseGoogleCalendar(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="use_google_calendar" className="cursor-pointer text-sm">
                Create Google Calendar event with Meet link
              </Label>
            </div>
          )}

          <div className="space-y-2">
            <Label>Location / Meeting Link</Label>
            <Input
              value={sessionForm.location}
              onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
              placeholder="https://meet.google.com/... or room name"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={sessionForm.description}
              onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
              placeholder="Agenda or notes"
              rows={2}
            />
          </div>

          {/* Recurring options - only show when creating */}
          {!isEditing && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={sessionForm.is_recurring}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, is_recurring: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is_recurring" className="cursor-pointer">
                  Make this a recurring session
                </Label>
              </div>
              {sessionForm.is_recurring && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label>Repeat</Label>
                    <Select
                      value={sessionForm.recurrence_pattern}
                      onValueChange={(val) =>
                        setSessionForm({ ...sessionForm, recurrence_pattern: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Until</Label>
                    <Input
                      type="date"
                      value={sessionForm.recurrence_end_date}
                      onChange={(e) =>
                        setSessionForm({ ...sessionForm, recurrence_end_date: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Update all future option - only show when editing a recurring session */}
          {isEditing &&
            setUpdateAllFuture &&
            (editingSession.is_recurring || editingSession.parent_session_id) && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <input
                  type="checkbox"
                  id="update_all_future"
                  checked={updateAllFuture}
                  onChange={(e) => setUpdateAllFuture(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="update_all_future" className="cursor-pointer text-sm">
                  Apply changes to all future sessions in this series
                </Label>
              </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!sessionForm.title || !sessionForm.session_date || isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? (updateAllFuture ? "Update All Future" : "Save Changes") : "Add Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
