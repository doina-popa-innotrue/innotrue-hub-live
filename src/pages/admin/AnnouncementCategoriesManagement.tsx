import { useAdminCRUD, useAdminToggle } from '@/hooks/useAdminCRUD';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Tags } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from '@/components/admin';
import { IconPicker, DynamicIcon } from '@/components/admin/IconPicker';

interface AnnouncementCategory {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

type FormData = {
  name: string;
  label: string;
  icon: string;
  color: string;
  is_active: boolean;
};

const initialFormData: FormData = {
  name: '',
  label: '',
  icon: 'Info',
  color: 'blue',
  is_active: true,
};

const colorOptions = [
  { name: 'blue', label: 'Blue' },
  { name: 'green', label: 'Green' },
  { name: 'amber', label: 'Amber' },
  { name: 'orange', label: 'Orange' },
  { name: 'red', label: 'Red' },
  { name: 'purple', label: 'Purple' },
  { name: 'pink', label: 'Pink' },
  { name: 'indigo', label: 'Indigo' },
];

export default function AnnouncementCategoriesManagement() {
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
  } = useAdminCRUD<AnnouncementCategory, FormData>({
    tableName: 'announcement_categories',
    queryKey: 'announcement-categories',
    entityName: 'Announcement category',
    orderBy: 'display_order',
    initialFormData,
    mapItemToForm: (category) => ({
      name: category.name,
      label: category.label,
      icon: category.icon || 'Info',
      color: category.color || 'blue',
      is_active: category.is_active,
    }),
  });

  const toggleActive = useAdminToggle('announcement_categories', 'announcement-categories', 'Announcement category');

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Key (unique identifier)</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
          required
          placeholder="e.g., feature_launch"
          disabled={!!editingItem}
        />
        <p className="text-xs text-muted-foreground">Used internally, cannot be changed after creation</p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="label">Display Label</Label>
        <Input
          id="label"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          required
          placeholder="e.g., New Feature Launch"
        />
      </div>

      <IconPicker
        label="Category Icon"
        value={formData.icon}
        onChange={(icon) => setFormData({ ...formData, icon })}
      />
      
      <div className="space-y-2">
        <Label>Color Theme</Label>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <Button
              key={color.name}
              type="button"
              variant={formData.color === color.name ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormData({ ...formData, color: color.name })}
            >
              {color.label}
            </Button>
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
            <BreadcrumbLink href="/admin/announcements">Announcements</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Categories</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <AdminPageHeader
          title="Announcement Categories"
          description="Manage categories for organizing announcements (e.g., Just Launched, Coming Soon)"
          isDialogOpen={isDialogOpen}
          onDialogOpenChange={setIsDialogOpen}
          dialogTitle={editingItem ? 'Edit Category' : 'Create Category'}
          dialogContent={formContent}
          createButtonLabel="New Category"
        />

        <Card>
          <CardHeader>
            <CardTitle>All Categories</CardTitle>
            <CardDescription>Categories help organize and visually distinguish different types of announcements.</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <AdminEmptyState
                icon={Tags}
                title="No categories yet"
                description="Create your first announcement category!"
                actionLabel="New Category"
                onAction={openCreate}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Icon</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <DynamicIcon name={category.icon || 'Info'} className="h-5 w-5" />
                      </TableCell>
                      <TableCell className="font-medium">{category.label}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{category.name}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{category.color}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={category.is_active}
                          onCheckedChange={() => toggleActive.mutate({ id: category.id, column: 'is_active', value: !category.is_active })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive"
                            onClick={() => handleDelete(category.id, `Delete "${category.label}"? Announcements using this category will have their category cleared.`)}
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
