import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Target, CheckCircle2, TrendingUp, Share2, Calendar, Sparkles } from "lucide-react";
import GoalCard from "@/components/goals/GoalCard";
import GoalFilters from "@/components/goals/GoalFilters";
import GoalForm from "@/components/goals/GoalForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FeatureGate } from "@/components/FeatureGate";
import { usePageView } from "@/hooks/useAnalytics";

function GoalsFallback() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Target,
      title: "Set Meaningful Goals",
      description: "Define goals across all life areas using the Wheel of Life framework",
    },
    {
      icon: TrendingUp,
      title: "Track Progress",
      description: "Monitor your journey with visual progress indicators and milestones",
    },
    {
      icon: CheckCircle2,
      title: "Break Down Goals",
      description: "Create actionable milestones and track completion step by step",
    },
    {
      icon: Share2,
      title: "Share with Coach",
      description: "Get personalized feedback by sharing goals with your instructor or coach",
    },
    {
      icon: Calendar,
      title: "Set Target Dates",
      description: "Stay accountable with timeframes for short, medium, and long-term goals",
    },
    {
      icon: Sparkles,
      title: "Reflect & Learn",
      description: "Add reflections and resources to document your growth journey",
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Goal Setting & Tracking</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Transform your aspirations into achievements with our comprehensive goal management
          system. Set, track, and accomplish goals across all dimensions of your life.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
        {features.map((feature, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="py-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Unlock Goal Management</h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              This feature is available with our premium programs. Enroll in a program or upgrade
              your plan to start setting and achieving your goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate("/explore-programs")}>Explore Programs</Button>
              <Button variant="outline" onClick={() => navigate("/subscription")}>
                View Subscription Options
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface Goal {
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
  updated_at: string;
}

export default function Goals() {
  // Track page view for analytics
  usePageView("Goals");

  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [filteredGoals, setFilteredGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Initialize filters from URL params
  const categoryParam = searchParams.get("category") || "all";
  const newParam = searchParams.get("new");

  const [filters, setFilters] = useState({
    category: categoryParam,
    timeframe: "all",
    status: "all",
    priority: "all",
    search: "",
  });

  // Open create dialog if ?new=true
  useEffect(() => {
    if (newParam === "true") {
      setShowCreateDialog(true);
      // Clear the new param from URL
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [newParam]);

  // Update filters when URL category changes
  useEffect(() => {
    if (categoryParam && categoryParam !== filters.category) {
      setFilters((prev) => ({ ...prev, category: categoryParam }));
    }
  }, [categoryParam]);

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [goals, filters]);

  const fetchGoals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load goals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...goals];

    if (filters.category !== "all") {
      filtered = filtered.filter((g) => g.category === filters.category);
    }
    if (filters.timeframe !== "all") {
      filtered = filtered.filter((g) => g.timeframe_type === filters.timeframe);
    }
    if (filters.status !== "all") {
      filtered = filtered.filter((g) => g.status === filters.status);
    }
    if (filters.priority !== "all") {
      filtered = filtered.filter((g) => g.priority === filters.priority);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.title.toLowerCase().includes(searchLower) ||
          g.description?.toLowerCase().includes(searchLower),
      );
    }

    setFilteredGoals(filtered);
  };

  const handleGoalCreated = () => {
    setShowCreateDialog(false);
    fetchGoals();
  };

  const handleGoalDeleted = () => {
    fetchGoals();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading goals...</div>
      </div>
    );
  }

  return (
    <FeatureGate featureKey="goals" fallback={<GoalsFallback />}>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">My Goals</h1>
              <p className="text-muted-foreground">Track and achieve your personal goals</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Goal
          </Button>
        </div>

        <GoalFilters filters={filters} onFiltersChange={setFilters} />

        {filteredGoals.length === 0 ? (
          <div className="text-center py-12">
            <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No goals found</h3>
            <p className="text-muted-foreground mb-4">
              {goals.length === 0
                ? "Start by creating your first goal"
                : "Try adjusting your filters"}
            </p>
            {goals.length === 0 && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Goal
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onDelete={handleGoalDeleted} />
            ))}
          </div>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <GoalForm
              defaultCategory={categoryParam !== "all" ? categoryParam : undefined}
              onSuccess={handleGoalCreated}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}
