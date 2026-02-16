import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { User } from "lucide-react";

interface SharedTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  importance: boolean | null;
  urgency: boolean | null;
  quadrant: string | null;
  due_date: string | null;
  user_id: string;
  profiles: {
    name: string;
  };
}

export default function CoachingTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  if (!user) return null;
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      fetchSharedTasks();
    }
  }, [user]);

  async function fetchSharedTasks() {
    try {
      // First get client IDs for this coach
      const { data: coachClients, error: coachError } = await supabase
        .from("client_coaches")
        .select("client_id")
        .eq("coach_id", user.id);

      if (coachError) throw coachError;

      const clientIds = coachClients?.map((cc) => cc.client_id) || [];

      if (clientIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // Get tasks shared by these clients
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          profiles!tasks_user_id_fkey (name)
        `,
        )
        .eq("shared_with_coach", true)
        .in("user_id", clientIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error fetching shared tasks",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const tasksByQuadrant = {
    important_urgent: filteredTasks.filter((t) => t.quadrant === "important_urgent"),
    important_not_urgent: filteredTasks.filter((t) => t.quadrant === "important_not_urgent"),
    not_important_urgent: filteredTasks.filter((t) => t.quadrant === "not_important_urgent"),
    not_important_not_urgent: filteredTasks.filter(
      (t) => t.quadrant === "not_important_not_urgent",
    ),
  };

  if (loading) {
    return <PageLoadingState message="Loading shared tasks..." />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Shared Tasks</h1>
        <p className="text-muted-foreground mt-1">
          Tasks your clients have shared with you for guidance
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <Badge variant="outline">{filteredTasks.length} shared</Badge>
      </div>

      {/* Eisenhower Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuadrantCard
          title="Do First"
          subtitle="Important & Urgent"
          tasks={tasksByQuadrant.important_urgent}
          color="destructive"
        />
        <QuadrantCard
          title="Schedule"
          subtitle="Important & Not Urgent"
          tasks={tasksByQuadrant.important_not_urgent}
          color="default"
        />
        <QuadrantCard
          title="Delegate"
          subtitle="Not Important & Urgent"
          tasks={tasksByQuadrant.not_important_urgent}
          color="secondary"
        />
        <QuadrantCard
          title="Eliminate"
          subtitle="Not Important & Not Urgent"
          tasks={tasksByQuadrant.not_important_not_urgent}
          color="outline"
        />
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No shared tasks to display</p>
          <p className="text-sm mt-1">Your clients haven't shared any tasks with you yet</p>
        </div>
      )}
    </div>
  );
}

function QuadrantCard({
  title,
  subtitle,
  tasks,
  color,
}: {
  title: string;
  subtitle: string;
  tasks: SharedTask[];
  color: string;
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
          {tasks.map((task) => (
            <div key={task.id} className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <User className="h-3 w-3" />
                <span>{task.profiles.name}</span>
              </div>
              <div className="font-medium">{task.title}</div>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="capitalize text-xs">
                  {task.status.replace("_", " ")}
                </Badge>
                {task.due_date && (
                  <span className="text-xs text-muted-foreground">Due: {task.due_date}</span>
                )}
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tasks in this quadrant
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
