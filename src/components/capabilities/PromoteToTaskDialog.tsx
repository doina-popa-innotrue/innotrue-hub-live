import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { differenceInDays, parseISO } from "date-fns";

interface ActionItemForPromotion {
  id: string;
  title: string | null;
  content: string | null;
  due_date: string | null;
}

interface PromoteToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionItem: ActionItemForPromotion | null;
}

function getQuadrant(
  importance: boolean,
  urgency: boolean,
): "important_urgent" | "important_not_urgent" | "not_important_urgent" | "not_important_not_urgent" {
  if (importance && urgency) return "important_urgent";
  if (importance && !urgency) return "important_not_urgent";
  if (!importance && urgency) return "not_important_urgent";
  return "not_important_not_urgent";
}

export function PromoteToTaskDialog({ open, onOpenChange, actionItem }: PromoteToTaskDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultTitle = actionItem?.title || actionItem?.content?.slice(0, 80) || "";
  const defaultDueDate = actionItem?.due_date || "";

  // Auto-set urgency if due within 7 days
  const autoUrgent =
    actionItem?.due_date != null &&
    differenceInDays(parseISO(actionItem.due_date), new Date()) <= 7;

  const [title, setTitle] = useState(defaultTitle);
  const [importance, setImportance] = useState(false);
  const [urgency, setUrgency] = useState(autoUrgent);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  // Reset form when actionItem changes
  const [prevItemId, setPrevItemId] = useState<string | null>(null);
  if (actionItem && actionItem.id !== prevItemId) {
    setPrevItemId(actionItem.id);
    setTitle(actionItem.title || actionItem.content?.slice(0, 80) || "");
    setDueDate(actionItem.due_date || "");
    setImportance(false);
    setUrgency(
      actionItem.due_date != null &&
        differenceInDays(parseISO(actionItem.due_date), new Date()) <= 7,
    );
  }

  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !actionItem) throw new Error("Missing user or action item");

      // 1. Create the task
      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: title.trim() || "Untitled Task",
          importance,
          urgency,
          quadrant: getQuadrant(importance, urgency),
          due_date: dueDate || null,
          source_type: "manual",
          status: "todo",
        })
        .select("id")
        .single();

      if (taskError) throw taskError;

      // 2. Create the junction link
      const { error: linkError } = await supabase
        .from("development_item_task_links")
        .insert({
          development_item_id: actionItem.id,
          task_id: newTask.id,
        });

      if (linkError) throw linkError;

      return newTask;
    },
    onSuccess: () => {
      toast({ description: "Action item promoted to task" });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
      queryClient.invalidateQueries({ queryKey: ["development-items"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to promote action item",
        variant: "destructive",
      });
    },
  });

  if (!actionItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Promote to Task</DialogTitle>
          <DialogDescription>
            Add this action item to your Eisenhower Matrix for prioritized task management.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            promoteMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="promote-title">Title</Label>
            <Input
              id="promote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="promote-importance">Important</Label>
              <p className="text-xs text-muted-foreground">Contributes to long-term goals</p>
            </div>
            <Switch
              id="promote-importance"
              checked={importance}
              onCheckedChange={setImportance}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="promote-urgency">Urgent</Label>
              <p className="text-xs text-muted-foreground">Needs attention soon</p>
            </div>
            <Switch id="promote-urgency" checked={urgency} onCheckedChange={setUrgency} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promote-due-date">Due Date</Label>
            <Input
              id="promote-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={promoteMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={promoteMutation.isPending}>
              {promoteMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
