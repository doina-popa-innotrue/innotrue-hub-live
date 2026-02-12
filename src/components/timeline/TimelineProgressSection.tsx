import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Target,
  CheckSquare,
  Flag,
  Trophy,
  Sparkles,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  format,
  subDays,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type TimeRange = "7d" | "30d" | "90d" | "6m" | "1y";

interface CompletedItem {
  id: string;
  type: "goal" | "milestone" | "task";
  title: string;
  completed_at: string;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
];

const chartConfig = {
  goals: {
    label: "Goals",
    color: "hsl(var(--success))",
  },
  milestones: {
    label: "Milestones",
    color: "hsl(var(--chart-2))",
  },
  tasks: {
    label: "Tasks",
    color: "hsl(var(--chart-4))",
  },
};

export function TimelineProgressSection() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const getStartDate = (range: TimeRange): Date => {
    const now = new Date();
    switch (range) {
      case "7d":
        return subDays(now, 7);
      case "30d":
        return subDays(now, 30);
      case "90d":
        return subDays(now, 90);
      case "6m":
        return subMonths(now, 6);
      case "1y":
        return subMonths(now, 12);
    }
  };

  const startDate = getStartDate(timeRange);

  // Fetch completed goals
  const { data: completedGoals = [] } = useQuery({
    queryKey: ["completed-goals", user?.id, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, title, updated_at")
        .eq("user_id", user?.id ?? "")
        .in("status", ["completed", "done"])
        .gte("updated_at", startDate.toISOString());

      if (error) throw error;
      return (data || []).map((g) => ({
        id: g.id,
        type: "goal" as const,
        title: g.title,
        completed_at: g.updated_at,
      }));
    },
    enabled: !!user && isOpen,
  });

  // Fetch completed milestones
  const { data: completedMilestones = [] } = useQuery({
    queryKey: ["completed-milestones", user?.id, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_milestones")
        .select(
          `
          id, 
          title, 
          created_at,
          goals!inner(user_id)
        `,
        )
        .eq("goals.user_id", user?.id ?? "")
        .in("status", ["completed", "done"])
        .gte("created_at", startDate.toISOString());

      if (error) throw error;
      return (data || []).map((m) => ({
        id: m.id,
        type: "milestone" as const,
        title: m.title,
        completed_at: m.created_at,
      }));
    },
    enabled: !!user && isOpen,
  });

  // Fetch completed tasks
  const { data: completedTasks = [] } = useQuery({
    queryKey: ["completed-tasks", user?.id, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, created_at")
        .eq("user_id", user?.id ?? "")
        .eq("status", "done")
        .gte("created_at", startDate.toISOString());

      if (error) throw error;
      return (data || []).map((t) => ({
        id: t.id,
        type: "task" as const,
        title: t.title,
        completed_at: t.created_at,
      }));
    },
    enabled: !!user && isOpen,
  });

  // Combine all completed items
  const allCompleted: CompletedItem[] = useMemo(() => {
    return [...completedGoals, ...completedMilestones, ...completedTasks].filter(
      (item): item is CompletedItem => item.completed_at != null,
    );
  }, [completedGoals, completedMilestones, completedTasks]);

  // Calculate weekly data for chart
  const weeklyData = useMemo(() => {
    const weeks: {
      week: string;
      goals: number;
      milestones: number;
      tasks: number;
      total: number;
    }[] = [];
    const now = new Date();
    const numWeeks =
      timeRange === "7d"
        ? 1
        : timeRange === "30d"
          ? 4
          : timeRange === "90d"
            ? 12
            : timeRange === "6m"
              ? 24
              : 52;

    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i));
      const weekEnd = endOfWeek(subWeeks(now, i));

      const weekItems = allCompleted.filter((item) => {
        const completedDate = parseISO(item.completed_at);
        return isWithinInterval(completedDate, { start: weekStart, end: weekEnd });
      });

      weeks.push({
        week: format(weekStart, "MMM d"),
        goals: weekItems.filter((i) => i.type === "goal").length,
        milestones: weekItems.filter((i) => i.type === "milestone").length,
        tasks: weekItems.filter((i) => i.type === "task").length,
        total: weekItems.length,
      });
    }

    return weeks;
  }, [allCompleted, timeRange]);

  // Stats summary
  const stats = useMemo(
    () => ({
      totalCompleted: allCompleted.length,
      goalsCompleted: completedGoals.length,
      milestonesCompleted: completedMilestones.length,
      tasksCompleted: completedTasks.length,
    }),
    [allCompleted, completedGoals, completedMilestones, completedTasks],
  );

  const hasProgress = stats.totalCompleted > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed border-secondary/30 dark:border-secondary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/5 dark:hover:bg-secondary/10 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10 dark:bg-secondary/20">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Your Progress
                    {hasProgress && isOpen && (
                      <Badge
                        variant="outline"
                        className="ml-2 border-green-400 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950/50 dark:text-green-300"
                      >
                        <Trophy className="h-3 w-3 mr-1" />
                        {stats.totalCompleted} completed
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {isOpen ? "See what you've accomplished" : "Click to view your achievements"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-secondary">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Time Range Selector */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Time Period</span>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasProgress ? (
              <>
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-700">
                    <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                        {stats.goalsCompleted}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">Goals Achieved</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/10 dark:bg-secondary/20 border border-secondary/40 dark:border-secondary/30">
                    <Flag className="h-5 w-5 text-secondary" />
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {stats.milestonesCompleted}
                      </p>
                      <p className="text-xs text-muted-foreground">Milestones Hit</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-ring/10 dark:bg-ring/20 border border-ring/40 dark:border-ring/30">
                    <CheckSquare className="h-5 w-5 text-ring" />
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.tasksCompleted}</p>
                      <p className="text-xs text-muted-foreground">Tasks Done</p>
                    </div>
                  </div>
                </div>

                {/* Progress Chart */}
                <div className="h-[200px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart
                      data={weeklyData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="goals"
                        stackId="a"
                        fill="var(--color-goals)"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="milestones"
                        stackId="a"
                        fill="var(--color-milestones)"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="tasks"
                        stackId="a"
                        fill="var(--color-tasks)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-success" />
                    <span className="text-muted-foreground">Goals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-secondary" />
                    <span className="text-muted-foreground">Milestones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-ring" />
                    <span className="text-muted-foreground">Tasks</span>
                  </div>
                </div>

                {/* Encouragement message */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-700 text-sm">
                  <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="text-green-800 dark:text-green-200">
                    {stats.totalCompleted >= 10
                      ? "Amazing progress! You're building real momentum."
                      : stats.totalCompleted >= 5
                        ? "Great work! Every completed item is a step forward."
                        : "You're on your way! Keep building those habits."}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No completed items yet in this period</p>
                <p className="text-sm mt-1">
                  Complete goals, milestones, or tasks to see your progress here
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
