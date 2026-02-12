import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2, Paperclip, BookOpen } from "lucide-react";
import { format } from "date-fns";
import ReflectionResourceForm from "./ReflectionResourceForm";
import ReflectionResources from "./ReflectionResources";

interface ModuleReflection {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ModuleReflectionsProps {
  moduleProgressId: string;
}

export default function ModuleReflections({ moduleProgressId }: ModuleReflectionsProps) {
  const { user } = useAuth();
  const [reflections, setReflections] = useState<ModuleReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addingResourceTo, setAddingResourceTo] = useState<string | null>(null);

  useEffect(() => {
    fetchReflections();
  }, [moduleProgressId]);

  async function fetchReflections() {
    try {
      const { data, error } = await supabase
        .from("module_reflections")
        .select("*")
        .eq("module_progress_id", moduleProgressId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReflections(data || []);
    } catch (error) {
      console.error("Error fetching reflections:", error);
      toast.error("Failed to load reflections");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!user || !content.trim()) return;

    setSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("module_reflections")
          .update({ content: content.trim() })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Reflection updated");
      } else {
        const { error } = await supabase.from("module_reflections").insert({
          user_id: user.id,
          module_progress_id: moduleProgressId,
          content: content.trim(),
        });

        if (error) throw error;
        toast.success("Reflection added");
      }

      setContent("");
      setEditingId(null);
      setIsAdding(false);
      fetchReflections();
    } catch (error) {
      console.error("Error saving reflection:", error);
      toast.error("Failed to save reflection");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this reflection?")) return;

    try {
      const { error } = await supabase.from("module_reflections").delete().eq("id", id);

      if (error) throw error;
      toast.success("Reflection deleted");
      fetchReflections();
    } catch (error) {
      console.error("Error deleting reflection:", error);
      toast.error("Failed to delete reflection");
    }
  }

  function startEdit(reflection: ModuleReflection) {
    setEditingId(reflection.id);
    setContent(reflection.content);
    setIsAdding(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setContent("");
    setIsAdding(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Reflections
            </CardTitle>
            <CardDescription className="mt-1.5">
              Record your thoughts, insights, and learnings from this module
            </CardDescription>
          </div>
          {!isAdding && (
            <Button
              onClick={() => setIsAdding(true)}
              size="sm"
              className="shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Reflection
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="font-medium text-sm">
              {editingId ? "Edit Reflection" : "New Reflection"}
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What did you learn? How will you apply it?"
              rows={5}
            />
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting || !content.trim()}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Update" : "Save"}
              </Button>
              <Button onClick={cancelEdit} variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {reflections.length === 0 && !isAdding ? (
          <p className="text-muted-foreground py-4 text-center">
            No reflections yet. Add your first reflection to track your learning journey.
          </p>
        ) : (
          <div className="space-y-3">
            {reflections.map((reflection) => (
              <div key={reflection.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <p className="whitespace-pre-wrap">{reflection.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(reflection.created_at), "PPp")}
                      {reflection.updated_at !== reflection.created_at && " (edited)"}
                    </p>
                    <ReflectionResources reflectionId={reflection.id} />
                    {addingResourceTo === reflection.id ? (
                      <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                        <ReflectionResourceForm
                          reflectionId={reflection.id}
                          onSuccess={() => {
                            setAddingResourceTo(null);
                          }}
                          onCancel={() => setAddingResourceTo(null)}
                        />
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddingResourceTo(reflection.id)}
                        className="mt-2"
                      >
                        <Paperclip className="h-3 w-3 mr-2" />
                        Attach Resource
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button onClick={() => startEdit(reflection)} variant="ghost" size="icon">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => handleDelete(reflection.id)} variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
