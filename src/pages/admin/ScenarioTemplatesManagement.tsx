import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2, Loader2, Eye, Lock, Unlock, FileText, Users } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader, AdminLoadingState, AdminEmptyState } from "@/components/admin";
import { useScenarioTemplates, useScenarioTemplateMutations } from "@/hooks/useScenarios";
import { useAuth } from "@/contexts/AuthContext";
import type { ScenarioTemplateFormData } from "@/types/scenarios";

const initialFormData: ScenarioTemplateFormData = {
  title: "",
  description: "",
  capability_assessment_id: "",
   category_id: "",
  is_protected: true,
  is_active: true,
};

export default function ScenarioTemplatesManagement() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<ScenarioTemplateFormData>(initialFormData);

  const { data: templates, isLoading } = useScenarioTemplates();
  const { createMutation, updateMutation, lockMutation, deleteMutation } = useScenarioTemplateMutations();

  // Fetch capability assessments for linking
  const { data: assessments } = useQuery({
    queryKey: ["capability-assessments-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("id, name, slug, rating_scale")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

   // Fetch scenario categories
   const { data: categories } = useQuery({
     queryKey: ["scenario-categories-list"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("scenario_categories")
         .select("id, name, color")
         .eq("is_active", true)
         .order("display_order");
       if (error) throw error;
       return data;
     },
   });

  // Fetch assignment counts
  const { data: assignmentCounts } = useQuery({
    queryKey: ["scenario-assignment-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenario_assignments")
        .select("template_id");
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach((item) => {
        counts[item.template_id] = (counts[item.template_id] || 0) + 1;
      });
      return counts;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        }
      });
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        }
      });
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      capability_assessment_id: item.capability_assessment_id || "",
       category_id: item.category_id || "",
      is_protected: item.is_protected,
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this scenario template? This will also delete all sections, paragraphs, and assignments.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleLockToggle = (id: string, currentlyLocked: boolean) => {
    if (!isAdmin) {
      toast({ title: "Permission denied", description: "Only admins can lock/unlock templates", variant: "destructive" });
      return;
    }
    lockMutation.mutate({ id, lock: !currentlyLocked });
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingItem(null);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return <AdminLoadingState message="Loading scenario templates..." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Scenario Templates"
        description="Create and manage scenario-based assessments with structured content and domain-linked scoring"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
        dialogTitle={editingItem ? "Edit Scenario Template" : "Create Scenario Template"}
        createButtonLabel="New Template"
        dialogContent={
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g., Enterprise Architecture Case Study"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Brief overview of the scenario..."
              />
            </div>

           <div>
             <Label htmlFor="category_id">Category</Label>
             <Select
               value={formData.category_id}
               onValueChange={(value) => setFormData({ ...formData, category_id: value })}
             >
               <SelectTrigger>
                 <SelectValue placeholder="Select a category..." />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="none">None</SelectItem>
                 {categories?.map((category) => (
                   <SelectItem key={category.id} value={category.id}>
                     {category.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
             <p className="text-xs text-muted-foreground mt-1">
               Organize scenarios into categories for easier filtering
             </p>
           </div>

            <div>
              <Label htmlFor="capability_assessment_id">Link to Capability Assessment</Label>
              <Select
                value={formData.capability_assessment_id}
                onValueChange={(value) => setFormData({ ...formData, capability_assessment_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assessment for scoring..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {assessments?.map((assessment) => (
                    <SelectItem key={assessment.id} value={assessment.id}>
                      {assessment.name} (Scale: 0-{assessment.rating_scale})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Scoring will use the rating scale from the linked assessment
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_protected">IP Protected (View-only for clients)</Label>
              <Switch
                id="is_protected"
                checked={formData.is_protected}
                onCheckedChange={(checked) => setFormData({ ...formData, is_protected: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        }
      />

      {!templates || templates.length === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title="No scenario templates"
          description="Create your first scenario template to get started"
          actionLabel="Create Template"
          onAction={() => setIsDialogOpen(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                 <TableHead>Category</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Assignments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow 
                  key={template.id} 
                  className={template.is_locked ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{template.title}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                   <TableCell>
                     {template.scenario_categories ? (
                       <Badge variant="outline">
                         {template.scenario_categories.name}
                       </Badge>
                     ) : (
                       <span className="text-muted-foreground text-sm">—</span>
                     )}
                   </TableCell>
                  <TableCell>
                    {template.capability_assessments ? (
                      <Badge variant="secondary">
                        {template.capability_assessments.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not linked</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{assignmentCounts?.[template.id] || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.is_locked && (
                        <Badge variant="destructive">
                          <Lock className="h-3 w-3 mr-1" />
                          Locked
                        </Badge>
                      )}
                      {template.is_protected && (
                        <Badge variant="outline">Protected</Badge>
                      )}
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/admin/scenario-templates/${template.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View & Edit Content</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {isAdmin && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleLockToggle(template.id, template.is_locked)}
                                disabled={lockMutation.isPending}
                              >
                                {template.is_locked ? (
                                  <Unlock className="h-4 w-4" />
                                ) : (
                                  <Lock className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {template.is_locked ? "Unlock Template" : "Lock Template"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {!template.is_locked && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(template)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(template.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
