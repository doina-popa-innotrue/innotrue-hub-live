import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, Loader2, CheckCircle2, Circle, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";

interface SessionHomeworkProps {
  sessionId: string;
  cohortId: string;
  sessionDate: string;
}

interface HomeworkItem {
  id: string;
  title: string | null;
  content: string | null;
  status: string | null;
  due_date: string | null;
  item_type: string;
  user_id: string;
  user_name: string;
}

export function SessionHomework({ sessionId, cohortId, sessionDate }: SessionHomeworkProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Fetch homework items linked to this session
  const { data: homeworkItems, isLoading } = useQuery({
    queryKey: ["session-homework", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_items")
        .select("id, title, content, status, due_date, item_type, user_id, profiles:user_id(name)")
        .eq("cohort_session_id" as string, sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        content: d.content,
        status: d.status,
        due_date: d.due_date,
        item_type: d.item_type,
        user_id: d.user_id,
        user_name: d.profiles?.name || "Unknown",
      })) as HomeworkItem[];
    },
  });

  // Fetch enrolled users for bulk assignment
  const { data: enrolledUsers } = useQuery({
    queryKey: ["cohort-enrolled-users-hw", cohortId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_enrollments")
        .select("id, client_user_id, profiles:client_user_id(name)")
        .eq("cohort_id" as string, cohortId)
        .eq("status", "active");

      if (error) throw error;
      return (data as any[])?.map((d: any) => ({
        enrollment_id: d.id,
        user_id: d.client_user_id,
        name: d.profiles?.name || "Unknown",
      })) || [];
    },
  });

  const addHomeworkMutation = useMutation({
    mutationFn: async () => {
      if (!enrolledUsers || enrolledUsers.length === 0) throw new Error("No enrolled users");
      if (!newTitle.trim()) throw new Error("Title is required");

      // Create an action_item for each enrolled user
      const items = enrolledUsers.map((u) => ({
        user_id: u.user_id,
        author_id: user?.id,
        item_type: "action_item",
        title: newTitle.trim(),
        content: newContent.trim() || null,
        due_date: newDueDate || null,
        status: "pending",
        cohort_session_id: sessionId,
      }));

      const { error } = await supabase.from("development_items").insert(items);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-homework", sessionId] });
      toast.success(`Homework assigned to ${enrolledUsers?.length || 0} enrolled clients`);
      setNewTitle("");
      setNewContent("");
      setNewDueDate("");
      setShowAddForm(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to assign homework");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading homework...
      </div>
    );
  }

  const items = homeworkItems || [];
  const completedCount = items.filter((i) => i.status === "completed").length;

  // Default due date = session date + 7 days
  const defaultDueDate = (() => {
    const d = new Date(sessionDate);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  })();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1">
          <ClipboardList className="h-4 w-4" />
          Homework
          {items.length > 0 && (
            <Badge variant="outline" className="text-xs ml-1">
              {completedCount}/{items.length}
            </Badge>
          )}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => {
            setShowAddForm(!showAddForm);
            if (!newDueDate) setNewDueDate(defaultDueDate);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Assign Homework
        </Button>
      </div>

      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-1 border rounded-lg p-2 bg-muted/20">
          {/* De-duplicate by title (since same homework assigned to multiple users) */}
          {(() => {
            const uniqueTitles = new Map<string, { title: string; due_date: string | null; total: number; completed: number }>();
            items.forEach((item) => {
              const key = item.title || item.content || item.id;
              if (!uniqueTitles.has(key)) {
                uniqueTitles.set(key, { title: key, due_date: item.due_date, total: 0, completed: 0 });
              }
              const entry = uniqueTitles.get(key)!;
              entry.total++;
              if (item.status === "completed") entry.completed++;
            });

            return Array.from(uniqueTitles.values()).map((hw) => (
              <div key={hw.title} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-2 min-w-0">
                  {hw.completed === hw.total ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm truncate">{hw.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hw.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Due {format(new Date(hw.due_date), "MMM d")}
                    </span>
                  )}
                  <Badge
                    variant={hw.completed === hw.total ? "default" : "outline"}
                    className="text-xs"
                  >
                    {hw.completed}/{hw.total}
                  </Badge>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">New Homework Assignment</p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddForm(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`hw-title-${sessionId}`} className="text-xs">Title</Label>
            <Input
              id={`hw-title-${sessionId}`}
              placeholder="e.g., Complete leadership self-assessment"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`hw-content-${sessionId}`} className="text-xs">Description (optional)</Label>
            <Textarea
              id={`hw-content-${sessionId}`}
              placeholder="Additional instructions..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`hw-due-${sessionId}`} className="text-xs">Due Date</Label>
            <Input
              id={`hw-due-${sessionId}`}
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This will be assigned to all {enrolledUsers?.length || 0} enrolled clients
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addHomeworkMutation.mutate()}
              disabled={!newTitle.trim() || addHomeworkMutation.isPending}
            >
              {addHomeworkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Assign
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
