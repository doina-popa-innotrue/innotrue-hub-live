import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Plus,
  Calendar,
  Target,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface CoachingNote {
  id: string;
  session_date: string;
  summary: string;
  action_items: string;
  next_steps: string;
  created_at: string;
}

interface CoachingSessionNotesProps {
  clientUserId: string;
  clientName: string;
}

/**
 * CoachingSessionNotes — Structured coaching session notes for coaches/instructors.
 * Stored in staff_notes table with category 'coaching_session' for structured data.
 * Displays a timeline of coaching session notes with summary, action items, and next steps.
 */
export function CoachingSessionNotes({ clientUserId, clientName }: CoachingSessionNotesProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<CoachingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sessionDate, setSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [summary, setSummary] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  useEffect(() => {
    loadNotes();
  }, [clientUserId]);

  async function loadNotes() {
    setLoading(true);
    try {
      // Fetch coaching session notes from staff_notes with category='coaching_session'
      const { data, error } = await supabase
        .from("client_staff_notes")
        .select("id, content, created_at")
        .eq("client_user_id", clientUserId)
        .eq("note_type", "coaching_session")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const parsed: CoachingNote[] = (data || []).map((note) => {
        let parsed;
        try {
          parsed = JSON.parse(note.content);
        } catch {
          parsed = { session_date: "", summary: note.content, action_items: "", next_steps: "" };
        }
        return {
          id: note.id,
          session_date: parsed.session_date || "",
          summary: parsed.summary || "",
          action_items: parsed.action_items || "",
          next_steps: parsed.next_steps || "",
          created_at: note.created_at,
        };
      });

      setNotes(parsed);
    } catch (err) {
      console.error("Error loading coaching notes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!summary.trim()) {
      toast.error("Session summary is required");
      return;
    }

    setSaving(true);
    try {
      const content = JSON.stringify({
        session_date: sessionDate,
        summary: summary.trim(),
        action_items: actionItems.trim(),
        next_steps: nextSteps.trim(),
      });

      const { error } = await supabase.from("client_staff_notes").insert({
        client_user_id: clientUserId,
        author_id: user!.id,
        title: `Coaching Session — ${sessionDate}`,
        content,
        note_type: "coaching_session",
      });

      if (error) throw error;

      toast.success("Coaching session notes saved");
      setDialogOpen(false);
      setSummary("");
      setActionItems("");
      setNextSteps("");
      setSessionDate(format(new Date(), "yyyy-MM-dd"));
      loadNotes();
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Coaching Session Notes
          </CardTitle>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Log Session
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No coaching sessions recorded yet. Click "Log Session" to add your first note.
          </p>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {note.session_date
                        ? format(new Date(note.session_date), "MMM d, yyyy")
                        : "No date"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Logged {format(new Date(note.created_at), "MMM d, yyyy")}
                  </span>
                </div>

                {note.summary && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Target className="h-3 w-3" />
                      Summary
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.summary}</p>
                  </div>
                )}

                {note.action_items && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <CheckSquare className="h-3 w-3" />
                      Action Items
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.action_items}</p>
                  </div>
                )}

                {note.next_steps && (
                  <div>
                    <Badge variant="outline" className="text-xs mb-1">
                      Next Steps
                    </Badge>
                    <p className="text-sm whitespace-pre-wrap">{note.next_steps}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Log Session Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Log Coaching Session</DialogTitle>
            <DialogDescription>
              Record session notes for {clientName}. These notes are private and only visible to
              coaches and instructors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="session-date">Session Date</Label>
              <Input
                id="session-date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Session Summary *</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What was discussed? Key topics, insights, progress observed..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-items">Action Items for Client</Label>
              <Textarea
                id="action-items"
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="Tasks or exercises assigned to the client..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-steps">Next Steps / Follow-Up</Label>
              <Textarea
                id="next-steps"
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                placeholder="Plans for the next session, topics to revisit..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !summary.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Session Notes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
