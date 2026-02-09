import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Reflection {
  id: string;
  what_went_well: string | null;
  what_did_not_go_well: string | null;
  unexpected_results: string | null;
  what_i_learned: string | null;
  satisfaction_score: number | null;
  alignment_with_values_score: number | null;
}

interface DecisionReflectionProps {
  decisionId: string;
}

export function DecisionReflection({ decisionId }: DecisionReflectionProps) {
  const { toast } = useToast();
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReflection();
  }, [decisionId]);

  async function fetchReflection() {
    try {
      const { data, error } = await supabase
        .from("decision_reflections")
        .select("*")
        .eq("decision_id", decisionId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setReflection(data);
      } else {
        // Create initial reflection
        const { data: newReflection, error: createError } = await supabase
          .from("decision_reflections")
          .insert([
            {
              decision_id: decisionId,
              satisfaction_score: 5,
              alignment_with_values_score: 5,
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        setReflection(newReflection);
      }
    } catch (error: any) {
      toast({
        title: "Error loading reflection",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateReflection(updates: Partial<Reflection>) {
    if (!reflection) return;

    try {
      const { error } = await supabase
        .from("decision_reflections")
        .update(updates)
        .eq("id", reflection.id);

      if (error) throw error;

      setReflection({ ...reflection, ...updates });
    } catch (error: any) {
      toast({
        title: "Error updating reflection",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading reflection...</div>;
  }

  if (!reflection) {
    return <div className="text-sm text-muted-foreground">No reflection data available</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Decision Reflection</h3>
        <p className="text-sm text-muted-foreground">
          Reflect on the outcome and learn from the experience
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Satisfaction Score</Label>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  How satisfied are you with the outcome?
                </span>
                <span className="text-2xl font-bold text-primary">
                  {reflection.satisfaction_score || 5}/10
                </span>
              </div>
              <Slider
                value={[reflection.satisfaction_score || 5]}
                onValueChange={([score]) => updateReflection({ satisfaction_score: score })}
                min={0}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Not satisfied</span>
                <span>Very satisfied</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Values Alignment Score</Label>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Did it align with your values?
                </span>
                <span className="text-2xl font-bold text-primary">
                  {reflection.alignment_with_values_score || 5}/10
                </span>
              </div>
              <Slider
                value={[reflection.alignment_with_values_score || 5]}
                onValueChange={([score]) => updateReflection({ alignment_with_values_score: score })}
                min={0}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Not aligned</span>
                <span>Perfectly aligned</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wentWell" className="text-base font-semibold">
            What went well?
          </Label>
          <Textarea
            id="wentWell"
            value={reflection.what_went_well || ""}
            onChange={(e) => updateReflection({ what_went_well: e.target.value })}
            placeholder="What positive outcomes resulted from this decision? What worked better than expected?"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="didNotGoWell" className="text-base font-semibold">
            What didn't go well?
          </Label>
          <Textarea
            id="didNotGoWell"
            value={reflection.what_did_not_go_well || ""}
            onChange={(e) => updateReflection({ what_did_not_go_well: e.target.value })}
            placeholder="What challenges or negative outcomes occurred? What would you do differently?"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unexpected" className="text-base font-semibold">
            Unexpected results
          </Label>
          <Textarea
            id="unexpected"
            value={reflection.unexpected_results || ""}
            onChange={(e) => updateReflection({ unexpected_results: e.target.value })}
            placeholder="What surprised you? Were there outcomes you didn't anticipate?"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="learned" className="text-base font-semibold">
            What I learned
          </Label>
          <Textarea
            id="learned"
            value={reflection.what_i_learned || ""}
            onChange={(e) => updateReflection({ what_i_learned: e.target.value })}
            placeholder="What insights did you gain? How will this inform future decisions?"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}
