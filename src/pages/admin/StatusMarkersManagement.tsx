import { useAdminCRUD, useAdminToggle } from "@/hooks/useAdminCRUD";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, GripVertical, Tags } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from "@/components/admin";

interface StatusMarker {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

type FormData = {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
};

const initialFormData: FormData = {
  name: "",
  description: "",
  color: "blue",
  is_active: true,
};

const colorOptions = ["blue", "green", "red", "purple", "orange", "yellow", "pink", "indigo"];

export default function StatusMarkersManagement() {
  const {
    data: markers = [],
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
  } = useAdminCRUD<StatusMarker, FormData>({
    tableName: "status_markers",
    queryKey: "status-markers",
    entityName: "Status marker",
    orderBy: "display_order",
    initialFormData,
    mapItemToForm: (marker) => ({
      name: marker.name,
      description: marker.description || "",
      color: marker.color,
      is_active: marker.is_active,
    }),
  });

  const toggleActive = useAdminToggle("status_markers", "status-markers", "Status marker");

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g., CTA Candidate"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
        />
      </div>
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: `var(--${color}-500, ${color})` }}
              onClick={() => setFormData({ ...formData, color })}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Active</Label>
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
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Status Markers</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <AdminPageHeader
          title="Status Markers"
          description="Manage client status markers like CTA Candidate, Architect, etc."
          isDialogOpen={isDialogOpen}
          onDialogOpenChange={setIsDialogOpen}
          dialogTitle={editingItem ? "Edit Status Marker" : "Create Status Marker"}
          dialogContent={formContent}
          createButtonLabel="New Marker"
        />

        <Card>
          <CardHeader>
            <CardTitle>All Status Markers</CardTitle>
            <CardDescription>
              These markers can be assigned to clients to indicate their status level.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {markers.length === 0 ? (
              <AdminEmptyState
                icon={Tags}
                title="No status markers yet"
                description="Create your first status marker!"
                actionLabel="New Marker"
                onAction={openCreate}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markers.map((marker) => (
                    <TableRow key={marker.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium">
                          {marker.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {marker.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={marker.is_active}
                          onCheckedChange={() =>
                            toggleActive.mutate({
                              id: marker.id,
                              column: "is_active",
                              value: !marker.is_active,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(marker)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() =>
                              handleDelete(
                                marker.id,
                                `Delete "${marker.name}"? Clients with this marker will have their marker cleared.`,
                              )
                            }
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
    </div>
  );
}
