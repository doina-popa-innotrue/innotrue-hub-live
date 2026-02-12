import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Pencil, Trash2, Lock, Crown } from "lucide-react";
import { format } from "date-fns";
import {
  WheelCategory,
  WHEEL_OF_LIFE_CATEGORIES,
  WHEEL_CATEGORY_DESCRIPTIONS,
} from "@/lib/wheelOfLifeCategories";
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

interface DomainReflection {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface DomainReflectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: WheelCategory;
  canAddReflection?: boolean;
  isFreePlan?: boolean;
  currentReflectionCount?: number;
  maxReflections?: number;
}

export function DomainReflectionDialog({
  open,
  onOpenChange,
  category,
  canAddReflection = true,
  isFreePlan = false,
  currentReflectionCount = 0,
  maxReflections = 3,
}: DomainReflectionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reflections, setReflections] = useState<DomainReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchReflections();
    }
  }, [open, user, category]);

  const fetchReflections = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wheel_domain_reflections" as any)
        .select("id, content, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("category", category)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReflections((data as unknown as DomainReflection[]) || []);
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
    if (!user || !content.trim()) return;
    setSaving(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("wheel_domain_reflections" as any)
          .update({ content: content.trim(), updated_at: new Date().toISOString() })
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Reflection updated" });
      } else {
        const { error } = await supabase.from("wheel_domain_reflections" as any).insert({
          user_id: user.id,
          category,
          content: content.trim(),
        });

        if (error) throw error;
        toast({ title: "Reflection added" });
      }

      setContent("");
      setEditingId(null);
      setShowForm(false);
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

  const handleEdit = (reflection: DomainReflection) => {
    setEditingId(reflection.id);
    setContent(reflection.content);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("wheel_domain_reflections" as any)
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast({ title: "Reflection deleted" });
      setDeleteId(null);
      fetchReflections();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete reflection",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setContent("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{WHEEL_OF_LIFE_CATEGORIES[category]} Reflections</DialogTitle>
            <DialogDescription>{WHEEL_CATEGORY_DESCRIPTIONS[category]}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isFreePlan && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/30">
                <Crown className="h-4 w-4" />
                <span>
                  Free plan: {currentReflectionCount}/{maxReflections} reflections used across all
                  categories
                </span>
              </div>
            )}

            {!showForm &&
              (canAddReflection ? (
                <Button onClick={() => setShowForm(true)} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Reflection
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  <Lock className="mr-2 h-4 w-4" />
                  Reflection Limit Reached
                </Button>
              ))}

            {showForm && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your reflection about this area of your life..."
                  rows={4}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving || !content.trim()}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingId ? "Update" : "Save"}
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : reflections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No reflections yet. Add your first reflection to start tracking your thoughts.
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {reflections.map((reflection) => (
                    <div key={reflection.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(reflection.created_at), "MMM d, yyyy h:mm a")}
                          {reflection.updated_at !== reflection.created_at && " (edited)"}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(reflection)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteId(reflection.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{reflection.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

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
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
