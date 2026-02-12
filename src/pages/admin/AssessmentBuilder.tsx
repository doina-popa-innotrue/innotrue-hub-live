import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Edit, Trash2, Loader2, Eye, FileText, Settings, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from "@/components/admin";

type Assessment = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  instructions: string | null;
  feature_key: string | null;
  category_id: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  assessment_categories?: { name: string } | null;
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
  feature_key: string;
  category_id: string;
  is_active: boolean;
  is_public: boolean;
}

const initialFormData: FormData = {
  name: "",
  slug: "",
  description: "",
  instructions: "",
  feature_key: "",
  category_id: "",
  is_active: true,
  is_public: false,
};

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

export default function AssessmentBuilder() {
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
    isMutating,
  } = useAdminCRUD<Assessment, FormData>({
    tableName: "assessment_definitions",
    queryKey: "admin-assessment-definitions",
    entityName: "Assessment",
    orderBy: "created_at",
    orderDirection: "desc",
    select: "*, assessment_categories(name)",
    initialFormData,
    mapItemToForm: (item) => ({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      instructions: item.instructions || "",
      feature_key: item.feature_key || "",
      category_id: item.category_id || "",
      is_active: item.is_active,
      is_public: item.is_public,
    }),
  });

  const { data: features } = useQuery({
    queryKey: ["admin-features-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("features").select("id, key, name").order("name");

      if (error) throw error;
      return data as Feature[];
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

  // Custom create/update mutations for null handling
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const insertData = {
        ...data,
        feature_key: data.feature_key || null,
        category_id: data.category_id || null,
      };
      const { error } = await supabase.from("assessment_definitions").insert([insertData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-definitions"] });
      toast({ description: "Assessment created successfully" });
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
        feature_key: data.feature_key || null,
        category_id: data.category_id || null,
      };
      const { error } = await supabase
        .from("assessment_definitions")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-definitions"] });
      toast({ description: "Assessment updated successfully" });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (assessment: Assessment) => {
      // 1. Create new assessment with modified slug
      const newSlug = `${assessment.slug}-copy-${Date.now()}`;
      const { data: newAssessment, error: assessmentError } = await supabase
        .from("assessment_definitions")
        .insert({
          name: `${assessment.name} (Copy)`,
          slug: newSlug,
          description: assessment.description,
          instructions: assessment.instructions,
          is_active: false,
          is_public: false,
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      // 2. Clone dimensions
      const { data: dimensions } = await supabase
        .from("assessment_dimensions")
        .select("*")
        .eq("assessment_id", assessment.id);

      const dimensionIdMap: Record<string, string> = {};
      if (dimensions && dimensions.length > 0) {
        for (const dim of dimensions) {
          const { data: newDim, error: dimError } = await supabase
            .from("assessment_dimensions")
            .insert({
              assessment_id: newAssessment.id,
              name: dim.name,
              description: dim.description,
              order_index: dim.order_index,
            })
            .select()
            .single();
          if (dimError) throw dimError;
          dimensionIdMap[dim.id] = newDim.id;
        }
      }

      // 3. Clone questions and options
      const { data: questions } = await supabase
        .from("assessment_questions")
        .select("*")
        .eq("assessment_id", assessment.id);

      if (questions && questions.length > 0) {
        for (const question of questions) {
          const { data: newQuestion, error: questionError } = await supabase
            .from("assessment_questions")
            .insert({
              assessment_id: newAssessment.id,
              question_text: question.question_text,
              question_type: question.question_type,
              is_required: question.is_required,
              order_index: question.order_index,
            })
            .select()
            .single();
          if (questionError) throw questionError;

          // Clone options for this question
          const { data: options } = await supabase
            .from("assessment_options")
            .select("*")
            .eq("question_id", question.id);

          if (options && options.length > 0) {
            for (const option of options) {
              const { data: newOption, error: optionError } = await supabase
                .from("assessment_options")
                .insert({
                  question_id: newQuestion.id,
                  option_text: option.option_text,
                  order_index: option.order_index,
                })
                .select()
                .single();
              if (optionError) throw optionError;

              // Clone option scores
              const { data: scores } = await supabase
                .from("assessment_option_scores")
                .select("*")
                .eq("option_id", option.id);

              if (scores && scores.length > 0) {
                const newScores = scores.map((score) => ({
                  option_id: newOption.id,
                  dimension_id: dimensionIdMap[score.dimension_id],
                  score: score.score,
                }));
                const { error: scoresError } = await supabase
                  .from("assessment_option_scores")
                  .insert(newScores);
                if (scoresError) throw scoresError;
              }
            }
          }
        }
      }

      // 4. Clone interpretations
      const { data: interpretations } = await supabase
        .from("assessment_interpretations")
        .select("*")
        .eq("assessment_id", assessment.id);

      if (interpretations && interpretations.length > 0) {
        const newInterpretations = interpretations.map((interp) => ({
          assessment_id: newAssessment.id,
          name: interp.name,
          description: interp.description,
          conditions: interp.conditions,
          interpretation_text: interp.interpretation_text,
          priority: interp.priority,
        }));
        const { error: interpError } = await supabase
          .from("assessment_interpretations")
          .insert(newInterpretations);
        if (interpError) throw interpError;
      }

      return newAssessment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-definitions"] });
      toast({ description: "Assessment cloned successfully" });
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Assessment Builder"
        description="Create and manage custom assessments with questions, scoring dimensions, and interpretation rules"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={setIsDialogOpen}
        dialogTitle={editingItem ? "Edit Assessment" : "Create Assessment"}
        createButtonLabel="New Assessment"
        dialogContent={
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
                placeholder="leadership-assessment"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Public URL: /assess/{formData.slug || "your-slug"}
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
              <Label htmlFor="instructions">Instructions for Participants</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                rows={3}
                placeholder="Answer each question based on how you typically respond in work situations..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category_id">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No category</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="feature_key">Feature Gate (Optional)</Label>
                <Select
                  value={formData.feature_key}
                  onValueChange={(value) => setFormData({ ...formData, feature_key: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No feature gate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No feature gate</SelectItem>
                    {features?.map((feature) => (
                      <SelectItem key={feature.id} value={feature.key}>
                        {feature.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Only users with this feature enabled can access
                </p>
              </div>
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
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : !assessments?.length ? (
        <AdminEmptyState
          icon={FileText}
          title="No assessments yet"
          description="Create your first assessment to get started"
          actionLabel="Create Assessment"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4">
          {assessments.map((assessment) => (
            <Card key={assessment.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{assessment.name}</CardTitle>
                      <Badge variant={assessment.is_active ? "default" : "secondary"}>
                        {assessment.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {assessment.is_public && <Badge variant="outline">Public</Badge>}
                      {assessment.assessment_categories?.name && (
                        <Badge variant="outline">{assessment.assessment_categories.name}</Badge>
                      )}
                    </div>
                    <CardDescription>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        /assess/{assessment.slug}
                      </code>
                    </CardDescription>
                    {assessment.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {assessment.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/assessment-builder/${assessment.id}`)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/assess/${assessment.slug}`, "_blank")}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(assessment)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cloneMutation.mutate(assessment)}
                      disabled={cloneMutation.isPending}
                    >
                      {cloneMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(assessment.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
