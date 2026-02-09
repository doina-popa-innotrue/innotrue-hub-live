import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, LayoutGrid, Clock, Zap, Focus, ArrowUpRight, CheckSquare, AlertTriangle, Filter, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FeatureGate } from "@/components/FeatureGate";
import { useWheelCategories } from "@/hooks/useWheelCategories";
import { usePageView } from "@/hooks/useAnalytics";

function TasksFallback() {
  const navigate = useNavigate();

  const quadrants = [
    {
      title: 'Do First',
      subtitle: 'Important & Urgent',
      description: 'Crisis, deadlines, pressing problems that need immediate attention',
      color: 'bg-destructive/10 border-destructive/20',
      icon: AlertTriangle,
    },
    {
      title: 'Schedule',
      subtitle: 'Important & Not Urgent',
      description: 'Planning, improvement, relationships, and personal development',
      color: 'bg-primary/10 border-primary/20',
      icon: Clock,
    },
    {
      title: 'Delegate',
      subtitle: 'Not Important & Urgent',
      description: 'Interruptions, some calls, emails that can be handed off',
      color: 'bg-secondary/50 border-secondary',
      icon: ArrowUpRight,
    },
    {
      title: 'Eliminate',
      subtitle: 'Not Important & Not Urgent',
      description: 'Time wasters, busywork, and activities to minimize or avoid',
      color: 'bg-muted/50 border-muted',
      icon: CheckSquare,
    },
  ];

  const benefits = [
    {
      icon: Focus,
      title: 'Focus on What Matters',
      description: 'Prioritize tasks based on importance and urgency to maximize productivity',
    },
    {
      icon: Zap,
      title: 'Reduce Overwhelm',
      description: 'Clearly categorize tasks to eliminate decision fatigue and stress',
    },
    {
      icon: LayoutGrid,
      title: 'Visual Organization',
      description: 'See all your tasks organized in an intuitive matrix view',
    },
  ];

  return (
    <div className="p-6 space-y-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
          <LayoutGrid className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Eisenhower Matrix</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          The proven task prioritization framework used by leaders worldwide. 
          Organize your tasks by importance and urgency to focus on what truly matters.
        </p>
      </div>

      {/* Matrix Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {quadrants.map((quadrant, index) => (
          <Card key={index} className={`${quadrant.color} border-2`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <quadrant.icon className="h-5 w-5" />
                <CardTitle className="text-lg">{quadrant.title}</CardTitle>
              </div>
              <Badge variant="outline" className="w-fit">{quadrant.subtitle}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{quadrant.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Benefits */}
      <div className="grid gap-6 md:grid-cols-3 mt-12">
        {benefits.map((benefit, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <benefit.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">{benefit.title}</CardTitle>
              <CardDescription>{benefit.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 mt-8">
        <CardContent className="py-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Unlock Task Prioritization</h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              This feature is part of the Decision Toolkit, available with premium programs. 
              Start organizing your tasks with the Eisenhower Matrix today.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/explore-programs')}>
                Explore Programs
              </Button>
              <Button variant="outline" onClick={() => navigate('/subscription')}>
                View Subscription Options
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
  goal_id: string | null;
}

interface Goal {
  id: string;
  title: string;
}

export default function Tasks() {
  // Track page view for analytics
  usePageView('Tasks');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("active"); // 'all', 'active', 'done'

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching tasks",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Filter tasks based on status filter
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return t.status !== "done";
    if (statusFilter === "done") return t.status === "done";
    return true;
  });

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const activeCount = tasks.filter((t) => t.status !== "done").length;

  const tasksByQuadrant = {
    important_urgent: filteredTasks.filter((t) => t.quadrant === "important_urgent"),
    important_not_urgent: filteredTasks.filter((t) => t.quadrant === "important_not_urgent"),
    not_important_urgent: filteredTasks.filter((t) => t.quadrant === "not_important_urgent"),
    not_important_not_urgent: filteredTasks.filter((t) => t.quadrant === "not_important_not_urgent"),
  };

  if (loading) {
    return <div className="p-6">Loading tasks...</div>;
  }

  return (
    <FeatureGate featureKey="decision_toolkit_basic" fallback={<TasksFallback />}>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Task Prioritization</h1>
            <p className="text-muted-foreground mt-1">Eisenhower Matrix for task management</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Active ({activeCount})
                  </div>
                </SelectItem>
                <SelectItem value="done">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Done ({doneCount})
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    All ({tasks.length})
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="flex-1 sm:flex-none">
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>Add a new task to your prioritization matrix</DialogDescription>
                </DialogHeader>
                <TaskForm onSuccess={() => { setDialogOpen(false); fetchTasks(); }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Eisenhower Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuadrantCard
            title="Do First"
            subtitle="Important & Urgent"
            tasks={tasksByQuadrant.important_urgent}
            color="destructive"
            onTaskClick={(id) => navigate(`/tasks/${id}`)}
          />
          <QuadrantCard
            title="Schedule"
            subtitle="Important & Not Urgent"
            tasks={tasksByQuadrant.important_not_urgent}
            color="default"
            onTaskClick={(id) => navigate(`/tasks/${id}`)}
          />
          <QuadrantCard
            title="Delegate"
            subtitle="Not Important & Urgent"
            tasks={tasksByQuadrant.not_important_urgent}
            color="secondary"
            onTaskClick={(id) => navigate(`/tasks/${id}`)}
          />
          <QuadrantCard
            title="Eliminate"
            subtitle="Not Important & Not Urgent"
            tasks={tasksByQuadrant.not_important_not_urgent}
            color="outline"
            onTaskClick={(id) => navigate(`/tasks/${id}`)}
          />
        </div>
      </div>
    </FeatureGate>
  );
}

function QuadrantCard({ 
  title, 
  subtitle, 
  tasks, 
  color, 
  onTaskClick 
}: { 
  title: string; 
  subtitle: string; 
  tasks: Task[]; 
  color: string;
  onTaskClick: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <div>{title}</div>
            <div className="text-sm font-normal text-muted-foreground">{subtitle}</div>
          </div>
          <Badge variant={color as any}>{tasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tasks.map((task) => {
            const isDone = task.status === "done";
            return (
              <div 
                key={task.id} 
                className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
                  isDone ? 'bg-primary/10 border-primary/30' : 'bg-card'
                }`}
                onClick={() => onTaskClick(task.id)}
              >
                <div className={`font-medium ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant={isDone ? "default" : "outline"} 
                    className="capitalize text-xs"
                  >
                    {task.status.replace("_", " ")}
                  </Badge>
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">Due: {task.due_date}</span>
                )}
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks in this quadrant</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: categories = [], isLoading: categoriesLoading } = useWheelCategories({ includeLegacy: false });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [goalId, setGoalId] = useState("");
  const [importance, setImportance] = useState(false);
  const [urgency, setUrgency] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  async function fetchGoals() {
    try {
      const { data, error } = await supabase
        .from("goals")
        .select("id, title")
        .eq("user_id", user?.id)
        .order("title");

      if (error) throw error;
      setGoals(data || []);
    } catch (error: any) {
      console.error("Error fetching goals:", error);
    }
  }

  function getQuadrant(imp: boolean, urg: boolean): "important_urgent" | "important_not_urgent" | "not_important_urgent" | "not_important_not_urgent" {
    if (imp && urg) return "important_urgent";
    if (imp && !urg) return "important_not_urgent";
    if (!imp && urg) return "not_important_urgent";
    return "not_important_not_urgent";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your task",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const cleanCategory = category && category !== "_none" ? category : null;
    const cleanGoalId = goalId && goalId !== "_none" ? goalId : null;
    
    try {
      const { error } = await supabase.from("tasks").insert([
        {
          user_id: user?.id,
          title,
          description,
          category: cleanCategory,
          goal_id: cleanGoalId,
          importance,
          urgency,
          quadrant: getQuadrant(importance, urgency),
          due_date: dueDate || null,
          source_type: cleanGoalId ? "goal" : "manual",
          status: "todo",
          is_private: isPrivate,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Task created",
        description: "Your task has been added successfully",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error creating task",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
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
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Life Area</Label>
        <Select value={category} onValueChange={setCategory} disabled={categoriesLoading}>
          <SelectTrigger>
            <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select life area (optional)"} />
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
        <Label htmlFor="goalId">Link to Goal</Label>
        <Select value={goalId} onValueChange={setGoalId}>
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

      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="importance">Important</Label>
        <Switch id="importance" checked={importance} onCheckedChange={setImportance} />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="urgency">Urgent</Label>
        <Switch id="urgency" checked={urgency} onCheckedChange={setUrgency} />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="isPrivate">Private Task</Label>
          <p className="text-xs text-muted-foreground">
            Only visible to you and admins
          </p>
        </div>
        <Switch id="isPrivate" checked={isPrivate} onCheckedChange={setIsPrivate} />
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
