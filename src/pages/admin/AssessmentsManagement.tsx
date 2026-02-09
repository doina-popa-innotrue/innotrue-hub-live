import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2, ExternalLink, DollarSign } from "lucide-react";
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
        .from('psychometric_assessments')
        .update(submitData)
        .eq('id', editingItem.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('psychometric_assessments')
        .insert(submitData);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Psychometric Assessments</h1>
          <p className="text-muted-foreground mt-2">
            Manage available assessments for clients
          </p>
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
              <DialogTitle>
                {editingItem ? "Edit Assessment" : "Add Assessment"}
              </DialogTitle>
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
                      onClick={() => openEdit(assessment)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(assessment.id)}
                    >
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
    </div>
  );
}
