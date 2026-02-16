import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2, ChevronRight, Copy } from "lucide-react";
import TaskNotes from "@/components/tasks/TaskNotes";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useWheelCategories } from "@/hooks/useWheelCategories";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  importance: boolean | null;
  urgency: boolean | null;
  quadrant: string | null;
  due_date: string | null;
  source_type: string | null;
  shared_with_coach: boolean;
  category: string | null;
  goal_id: string | null;
  is_private: boolean;
}

interface Goal {
  id: string;
  title: string;
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: categories = [], isLoading: categoriesLoading } = useWheelCategories({
    includeLegacy: false,
  });
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done" | "blocked">("todo");
  const [importance, setImportance] = useState(false);
  const [urgency, setUrgency] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [goalId, setGoalId] = useState<string>("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);

  if (!id) return null;

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  useEffect(() => {
    if (id && user) {
      fetchTask();
    }
  }, [id, user]);

  async function fetchGoals() {
    try {
      const { data, error } = await supabase
        .from("goals")
        .select("id, title")
        .eq("user_id", user?.id ?? "")
        .order("title");

      if (error) throw error;
      setGoals(data || []);
    } catch (error: any) {
      console.error("Error fetching goals:", error);
    }
  }

  useEffect(() => {
    if (id && user) {
      fetchTask();
    }
  }, [id, user]);

  async function fetchTask() {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id!)
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;

      setTask(data);
      setTitle(data.title);
      setDescription(data.description || "");
      setStatus(data.status as "todo" | "in_progress" | "done" | "blocked");
      setImportance(data.importance || false);
      setUrgency(data.urgency || false);
      setDueDate(data.due_date || "");
      setCategory(data.category || "");
      setGoalId(data.goal_id || "");
      setIsPrivate(data.is_private || false);
    } catch (error: any) {
      toast({
        title: "Error loading task",
        description: error.message,
        variant: "destructive",
      });
      navigate("/tasks");
    } finally {
      setLoading(false);
    }
  }

  function getQuadrant(
    imp: boolean,
    urg: boolean,
  ):
    | "important_urgent"
    | "important_not_urgent"
    | "not_important_urgent"
    | "not_important_not_urgent" {
    if (imp && urg) return "important_urgent";
    if (imp && !urg) return "important_not_urgent";
    if (!imp && urg) return "not_important_urgent";
    return "not_important_not_urgent";
  }

  async function handleSave() {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your task",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title,
          description,
          status,
          importance,
          urgency,
          quadrant: getQuadrant(importance, urgency),
          due_date: dueDate || null,
          category: category === "_none" ? null : category || null,
          goal_id: goalId === "_none" ? null : goalId || null,
          is_private: isPrivate,
        })
        .eq("id", id!);

      if (error) throw error;

      toast({
        title: "Task updated",
        description: "Your changes have been saved",
      });
      fetchTask();
    } catch (error: any) {
      toast({
        title: "Error saving task",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id!);

      if (error) throw error;

      toast({
        title: "Task deleted",
        description: "The task has been removed",
      });
      navigate("/tasks");
    } catch (error: any) {
      toast({
        title: "Error deleting task",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function handleClone() {
    if (!task) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            user_id: user?.id ?? "",
            title: `${task.title} (copy)`,
            description: task.description,
            status: "todo" as const,
            importance: task.importance,
            urgency: task.urgency,
            quadrant: task.quadrant as
              | "important_urgent"
              | "important_not_urgent"
              | "not_important_urgent"
              | "not_important_not_urgent"
              | null,
            due_date: task.due_date,
            category: task.category,
            goal_id: task.goal_id,
            source_type: task.source_type as "manual" | "goal" | "decision" | "program" | null,
            is_private: task.is_private,
            shared_with_coach: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Task cloned",
        description: "A copy of the task has been created",
      });

      navigate(`/tasks/${data!.id}`);
    } catch (error: any) {
      toast({
        title: "Error cloning task",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  function getQuadrantColor(quadrant: string | null) {
    switch (quadrant) {
      case "important_urgent":
        return "destructive";
      case "important_not_urgent":
        return "default";
      case "not_important_urgent":
        return "secondary";
      case "not_important_not_urgent":
        return "outline";
      default:
        return "outline";
    }
  }

  function getQuadrantLabel(quadrant: string | null) {
    switch (quadrant) {
      case "important_urgent":
        return "Do First";
      case "important_not_urgent":
        return "Schedule";
      case "not_important_urgent":
        return "Delegate";
      case "not_important_not_urgent":
        return "Eliminate";
      default:
        return "";
    }
  }

  if (loading) {
    return <PageLoadingState message="Loading task..." />;
  }

  if (!task) {
    return <ErrorState title="Not Found" description="Task not found" />;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate("/tasks")} className="cursor-pointer">
              Tasks
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{task.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Details</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={getQuadrantColor(task.quadrant) as any}>
              {getQuadrantLabel(task.quadrant)}
            </Badge>
            {task.source_type && (
              <Badge variant="outline" className="capitalize">
                {task.source_type.replace("_", " ")}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClone}>
            <Copy className="h-4 w-4 mr-2" />
            Clone
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task Information</CardTitle>
          <CardDescription>Edit task details and priority settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as "todo" | "in_progress" | "done" | "blocked")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Life Area</Label>
            <Select
              value={category || "_none"}
              onValueChange={(value) => setCategory(value === "_none" ? "" : value)}
              disabled={categoriesLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={categoriesLoading ? "Loading..." : "Select life area (optional)"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goalId">Linked Goal</Label>
            <Select
              value={goalId || "_none"}
              onValueChange={(value) => setGoalId(value === "_none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Link to a goal (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {goals.map((goal) => (
                  <SelectItem key={goal.id} value={goal.id}>
                    {goal.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Priority Matrix</h3>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="importance">Important</Label>
                <p className="text-xs text-muted-foreground">Impacts long-term goals and values</p>
              </div>
              <Switch id="importance" checked={importance} onCheckedChange={setImportance} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="urgency">Urgent</Label>
                <p className="text-xs text-muted-foreground">Requires immediate attention</p>
              </div>
              <Switch id="urgency" checked={urgency} onCheckedChange={setUrgency} />
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                <span className="font-semibold">Current Quadrant:</span>{" "}
                <Badge variant={getQuadrantColor(getQuadrant(importance, urgency)) as any}>
                  {getQuadrantLabel(getQuadrant(importance, urgency))}
                </Badge>
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Privacy</h3>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="isPrivate">Private Task</Label>
                <p className="text-xs text-muted-foreground">
                  Only visible to you and admins. Hidden from coaches/instructors.
                </p>
              </div>
              <Switch id="isPrivate" checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Notes Section */}
      <TaskNotes taskId={id!} />
    </div>
  );
}
