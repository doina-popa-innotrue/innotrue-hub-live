import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FolderTree, FileQuestion, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Family {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  icon: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  _count?: {
    questions: number;
    templates: number;
  };
}

interface FormData {
  name: string;
  description: string;
  slug: string;
  icon: string;
  is_active: boolean;
}

const defaultFormData: FormData = {
  name: "",
  description: "",
  slug: "",
  icon: "",
  is_active: true,
};

export default function GuidedPathFamilies() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [deletingFamily, setDeletingFamily] = useState<Family | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  const { data: families = [], isLoading } = useQuery({
    queryKey: ["guided-path-families"],
    queryFn: async () => {
      const { data: familiesData, error } = await supabase
        .from("guided_path_template_families")
        .select("*")
        .order("order_index");

      if (error) throw error;

      // Get counts for each family
      const familiesWithCounts = await Promise.all(
        (familiesData || []).map(async (family) => {
          const [questionsResult, templatesResult] = await Promise.all([
            supabase
              .from("family_survey_questions")
              .select("id", { count: "exact", head: true })
              .eq("family_id", family.id),
            supabase
              .from("guided_path_templates")
              .select("id", { count: "exact", head: true })
              .eq("family_id", family.id),
          ]);

          return {
            ...family,
            _count: {
              questions: questionsResult.count || 0,
              templates: templatesResult.count || 0,
            },
          };
        }),
      );

      return familiesWithCounts as Family[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("guided_path_template_families").insert({
        name: data.name,
        description: data.description || null,
        slug: data.slug,
        icon: data.icon || null,
        is_active: data.is_active,
        order_index: families.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family created successfully");
      queryClient.invalidateQueries({ queryKey: ["guided-path-families"] });
      setDialogOpen(false);
      setFormData(defaultFormData);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create family: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("guided_path_template_families")
        .update({
          name: data.name,
          description: data.description || null,
          slug: data.slug,
          icon: data.icon || null,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family updated successfully");
      queryClient.invalidateQueries({ queryKey: ["guided-path-families"] });
      setDialogOpen(false);
      setEditingFamily(null);
      setFormData(defaultFormData);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update family: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guided_path_template_families").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["guided-path-families"] });
      setDeleteDialogOpen(false);
      setDeletingFamily(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete family: ${error.message}`);
    },
  });

  function openCreateDialog() {
    setEditingFamily(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  }

  function openEditDialog(family: Family) {
    setEditingFamily(family);
    setFormData({
      name: family.name,
      description: family.description || "",
      slug: family.slug,
      icon: family.icon || "",
      is_active: family.is_active,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }

    if (editingFamily) {
      updateMutation.mutate({ id: editingFamily.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Guided Path Families</h1>
          <p className="text-muted-foreground">
            Manage template families with surveys for path configuration
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Family
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Families</CardTitle>
          <CardDescription>
            Each family groups related path templates and defines a survey for path selection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <ArrowUpDown className="h-4 w-4" />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Templates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {families.map((family) => (
                <TableRow key={family.id}>
                  <TableCell className="text-muted-foreground">{family.order_index + 1}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{family.name}</p>
                      {family.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                          {family.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{family.slug}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <FileQuestion className="h-3 w-3" />
                      {family._count?.questions || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <FolderTree className="h-3 w-3" />
                      {family._count?.templates || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={family.is_active ? "default" : "secondary"}>
                      {family.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/guided-path-families/${family.id}`)}
                      >
                        Configure
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(family)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          setDeletingFamily(family);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {families.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No template families created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFamily ? "Edit Family" : "Create Family"}</DialogTitle>
            <DialogDescription>
              {editingFamily
                ? "Update the template family details"
                : "Create a new template family to group related paths"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name,
                    slug: prev.slug || generateSlug(name),
                  }));
                }}
                placeholder="e.g., Salesforce CTA Journey"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="e.g., salesforce-cta"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe this path family..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icon (optional)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData((prev) => ({ ...prev, icon: e.target.value }))}
                placeholder="e.g., trophy, target, rocket"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingFamily ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Family</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFamily?.name}"? This will also delete all
              survey questions and unlink associated templates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFamily && deleteMutation.mutate(deletingFamily.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
