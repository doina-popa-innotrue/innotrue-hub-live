import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Brain, MessageSquare, TrendingUp } from "lucide-react";

interface UsageItem {
  feature_key: string;
  feature_name: string;
  used_count: number;
  limit_value: number | null;
  is_consumable: boolean;
}

const featureIcons: Record<string, React.ElementType> = {
  ai_insights: Brain,
  ai_recommendations: Sparkles,
  default: TrendingUp,
};

export function UsageDashboard() {
  const { user } = useAuth();

  const { data: usageData, isLoading } = useQuery({
    queryKey: ["user-usage", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's plan
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_id")
        .eq("id", user.id)
        .single();

      if (!profile?.plan_id) return [];

      // Get consumable features for user's plan
      const { data: planFeatures } = await supabase
        .from("plan_features")
        .select(
          `
          limit_value,
          enabled,
          features!inner (
            key,
            name,
            is_consumable
          )
        `,
        )
        .eq("plan_id", profile.plan_id)
        .eq("enabled", true);

      const consumableFeatures = (planFeatures || []).filter(
        (pf: any) => pf.features?.is_consumable,
      );

      // Get current usage for each consumable feature
      const usageItems: UsageItem[] = [];

      for (const pf of consumableFeatures) {
        const { data: usage } = await supabase.rpc("get_current_usage", {
          _user_id: user.id,
          _feature_key: pf.features.key,
        });

        usageItems.push({
          feature_key: pf.features.key,
          feature_name: pf.features.name,
          used_count: usage || 0,
          limit_value: pf.limit_value,
          is_consumable: pf.features.is_consumable,
        });
      }

      return usageItems;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!usageData || usageData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Feature Usage
          </CardTitle>
          <CardDescription>No consumable features available on your current plan.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Monthly Feature Usage
        </CardTitle>
        <CardDescription>Track your usage of consumable features this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {usageData.map((item) => {
          const Icon = featureIcons[item.feature_key] || featureIcons.default;
          const percentage = item.limit_value
            ? Math.min(100, (item.used_count / item.limit_value) * 100)
            : 0;
          const remaining = item.limit_value
            ? Math.max(0, item.limit_value - item.used_count)
            : null;

          return (
            <div key={item.feature_key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{item.feature_name}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {item.limit_value !== null ? (
                    <>
                      {item.used_count} / {item.limit_value} used
                      <span className="ml-2 text-primary">({remaining} remaining)</span>
                    </>
                  ) : (
                    <span className="text-primary">Unlimited</span>
                  )}
                </span>
              </div>
              {item.limit_value !== null && <Progress value={percentage} className="h-2" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
