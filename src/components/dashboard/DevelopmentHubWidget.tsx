import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Brain, CheckSquare, ChevronRight, Sparkles } from "lucide-react";

interface Goal {
  id: string;
  title: string;
  category: string;
  status: string;
  progress_percentage: number;
}

interface Decision {
  id: string;
  title: string;
  status: string;
  importance: string;
  urgency: string;
  decision_date: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  quadrant: string;
}

interface DevelopmentHubWidgetProps {
  goals: Goal[];
  decisions: Decision[];
  tasks: Task[];
}

export function DevelopmentHubWidget({ goals, decisions, tasks }: DevelopmentHubWidgetProps) {
  const navigate = useNavigate();

  const topGoal = goals[0];
  const topDecision = decisions[0];
  const topTask = tasks[0];

  const highPriorityDecisions = decisions.filter(
    (d) => d.importance === "high" || d.importance === "critical",
  ).length;

  const urgentTasks = tasks.filter(
    (t) => t.quadrant === "do_first" || t.quadrant === "schedule",
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Development Hub
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {/* Goals */}
          <div
            className="p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => navigate("/goals")}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-chart-1/15">
                  <Target className="h-4 w-4 text-chart-1" />
                </div>
                <span className="font-medium">Goals</span>
              </div>
              <Badge variant="secondary" className="text-lg font-bold">
                {goals.length}
              </Badge>
            </div>
            {topGoal ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground line-clamp-1">Top: {topGoal.title}</p>
                <p className="text-xs text-muted-foreground">
                  {topGoal.progress_percentage}% complete
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active goals</p>
            )}
            <Button variant="ghost" size="sm" className="w-full mt-3 text-xs">
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {/* Decisions */}
          <div
            className="p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => navigate("/decisions")}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-chart-2/15">
                  <Brain className="h-4 w-4 text-chart-2" />
                </div>
                <span className="font-medium">Decisions</span>
              </div>
              <Badge variant="secondary" className="text-lg font-bold">
                {decisions.length}
              </Badge>
            </div>
            {topDecision ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground line-clamp-1">
                  Top: {topDecision.title}
                </p>
                {highPriorityDecisions > 0 && (
                  <p className="text-xs text-destructive">{highPriorityDecisions} high priority</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active decisions</p>
            )}
            <Button variant="ghost" size="sm" className="w-full mt-3 text-xs">
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {/* Tasks */}
          <div
            className="p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => navigate("/tasks")}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-chart-3/15">
                  <CheckSquare className="h-4 w-4 text-chart-3" />
                </div>
                <span className="font-medium">Tasks</span>
              </div>
              <Badge variant="secondary" className="text-lg font-bold">
                {tasks.length}
              </Badge>
            </div>
            {topTask ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground line-clamp-1">Next: {topTask.title}</p>
                {urgentTasks > 0 && <p className="text-xs text-warning">{urgentTasks} urgent</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming tasks</p>
            )}
            <Button variant="ghost" size="sm" className="w-full mt-3 text-xs">
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
