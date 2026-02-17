import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  CircleDot,
  Target,
  BookOpen,
  UserCircle,
  Check,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  url: string;
  completed: boolean;
}

interface OnboardingWelcomeCardProps {
  /** User's first name for a personal greeting */
  userName?: string;
  /** Whether the user has completed the Wheel of Life */
  hasWheelData: boolean;
  /** Whether the user has set at least one goal */
  hasGoals: boolean;
  /** Whether the user has at least one active enrollment */
  hasEnrollments: boolean;
  /** Whether the user's profile has a name set */
  hasProfileName: boolean;
}

const DISMISS_KEY = "innotrue_onboarding_dismissed";

export function OnboardingWelcomeCard({
  userName,
  hasWheelData,
  hasGoals,
  hasEnrollments,
  hasProfileName,
}: OnboardingWelcomeCardProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      label: "Complete your profile",
      description: "Add your name and photo",
      icon: UserCircle,
      url: "/account",
      completed: hasProfileName,
    },
    {
      id: "wheel",
      label: "Assess your life",
      description: "Discover where you are today",
      icon: CircleDot,
      url: "/wheel-of-life",
      completed: hasWheelData,
    },
    {
      id: "goals",
      label: "Set your first goal",
      description: "Define where you want to go",
      icon: Target,
      url: "/goals",
      completed: hasGoals,
    },
    {
      id: "programs",
      label: "Explore programs",
      description: "Find programs to help you grow",
      icon: BookOpen,
      url: "/explore-programs",
      completed: hasEnrollments,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  // Don't show if dismissed or all steps complete
  if (dismissed || allComplete) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // ignore storage errors
    }
  };

  const nextStep = steps.find((s) => !s.completed);

  const greeting = userName ? `Welcome, ${userName}!` : "Welcome to InnoTrue!";

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/5 dark:from-primary/10 dark:to-secondary/10">
      <CardContent className="pt-6 pb-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{greeting}</h2>
              <p className="text-sm text-muted-foreground">
                Here are a few steps to get you started on your growth journey.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleDismiss}
            aria-label="Dismiss welcome card"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
            {completedCount}/{steps.length} done
          </span>
        </div>

        {/* Steps */}
        <div className="grid gap-2 sm:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;
            const isNext = step.id === nextStep?.id;
            return (
              <button
                key={step.id}
                onClick={() => navigate(step.url)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                  step.completed
                    ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                    : isNext
                      ? "bg-primary/10 dark:bg-primary/15 hover:bg-primary/15 dark:hover:bg-primary/20 ring-1 ring-primary/30"
                      : "bg-muted/50 hover:bg-muted",
                )}
              >
                <div
                  className={cn(
                    "p-1.5 rounded-lg shrink-0",
                    step.completed
                      ? "bg-green-100 dark:bg-green-900/50"
                      : isNext
                        ? "bg-primary/15 dark:bg-primary/25"
                        : "bg-muted",
                  )}
                >
                  {step.completed ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.completed && "line-through opacity-70",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
                {!step.completed && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
