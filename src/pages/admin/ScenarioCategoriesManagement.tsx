import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
  AdminTable,
  AdminTableColumn,
  AdminTableActions,
} from "@/components/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";

interface ScenarioCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

const initialFormData: FormData = {
  name: "",
  description: "",
  color: "gray",
  display_order: 0,
  is_active: true,
};

const colorOptions = [
  { name: "gray", label: "Gray", class: "bg-gray-500" },
  { name: "blue", label: "Blue", class: "bg-blue-500" },
  { name: "green", label: "Green", class: "bg-green-500" },
  { name: "yellow", label: "Yellow", class: "bg-yellow-500" },
  { name: "orange", label: "Orange", class: "bg-orange-500" },
  { name: "red", label: "Red", class: "bg-red-500" },
  { name: "purple", label: "Purple", class: "bg-purple-500" },
  { name: "pink", label: "Pink", class: "bg-pink-500" },
];

export default function ScenarioCategoriesManagement() {
  const {
    data: categories = [],
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
  } = useAdminCRUD<ScenarioCategory, FormData>({
    tableName: "scenario_categories",
    queryKey: "scenario-categories",
    entityName: "Scenario category",
    orderBy: "display_order",
    initialFormData,
    mapItemToForm: (category) => ({
      name: category.name,
      description: category.description || "",
      color: category.color || "gray",
      display_order: category.display_order,
      is_active: category.is_active,
    }),
  });

  const columns: AdminTableColumn<ScenarioCategory>[] = [
    {
      key: "name",
      header: "Name",
      accessor: (category) => (
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${colorOptions.find((c) => c.name === category.color)?.class || "bg-gray-500"}`}
          />
          <span className="font-medium">{category.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "description",
      header: "Description",
      accessor: (category) => (
        <span className="text-muted-foreground text-sm">{category.description || "—"}</span>
      ),
    },
    {
      key: "display_order",
      header: "Order",
      accessor: "display_order",
      sortable: true,
    },
    {
      key: "is_active",
      header: "Status",
      accessor: (category) => (
        <Badge variant={category.is_active ? "default" : "secondary"}>
          {category.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Category Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g., Enterprise Scenarios"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          placeholder="What types of scenarios belong in this category?"
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <Button
              key={color.name}
              type="button"
              variant={formData.color === color.name ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setFormData({ ...formData, color: color.name })}
            >
              <div className={`w-3 h-3 rounded-full ${color.class}`} />
              {color.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_order">Display Order</Label>
        <Input
          id="display_order"
          type="number"
          value={formData.display_order}
          onChange={(e) =>
            setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
          }
        />
        <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="is_active">Active</Label>
          <p className="text-xs text-muted-foreground">Available for use in scenarios</p>
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
    return <AdminLoadingState message="Loading scenario categories..." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Scenario Categories"
        description="Manage categories for organizing scenario templates"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={setIsDialogOpen}
        dialogTitle={editingItem ? "Edit Category" : "Add Category"}
        dialogContent={formContent}
        createButtonLabel="Add Category"
      />

      {categories.length === 0 ? (
        <AdminEmptyState
          icon={FolderOpen}
          title="No categories yet"
          description="Create your first scenario category to organize your templates"
          actionLabel="Add Category"
          onAction={openCreate}
        />
      ) : (
        <AdminTable
          data={categories}
          columns={columns}
          renderActions={(category) => (
            <AdminTableActions
              onEdit={() => openEdit(category)}
              onDelete={() => handleDelete(category.id)}
            />
          )}
          emptyState={{
            icon: FolderOpen,
            title: "No categories yet",
            description: "Create your first scenario category to organize your templates",
            actionLabel: "Add Category",
            onAction: openCreate,
          }}
        />
      )}
    </div>
  );
}
