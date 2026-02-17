import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  UserCircle,
  CircleDot,
  Target,
  Brain,
  CheckSquare,
  Lightbulb,
  GitBranch,
  ChevronRight,
  Check,
  Compass,
  Lock,
  BookOpen,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface JourneyProgressWidgetProps {
  userName?: string;
  hasProfileName: boolean;
  hasEnrollments: boolean;
}

const WELCOME_DISMISS_KEY = "innotrue_welcome_dismissed";

export function JourneyProgressWidget({
  userName,
  hasProfileName,
  hasEnrollments,
}: JourneyProgressWidgetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasFeature } = useEntitlements();

  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Check Wheel of Life completion
  const { data: hasWheelData } = useQuery({
    queryKey: ["journey-wheel", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count } = await supabase
        .from("wheel_of_life_snapshots")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      return (count || 0) > 0;
    },
    enabled: !!user,
  });

  // Check Goals completion
  const { data: hasGoals } = useQuery({
    queryKey: ["journey-goals", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count } = await supabase
        .from("goals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      return (count || 0) > 0;
    },
    enabled: !!user,
  });

  // Check Decisions
  const { data: hasDecisions } = useQuery({
    queryKey: ["journey-decisions", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count } = await supabase
        .from("decisions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      return (count || 0) > 0;
    },
    enabled: !!user,
  });

  // Check Tasks
  const { data: hasTasks } = useQuery({
    queryKey: ["journey-tasks", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      return (count || 0) > 0;
    },
    enabled: !!user,
  });

  // Check Development Items
  const { data: hasDevItems } = useQuery({
    queryKey: ["journey-dev-items", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count } = await supabase
        .from("development_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      return (count || 0) > 0;
    },
    enabled: !!user,
  });

  const journeySteps = [
    {
      id: "profile",
      title: "Profile",
      subtitle: "Set up your profile",
      icon: UserCircle,
      url: "/account",
      completed: hasProfileName,
      featureKey: undefined,
    },
    {
      id: "wheel",
      title: "Assess",
      subtitle: "Where am I now?",
      icon: CircleDot,
      url: "/wheel-of-life",
      completed: hasWheelData,
      featureKey: undefined,
    },
    {
      id: "goals",
      title: "Set Goals",
      subtitle: "Where do I want to go?",
      icon: Target,
      url: "/goals",
      completed: hasGoals,
      featureKey: undefined,
    },
    {
      id: "enroll",
      title: "Enroll",
      subtitle: "Find a program",
      icon: BookOpen,
      url: "/explore-programs",
      completed: hasEnrollments,
      featureKey: undefined,
    },
    {
      id: "decisions",
      title: "Decide",
      subtitle: "What path will I take?",
      icon: Brain,
      url: "/decisions",
      completed: hasDecisions,
      featureKey: "decision_toolkit_basic",
    },
    {
      id: "tasks",
      title: "Act",
      subtitle: "What will I do today?",
      icon: CheckSquare,
      url: "/tasks",
      completed: hasTasks,
      featureKey: "decision_toolkit_basic",
    },
    {
      id: "reflect",
      title: "Reflect",
      subtitle: "What am I learning?",
      icon: Lightbulb,
      url: "/development-items",
      completed: hasDevItems,
      featureKey: undefined,
    },
    {
      id: "review",
      title: "Review",
      subtitle: "How far have I come?",
      icon: GitBranch,
      url: "/development-timeline",
      completed: hasDevItems, // Timeline is useful once you have items
      featureKey: undefined,
    },
  ];

  const isStepLocked = (step: (typeof journeySteps)[0]): boolean => {
    if (!step.featureKey) return false;
    return !hasFeature(step.featureKey);
  };

  const handleStepClick = (step: (typeof journeySteps)[0]) => {
    if (isStepLocked(step)) {
      toast.info(`${step.title} is a premium feature`, {
        description: "Upgrade your plan or enroll in a program to unlock this step.",
        action: {
          label: "View Options",
          onClick: () => navigate("/subscription"),
        },
      });
      return;
    }
    navigate(step.url);
  };

  const handleDismissWelcome = () => {
    setWelcomeDismissed(true);
    try {
      localStorage.setItem(WELCOME_DISMISS_KEY, "true");
    } catch {
      // ignore storage errors
    }
  };

  const completedCount = journeySteps.filter((s) => s.completed).length;
  const nextStep = journeySteps.find((s) => !s.completed && !isStepLocked(s));
  const allComplete = completedCount === journeySteps.length;

  // Show welcome greeting for new users (not all steps done + not dismissed)
  const showWelcome = !welcomeDismissed && !allComplete && completedCount < 4;
  const greeting = userName ? `Welcome, ${userName}!` : "Welcome to InnoTrue!";

  return (
    <Card className="overflow-hidden border-secondary/20 dark:border-secondary/15">
      <CardHeader className="pb-3 bg-gradient-to-r from-secondary/5 to-transparent dark:from-secondary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-secondary" />
            <CardTitle className="text-lg">Your Growth Journey</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="text-xs border-secondary/40 bg-secondary/10 text-secondary dark:border-secondary/30"
          >
            {completedCount}/{journeySteps.length} steps
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Welcome greeting for new users */}
        {showWelcome && (
          <div className="flex items-start justify-between mb-4 p-3 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{greeting}</p>
                <p className="text-xs text-muted-foreground">
                  Follow these steps to get started on your growth journey.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleDismissWelcome}
              aria-label="Dismiss welcome message"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Journey Flow Visualization */}
        <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2 gap-1 sm:gap-0">
          <TooltipProvider delayDuration={300}>
            {journeySteps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = step.completed;
              const isNext = step.id === nextStep?.id;
              const isLocked = isStepLocked(step);

              const stepButton = (
                <button
                  onClick={() => handleStepClick(step)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-lg transition-all min-w-[50px] sm:min-w-[60px]",
                    isLocked && "opacity-60 cursor-not-allowed",
                    !isLocked && isCompleted && "text-green-700 dark:text-green-300",
                    !isLocked && isNext && "ring-2 ring-secondary ring-offset-2",
                    !isLocked && !isCompleted && !isNext && "text-muted-foreground",
                    !isLocked && "hover:bg-accent",
                  )}
                >
                  <div
                    className={cn(
                      "relative p-1.5 sm:p-2 rounded-full",
                      isLocked && "bg-muted",
                      !isLocked && isCompleted && "bg-green-100 dark:bg-green-900/50",
                      !isLocked && isNext && "bg-secondary/15 dark:bg-secondary/25",
                      !isLocked && !isCompleted && !isNext && "bg-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {isLocked && (
                      <div className="absolute -top-1 -right-1 bg-muted-foreground text-background rounded-full p-0.5">
                        <Lock className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                      </div>
                    )}
                    {!isLocked && isCompleted && (
                      <div className="absolute -top-1 -right-1 bg-green-600 text-white rounded-full p-0.5">
                        <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium whitespace-nowrap">
                    {step.title}
                  </span>
                </button>
              );

              return (
                <div key={step.id} className="flex items-center">
                  {isLocked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{stepButton}</TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] text-center">
                        <p className="text-xs">Premium feature — upgrade to unlock</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    stepButton
                  )}
                  {index < journeySteps.length - 1 && (
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 sm:h-4 sm:w-4 mx-0.5 sm:mx-1 shrink-0",
                        journeySteps[index + 1].completed || isCompleted
                          ? "text-green-600 dark:text-green-400"
                          : "text-muted-foreground/40",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </TooltipProvider>
        </div>

        {/* Next Step CTA */}
        {nextStep && !allComplete && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-secondary/10 dark:bg-secondary/15 rounded-lg border border-secondary/30 dark:border-secondary/25">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-secondary/20 dark:bg-secondary/30">
                <nextStep.icon className="h-4 w-4 text-secondary" />
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium">Next: {nextStep.title}</p>
                  <p className="text-xs text-muted-foreground">{nextStep.subtitle}</p>
                </div>
                {isStepLocked(nextStep) && (
                  <Badge variant="outline" className="text-xs border-muted-foreground/30">
                    <Lock className="h-3 w-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleStepClick(nextStep)}
              className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            >
              {isStepLocked(nextStep) ? "Unlock" : "Start"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {allComplete && (
          <div className="flex items-center justify-center gap-2 p-3 bg-green-50 dark:bg-green-950/50 rounded-lg text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700">
            <Check className="h-5 w-5" />
            <span className="text-sm font-medium">You've explored all journey steps!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
