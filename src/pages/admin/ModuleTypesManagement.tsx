import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Blocks } from "lucide-react";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminFormActions,
  AdminTable,
  AdminTableActions,
  AdminBreadcrumb,
} from "@/components/admin";
import type { AdminTableColumn } from "@/components/admin";

interface ModuleType {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

type FormData = {
  name: string;
  description: string;
};

const initialFormData: FormData = {
  name: "",
  description: "",
};

export default function ModuleTypesManagement() {
  const {
    data: moduleTypes = [],
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
  } = useAdminCRUD<ModuleType, FormData>({
    tableName: "module_types",
    queryKey: "module-types",
    entityName: "Module type",
    orderBy: "name",
    initialFormData,
    mapItemToForm: (type) => ({
      name: type.name,
      description: type.description || "",
    }),
  });

  const columns: AdminTableColumn<ModuleType>[] = [
    {
      key: "name",
      header: "Name",
      accessor: "name",
      sortable: true,
      className: "font-medium capitalize",
    },
    {
      key: "description",
      header: "Description",
      accessor: (item) => item.description || null,
      hideOnMobile: true,
    },
  ];

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g., Workshop, Coaching Call"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description of this module type"
          rows={3}
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
      <AdminBreadcrumb items={[{ label: "Module Types" }]} />

      <AdminPageHeader
        title="Module Types"
        description="Manage the types of modules that can be created in programs"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={setIsDialogOpen}
        dialogTitle={editingItem ? "Edit Module Type" : "Create Module Type"}
        dialogContent={formContent}
        createButtonLabel="New Module Type"
      />

      <AdminTable
        title="All Module Types"
        description="Manage the types of modules that can be created in programs"
        data={moduleTypes}
        columns={columns}
        renderActions={(type) => (
          <AdminTableActions
            onEdit={() => openEdit(type)}
            onDelete={() =>
              handleDelete(type.id, `Delete "${type.name}"? This action cannot be undone.`)
            }
          />
        )}
        emptyState={{
          icon: Blocks,
          title: "No module types yet",
          description: "Create your first module type.",
          actionLabel: "New Module Type",
          onAction: openCreate,
        }}
      />
    </div>
  );
}
