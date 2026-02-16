import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import GoalComments from "@/components/goals/GoalComments";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SharedGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  timeframe_type: string;
  priority: string;
  target_date: string | null;
  status: string;
  progress_percentage: number;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
  };
}

import { CATEGORY_LABELS } from "@/lib/wheelOfLifeCategories";
import { PageLoadingState } from "@/components/ui/page-loading-state";

const TIMEFRAME_LABELS: Record<string, string> = {
  short: "Short-term",
  medium: "Medium-term",
  long: "Long-term",
};

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  paused: "bg-warning/15 text-warning",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/15 text-primary",
  high: "bg-destructive/15 text-destructive",
};

export default function SharedGoals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<SharedGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSharedGoals();
    }
  }, [user]);

  const fetchSharedGoals = async () => {
    try {
      const { data, error } = await supabase
        .from("goal_shares")
        .select(
          `
          goal_id,
          goals!inner (
            id,
            title,
            description,
            category,
            timeframe_type,
            priority,
            target_date,
            status,
            progress_percentage,
            created_at,
            user_id
          )
        `,
        )
        .eq("shared_with_user_id", user?.id ?? "");

      if (error) throw error;

      // Flatten the data and fetch user profiles separately
      const sharedGoals = data.map((share) => share.goals).filter(Boolean) as any[];

      // Fetch profiles for each goal
      const goalsWithProfiles = await Promise.all(
        sharedGoals.map(async (goal) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", goal.user_id)
            .single();

          return {
            ...goal,
            profiles: profile || { name: "Unknown" },
          };
        }),
      );

      setGoals(goalsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load shared goals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingState message="Loading shared goals..." />;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Target className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Shared Goals</h1>
        </div>
        <p className="text-muted-foreground">
          Goals shared with you by clients for feedback and support
        </p>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No shared goals yet</h3>
            <p className="text-muted-foreground">
              Clients will share their goals with you for feedback and support
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4">
          {goals.map((goal) => (
            <AccordionItem key={goal.id} value={goal.id} className="border rounded-lg">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-start justify-between w-full pr-4">
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={STATUS_COLORS[goal.status]}>
                        {goal.status.replace("_", " ")}
                      </Badge>
                      <Badge className={PRIORITY_COLORS[goal.priority]} variant="outline">
                        {goal.priority}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-lg">{goal.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{goal.profiles.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">Progress</div>
                    <div className="font-semibold">{goal.progress_percentage}%</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {goal.description && <p className="text-muted-foreground">{goal.description}</p>}

                  <div>
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{goal.progress_percentage}%</span>
                    </div>
                    <Progress value={goal.progress_percentage} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Category:</span>
                      <p className="font-medium">{CATEGORY_LABELS[goal.category]}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Timeframe:</span>
                      <p className="font-medium">{TIMEFRAME_LABELS[goal.timeframe_type]}</p>
                    </div>
                    {goal.target_date && (
                      <div>
                        <span className="text-muted-foreground">Target Date:</span>
                        <p className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(goal.target_date), "MMM d, yyyy")}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <p className="font-medium">
                        {format(new Date(goal.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>

                  <GoalComments goalId={goal.id} />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
