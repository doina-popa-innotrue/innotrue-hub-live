import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FolderTree, GripVertical } from "lucide-react";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from "@/components/admin";
import {
  useSkillCategories,
  useSkillCategoryMutations,
  SkillCategory,
} from "@/hooks/useSkillCategories";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

type FormData = {
  name: string;
  key: string;
  description: string;
  color: string;
  icon: string;
  order_index: number;
  is_active: boolean;
};

const initialFormData: FormData = {
  name: "",
  key: "",
  description: "",
  color: "",
  icon: "",
  order_index: 0,
  is_active: true,
};

// Sortable row component for drag-and-drop
interface SortableRowProps {
  category: SkillCategory;
  onEdit: (category: SkillCategory) => void;
  onDelete: (id: string) => void;
}

function SortableRow({ category, onEdit, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50 bg-muted")}>
      <TableCell>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{category.order_index}</TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {category.color && (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
          )}
          {category.name}
        </div>
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{category.key}</code>
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[300px] truncate">
        {category.description || "—"}
      </TableCell>
      <TableCell>
        <Badge variant={category.is_active ? "default" : "secondary"}>
          {category.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => onEdit(category)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Category</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{category.name}"? Skills in this category will
                  become uncategorized.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(category.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function SkillCategoriesManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SkillCategory | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const { data: categories = [], isLoading } = useSkillCategories({ activeOnly: false });
  const { createMutation, updateMutation, deleteMutation } = useSkillCategoryMutations();

  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => {
      // Auto-generate key when creating new category and key matches what would be generated from the previous name
      // (meaning user hasn't manually edited the key)
      const shouldAutoGenerateKey =
        !editingCategory && (prev.key === "" || prev.key === generateKey(prev.name));

      return {
        ...prev,
        name,
        key: shouldAutoGenerateKey ? generateKey(name) : prev.key,
      };
    });
  };

  const getNextOrderIndex = () => {
    if (categories.length === 0) return 10;
    const maxOrder = Math.max(...categories.map((c) => c.order_index));
    return maxOrder + 10; // Increment by 10 to allow manual reordering
  };

  const openCreate = () => {
    setEditingCategory(null);
    setFormData({
      ...initialFormData,
      key: "", // Explicitly set empty key for new categories
      order_index: getNextOrderIndex(),
    });
    setIsDialogOpen(true);
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredCategories.findIndex((cat) => cat.id === active.id);
      const newIndex = filteredCategories.findIndex((cat) => cat.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(filteredCategories, oldIndex, newIndex);

        // Update order_index for all affected items (use increments of 10)
        const updates = reordered.map((cat, index) => ({
          id: cat.id,
          order_index: (index + 1) * 10,
        }));

        // Update each category's order
        for (const update of updates) {
          await updateMutation.mutateAsync(update);
        }
      }
    }
  };

  const openEdit = (category: SkillCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      key: category.key,
      description: category.description || "",
      color: category.color || "",
      icon: category.icon || "",
      order_index: category.order_index,
      is_active: category.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      key: formData.key || generateKey(formData.name),
      description: formData.description || null,
      color: formData.color || null,
      icon: formData.icon || null,
      order_index: formData.order_index,
      is_active: formData.is_active,
    };

    if (editingCategory) {
      await updateMutation.mutateAsync({ id: editingCategory.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }

    setIsDialogOpen(false);
    setFormData(initialFormData);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Leadership"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Key *</Label>
          <Input
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            placeholder="e.g., leadership"
            required
          />
          <p className="text-xs text-muted-foreground">Unique identifier (auto-generated)</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this category..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Color</Label>
          <Input
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            placeholder="e.g., #3B82F6"
          />
        </div>
        <div className="space-y-2">
          <Label>Icon</Label>
          <Input
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            placeholder="e.g., star"
          />
        </div>
        <div className="space-y-2">
          <Label>Order</Label>
          <Input
            type="number"
            value={formData.order_index}
            onChange={(e) =>
              setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })
            }
          />
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
        isEditing={!!editingCategory}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
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
        title="Skill Categories"
        description="Manage categories for organizing skills into capability clusters"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={setIsDialogOpen}
        dialogTitle={editingCategory ? "Edit Category" : "Add New Category"}
        dialogContent={formContent}
        createButtonLabel="Add Category"
        actions={<FolderTree className="h-8 w-8 text-primary" />}
      />

      <Card>
        <CardHeader>
          <CardTitle>All Categories ({categories.length})</CardTitle>
          <CardDescription>
            Categories group related skills together for easier navigation and reporting.
          </CardDescription>
          <div className="pt-2">
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredCategories.length === 0 ? (
            <AdminEmptyState
              icon={FolderTree}
              title="No categories defined yet"
              description="Click 'Add Category' to create your first skill category."
              actionLabel="Add Category"
              onAction={openCreate}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="w-[60px]">Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={filteredCategories.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredCategories.map((category) => (
                      <SortableRow
                        key={category.id}
                        category={category}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
