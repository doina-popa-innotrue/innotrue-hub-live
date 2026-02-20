import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import {
  usePsychometricSchemaMap,
  useUpsertPsychometricSchema,
} from "@/hooks/usePsychometricSchemas";
import type { SchemaDimension } from "@/hooks/usePsychometricSchemas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2, ExternalLink, DollarSign, Sliders, X } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextDisplay } from "@/components/ui/rich-text-display";

type Assessment = {
  id: string;
  name: string;
  description: string | null;
  provider: string | null;
  category: string;
  is_active: boolean;
  feature_key: string | null;
  url: string | null;
  cost: number | null;
};

const defaultFormData = {
  name: "",
  description: "",
  provider: "",
  category: "personality",
  is_active: true,
  feature_key: "",
  url: "",
  cost: "",
};

export default function AssessmentsManagement() {
  const {
    data: assessments,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    openCreate,
    openEdit,
    handleDelete,
    isMutating: isSubmitting,
    formData,
    setFormData,
  } = useAdminCRUD<Assessment, typeof defaultFormData>({
    queryKey: "admin-assessments",
    tableName: "psychometric_assessments",
    entityName: "Assessment",
    initialFormData: defaultFormData,
    mapItemToForm: (assessment) => ({
      name: assessment.name,
      description: assessment.description || "",
      provider: assessment.provider || "",
      category: assessment.category,
      is_active: assessment.is_active,
      feature_key: assessment.feature_key || "",
      url: assessment.url || "",
      cost: assessment.cost?.toString() || "",
    }),
  });

  // Custom submit handler for form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      name: formData.name,
      description: formData.description || null,
      provider: formData.provider || null,
      category: formData.category,
      is_active: formData.is_active,
      feature_key: formData.feature_key || null,
      url: formData.url || null,
      cost: formData.cost ? parseFloat(formData.cost) : null,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("psychometric_assessments")
        .update(submitData)
        .eq("id", editingItem.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("psychometric_assessments").insert(submitData);
      if (error) throw error;
    }
    setIsDialogOpen(false);
  };

  const { data: features } = useQuery({
    queryKey: ["assessment-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("features")
        .select("id, key, name")
        .like("key", "assessments_%")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // DP6: Dimension schema management
  const { schemaMap } = usePsychometricSchemaMap();
  const upsertSchema = useUpsertPsychometricSchema();
  const [dimensionDialogOpen, setDimensionDialogOpen] = useState(false);
  const [dimensionAssessmentId, setDimensionAssessmentId] = useState<string | null>(null);
  const [dimensionAssessmentName, setDimensionAssessmentName] = useState("");
  const [dimensions, setDimensions] = useState<SchemaDimension[]>([]);

  const openDimensionDialog = (assessment: Assessment) => {
    setDimensionAssessmentId(assessment.id);
    setDimensionAssessmentName(assessment.name);
    const existing = schemaMap.get(assessment.id);
    setDimensions(
      existing?.dimensions && existing.dimensions.length > 0
        ? [...existing.dimensions]
        : [{ key: "", label: "", min: 0, max: 100 }],
    );
    setDimensionDialogOpen(true);
  };

  const addDimension = () => {
    setDimensions([...dimensions, { key: "", label: "", min: 0, max: 100 }]);
  };

  const removeDimension = (index: number) => {
    setDimensions(dimensions.filter((_, i) => i !== index));
  };

  const updateDimension = (index: number, field: keyof SchemaDimension, value: string | number) => {
    const updated = [...dimensions];
    updated[index] = { ...updated[index], [field]: value };
    setDimensions(updated);
  };

  const handleSaveDimensions = async () => {
    if (!dimensionAssessmentId) return;
    const valid = dimensions.filter((d) => d.key.trim() && d.label.trim());
    if (valid.length === 0) return;

    await upsertSchema.mutateAsync({
      assessmentId: dimensionAssessmentId,
      dimensions: valid,
    });
    setDimensionDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Psychometric Assessments</h1>
          <p className="text-muted-foreground mt-2">Manage available assessments for clients</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 w-full sm:w-auto" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Assessment" : "Add Assessment"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Assessment Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personality">Personality</SelectItem>
                    <SelectItem value="aptitude">Aptitude</SelectItem>
                    <SelectItem value="career">Career</SelectItem>
                    <SelectItem value="emotional-intelligence">Emotional Intelligence</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(value) => setFormData({ ...formData, description: value })}
                  placeholder="Enter assessment description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="url">Assessment URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://..."
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Cost</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="feature_key">Required Feature (for plan gating)</Label>
                <Select
                  value={formData.feature_key}
                  onValueChange={(value) => setFormData({ ...formData, feature_key: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No feature required (accessible to all)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No feature required</SelectItem>
                    {features?.map((feature) => (
                      <SelectItem key={feature.id} value={feature.key}>
                        {feature.name} ({feature.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Link this assessment to a feature to restrict access by plan
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingItem ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assessments?.map((assessment) => (
            <Card key={assessment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle>{assessment.name}</CardTitle>
                      {assessment.is_active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    {assessment.provider && (
                      <p className="text-sm text-muted-foreground">
                        Provider: {assessment.provider}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{assessment.category}</Badge>
                      {assessment.cost != null && (
                        <Badge variant="outline" className="gap-1">
                          <DollarSign className="h-3 w-3" />
                          {assessment.cost.toFixed(2)}
                        </Badge>
                      )}
                      {schemaMap.get(assessment.id) && (
                        <Badge variant="outline" className="gap-1">
                          <Sliders className="h-3 w-3" />
                          {schemaMap.get(assessment.id)!.dimensions.length} dimensions
                        </Badge>
                      )}
                    </div>
                    {assessment.url && (
                      <a
                        href={assessment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Assessment
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Define dimensions"
                      onClick={() => openDimensionDialog(assessment)}
                    >
                      <Sliders className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(assessment)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(assessment.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {assessment.description && (
                <CardContent>
                  <RichTextDisplay content={assessment.description} />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* DP6: Dimension Schema Dialog */}
      <Dialog open={dimensionDialogOpen} onOpenChange={setDimensionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Define Dimensions — {dimensionAssessmentName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Define the scoring dimensions for this assessment (e.g., DISC has D, I, S, C).
            Coaches and clients will enter scores for each dimension.
          </p>
          <div className="space-y-3 mt-4">
            {dimensions.map((dim, index) => (
              <div key={index} className="flex items-end gap-2 p-3 rounded-lg border">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Key</Label>
                  <Input
                    value={dim.key}
                    onChange={(e) => updateDimension(index, "key", e.target.value)}
                    placeholder="D"
                    className="h-8"
                  />
                </div>
                <div className="flex-[2] space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={dim.label}
                    onChange={(e) => updateDimension(index, "label", e.target.value)}
                    placeholder="Dominance"
                    className="h-8"
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    value={dim.min}
                    onChange={(e) => updateDimension(index, "min", parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    value={dim.max}
                    onChange={(e) => updateDimension(index, "max", parseFloat(e.target.value) || 100)}
                    className="h-8"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeDimension(index)}
                  disabled={dimensions.length <= 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" onClick={addDimension}>
              <Plus className="h-4 w-4 mr-1" />
              Add Dimension
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDimensionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveDimensions}
                disabled={upsertSchema.isPending || dimensions.every((d) => !d.key.trim())}
              >
                {upsertSchema.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Dimensions
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
