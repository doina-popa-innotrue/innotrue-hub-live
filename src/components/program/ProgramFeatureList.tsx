import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, ChevronDown, Sparkles } from "lucide-react";

interface ProgramFeature {
  feature_id: string;
  enabled: boolean;
  limit_value: number | null;
  features: {
    key: string;
    name: string;
    description: string | null;
  } | null;
}

interface ProgramFeatureListProps {
  programPlanId: string | undefined;
  className?: string;
  /** Compact variant for inline display */
  compact?: boolean;
}

/**
 * Shows features included in a program plan.
 *
 * Fetches from program_plan_features table and displays
 * feature names, descriptions, and limits.
 *
 * @example
 * ```tsx
 * <ProgramFeatureList programPlanId={enrollment.program_plan_id} />
 * ```
 */
export function ProgramFeatureList({
  programPlanId,
  className,
  compact = false,
}: ProgramFeatureListProps) {
  const [open, setOpen] = useState(false);

  const { data: features, isLoading } = useQuery({
    queryKey: ["program-plan-features", programPlanId],
    queryFn: async (): Promise<ProgramFeature[]> => {
      if (!programPlanId) return [];

      const { data, error } = await supabase
        .from("program_plan_features")
        .select(
          `
          feature_id,
          enabled,
          limit_value,
          features (key, name, description)
        `,
        )
        .eq("program_plan_id", programPlanId)
        .eq("enabled", true);

      if (error) {
        console.error("Error fetching program plan features:", error);
        return [];
      }

      return (data ?? []) as unknown as ProgramFeature[];
    },
    enabled: !!programPlanId,
    staleTime: 5 * 60 * 1000,
  });

  if (!programPlanId) return null;

  if (isLoading) {
    return compact ? (
      <div className="space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    ) : (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!features || features.length === 0) return null;

  if (compact) {
    return (
      <div className={`space-y-1 ${className ?? ""}`}>
        {features.map((f) => (
          <div key={f.feature_id} className="flex items-center gap-1.5 text-sm">
            <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
            <span className="capitalize">{f.features?.name ?? f.features?.key?.replace(/_/g, " ") ?? "Feature"}</span>
            {f.limit_value != null && (
              <Badge variant="outline" className="text-[10px] ml-1">
                {f.limit_value}/mo
              </Badge>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={className}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer select-none hover:bg-accent/50 transition-colors rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              What's Included
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {features.length} feature{features.length !== 1 ? "s" : ""}
              </Badge>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-2">
              {features.map((f) => (
                <div key={f.feature_id} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {f.features?.name ?? f.features?.key?.replace(/_/g, " ") ?? "Feature"}
                      </span>
                      {f.limit_value != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          {f.limit_value}/mo
                        </Badge>
                      )}
                    </div>
                    {f.features?.description && (
                      <p className="text-xs text-muted-foreground">{f.features.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
