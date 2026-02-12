import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, FileText } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Reflection {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface GoalReflectionsProps {
  goalId: string;
}

export default function GoalReflections({ goalId }: GoalReflectionsProps) {
  const { toast } = useToast();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchReflections();
  }, [goalId]);

  const fetchReflections = async () => {
    try {
      const { data, error } = await supabase
        .from("goal_reflections")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReflections(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load reflections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingId) {
        const { error } = await supabase
          .from("goal_reflections")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Success", description: "Reflection updated successfully" });
      } else {
        const { error } = await supabase
          .from("goal_reflections")
          .insert([{ goal_id: goalId, user_id: user.id, content }]);

        if (error) throw error;
        toast({ title: "Success", description: "Reflection added successfully" });
      }

      setContent("");
      setShowForm(false);
      setEditingId(null);
      fetchReflections();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save reflection",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reflection: Reflection) => {
    setEditingId(reflection.id);
    setContent(reflection.content);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase.from("goal_reflections").delete().eq("id", deleteId);

      if (error) throw error;
      toast({ title: "Success", description: "Reflection deleted successfully" });
      fetchReflections();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete reflection",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setContent("");
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading reflections...</div>;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0" />
            <CardTitle>Reflections</CardTitle>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} size="sm" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Reflection
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your reflection here... Share your thoughts, progress, challenges, or insights."
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !content.trim()}>
                {saving ? "Saving..." : editingId ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {reflections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No reflections yet. Add your first reflection to track your journey.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reflections.map((reflection) => (
              <div
                key={reflection.id}
                className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      Created: {format(new Date(reflection.created_at), "MMM d, yyyy h:mm a")}
                    </div>
                    {reflection.updated_at !== reflection.created_at && (
                      <div>
                        Updated: {format(new Date(reflection.updated_at), "MMM d, yyyy h:mm a")}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(reflection)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(reflection.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{reflection.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reflection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reflection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
