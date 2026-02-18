import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateMilestoneGate } from "@/hooks/useMilestoneGates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateMilestoneId: string;
}

export function MilestoneGateDialog({
  open,
  onOpenChange,
  templateMilestoneId,
}: Props) {
  const { toast } = useToast();
  const createGate = useCreateMilestoneGate();

  const [sourceType, setSourceType] = useState<"capability" | "definition">(
    "capability",
  );
  const [assessmentId, setAssessmentId] = useState("");
  const [domainId, setDomainId] = useState("");
  const [definitionId, setDefinitionId] = useState("");
  const [dimensionId, setDimensionId] = useState("");
  const [minScore, setMinScore] = useState("");
  const [gateLabel, setGateLabel] = useState("");

  // Fetch capability assessments
  const { data: capAssessments = [] } = useQuery({
    queryKey: ["gate-cap-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("id, name, rating_scale")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && sourceType === "capability",
  });

  // Fetch domains for selected capability assessment
  const { data: capDomains = [] } = useQuery({
    queryKey: ["gate-cap-domains", assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_domains")
        .select("id, name")
        .eq("assessment_id", assessmentId)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
    enabled: !!assessmentId && sourceType === "capability",
  });

  // Fetch assessment definitions
  const { data: definitions = [] } = useQuery({
    queryKey: ["gate-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_definitions")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && sourceType === "definition",
  });

  // Fetch dimensions for selected definition
  const { data: dimensions = [] } = useQuery({
    queryKey: ["gate-dimensions", definitionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_dimensions")
        .select("id, name")
        .eq("assessment_id", definitionId)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
    enabled: !!definitionId && sourceType === "definition",
  });

  const resetForm = () => {
    setSourceType("capability");
    setAssessmentId("");
    setDomainId("");
    setDefinitionId("");
    setDimensionId("");
    setMinScore("");
    setGateLabel("");
  };

  const handleSubmit = async () => {
    if (!minScore || isNaN(parseFloat(minScore))) {
      toast({
        title: "Error",
        description: "Please enter a valid minimum score",
        variant: "destructive",
      });
      return;
    }

    try {
      const params: Record<string, unknown> = {
        template_milestone_id: templateMilestoneId,
        min_score: parseFloat(minScore),
        gate_label: gateLabel || null,
      };

      if (sourceType === "capability") {
        if (!assessmentId || !domainId) {
          toast({
            title: "Error",
            description: "Please select an assessment and domain",
            variant: "destructive",
          });
          return;
        }
        params.capability_assessment_id = assessmentId;
        params.capability_domain_id = domainId;

        // Auto-generate label if empty
        if (!gateLabel) {
          const domain = capDomains.find((d) => d.id === domainId);
          params.gate_label = `${domain?.name || "Domain"} ≥ ${minScore}`;
        }
      } else {
        if (!definitionId || !dimensionId) {
          toast({
            title: "Error",
            description: "Please select an assessment and dimension",
            variant: "destructive",
          });
          return;
        }
        params.assessment_definition_id = definitionId;
        params.assessment_dimension_id = dimensionId;

        if (!gateLabel) {
          const dim = dimensions.find((d) => d.id === dimensionId);
          params.gate_label = `${dim?.name || "Dimension"} ≥ ${minScore}`;
        }
      }

      await createGate.mutateAsync(params as any);
      toast({ title: "Gate added", description: "Milestone gate created successfully" });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create gate",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Assessment Gate</DialogTitle>
          <DialogDescription>
            Define a minimum assessment score requirement for this milestone.
            Gates are advisory — they don&apos;t block progress.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source type */}
          <div className="space-y-2">
            <Label>Assessment Type</Label>
            <Select
              value={sourceType}
              onValueChange={(v) => {
                setSourceType(v as "capability" | "definition");
                setAssessmentId("");
                setDomainId("");
                setDefinitionId("");
                setDimensionId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capability">Capability Assessment</SelectItem>
                <SelectItem value="definition">Assessment Definition</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Capability assessment flow */}
          {sourceType === "capability" && (
            <>
              <div className="space-y-2">
                <Label>Assessment</Label>
                <Select
                  value={assessmentId}
                  onValueChange={(v) => {
                    setAssessmentId(v);
                    setDomainId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {capAssessments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {assessmentId && (
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select value={domainId} onValueChange={setDomainId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {capDomains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Definition assessment flow */}
          {sourceType === "definition" && (
            <>
              <div className="space-y-2">
                <Label>Assessment</Label>
                <Select
                  value={definitionId}
                  onValueChange={(v) => {
                    setDefinitionId(v);
                    setDimensionId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {definitions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {definitionId && (
                <div className="space-y-2">
                  <Label>Dimension</Label>
                  <Select value={dimensionId} onValueChange={setDimensionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dimension" />
                    </SelectTrigger>
                    <SelectContent>
                      {dimensions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Min score */}
          <div className="space-y-2">
            <Label>Minimum Score</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="e.g. 7.0"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
          </div>

          {/* Custom label */}
          <div className="space-y-2">
            <Label>
              Gate Label{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              placeholder="Auto-generated if blank"
              value={gateLabel}
              onChange={(e) => setGateLabel(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createGate.isPending}
          >
            {createGate.isPending ? "Adding..." : "Add Gate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
