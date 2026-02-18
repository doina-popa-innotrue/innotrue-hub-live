import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, Map, Calendar, Zap, Scale, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  instantiateTemplate,
  estimateCompletionDate,
  type PaceType,
} from "@/lib/guidedPathInstantiation";

interface TemplateGoal {
  id: string;
  title: string;
  guided_path_template_milestones: {
    id: string;
    recommended_days_min: number | null;
    recommended_days_optimal: number | null;
    recommended_days_max: number | null;
    guided_path_template_tasks: { id: string }[];
  }[];
}

interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  guided_path_template_goals: TemplateGoal[];
}

interface Props {
  templateIds: string[];
  surveyResponseId?: string;
  onComplete: () => void;
  onBack: () => void;
}

export function PathConfirmation({
  templateIds,
  surveyResponseId,
  onComplete,
  onBack,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paceType, setPaceType] = useState<PaceType>("optimal");

  // Fetch template summaries
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["path-confirmation-templates", templateIds],
    queryFn: async () => {
      if (templateIds.length === 0) return [];

      const { data, error } = await supabase
        .from("guided_path_templates")
        .select(
          `
          id, name, description,
          guided_path_template_goals(
            id, title,
            guided_path_template_milestones(
              id, recommended_days_min, recommended_days_optimal, recommended_days_max,
              guided_path_template_tasks(id)
            )
          )
        `,
        )
        .in("id", templateIds);

      if (error) throw error;
      return (data || []) as TemplateSummary[];
    },
    enabled: templateIds.length > 0,
  });

  // Compute totals
  const totalGoals = templates.reduce(
    (sum, t) => sum + t.guided_path_template_goals.length,
    0,
  );
  const totalMilestones = templates.reduce(
    (sum, t) =>
      sum +
      t.guided_path_template_goals.reduce(
        (s, g) => s + g.guided_path_template_milestones.length,
        0,
      ),
    0,
  );
  const totalTasks = templates.reduce(
    (sum, t) =>
      sum +
      t.guided_path_template_goals.reduce(
        (s, g) =>
          s +
          g.guided_path_template_milestones.reduce(
            (ts, m) => ts + m.guided_path_template_tasks.length,
            0,
          ),
        0,
      ),
    0,
  );

  // Estimate completion date
  const allGoals = templates.flatMap((t) => t.guided_path_template_goals);
  const estimatedDate =
    allGoals.length > 0
      ? estimateCompletionDate(allGoals as any, new Date(startDate), paceType)
      : new Date(startDate);

  // Instantiation mutation
  const instantiateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const results = [];
      for (const tmplId of templateIds) {
        const result = await instantiateTemplate(supabase, {
          userId: user.id,
          templateId: tmplId,
          surveyResponseId,
          startDate: new Date(startDate),
          paceType,
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dev-profile-guided-paths"] });
      const totalCreated = results.reduce((s, r) => s + r.goalsCreated, 0);
      // The parent handles navigation and toasts
      onComplete();
    },
    onError: (error: Error) => {
      console.error("Path instantiation failed:", error);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5" />
          Confirm Your Development Path
        </CardTitle>
        <CardDescription>
          Review the matched templates and choose your pace before creating your
          personalized path.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Matched templates summary */}
        <div>
          <h3 className="text-sm font-medium mb-2">Matched Templates</h3>
          <div className="space-y-2">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <span className="font-medium text-sm">{tmpl.name}</span>
                  {tmpl.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tmpl.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    {tmpl.guided_path_template_goals.length} goals
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
            <span>{totalGoals} goals</span>
            <span>·</span>
            <span>{totalMilestones} milestones</span>
            <span>·</span>
            <span>{totalTasks} tasks</span>
          </div>
        </div>

        {/* Start date */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Start Date
          </Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* Pace selector */}
        <div className="space-y-2">
          <Label>Pace</Label>
          <RadioGroup
            value={paceType}
            onValueChange={(v) => setPaceType(v as PaceType)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50">
              <RadioGroupItem value="min" id="pace-min" />
              <Label
                htmlFor="pace-min"
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <Zap className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="font-medium text-sm">Intensive</div>
                  <div className="text-xs text-muted-foreground">
                    Faster pace — minimum recommended days
                  </div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50">
              <RadioGroupItem value="optimal" id="pace-optimal" />
              <Label
                htmlFor="pace-optimal"
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <Scale className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium text-sm">
                    Standard{" "}
                    <span className="text-xs text-muted-foreground">(Recommended)</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Balanced pace — optimal recommended days
                  </div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50">
              <RadioGroupItem value="max" id="pace-max" />
              <Label
                htmlFor="pace-max"
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <Clock className="h-4 w-4 text-green-500" />
                <div>
                  <div className="font-medium text-sm">Part-time</div>
                  <div className="text-xs text-muted-foreground">
                    Relaxed pace — maximum recommended days
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Estimated completion */}
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <span className="text-muted-foreground">Estimated completion: </span>
          <span className="font-medium">
            {format(estimatedDate, "MMM d, yyyy")}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={() => instantiateMutation.mutate()}
            disabled={instantiateMutation.isPending}
          >
            {instantiateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating path...
              </>
            ) : (
              "Create My Path"
            )}
          </Button>
        </div>

        {instantiateMutation.isError && (
          <p className="text-sm text-destructive">
            {(instantiateMutation.error as Error).message ||
              "Failed to create path. Please try again."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
