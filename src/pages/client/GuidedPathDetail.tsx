import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Map,
  Target,
  Flag,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  BookOpen,
  Calendar,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { FeatureGate } from "@/components/FeatureGate";

interface TemplateTask {
  id: string;
  title: string;
  description: string | null;
  importance: boolean;
  urgency: boolean;
  order_index: number;
}

interface TemplateMilestone {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  recommended_days_min: number | null;
  recommended_days_optimal: number | null;
  recommended_days_max: number | null;
  guided_path_template_tasks: TemplateTask[];
}

// Valid goal categories from the database enum
type GoalCategory =
  | "family_home"
  | "financial_career"
  | "mental_educational"
  | "spiritual_ethical"
  | "social_cultural"
  | "physical_health"
  | "health_fitness"
  | "career_business"
  | "finances"
  | "relationships"
  | "personal_growth"
  | "fun_recreation"
  | "physical_environment"
  | "family_friends"
  | "romance"
  | "contribution";

const VALID_GOAL_CATEGORIES: GoalCategory[] = [
  "family_home",
  "financial_career",
  "mental_educational",
  "spiritual_ethical",
  "social_cultural",
  "physical_health",
  "health_fitness",
  "career_business",
  "finances",
  "relationships",
  "personal_growth",
  "fun_recreation",
  "physical_environment",
  "family_friends",
  "romance",
  "contribution",
];

// Default days to add when no recommended days are configured
const DEFAULT_MILESTONE_DAYS = 14;

interface TemplateGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  timeframe_type: string;
  priority: string;
  order_index: number;
  guided_path_template_milestones: TemplateMilestone[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  is_active: boolean;
  programs?: { id: string; name: string } | null;
  guided_path_template_goals: TemplateGoal[];
}

function getQuadrant(importance: boolean, urgency: boolean) {
  if (importance && urgency) return "important_urgent";
  if (importance && !urgency) return "important_not_urgent";
  if (!importance && urgency) return "not_important_urgent";
  return "not_important_not_urgent";
}

export default function GuidedPathDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  if (!id) return null;

  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paceType, setPaceType] = useState<"min" | "optimal" | "max">("optimal");

  const { data: template, isLoading } = useQuery({
    queryKey: ["guided-path-template-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guided_path_templates")
        .select(
          `
          *,
          programs(id, name),
          guided_path_template_goals(
            *,
            guided_path_template_milestones(
              *,
              guided_path_template_tasks(*)
            )
          )
        `,
        )
        .eq("id", id!)
        .single();

      if (error) throw error;

      // Sort nested data
      const sorted = {
        ...data,
        guided_path_template_goals: ((data.guided_path_template_goals || []) as TemplateGoal[])
          .sort((a: TemplateGoal, b: TemplateGoal) => a.order_index - b.order_index)
          .map((goal: TemplateGoal) => ({
            ...goal,
            guided_path_template_milestones: (goal.guided_path_template_milestones || [])
              .sort((a: TemplateMilestone, b: TemplateMilestone) => a.order_index - b.order_index)
              .map((milestone: TemplateMilestone) => ({
                ...milestone,
                guided_path_template_tasks: (milestone.guided_path_template_tasks || []).sort(
                  (a: TemplateTask, b: TemplateTask) => a.order_index - b.order_index,
                ),
              })),
          })),
      };

      // Expand all by default
      const goalIds = new Set(sorted.guided_path_template_goals.map((g: TemplateGoal) => g.id));
      const milestoneIds = new Set(
        sorted.guided_path_template_goals.flatMap((g: TemplateGoal) =>
          g.guided_path_template_milestones.map((m: TemplateMilestone) => m.id),
        ),
      );
      setExpandedGoals(goalIds);
      setExpandedMilestones(milestoneIds);

      return sorted as Template;
    },
    enabled: !!id && !!user,
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!template || !user) throw new Error("Missing data");

      const start = new Date(startDate);
      let currentDate = start;

      // Create goals, milestones, and tasks
      for (const templateGoal of template.guided_path_template_goals) {
        // Validate and normalize category
        const normalizedCategory: GoalCategory = VALID_GOAL_CATEGORIES.includes(
          templateGoal.category as GoalCategory,
        )
          ? (templateGoal.category as GoalCategory)
          : "personal_growth"; // Default fallback category

        // Create goal
        const { data: newGoal, error: goalError } = await supabase
          .from("goals")
          .insert({
            user_id: user.id,
            title: templateGoal.title,
            description: templateGoal.description,
            category: normalizedCategory,
            timeframe_type: templateGoal.timeframe_type,
            priority: templateGoal.priority,
            status: "active",
            progress_percentage: 0,
          })
          .select()
          .single();

        if (goalError) throw goalError;

        // Create milestones
        for (let mIdx = 0; mIdx < templateGoal.guided_path_template_milestones.length; mIdx++) {
          const templateMilestone = templateGoal.guided_path_template_milestones[mIdx];

          // Calculate due date based on recommended time and pace preference
          if (mIdx > 0) {
            const prevMilestone = templateGoal.guided_path_template_milestones[mIdx - 1];
            let daysToAdd = DEFAULT_MILESTONE_DAYS;
            if (paceType === "min" && prevMilestone.recommended_days_min) {
              daysToAdd = prevMilestone.recommended_days_min;
            } else if (paceType === "optimal" && prevMilestone.recommended_days_optimal) {
              daysToAdd = prevMilestone.recommended_days_optimal;
            } else if (paceType === "max" && prevMilestone.recommended_days_max) {
              daysToAdd = prevMilestone.recommended_days_max;
            } else {
              // Fallback priority: optimal > max > min > default
              daysToAdd =
                prevMilestone.recommended_days_optimal ||
                prevMilestone.recommended_days_max ||
                prevMilestone.recommended_days_min ||
                DEFAULT_MILESTONE_DAYS;
            }
            currentDate = addDays(currentDate, daysToAdd);
          }

          const { data: newMilestone, error: milestoneError } = await supabase
            .from("goal_milestones")
            .insert({
              goal_id: newGoal.id,
              title: templateMilestone.title,
              description: templateMilestone.description,
              status: "not_started",
              order_index: mIdx,
              due_date: format(currentDate, "yyyy-MM-dd"),
            })
            .select()
            .single();

          if (milestoneError) throw milestoneError;

          // Create tasks for each milestone
          for (const templateTask of templateMilestone.guided_path_template_tasks) {
            const { error: taskError } = await supabase.from("tasks").insert({
              user_id: user.id,
              title: templateTask.title,
              description: templateTask.description,
              status: "todo",
              importance: templateTask.importance,
              urgency: templateTask.urgency,
              quadrant: getQuadrant(templateTask.importance, templateTask.urgency),
              goal_id: newGoal.id,
              category: templateGoal.category,
              source_type: "goal",
            });

            if (taskError) throw taskError;
          }

          // Move date forward for next milestone based on pace
          let nextDays = 0;
          if (paceType === "min" && templateMilestone.recommended_days_min) {
            nextDays = templateMilestone.recommended_days_min;
          } else if (paceType === "optimal" && templateMilestone.recommended_days_optimal) {
            nextDays = templateMilestone.recommended_days_optimal;
          } else if (paceType === "max" && templateMilestone.recommended_days_max) {
            nextDays = templateMilestone.recommended_days_max;
          } else {
            nextDays =
              templateMilestone.recommended_days_optimal ||
              templateMilestone.recommended_days_max ||
              templateMilestone.recommended_days_min ||
              0;
          }
          if (nextDays > 0) {
            currentDate = addDays(currentDate, nextDays);
          }
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Path Copied!",
        description:
          "Your goals, milestones, and tasks have been created. Visit your Goals page to see them.",
      });
      setCopyDialogOpen(false);
      navigate("/goals");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleGoal = (goalId: string) => {
    const newSet = new Set(expandedGoals);
    if (newSet.has(goalId)) newSet.delete(goalId);
    else newSet.add(goalId);
    setExpandedGoals(newSet);
  };

  const toggleMilestone = (milestoneId: string) => {
    const newSet = new Set(expandedMilestones);
    if (newSet.has(milestoneId)) newSet.delete(milestoneId);
    else newSet.add(milestoneId);
    setExpandedMilestones(newSet);
  };

  const formatTimeDistance = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    if (min && max) {
      if (min >= 30 && max >= 30) {
        const minMonths = Math.round(min / 30);
        const maxMonths = Math.round(max / 30);
        return `${minMonths}-${maxMonths} months`;
      }
      if (min >= 7 && max >= 7) {
        const minWeeks = Math.round(min / 7);
        const maxWeeks = Math.round(max / 7);
        return `${minWeeks}-${maxWeeks} weeks`;
      }
      return `${min}-${max} days`;
    }
    const days = min || max;
    if (days! >= 30) return `~${Math.round(days! / 30)} months`;
    if (days! >= 7) return `~${Math.round(days! / 7)} weeks`;
    return `~${days} days`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <Map className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Template Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested guided path could not be found</p>
        <Button onClick={() => navigate("/guided-paths")}>Back to Guided Paths</Button>
      </div>
    );
  }

  const totalGoals = template.guided_path_template_goals.length;
  const totalMilestones = template.guided_path_template_goals.reduce(
    (sum, g) => sum + g.guided_path_template_milestones.length,
    0,
  );
  const totalTasks = template.guided_path_template_goals.reduce(
    (sum, g) =>
      sum +
      g.guided_path_template_milestones.reduce(
        (mSum, m) => mSum + m.guided_path_template_tasks.length,
        0,
      ),
    0,
  );

  return (
    <FeatureGate featureKey="guided_paths">
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/guided-paths">Guided Paths</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{template.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Map className="h-8 w-8" />
              {template.name}
            </h1>
            {template.description && (
              <p className="text-muted-foreground mt-1">{template.description}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              {template.programs?.name ? (
                <Badge variant="outline">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {template.programs.name}
                </Badge>
              ) : (
                <Badge variant="secondary">General Path</Badge>
              )}
            </div>
          </div>
          <Button size="lg" onClick={() => setCopyDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy This Path
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Target className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold">{totalGoals}</div>
              <div className="text-sm text-muted-foreground">Goals</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Flag className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <div className="text-2xl font-bold">{totalMilestones}</div>
              <div className="text-sm text-muted-foreground">Milestones</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckSquare className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold">{totalTasks}</div>
              <div className="text-sm text-muted-foreground">Tasks</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Path Overview</CardTitle>
            <CardDescription>
              Review the goals, milestones, and tasks included in this path
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {template.guided_path_template_goals.map((goal) => (
              <Collapsible
                key={goal.id}
                open={expandedGoals.has(goal.id)}
                onOpenChange={() => toggleGoal(goal.id)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        {expandedGoals.has(goal.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Target className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">{goal.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {goal.timeframe_type.replace("_", " ")} • {goal.priority} priority
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {goal.guided_path_template_milestones.length} milestones
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
                      {goal.description && (
                        <p className="text-sm text-muted-foreground">{goal.description}</p>
                      )}
                      <div className="space-y-2 ml-4">
                        {goal.guided_path_template_milestones.map((milestone, mIdx) => (
                          <Collapsible
                            key={milestone.id}
                            open={expandedMilestones.has(milestone.id)}
                            onOpenChange={() => toggleMilestone(milestone.id)}
                          >
                            <div className="border rounded-lg bg-background">
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                                  <div className="flex items-center gap-3">
                                    {expandedMilestones.has(milestone.id) ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                    <Flag className="h-4 w-4 text-amber-500" />
                                    <div>
                                      <div className="font-medium text-sm">{milestone.title}</div>
                                      {(milestone.recommended_days_min ||
                                        milestone.recommended_days_max) && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {mIdx > 0 ? "After previous: " : "Start: "}
                                          {formatTimeDistance(
                                            milestone.recommended_days_min,
                                            milestone.recommended_days_max,
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {milestone.guided_path_template_tasks.length} tasks
                                  </Badge>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t px-3 py-2 bg-muted/20 space-y-1">
                                  {milestone.description && (
                                    <p className="text-xs text-muted-foreground mb-2">
                                      {milestone.description}
                                    </p>
                                  )}
                                  {milestone.guided_path_template_tasks.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No tasks</p>
                                  ) : (
                                    milestone.guided_path_template_tasks.map((task) => (
                                      <div
                                        key={task.id}
                                        className="flex items-center gap-2 p-2 border rounded bg-background"
                                      >
                                        <CheckSquare className="h-3 w-3 text-blue-500" />
                                        <span className="text-sm flex-1">{task.title}</span>
                                        {(task.importance || task.urgency) && (
                                          <div className="flex gap-1">
                                            {task.importance && (
                                              <Badge variant="secondary" className="text-xs">
                                                Important
                                              </Badge>
                                            )}
                                            {task.urgency && (
                                              <Badge variant="secondary" className="text-xs">
                                                Urgent
                                              </Badge>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copy This Path</DialogTitle>
              <DialogDescription>
                This will create {totalGoals} goal{totalGoals !== 1 ? "s" : ""}, {totalMilestones}{" "}
                milestone{totalMilestones !== 1 ? "s" : ""}, and {totalTasks} task
                {totalTasks !== 1 ? "s" : ""} for you to personalize.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  <Clock className="h-4 w-4 inline mr-2" />
                  Pace
                </Label>
                <RadioGroup
                  value={paceType}
                  onValueChange={(val) => setPaceType(val as "min" | "optimal" | "max")}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="min" id="pace-min" />
                    <Label htmlFor="pace-min" className="cursor-pointer flex-1">
                      <span className="font-medium">Fast</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        Minimum recommended time
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="optimal" id="pace-optimal" />
                    <Label htmlFor="pace-optimal" className="cursor-pointer flex-1">
                      <span className="font-medium">Balanced</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        Optimal pace (recommended)
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="max" id="pace-max" />
                    <Label htmlFor="pace-max" className="cursor-pointer flex-1">
                      <span className="font-medium">Relaxed</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        Maximum time per milestone
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Milestone due dates will be calculated based on this pace and the start date.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending}>
                {copyMutation.isPending ? "Creating..." : "Create My Path"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}
