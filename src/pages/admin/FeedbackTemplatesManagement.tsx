import { useState } from "react";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { SortableFieldList } from "@/components/admin/SortableFieldList";
import { PageLoadingState } from "@/components/ui/page-loading-state";

interface StructureField {
  id: string;
  type: "text" | "textarea" | "number" | "rating" | "select" | "checkbox" | "richtext";
  label: string;
  description?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  structure: StructureField[];
  is_active: boolean;
  created_at: string;
}

const defaultFormData = {
  name: "",
  description: "",
  is_active: true,
  structure: [] as StructureField[],
};

export default function FeedbackTemplatesManagement() {
  const {
    data: templates,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    openCreate,
    openEdit,
    handleSubmit,
    handleDelete,
    isMutating: isSubmitting,
    formData,
    setFormData,
  } = useAdminCRUD<Template, typeof defaultFormData>({
    queryKey: "feedback-templates",
    tableName: "feedback_template_types",
    entityName: "Template",
    initialFormData: defaultFormData,
    mapItemToForm: (template) => ({
      name: template.name,
      description: template.description || "",
      is_active: template.is_active,
      structure: template.structure || [],
    }),
    transform: (data) =>
      data.map((t: any) => ({
        ...t,
        structure: (t.structure as unknown as StructureField[]) || [],
      })),
  });

  const addField = () => {
    const newField: StructureField = {
      id: crypto.randomUUID(),
      type: "text",
      label: "",
      description: "",
      required: false,
    };
    setFormData({ ...formData, structure: [...formData.structure, newField] });
  };

  const updateField = (index: number, updates: Partial<StructureField>) => {
    const newFields = [...formData.structure];
    newFields[index] = { ...newFields[index], ...updates };
    setFormData({ ...formData, structure: newFields });
  };

  const removeField = (index: number) => {
    setFormData({ ...formData, structure: formData.structure.filter((_, i) => i !== index) });
  };

  if (isLoading) {
    return <PageLoadingState />;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Feedback Templates</h1>
            <p className="text-muted-foreground">
              Define structured feedback templates for coaches and instructors
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Template" : "New Template"}</DialogTitle>
                <DialogDescription>
                  Define the structure for feedback that coaches/instructors can provide
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Session Feedback, Assignment Review"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="When to use this template..."
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                    />
                    <Label>Active</Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Fields</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addField}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Field
                    </Button>
                  </div>

                  {formData.structure.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No fields defined. Add fields to create a structured form.
                    </p>
                  )}

                  <SortableFieldList
                    items={formData.structure}
                    onReorder={(newFields) => setFormData({ ...formData, structure: newFields })}
                    renderItem={(field, index) => (
                      <Card className="p-4 pl-10">
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Label *</Label>
                                  <Input
                                    value={field.label}
                                    onChange={(e) => updateField(index, { label: e.target.value })}
                                    placeholder="Field label"
                                    required
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Type</Label>
                                  <Select
                                    value={field.type}
                                    onValueChange={(v) =>
                                      updateField(index, { type: v as StructureField["type"] })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Short Text</SelectItem>
                                      <SelectItem value="textarea">Long Text</SelectItem>
                                      <SelectItem value="richtext">Rich Text</SelectItem>
                                      <SelectItem value="number">Number</SelectItem>
                                      <SelectItem value="rating">Rating Scale</SelectItem>
                                      <SelectItem value="select">Dropdown</SelectItem>
                                      <SelectItem value="checkbox">Checkbox</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">Description / Placeholder</Label>
                                <Input
                                  value={field.description || ""}
                                  onChange={(e) =>
                                    updateField(index, { description: e.target.value })
                                  }
                                  placeholder="Help text for this field"
                                />
                              </div>

                              {field.type === "rating" && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Min</Label>
                                    <Input
                                      type="number"
                                      value={field.min ?? 1}
                                      onChange={(e) =>
                                        updateField(index, { min: Number(e.target.value) })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Max</Label>
                                    <Input
                                      type="number"
                                      value={field.max ?? 5}
                                      onChange={(e) =>
                                        updateField(index, { max: Number(e.target.value) })
                                      }
                                    />
                                  </div>
                                </div>
                              )}

                              {field.type === "select" && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Options (one per line)</Label>
                                  <Textarea
                                    value={(field.options || []).join("\n")}
                                    onChange={(e) =>
                                      updateField(index, {
                                        options: e.target.value.split("\n").filter((o) => o.trim()),
                                      })
                                    }
                                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                                    rows={3}
                                  />
                                </div>
                              )}

                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={field.required || false}
                                  onCheckedChange={(v) => updateField(index, { required: v })}
                                />
                                <Label className="text-xs">Required</Label>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => removeField(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingItem ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>
              {templates?.length || 0} template{templates?.length !== 1 ? "s" : ""} defined
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!templates || templates.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No templates yet. Create one to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {template.description || "-"}
                      </TableCell>
                      <TableCell>{template.structure.length}</TableCell>
                      <TableCell>
                        <Switch checked={template.is_active} disabled />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(template)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(`Delete "${template.name}"? This cannot be undone.`)) {
                                handleDelete(template.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
