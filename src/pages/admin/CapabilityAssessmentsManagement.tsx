import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, Loader2, Eye, Settings, Gauge, Copy, Archive, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from "@/components/admin";

type CapabilityAssessment = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  instructions: string | null;
  instructions_self: string | null;
  instructions_evaluator: string | null;
  assessment_mode: "self" | "evaluator" | "both";
  feature_key: string | null;
  program_id: string | null;
  category_id: string | null;
  family_id: string | null;
  allow_instructor_eval: boolean;
  rating_scale: number;
  is_active: boolean;
  is_public: boolean;
  is_retired: boolean;
  pass_fail_enabled: boolean;
  pass_fail_mode: "overall" | "per_domain" | null;
  pass_fail_threshold: number | null;
  created_at: string;
  programs?: { name: string } | null;
  assessment_categories?: { name: string } | null;
  assessment_families?: { name: string } | null;
};

type AssessmentFamily = {
  id: string;
  name: string;
};

type Program = {
  id: string;
  name: string;
};

type Feature = {
  id: string;
  key: string;
  name: string;
};

type AssessmentCategory = {
  id: string;
  name: string;
};

interface FormData {
  name: string;
  slug: string;
  description: string;
  instructions: string;
  instructions_self: string;
  instructions_evaluator: string;
  assessment_mode: "self" | "evaluator" | "both";
  feature_key: string;
  program_id: string;
  category_id: string;
  family_id: string;
  allow_instructor_eval: boolean;
  rating_scale: number;
  is_active: boolean;
  is_public: boolean;
  pass_fail_enabled: boolean;
  pass_fail_mode: "" | "overall" | "per_domain";
  pass_fail_threshold: number;
}

const initialFormData: FormData = {
  name: "",
  slug: "",
  description: "",
  instructions: "",
  instructions_self: "",
  instructions_evaluator: "",
  assessment_mode: "both",
  feature_key: "",
  program_id: "",
  category_id: "",
  family_id: "",
  allow_instructor_eval: true,
  rating_scale: 10,
  is_active: true,
  is_public: false,
  pass_fail_enabled: false,
  pass_fail_mode: "",
  pass_fail_threshold: 75,
};

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

export default function CapabilityAssessmentsManagement() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: assessments,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    formData,
    setFormData,
    openCreate,
    handleEdit,
    handleDelete,
  } = useAdminCRUD<CapabilityAssessment, FormData>({
    tableName: "capability_assessments",
    queryKey: "admin-capability-assessments",
    entityName: "Capability assessment",
    select: "*, programs(name), assessment_categories(name), assessment_families(name)",
    orderBy: "created_at",
    orderDirection: "desc",
    initialFormData,
    mapItemToForm: (item) => ({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      instructions: item.instructions || "",
      instructions_self: item.instructions_self || "",
      instructions_evaluator: item.instructions_evaluator || "",
      assessment_mode: item.assessment_mode || "both",
      feature_key: item.feature_key || "",
      program_id: item.program_id || "",
      category_id: item.category_id || "",
      family_id: item.family_id || "",
      allow_instructor_eval: item.allow_instructor_eval,
      rating_scale: item.rating_scale,
      is_active: item.is_active,
      is_public: item.is_public,
      pass_fail_enabled: item.pass_fail_enabled,
      pass_fail_mode: item.pass_fail_mode || "",
      pass_fail_threshold: item.pass_fail_threshold ?? 75,
    }),
  });

  // Get snapshot counts per assessment — only runs when assessments exist
  const { data: snapshotCounts } = useQuery({
    queryKey: ["admin-capability-assessment-snapshot-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_snapshots")
        .select("assessment_id")
        .not("assessment_id", "is", null);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((item) => {
        counts[item.assessment_id!] = (counts[item.assessment_id!] || 0) + 1;
      });

      return counts;
    },
    enabled: (assessments?.length ?? 0) > 0,
  });

  const getSnapshotCount = (assessmentId: string) => {
    return snapshotCounts?.[assessmentId] || 0;
  };

  const { data: families } = useQuery({
    queryKey: ["admin-assessment-families-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_families")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as AssessmentFamily[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-assessment-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("order_index");

      if (error) throw error;
      return data as AssessmentCategory[];
    },
  });

  const { data: programs } = useQuery({
    queryKey: ["admin-programs-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programs").select("id, name").order("name");

      if (error) throw error;
      return data as Program[];
    },
  });

  const { data: features } = useQuery({
    queryKey: ["admin-features-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("features").select("id, key, name").order("name");

      if (error) throw error;
      return data as Feature[];
    },
  });

  // Custom mutations for null handling
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const insertData = {
        ...data,
        instructions: data.instructions || null,
        instructions_self: data.instructions_self || null,
        instructions_evaluator: data.instructions_evaluator || null,
        feature_key: data.feature_key || null,
        program_id: data.program_id || null,
        category_id: data.category_id || null,
        family_id: data.family_id || null,
        pass_fail_mode: data.pass_fail_enabled && data.pass_fail_mode ? data.pass_fail_mode : null,
        pass_fail_threshold: data.pass_fail_enabled ? data.pass_fail_threshold : null,
      };
      const { error } = await supabase.from("capability_assessments").insert([insertData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-capability-assessments"] });
      toast({ description: "Capability assessment created successfully" });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const updateData = {
        ...data,
        instructions: data.instructions || null,
        instructions_self: data.instructions_self || null,
        instructions_evaluator: data.instructions_evaluator || null,
        feature_key: data.feature_key || null,
        program_id: data.program_id || null,
        category_id: data.category_id || null,
        family_id: data.family_id || null,
        pass_fail_mode: data.pass_fail_enabled && data.pass_fail_mode ? data.pass_fail_mode : null,
        pass_fail_threshold: data.pass_fail_enabled ? data.pass_fail_threshold : null,
      };
      const { error } = await supabase
        .from("capability_assessments")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-capability-assessments"] });
      toast({ description: "Capability assessment updated successfully" });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const retireMutation = useMutation({
    mutationFn: async ({ id, retire }: { id: string; retire: boolean }) => {
      const { error } = await supabase
        .from("capability_assessments")
        .update({ is_retired: retire, is_active: retire ? false : true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-capability-assessments"] });
      toast({ description: variables.retire ? "Assessment retired" : "Assessment restored" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (assessment: CapabilityAssessment) => {
      const newSlug = `${assessment.slug}-copy-${Date.now()}`;
      const { data: newAssessment, error: assessmentError } = await supabase
        .from("capability_assessments")
        .insert({
          name: `${assessment.name} (Copy)`,
          slug: newSlug,
          description: assessment.description,
          instructions: assessment.instructions,
          instructions_self: (assessment as any).instructions_self,
          instructions_evaluator: (assessment as any).instructions_evaluator,
          assessment_mode: (assessment as any).assessment_mode || "both",
          feature_key: assessment.feature_key,
          program_id: assessment.program_id,
          category_id: assessment.category_id,
          family_id: assessment.family_id,
          allow_instructor_eval: assessment.allow_instructor_eval,
          rating_scale: assessment.rating_scale,
          is_active: false,
          is_public: false,
          pass_fail_enabled: assessment.pass_fail_enabled,
          pass_fail_mode: assessment.pass_fail_mode,
          pass_fail_threshold: assessment.pass_fail_threshold,
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      const { data: domains } = await supabase
        .from("capability_domains")
        .select("*")
        .eq("assessment_id", assessment.id)
        .order("order_index");

      if (domains && domains.length > 0) {
        for (const domain of domains) {
          const { data: newDomain, error: domainError } = await supabase
            .from("capability_domains")
            .insert({
              assessment_id: newAssessment.id,
              name: domain.name,
              description: domain.description,
              order_index: domain.order_index,
            })
            .select()
            .single();
          if (domainError) throw domainError;

          const { data: questions } = await supabase
            .from("capability_domain_questions")
            .select("*")
            .eq("domain_id", domain.id)
            .order("order_index");

          if (questions && questions.length > 0) {
            const newQuestions = questions.map((q) => ({
              domain_id: newDomain.id,
              question_text: q.question_text,
              description: q.description,
              input_type: q.input_type,
              options: q.options,
              order_index: q.order_index,
            }));
            const { error: questionsError } = await supabase
              .from("capability_domain_questions")
              .insert(newQuestions);
            if (questionsError) throw questionsError;
          }
        }
      }

      return newAssessment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-capability-assessments"] });
      toast({ description: "Capability assessment cloned successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error cloning assessment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Sort assessments to show retired last
  const sortedAssessments = assessments?.slice().sort((a, b) => {
    if (a.is_retired !== b.is_retired) return a.is_retired ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Capability Assessments"
        description="Create and manage self-rating capability assessments with progress tracking, development items, and instructor evaluations"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={setIsDialogOpen}
        dialogTitle={editingItem ? "Edit Assessment" : "Create Capability Assessment"}
        createButtonLabel="New Assessment"
        dialogContent={
          <div className="max-h-[70vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Assessment Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: editingItem ? formData.slug : generateSlug(e.target.value),
                    });
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                  placeholder="cta-knowledge-check"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Access URL: /capabilities/{formData.slug || "your-slug"}
                </p>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="assessment_mode">Assessment Mode *</Label>
                <Select
                  value={formData.assessment_mode}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      assessment_mode: value as "self" | "evaluator" | "both",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both (Self + Evaluator)</SelectItem>
                    <SelectItem value="self">Self-Assessment Only</SelectItem>
                    <SelectItem value="evaluator">Evaluator Only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Controls who can use this assessment
                </p>
              </div>

              <div>
                <Label htmlFor="instructions">General Instructions (fallback)</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={2}
                  placeholder="Shown if mode-specific instructions not set..."
                />
              </div>

              {(formData.assessment_mode === "self" || formData.assessment_mode === "both") && (
                <div>
                  <Label htmlFor="instructions_self">Self-Assessment Instructions</Label>
                  <Textarea
                    id="instructions_self"
                    value={formData.instructions_self}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions_self: e.target.value })
                    }
                    rows={2}
                    placeholder="Rate yourself on each capability from 1 to N..."
                  />
                </div>
              )}

              {(formData.assessment_mode === "evaluator" ||
                formData.assessment_mode === "both") && (
                <div>
                  <Label htmlFor="instructions_evaluator">Evaluator Instructions</Label>
                  <Textarea
                    id="instructions_evaluator"
                    value={formData.instructions_evaluator}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions_evaluator: e.target.value })
                    }
                    rows={2}
                    placeholder="Rate the participant on each capability from 1 to N..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category_id">Category</Label>
                  <Select
                    value={formData.category_id || "_none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category_id: value === "_none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No category</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="family_id">Assessment Family</Label>
                  <Select
                    value={formData.family_id || "_none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, family_id: value === "_none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No family</SelectItem>
                      {families?.map((family) => (
                        <SelectItem key={family.id} value={family.id}>
                          {family.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="program_id">Program</Label>
                  <Select
                    value={formData.program_id || "_none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, program_id: value === "_none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No program</SelectItem>
                      {programs?.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="feature_key">Feature Gate (Optional)</Label>
                  <Select
                    value={formData.feature_key || "_none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, feature_key: value === "_none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No feature gate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No feature gate</SelectItem>
                      {features?.map((feature) => (
                        <SelectItem key={feature.id} value={feature.key}>
                          {feature.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="rating_scale">Rating Scale (1 to N)</Label>
                <Input
                  id="rating_scale"
                  type="number"
                  min={3}
                  max={10}
                  value={formData.rating_scale}
                  onChange={(e) =>
                    setFormData({ ...formData, rating_scale: parseInt(e.target.value) || 10 })
                  }
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="pass_fail_enabled">Pass/Fail Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable pass/fail threshold checking
                    </p>
                  </div>
                  <Switch
                    id="pass_fail_enabled"
                    checked={formData.pass_fail_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, pass_fail_enabled: checked })
                    }
                  />
                </div>

                {formData.pass_fail_enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                    <div>
                      <Label htmlFor="pass_fail_mode">Mode</Label>
                      <Select
                        value={formData.pass_fail_mode}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            pass_fail_mode: value as "" | "overall" | "per_domain",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="overall">Overall Average</SelectItem>
                          <SelectItem value="per_domain">Per Domain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="pass_fail_threshold">Threshold (%)</Label>
                      <Input
                        id="pass_fail_threshold"
                        type="number"
                        min={0}
                        max={100}
                        value={formData.pass_fail_threshold}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pass_fail_threshold: parseInt(e.target.value) || 75,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allow_instructor_eval">Allow Instructor Evaluations</Label>
                  <p className="text-xs text-muted-foreground">
                    Instructors can submit evaluations
                  </p>
                </div>
                <Switch
                  id="allow_instructor_eval"
                  checked={formData.allow_instructor_eval}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_instructor_eval: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-xs text-muted-foreground">Assessment is available for use</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_public">Public Access</Label>
                  <p className="text-xs text-muted-foreground">Anyone can access via public URL</p>
                </div>
                <Switch
                  id="is_public"
                  checked={formData.is_public}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                />
              </div>

              <AdminFormActions
                onCancel={() => setIsDialogOpen(false)}
                isEditing={!!editingItem}
                isSubmitting={isSubmitting}
                submitLabel={{ create: "Create Assessment", update: "Save Changes" }}
              />
            </form>
          </div>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : !sortedAssessments?.length ? (
        <AdminEmptyState
          icon={Gauge}
          title="No capability assessments yet"
          description="Create your first capability assessment to get started"
          actionLabel="Create Assessment"
          onAction={openCreate}
        />
      ) : (
        <TooltipProvider>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAssessments.map((assessment) => (
                  <TableRow
                    key={assessment.id}
                    className={assessment.is_retired ? "opacity-50" : ""}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium flex items-center gap-2">
                          {assessment.name}
                          {assessment.allow_instructor_eval && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Users className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>Instructor evaluations enabled</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground">{assessment.slug}</code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {assessment.is_retired ? (
                          <Badge variant="secondary">Retired</Badge>
                        ) : (
                          <Badge variant={assessment.is_active ? "default" : "secondary"}>
                            {assessment.is_active ? "Active" : "Inactive"}
                          </Badge>
                        )}
                        {assessment.is_public && <Badge variant="outline">Public</Badge>}
                        <Badge variant="outline">
                          {assessment.assessment_mode === "self"
                            ? "Self Only"
                            : assessment.assessment_mode === "evaluator"
                              ? "Evaluator Only"
                              : "Self + Evaluator"}
                        </Badge>
                        {assessment.pass_fail_enabled && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline">
                                <Gauge className="h-3 w-3 mr-1" />
                                {assessment.pass_fail_threshold}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Pass threshold: {assessment.pass_fail_threshold}% (
                              {assessment.pass_fail_mode})
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{assessment.assessment_categories?.name || "-"}</TableCell>
                    <TableCell>{assessment.programs?.name || "-"}</TableCell>
                    <TableCell>{getSnapshotCount(assessment.id)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/capability-assessments/${assessment.id}`)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/capabilities/${assessment.slug}`, "_blank")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(assessment)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cloneMutation.mutate(assessment)}
                          disabled={cloneMutation.isPending}
                        >
                          {cloneMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {getSnapshotCount(assessment.id) > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              retireMutation.mutate({
                                id: assessment.id,
                                retire: !assessment.is_retired,
                              })
                            }
                            disabled={retireMutation.isPending}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(assessment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TooltipProvider>
      )}
    </div>
  );
}
