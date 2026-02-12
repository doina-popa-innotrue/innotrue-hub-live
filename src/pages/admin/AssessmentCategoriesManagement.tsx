import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FolderTree } from "lucide-react";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from "@/components/admin";

type AssessmentCategory = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
};

type FormData = {
  name: string;
  description: string;
  order_index: number;
  is_active: boolean;
};

const initialFormData: FormData = {
  name: "",
  description: "",
  order_index: 0,
  is_active: true,
};

export default function AssessmentCategoriesManagement() {
  const {
    data: categories,
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
  } = useAdminCRUD<AssessmentCategory, FormData>({
    tableName: "assessment_categories",
    queryKey: "admin-assessment-categories",
    entityName: "Category",
    orderBy: "order_index",
    initialFormData,
    mapItemToForm: (category) => ({
      name: category.name,
      description: category.description || "",
      order_index: category.order_index,
      is_active: category.is_active,
    }),
  });

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Category Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g., leadership"
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          placeholder="What types of assessments belong in this category?"
        />
      </div>
      <div>
        <Label htmlFor="order_index">Display Order</Label>
        <Input
          id="order_index"
          type="number"
          value={formData.order_index}
          onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="is_active">Active</Label>
          <p className="text-xs text-muted-foreground">Available for use in assessments</p>
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
      />
    </form>
  );

  if (isLoading) {
    return <AdminLoadingState />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Assessment Categories"
        description="Manage categories for capability, leadership, and other assessment types"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={setIsDialogOpen}
        dialogTitle={editingItem ? "Edit Category" : "Create Category"}
        dialogContent={formContent}
        createButtonLabel="New Category"
      />

      {categories?.length === 0 ? (
        <AdminEmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Create your first assessment category"
          actionLabel="Create Category"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4">
          {categories?.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <FolderTree className="h-5 w-5" />
                        {category.name}
                      </CardTitle>
                      {category.is_active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                      <Badge variant="outline">Order: {category.order_index}</Badge>
                    </div>
                    {category.description && (
                      <CardDescription>{category.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(category.id, `Delete "${category.name}"?`)}
                    >
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
