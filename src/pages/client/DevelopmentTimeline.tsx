import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Target,
  Flag,
  CheckSquare,
  Calendar,
  Clock,
  Filter,
  Loader2,
  Home,
  GitBranch,
} from "lucide-react";
import { TimelineProgressSection } from "@/components/timeline/TimelineProgressSection";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { FeatureGate } from "@/components/FeatureGate";
import { useCategoryLookup } from "@/hooks/useWheelCategories";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  target_date: string | null;
  status: string;
  progress_percentage: number;
}

interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  category: string | null;
  goal_title?: string;
  goal_category?: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  goal_id: string | null;
  category: string | null;
  goal_title?: string;
  goal_category?: string;
}

interface TimelineItem {
  id: string;
  type: "goal" | "milestone" | "task";
  title: string;
  description: string | null;
  date: string | null;
  status: string;
  category: string | null;
  parentId?: string;
  parentTitle?: string;
  progress?: number;
}

const TYPE_ICONS = {
  goal: Target,
  milestone: Flag,
  task: CheckSquare,
};

const TYPE_COLORS = {
  goal: "bg-primary/15 text-primary",
  milestone: "bg-chart-2/15 text-chart-2",
  task: "bg-chart-4/15 text-chart-4",
};

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  paused: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
  active: "bg-primary/15 text-primary",
  "on-hold": "bg-warning/15 text-warning",
  retired: "bg-muted text-muted-foreground",
};

export default function DevelopmentTimeline() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Filters
  const [showGoals, setShowGoals] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch goals
      const { data: goalsData, error: goalsError } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("target_date", { ascending: true, nullsFirst: false });

      if (goalsError) throw goalsError;
      setGoals(goalsData || []);

      // Fetch milestones with goal info
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("goal_milestones")
        .select(
          `
          *,
          goals!inner(title, category, user_id)
        `,
        )
        .eq("goals.user_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (milestonesError) throw milestonesError;
      const formattedMilestones = (milestonesData || []).map((m) => ({
        ...m,
        goal_title: m.goals?.title,
        goal_category: m.goals?.category,
      }));
      setMilestones(formattedMilestones);

      // Fetch tasks with goal info
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(
          `
          *,
          goals(title, category)
        `,
        )
        .eq("user_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (tasksError) throw tasksError;
      const formattedTasks = (tasksData || []).map((t) => ({
        ...t,
        goal_title: t.goals?.title,
        goal_category: t.goals?.category,
      }));
      setTasks(formattedTasks);
    } catch (error) {
      console.error("Error fetching timeline data:", error);
      toast.error("Failed to load timeline data");
    } finally {
      setLoading(false);
    }
  };

  // Build timeline items
  const timelineItems = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [];

    if (showGoals) {
      goals.forEach((goal) => {
        items.push({
          id: goal.id,
          type: "goal",
          title: goal.title,
          description: goal.description,
          date: goal.target_date,
          status: goal.status,
          category: goal.category,
          progress: goal.progress_percentage,
        });
      });
    }

    if (showMilestones) {
      milestones.forEach((milestone) => {
        items.push({
          id: milestone.id,
          type: "milestone",
          title: milestone.title,
          description: milestone.description,
          date: milestone.due_date,
          status: milestone.status,
          // Prefer milestone's own category, fallback to goal's category
          category: milestone.category || milestone.goal_category || null,
          parentId: milestone.goal_id,
          parentTitle: milestone.goal_title,
        });
      });
    }

    if (showTasks) {
      tasks.forEach((task) => {
        items.push({
          id: task.id,
          type: "task",
          title: task.title,
          description: task.description,
          date: task.due_date,
          status: task.status,
          // Prefer task's own category, fallback to goal's category
          category: task.category || task.goal_category || null,
          parentId: task.goal_id || undefined,
          parentTitle: task.goal_title,
        });
      });
    }

    return items;
  }, [goals, milestones, tasks, showGoals, showMilestones, showTasks]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return timelineItems.filter((item) => {
      // Category filter
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all") {
        if (selectedStatus === "active" && ["completed", "done", "retired"].includes(item.status)) {
          return false;
        }
        if (selectedStatus === "completed" && !["completed", "done"].includes(item.status)) {
          return false;
        }
      }
      return true;
    });
  }, [timelineItems, selectedCategory, selectedStatus]);

  // Split into dated and undated
  const { datedItems, undatedItems } = useMemo(() => {
    const dated = filteredItems.filter((item) => item.date);
    const undated = filteredItems.filter((item) => !item.date);

    // Sort dated items by date
    dated.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return { datedItems: dated, undatedItems: undated };
  }, [filteredItems]);

  // Group dated items by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {};
    const today = startOfDay(new Date());

    datedItems.forEach((item) => {
      if (!item.date) return;
      const date = parseISO(item.date);
      const monthKey = format(date, "MMMM yyyy");

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(item);
    });

    return groups;
  }, [datedItems]);
  const { labels: categoryLabels, categories: wheelCategories } = useCategoryLookup();

  const getCategoryLabel = (category: string | null) => {
    if (!category) return "Uncategorized";
    return categoryLabels[category] || category;
  };

  const handleItemClick = (item: TimelineItem) => {
    if (item.type === "goal") {
      navigate(`/goals/${item.id}`);
    } else if (item.type === "milestone" && item.parentId) {
      navigate(`/goals/${item.parentId}`);
    } else if (item.type === "task") {
      navigate(`/tasks/${item.id}`);
    }
  };

  if (loading) {
    return <PageLoadingState />;
  }

  return (
    <FeatureGate
      featureKey="goals"
      fallback={<div className="p-6">Goals feature is not available on your plan.</div>}
    >
      <div className="space-y-6">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard" className="flex items-center gap-1">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1">
                <GitBranch className="h-4 w-4" />
                Timeline
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Development Timeline</h1>
              <p className="text-muted-foreground">
                View your goals, milestones, and tasks over time
              </p>
            </div>
          </div>
        </div>

        {/* Progress Section - Collapsible */}
        <TimelineProgressSection />

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Filters Sidebar */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Type Filters */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Show Types</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show-goals"
                      checked={showGoals}
                      onCheckedChange={(checked) => setShowGoals(checked === true)}
                    />
                    <Label
                      htmlFor="show-goals"
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Target className="h-4 w-4 text-primary" />
                      Goals
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show-milestones"
                      checked={showMilestones}
                      onCheckedChange={(checked) => setShowMilestones(checked === true)}
                    />
                    <Label
                      htmlFor="show-milestones"
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Flag className="h-4 w-4 text-chart-2" />
                      Milestones
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show-tasks"
                      checked={showTasks}
                      onCheckedChange={(checked) => setShowTasks(checked === true)}
                    />
                    <Label
                      htmlFor="show-tasks"
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <CheckSquare className="h-4 w-4 text-chart-3" />
                      Tasks
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Category Filter */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Life Area</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {(wheelCategories || [])
                      .filter((c) => !c.is_legacy)
                      .map((cat) => (
                        <SelectItem key={cat.key} value={cat.key}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Status Filter */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="completed">Completed Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary */}
              <Separator />
              <div className="text-sm text-muted-foreground">
                <p>Showing {filteredItems.length} items</p>
                <p>
                  {datedItems.length} with dates, {undatedItems.length} unplanned
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Content */}
          <div className="space-y-6">
            {/* Dated Items - Timeline */}
            {Object.keys(groupedByMonth).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Planned Timeline
                  </CardTitle>
                  <CardDescription>Items with scheduled dates</CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <ScrollArea className="h-[calc(100vh-320px)] min-h-[400px] pr-4">
                    <div className="space-y-6 pb-4">
                      {Object.entries(groupedByMonth).map(([month, items]) => (
                        <div key={month}>
                          <h3 className="font-semibold text-lg mb-3 sticky top-0 bg-background py-2 border-b">
                            {month}
                          </h3>
                          <div className="space-y-3 pl-4 border-l-2 border-border">
                            {items.map((item) => {
                              const Icon = TYPE_ICONS[item.type];
                              const isPast =
                                item.date && isBefore(parseISO(item.date), startOfDay(new Date()));
                              const isCompleted = ["completed", "done"].includes(item.status);

                              return (
                                <div
                                  key={`${item.type}-${item.id}`}
                                  className="relative pl-6 pb-3 cursor-pointer hover:bg-accent/50 rounded-lg p-3 -ml-4 transition-colors"
                                  onClick={() => handleItemClick(item)}
                                >
                                  <div
                                    className={`absolute left-0 top-4 w-3 h-3 rounded-full -translate-x-[7px] ${
                                      isCompleted
                                        ? "bg-green-500"
                                        : isPast
                                          ? "bg-destructive"
                                          : "bg-primary"
                                    }`}
                                  />

                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className={TYPE_COLORS[item.type]}>
                                          <Icon className="h-3 w-3 mr-1" />
                                          {item.type}
                                        </Badge>
                                        <Badge
                                          variant="outline"
                                          className={STATUS_COLORS[item.status] || "bg-secondary"}
                                        >
                                          {item.status.replace("_", " ")}
                                        </Badge>
                                      </div>
                                      <h4 className="font-medium truncate">{item.title}</h4>
                                      {item.parentTitle && (
                                        <p className="text-xs text-muted-foreground">
                                          Goal: {item.parentTitle}
                                        </p>
                                      )}
                                      {item.category && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {getCategoryLabel(item.category)}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                                      {item.date && format(parseISO(item.date), "MMM d")}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {/* Scroll fade indicator */}
                  <div className="absolute bottom-0 left-0 right-4 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                </CardContent>
              </Card>
            )}

            {/* Undated Items */}
            {undatedItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Not Yet Planned
                  </CardTitle>
                  <CardDescription>Items without scheduled dates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {undatedItems.map((item) => {
                      const Icon = TYPE_ICONS[item.type];
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleItemClick(item)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={TYPE_COLORS[item.type]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {item.type}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={STATUS_COLORS[item.status] || "bg-secondary"}
                            >
                              {item.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-sm truncate">{item.title}</h4>
                          {item.parentTitle && (
                            <p className="text-xs text-muted-foreground truncate">
                              Goal: {item.parentTitle}
                            </p>
                          )}
                          {item.category && (
                            <p className="text-xs text-muted-foreground">
                              {getCategoryLabel(item.category)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {filteredItems.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No items to display</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {timelineItems.length === 0
                      ? "You haven't created any goals, milestones, or tasks yet."
                      : "No items match your current filters."}
                  </p>
                  {timelineItems.length === 0 && (
                    <Button onClick={() => navigate("/goals")}>Create a Goal</Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
