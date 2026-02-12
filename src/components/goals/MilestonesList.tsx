import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Calendar, GripVertical, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import MilestoneForm from "./MilestoneForm";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Database } from "@/integrations/supabase/types";

type MilestoneStatus = Database["public"]["Enums"]["milestone_status"];

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  order_index: number;
  is_private: boolean;
}

interface MilestonesListProps {
  goalId: string;
  onMilestoneChange: () => void;
}

function SortableMilestoneItem({ milestone, onStatusChange, onDelete, onEdit }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: milestone.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const STATUS_COLORS: Record<string, string> = {
    not_started: "bg-secondary text-secondary-foreground",
    in_progress: "bg-primary/15 text-primary",
    completed: "bg-success/15 text-success",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => onEdit(milestone)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      <Checkbox
        checked={milestone.status === "completed"}
        onCheckedChange={(checked) =>
          onStatusChange(milestone.id, checked ? "completed" : "not_started")
        }
        className="mt-1"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4
              className={`font-medium ${milestone.status === "completed" ? "line-through text-muted-foreground" : ""}`}
            >
              {milestone.title}
            </h4>
            {milestone.description && (
              <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <Badge className={STATUS_COLORS[milestone.status]} variant="outline">
                {milestone.status.replace("_", " ")}
              </Badge>
              {milestone.due_date && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(milestone.due_date), "MMM d, yyyy")}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(milestone);
              }}
            >
              <Edit2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(milestone.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MilestonesList({ goalId, onMilestoneChange }: MilestonesListProps) {
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    fetchMilestones();
  }, [goalId]);

  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from("goal_milestones")
        .select("*")
        .eq("goal_id", goalId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setMilestones(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load milestones",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (milestoneId: string, status: MilestoneStatus) => {
    try {
      const { error } = await supabase
        .from("goal_milestones")
        .update({ status })
        .eq("id", milestoneId);

      if (error) throw error;

      fetchMilestones();
      onMilestoneChange();

      toast({
        title: "Success",
        description: "Milestone status updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update milestone",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("goal_milestones").delete().eq("id", deleteId);

      if (error) throw error;

      fetchMilestones();
      onMilestoneChange();

      toast({
        title: "Success",
        description: "Milestone deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete milestone",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setDeleteId(null);
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = milestones.findIndex((m) => m.id === active.id);
      const newIndex = milestones.findIndex((m) => m.id === over.id);

      const newMilestones = arrayMove(milestones, oldIndex, newIndex);
      setMilestones(newMilestones);

      // Update order_index for all milestones
      try {
        const updates = newMilestones.map((milestone, index) =>
          supabase.from("goal_milestones").update({ order_index: index }).eq("id", milestone.id),
        );

        await Promise.all(updates);
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to reorder milestones",
          variant: "destructive",
        });
        fetchMilestones();
      }
    }
  };

  const handleMilestoneSaved = () => {
    setShowDialog(false);
    setEditingMilestone(null);
    fetchMilestones();
    onMilestoneChange();
  };

  const handleEdit = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setShowDialog(true);
  };

  const handleOpenCreate = () => {
    setEditingMilestone(null);
    setShowDialog(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setShowDialog(false);
      setEditingMilestone(null);
    }
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <CardTitle>Milestones</CardTitle>
            <Button onClick={handleOpenCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Milestone
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No milestones yet. Add your first milestone to track progress.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={milestones.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {milestones.map((milestone) => (
                    <SortableMilestoneItem
                      key={milestone.id}
                      milestone={milestone}
                      onStatusChange={handleStatusChange}
                      onDelete={setDeleteId}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMilestone ? "Edit Milestone" : "Add Milestone"}</DialogTitle>
          </DialogHeader>
          <MilestoneForm
            goalId={goalId}
            orderIndex={milestones.length}
            milestone={editingMilestone}
            onSuccess={handleMilestoneSaved}
            onCancel={() => handleDialogClose(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this milestone? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
