import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import type { Json } from "@/integrations/supabase/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, X, Loader2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SortableFieldList } from "@/components/admin/SortableFieldList";

interface AssignmentField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "rating" | "checkbox" | "select" | "richtext";
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

interface AssignmentType {
  id: string;
  name: string;
  description: string | null;
  structure: AssignmentField[];
  is_active: boolean;
  created_at: string;
  scoring_assessment_id: string | null;
}

interface CapabilityAssessment {
  id: string;
  name: string;
}

const defaultField: AssignmentField = {
  id: crypto.randomUUID(),
  label: "",
  type: "text",
  required: false,
};

const defaultFormData = {
  name: "",
  description: "",
  is_active: true,
  structure: [{ ...defaultField }] as AssignmentField[],
  scoring_assessment_id: null as string | null,
};

export default function AssignmentTypesManagement() {
  const { toast } = useToast();
  const { data: capabilityAssessments } = useQuery({
    queryKey: ["capability-assessments-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CapabilityAssessment[];
    },
  });

  const {
    data: assignmentTypes,
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
    handleSubmit: handleCRUDSubmit,
  } = useAdminCRUD<AssignmentType, typeof defaultFormData>({
    queryKey: "assignment-types",
    tableName: "module_assignment_types",
    entityName: "Assignment type",
    orderBy: 'created_at',
    orderDirection: 'desc',
    initialFormData: defaultFormData,
    mapItemToForm: (type) => ({
      name: type.name,
      description: type.description || "",
      is_active: type.is_active,
      structure: type.structure.length > 0 ? type.structure : [{ ...defaultField, id: crypto.randomUUID() }],
      scoring_assessment_id: type.scoring_assessment_id,
    }),
    transform: (data) => data.map((d: any) => ({
      ...d,
      structure: (d.structure || []) as unknown as AssignmentField[],
    })),
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (formData.structure.some((f) => !f.label.trim())) {
      toast({ title: "All fields must have a label", variant: "destructive" });
      return;
    }
    handleCRUDSubmit(e ?? formData);
  };

  const addField = () => {
    setFormData({
      ...formData,
      structure: [...formData.structure, { ...defaultField, id: crypto.randomUUID() }],
    });
  };

  const removeField = (index: number) => {
    if (formData.structure.length <= 1) return;
    setFormData({
      ...formData,
      structure: formData.structure.filter((_, i) => i !== index),
    });
  };

  const updateField = (index: number, updates: Partial<AssignmentField>) => {
    const newStructure = [...formData.structure];
    newStructure[index] = { ...newStructure[index], ...updates };
    setFormData({ ...formData, structure: newStructure });
  };

  const handleClone = (type: AssignmentType) => {
    // Clone with new UUIDs for fields and prefixed name
    const clonedStructure = type.structure.map(field => ({
      ...field,
      id: crypto.randomUUID(),
    }));
    
    setFormData({
      name: `${type.name} (Copy)`,
      description: type.description || "",
      is_active: type.is_active,
      structure: clonedStructure,
      scoring_assessment_id: type.scoring_assessment_id,
    });
    setIsDialogOpen(true);
  };

  const getFieldTypeBadgeColor = (type: AssignmentField["type"]) => {
    switch (type) {
      case "text": return "bg-blue-100 text-blue-800";
      case "textarea": return "bg-green-100 text-green-800";
      case "number": return "bg-purple-100 text-purple-800";
      case "rating": return "bg-orange-100 text-orange-800";
      case "checkbox": return "bg-pink-100 text-pink-800";
      case "select": return "bg-cyan-100 text-cyan-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Assignment Types</h1>
          <p className="text-muted-foreground">Define structured assignment templates for modules</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Assignment Type
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : assignmentTypes?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No assignment types defined yet. Create your first one!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignmentTypes?.map((type) => (
            <Card key={type.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <Badge variant={type.is_active ? "default" : "secondary"}>
                      {type.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleClone(type)} title="Clone">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => openEdit(type)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Delete"
                      onClick={() => {
                        if (confirm("Delete this assignment type?")) {
                          handleDelete(type.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {type.description && (
                  <CardDescription>{type.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {type.structure.map((field, idx) => (
                    <Badge key={idx} variant="outline" className={getFieldTypeBadgeColor(field.type)}>
                      {field.label} ({field.type}){field.required && " *"}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Assignment Type" : "Create Assignment Type"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Module Competency Assignment"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this assignment type..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div>
                <Label htmlFor="scoring_assessment">Instructor Scoring Assessment</Label>
                <Select 
                  value={formData.scoring_assessment_id || 'none'} 
                  onValueChange={(v) => setFormData({ ...formData, scoring_assessment_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None - use form fields only" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None - use form fields only</SelectItem>
                    {capabilityAssessments?.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Optional. Link a capability assessment template for instructors to score client submissions.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Assignment Fields</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-4 w-4 mr-1" /> Add Field
                </Button>
              </div>

              <SortableFieldList
                items={formData.structure}
                onReorder={(newStructure) => setFormData({ ...formData, structure: newStructure })}
                renderItem={(field, index) => (
                  <Card className="p-4 pl-10">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Field Label *</Label>
                            <Input
                              value={field.label}
                              onChange={(e) => updateField(index, { label: e.target.value })}
                              placeholder="e.g., Technical Skills"
                            />
                          </div>
                          <div>
                            <Label>Field Type</Label>
                            <Select
                              value={field.type}
                              onValueChange={(value: AssignmentField["type"]) =>
                                updateField(index, { type: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text (short)</SelectItem>
                                <SelectItem value="textarea">Text (long)</SelectItem>
                                <SelectItem value="richtext">Rich Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="rating">Rating (1-5)</SelectItem>
                                <SelectItem value="checkbox">Checkbox</SelectItem>
                                <SelectItem value="select">Dropdown</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {(field.type === "number" || field.type === "rating") && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Min Value</Label>
                              <Input
                                type="number"
                                value={field.min ?? (field.type === "rating" ? 1 : "")}
                                onChange={(e) => updateField(index, { min: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <Label>Max Value</Label>
                              <Input
                                type="number"
                                value={field.max ?? (field.type === "rating" ? 5 : "")}
                                onChange={(e) => updateField(index, { max: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        )}

                        {field.type === "select" && (
                          <div>
                            <Label>Options (comma-separated)</Label>
                            <Input
                              defaultValue={field.options?.join(", ") ?? ""}
                              onBlur={(e) =>
                                updateField(index, {
                                  options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                                })
                              }
                              placeholder="Option 1, Option 2, Option 3"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Type options separated by commas, then click outside to save
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(v) => updateField(index, { required: v })}
                          />
                          <Label>Required field</Label>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeField(index)}
                        disabled={formData.structure.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
