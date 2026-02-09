import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface DecisionJournalProps {
  decisionId: string;
}

export function DecisionJournal({ decisionId }: DecisionJournalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: "",
    content: "",
    mood: "",
    tags: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery({
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

  const addMutation = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("decision_journal_entries").insert({
        decision_id: decisionId,
        user_id: user.id,
        title: entry.title,
        content: entry.content,
        mood: entry.mood || null,
        tags: entry.tags ? entry.tags.split(",").map(t => t.trim()) : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-journal", decisionId] });
      setNewEntry({ title: "", content: "", mood: "", tags: "" });
      setIsAdding(false);
      toast({ title: "Journal entry added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("decision_journal_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-journal", decisionId] });
      toast({ title: "Entry deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading journal entries...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Decision Journal</h3>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        )}
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>New Journal Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newEntry.title}
                onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                placeholder="Brief title for this entry"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={newEntry.content}
                onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                placeholder="What are you thinking about this decision? What new information or perspectives have emerged?"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mood">Mood (optional)</Label>
                <Input
                  id="mood"
                  value={newEntry.mood}
                  onChange={(e) => setNewEntry({ ...newEntry, mood: e.target.value })}
                  placeholder="e.g., confident, anxious"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (optional)</Label>
                <Input
                  id="tags"
                  value={newEntry.tags}
                  onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                  placeholder="Comma-separated tags"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => addMutation.mutate(newEntry)}
                disabled={!newEntry.title || !newEntry.content}
              >
                Save Entry
              </Button>
              <Button onClick={() => setIsAdding(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {entries && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{entry.title}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(entry.entry_date), "PPP")}
                      {entry.mood && (
                        <>
                          <span>•</span>
                          <span className="italic">{entry.mood}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {entry.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No journal entries yet. Start documenting your decision journey!
          </CardContent>
        </Card>
      )}
    </div>
  );
}