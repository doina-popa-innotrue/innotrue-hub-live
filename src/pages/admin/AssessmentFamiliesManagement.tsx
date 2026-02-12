/**
 * REFACTORED VERSION - Example of using useAdminCRUD pattern
 *
 * This demonstrates the consolidated admin CRUD infrastructure.
 * Compare with the original file to see how much boilerplate is eliminated.
 */
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FolderTree, Gauge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
  AdminStatusBadge,
  AdminTableActions,
} from "@/components/admin";

type AssessmentFamily = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AssessmentCount = {
  family_id: string;
  count: number;
};

type FormData = {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
};

const initialFormData: FormData = {
  name: "",
  slug: "",
  description: "",
  is_active: true,
};

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

export default function AssessmentFamiliesManagement() {
  const { toast } = useToast();

  // Use the consolidated CRUD hook - eliminates ~80 lines of boilerplate
  const {
    data: families,
    isLoading,
    formData,
    setFormData,
    editingItem,
    isDialogOpen,
    setIsDialogOpen,
    openCreate,
    openEdit,
    handleSubmit,
    handleDelete,
    isSubmitting,
    isDeleting,
  } = useAdminCRUD<AssessmentFamily, FormData>({
    tableName: "assessment_families",
    queryKey: "admin-assessment-families",
    entityName: "Assessment family",
    initialFormData,
    mapItemToForm: (family) => ({
      name: family.name,
      slug: family.slug,
      description: family.description || "",
      is_active: family.is_active,
    }),
  });

  // Get count of assessments per family (additional query specific to this page)
  const { data: assessmentCounts } = useQuery({
    queryKey: ["assessment-family-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("family_id")
        .not("family_id", "is", null);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((item) => {
        if (item.family_id) {
          counts[item.family_id] = (counts[item.family_id] || 0) + 1;
        }
      });

      return Object.entries(counts).map(([family_id, count]) => ({
        family_id,
        count,
      })) as AssessmentCount[];
    },
  });

  const getAssessmentCount = useCallback(
    (familyId: string) => {
      return assessmentCounts?.find((c) => c.family_id === familyId)?.count || 0;
    },
    [assessmentCounts],
  );

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: editingItem ? formData.slug : generateSlug(name),
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    handleSubmit(e);
  };

  const canDelete = (family: AssessmentFamily) => {
    const count = getAssessmentCount(family.id);
    return count === 0;
  };

  const getDeleteDisabledReason = (family: AssessmentFamily) => {
    const count = getAssessmentCount(family.id);
    if (count > 0) {
      return `This family has ${count} assessment(s) linked. Remove them first.`;
    }
    return undefined;
  };

  const handleDeleteWithValidation = (family: AssessmentFamily) => {
    const count = getAssessmentCount(family.id);
    if (count > 0) {
      toast({
        title: "Cannot delete",
        description: `This family has ${count} assessment(s) linked. Remove them first.`,
        variant: "destructive",
      });
      return;
    }
    handleDelete(family.id);
  };

  // Form content for the dialog
  const formContent = (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Family Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g., Salesforce Architecture Assessment"
          required
        />
      </div>
      <div>
        <Label htmlFor="slug">Slug *</Label>
        <Input
          id="slug"
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          placeholder="e.g., salesforce-architecture"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">Used for grouping and URLs</p>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          placeholder="What assessments in this family measure..."
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="is_active">Active</Label>
          <p className="text-xs text-muted-foreground">Family is available for use</p>
        </div>
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
      </div>
      <AdminFormActions
        isEditing={!!editingItem}
        isSubmitting={isSubmitting}
        onCancel={() => setIsDialogOpen(false)}
        submitLabel={{ create: "Create", update: "Update" }}
      />
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Header with create button - uses AdminPageHeader */}
      <AdminPageHeader
        title="Assessment Families"
        description="Group related assessment versions together (e.g., 'Architecture Assessment v1', 'v2', 'v3')"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={setIsDialogOpen}
        dialogTitle={editingItem ? "Edit Assessment Family" : "Create Assessment Family"}
        dialogContent={formContent}
        createButtonLabel="New Family"
      />

      {/* Loading state */}
      {isLoading && <AdminLoadingState />}

      {/* Empty state */}
      {!isLoading && (families?.length ?? 0) === 0 && (
        <AdminEmptyState
          icon={FolderTree}
          title="No assessment families yet"
          description="Create families to group related assessment versions together"
          actionLabel="Create Family"
          onAction={openCreate}
        />
      )}

      {/* Data table */}
      {!isLoading && families && families.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Family</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Assessments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {families.map((family) => {
                const count = getAssessmentCount(family.id);
                return (
                  <TableRow key={family.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{family.name}</span>
                        <span className="text-xs text-muted-foreground">{family.slug}</span>
                        {family.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {family.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge isActive={family.is_active} />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Gauge className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{count}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <AdminTableActions
                        onEdit={() => openEdit(family)}
                        onDelete={() => handleDeleteWithValidation(family)}
                        deleteDisabled={!canDelete(family)}
                        deleteDisabledReason={getDeleteDisabledReason(family)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
