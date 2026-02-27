import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useWheelCategories } from "@/hooks/useWheelCategories";
import { ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type GoalCategory = Database["public"]["Enums"]["goal_category"];
type GoalTimeframe = Database["public"]["Enums"]["goal_timeframe"];
type GoalPriority = Database["public"]["Enums"]["goal_priority"];
type GoalStatus = Database["public"]["Enums"]["goal_status"];

export interface AssessmentContext {
  capabilityAssessmentId?: string;
  capabilityDomainId?: string;
  capabilitySnapshotId?: string;
  assessmentDefinitionId?: string;
  scoreAtCreation?: number;
  domainName?: string;
  assessmentName?: string;
}

interface GoalFormProps {
  goalId?: string;
  defaultCategory?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  assessmentContext?: AssessmentContext;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function GoalForm({ goalId, defaultCategory, defaultTitle, defaultDescription, assessmentContext, onSuccess, onCancel }: GoalFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: categories = [], isLoading: categoriesLoading } = useWheelCategories({
    includeLegacy: false,
  });
  const [loading, setLoading] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(!!assessmentContext);
  const [assessmentLink, setAssessmentLink] = useState<{
    capabilityAssessmentId: string;
    capabilityDomainId: string;
    capabilitySnapshotId: string;
    scoreAtCreation: string;
    targetScore: string;
  }>({
    capabilityAssessmentId: assessmentContext?.capabilityAssessmentId || "",
    capabilityDomainId: assessmentContext?.capabilityDomainId || "",
    capabilitySnapshotId: assessmentContext?.capabilitySnapshotId || "",
    scoreAtCreation: assessmentContext?.scoreAtCreation?.toString() || "",
    targetScore: "",
  });

  // Fetch capability assessments for the assessment link section
  const { data: capAssessments = [] } = useQuery({
    queryKey: ["capability-assessments-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("id, name, rating_scale")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: assessmentOpen && !goalId,
  });

  // Fetch domains for selected assessment
  const { data: capDomains = [] } = useQuery({
    queryKey: ["capability-domains-select", assessmentLink.capabilityAssessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_domains")
        .select("id, name")
        .eq("assessment_id", assessmentLink.capabilityAssessmentId)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
    enabled: !!assessmentLink.capabilityAssessmentId && assessmentOpen && !goalId,
  });

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    category: GoalCategory;
    timeframe_type: GoalTimeframe;
    priority: GoalPriority;
    target_date: string;
    status: GoalStatus;
    is_private: boolean;
  }>({
    title: defaultTitle || "",
    description: defaultDescription || "",
    category: (defaultCategory || "personal_growth") as GoalCategory,
    timeframe_type: "short",
    priority: "medium",
    target_date: "",
    status: "not_started",
    is_private: false,
  });

  useEffect(() => {
    if (goalId) {
      fetchGoal();
    }
  }, [goalId]);

  const fetchGoal = async () => {
    try {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId ?? "")
        .single();

      if (error) throw error;

      setFormData({
        title: data.title,
        description: data.description || "",
        category: data.category as GoalCategory,
        timeframe_type: data.timeframe_type as GoalTimeframe,
        priority: data.priority as GoalPriority,
        target_date: data.target_date || "",
        status: data.status as GoalStatus,
        is_private: data.is_private || false,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load goal",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const goalData = {
        ...formData,
        description: formData.description || null,
        target_date: formData.target_date || null,
        user_id: user.id,
      };

      if (goalId) {
        const { error } = await supabase.from("goals").update(goalData).eq("id", goalId);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Goal updated successfully",
        });
      } else {
        const { data: newGoal, error } = await supabase
          .from("goals")
          .insert([goalData])
          .select("id")
          .single();

        if (error) throw error;

        // Create assessment link if one was specified
        if (
          newGoal &&
          assessmentLink.capabilityDomainId &&
          assessmentLink.capabilityAssessmentId
        ) {
          const linkData: Record<string, unknown> = {
            goal_id: newGoal.id,
            capability_assessment_id: assessmentLink.capabilityAssessmentId,
            capability_domain_id: assessmentLink.capabilityDomainId,
            capability_snapshot_id: assessmentLink.capabilitySnapshotId || null,
            score_at_creation: assessmentLink.scoreAtCreation
              ? parseFloat(assessmentLink.scoreAtCreation)
              : null,
            target_score: assessmentLink.targetScore
              ? parseFloat(assessmentLink.targetScore)
              : null,
          };

          await supabase
            .from("goal_assessment_links" as string)
            .insert(linkData);
        }

        toast({
          title: "Success",
          description: "Goal created successfully",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error(`Failed to ${goalId ? "update" : "create"} goal:`, error?.message || error);
      toast({
        title: "Error",
        description: `Failed to ${goalId ? "update" : "create"} goal`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          placeholder="Enter goal title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe your goal"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value as GoalCategory })}
            disabled={categoriesLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select category"} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.key} value={cat.key}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeframe">Timeframe *</Label>
          <Select
            value={formData.timeframe_type}
            onValueChange={(value) =>
              setFormData({ ...formData, timeframe_type: value as GoalTimeframe })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short-term (1-6 months)</SelectItem>
              <SelectItem value="medium">Medium-term (12 months)</SelectItem>
              <SelectItem value="long">Long-term (3+ years)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority *</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => setFormData({ ...formData, priority: value as GoalPriority })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value as GoalStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="target_date">Target Date</Label>
        <Input
          id="target_date"
          type="date"
          value={formData.target_date}
          onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="is_private">Private Goal</Label>
          <p className="text-xs text-muted-foreground">
            Only visible to you and admins. Hidden from coaches/instructors.
          </p>
        </div>
        <Switch
          id="is_private"
          checked={formData.is_private}
          onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked })}
        />
      </div>

      {/* Assessment Link Section — only for new goals */}
      {!goalId && (
        <Collapsible open={assessmentOpen} onOpenChange={setAssessmentOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2 w-full justify-start p-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {assessmentOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <BarChart3 className="h-4 w-4" />
              Link to Assessment
              {assessmentLink.capabilityDomainId && (
                <span className="ml-auto text-xs text-primary">Linked</span>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 rounded-lg border p-4 mt-1">
            <p className="text-xs text-muted-foreground">
              Optionally link this goal to a capability assessment domain to track score progress.
            </p>

            <div className="space-y-2">
              <Label>Assessment</Label>
              <Select
                value={assessmentLink.capabilityAssessmentId}
                onValueChange={(value) =>
                  setAssessmentLink({
                    ...assessmentLink,
                    capabilityAssessmentId: value,
                    capabilityDomainId: "",
                  })
                }
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

            {assessmentLink.capabilityAssessmentId && (
              <div className="space-y-2">
                <Label>Domain</Label>
                <Select
                  value={assessmentLink.capabilityDomainId}
                  onValueChange={(value) =>
                    setAssessmentLink({ ...assessmentLink, capabilityDomainId: value })
                  }
                >
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

            {assessmentLink.capabilityDomainId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Score at Creation</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 4.5"
                    value={assessmentLink.scoreAtCreation}
                    onChange={(e) =>
                      setAssessmentLink({ ...assessmentLink, scoreAtCreation: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Score</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 8.0"
                    value={assessmentLink.targetScore}
                    onChange={(e) =>
                      setAssessmentLink({ ...assessmentLink, targetScore: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {assessmentLink.capabilityDomainId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() =>
                  setAssessmentLink({
                    capabilityAssessmentId: "",
                    capabilityDomainId: "",
                    capabilitySnapshotId: "",
                    scoreAtCreation: "",
                    targetScore: "",
                  })
                }
              >
                Clear link
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : goalId ? "Update Goal" : "Create Goal"}
        </Button>
      </div>
    </form>
  );
}
