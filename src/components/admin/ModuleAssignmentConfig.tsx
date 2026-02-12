import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { X, Plus, ClipboardCheck, Gauge, Loader2 } from "lucide-react";
import { useState } from "react";

interface ModuleAssignmentConfigProps {
  moduleId: string;
}

interface AssignmentType {
  id: string;
  name: string;
  description: string | null;
}

interface CapabilityAssessment {
  id: string;
  name: string;
  slug: string;
}

interface AssignmentConfig {
  id: string;
  assignment_type_id: string;
  linked_capability_assessment_id: string | null;
  module_assignment_types: AssignmentType;
  capability_assessments: CapabilityAssessment | null;
}

export function ModuleAssignmentConfig({ moduleId }: ModuleAssignmentConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");

  const { data: assignmentTypes } = useQuery({
    queryKey: ["assignment-types-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_assignment_types")
        .select("id, name, description")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as AssignmentType[];
    },
  });

  const { data: capabilityAssessments } = useQuery({
    queryKey: ["capability-assessments-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("id, name, slug")
        .eq("is_active", true)
        .eq("allow_instructor_eval", true)
        .order("name");
      if (error) throw error;
      return data as CapabilityAssessment[];
    },
  });

  const { data: configs, isLoading } = useQuery({
    queryKey: ["module-assignment-configs", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_assignment_configs")
        .select(
          `
          id, 
          assignment_type_id, 
          linked_capability_assessment_id,
          module_assignment_types(id, name, description),
          capability_assessments(id, name, slug)
        `,
        )
        .eq("module_id", moduleId);
      if (error) throw error;
      return data as AssignmentConfig[];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      assignmentTypeId,
      assessmentId,
    }: {
      assignmentTypeId: string;
      assessmentId?: string;
    }) => {
      const { error } = await supabase.from("module_assignment_configs").insert({
        module_id: moduleId,
        assignment_type_id: assignmentTypeId,
        linked_capability_assessment_id: assessmentId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-assignment-configs", moduleId] });
      setSelectedTypeId("");
      setSelectedAssessmentId("");
      toast({ title: "Assignment type assigned" });
    },
    onError: (error) => {
      toast({ title: "Error assigning type", description: error.message, variant: "destructive" });
    },
  });

  const updateAssessmentLinkMutation = useMutation({
    mutationFn: async ({
      configId,
      assessmentId,
    }: {
      configId: string;
      assessmentId: string | null;
    }) => {
      const { error } = await supabase
        .from("module_assignment_configs")
        .update({ linked_capability_assessment_id: assessmentId })
        .eq("id", configId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-assignment-configs", moduleId] });
      toast({ title: "Assessment link updated" });
    },
    onError: (error) => {
      toast({ title: "Error updating link", description: error.message, variant: "destructive" });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from("module_assignment_configs")
        .delete()
        .eq("id", configId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-assignment-configs", moduleId] });
      toast({ title: "Assignment type removed" });
    },
    onError: (error) => {
      toast({ title: "Error removing type", description: error.message, variant: "destructive" });
    },
  });

  const availableTypes = assignmentTypes?.filter(
    (type) => !configs?.some((c) => c.assignment_type_id === type.id),
  );

  const handleAssign = () => {
    if (selectedTypeId) {
      assignMutation.mutate({
        assignmentTypeId: selectedTypeId,
        assessmentId: selectedAssessmentId || undefined,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        <Label className="font-medium">Assignment Types</Label>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {configs && configs.length > 0 && (
            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {config.module_assignment_types?.name}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-destructive/20"
                      onClick={() => unassignMutation.mutate(config.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Gauge className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Select
                      value={config.linked_capability_assessment_id || "_none"}
                      onValueChange={(value) =>
                        updateAssessmentLinkMutation.mutate({
                          configId: config.id,
                          assessmentId: value === "_none" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Link capability assessment for evaluator grading" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">No linked assessment</SelectItem>
                        {capabilityAssessments?.map((assessment) => (
                          <SelectItem key={assessment.id} value={assessment.id}>
                            {assessment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {config.capability_assessments && (
                    <p className="text-xs text-muted-foreground pl-5">
                      Instructor completes "{config.capability_assessments.name}" when grading
                      submissions
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {availableTypes && availableTypes.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground">Add assignment type:</p>
              <div className="flex gap-2 items-center flex-wrap">
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Assignment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Link assessment (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No linked assessment</SelectItem>
                    {capabilityAssessments?.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAssign}
                  disabled={!selectedTypeId || assignMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
          )}

          {(!availableTypes || availableTypes.length === 0) &&
            (!configs || configs.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No assignment types available. Create them in Admin → Assignment Types.
              </p>
            )}
        </>
      )}
    </div>
  );
}
