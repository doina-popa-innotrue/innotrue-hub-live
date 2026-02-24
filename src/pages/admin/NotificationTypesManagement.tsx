import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Lock,
  FolderOpen,
  Bell,
  Mail,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface NotificationCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  order_index: number | null;
  is_active: boolean | null;
  is_system: boolean;
}

interface NotificationType {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  category_id: string | null;
  is_active: boolean | null;
  is_critical: boolean | null;
  is_system: boolean;
  email_template_key: string | null;
  default_email_enabled: boolean | null;
  default_in_app_enabled: boolean | null;
  order_index: number | null;
  notification_categories?: NotificationCategory | null;
}

export default function NotificationTypesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<NotificationType | null>(null);
  const [editingCategory, setEditingCategory] = useState<NotificationCategory | null>(null);

  // Expanded categories in types tab
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Form states
  const [typeForm, setTypeForm] = useState({
    key: "",
    name: "",
    description: "",
    icon: "",
    category_id: "" as string | null,
    is_critical: false,
    email_template_key: "",
    default_email_enabled: true,
    default_in_app_enabled: true,
    order_index: 0,
  });

  const [categoryForm, setCategoryForm] = useState({
    key: "",
    name: "",
    description: "",
    icon: "",
    order_index: 0,
  });

  // ── Queries ──────────────────────────────────────────────────────────

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["notification-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_categories")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as NotificationCategory[];
    },
  });

  const { data: types, isLoading: typesLoading } = useQuery({
    queryKey: ["notification-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_types")
        .select("*, notification_categories(*)")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as NotificationType[];
    },
  });

  // ── Type Mutations ───────────────────────────────────────────────────

  const createTypeMutation = useMutation({
    mutationFn: async (data: Omit<typeof typeForm, "category_id"> & { category_id: string | null }) => {
      const { error } = await supabase.from("notification_types").insert({
        key: data.key,
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        category_id: data.category_id,
        is_critical: data.is_critical,
        email_template_key: data.email_template_key || null,
        default_email_enabled: data.default_email_enabled,
        default_in_app_enabled: data.default_in_app_enabled,
        order_index: data.order_index,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-types"] });
      setIsTypeDialogOpen(false);
      resetTypeForm();
      toast({ title: "Notification type created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error creating notification type",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof typeForm> & { category_id?: string | null } }) => {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.description !== undefined) payload.description = data.description || null;
      if (data.icon !== undefined) payload.icon = data.icon || null;
      if (data.category_id !== undefined) payload.category_id = data.category_id;
      if (data.is_critical !== undefined) payload.is_critical = data.is_critical;
      if (data.email_template_key !== undefined) payload.email_template_key = data.email_template_key || null;
      if (data.default_email_enabled !== undefined) payload.default_email_enabled = data.default_email_enabled;
      if (data.default_in_app_enabled !== undefined) payload.default_in_app_enabled = data.default_in_app_enabled;
      if (data.order_index !== undefined) payload.order_index = data.order_index;
      // Only allow key change for non-system types
      if (data.key !== undefined) payload.key = data.key;

      const { error } = await supabase.from("notification_types").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-types"] });
      setIsTypeDialogOpen(false);
      setEditingType(null);
      resetTypeForm();
      toast({ title: "Notification type updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error updating notification type",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-types"] });
      toast({ title: "Notification type deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error deleting notification type",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const toggleTypeActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("notification_types")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-types"] });
    },
    onError: (error) => {
      toast({
        title: "Error toggling notification type",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // ── Category Mutations ───────────────────────────────────────────────

  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const { error } = await supabase.from("notification_categories").insert({
        key: data.key,
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        order_index: data.order_index,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-categories"] });
      setIsCategoryDialogOpen(false);
      resetCategoryForm();
      toast({ title: "Category created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error creating category",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof categoryForm> }) => {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.description !== undefined) payload.description = data.description || null;
      if (data.icon !== undefined) payload.icon = data.icon || null;
      if (data.order_index !== undefined) payload.order_index = data.order_index;
      if (data.key !== undefined) payload.key = data.key;

      const { error } = await supabase.from("notification_categories").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-categories"] });
      queryClient.invalidateQueries({ queryKey: ["notification-types"] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      resetCategoryForm();
      toast({ title: "Category updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error updating category",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-categories"] });
      queryClient.invalidateQueries({ queryKey: ["notification-types"] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error deleting category",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const toggleCategoryActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("notification_categories")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-categories"] });
    },
    onError: (error) => {
      toast({
        title: "Error toggling category",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // ── Form Helpers ─────────────────────────────────────────────────────

  const resetTypeForm = () => {
    setTypeForm({
      key: "",
      name: "",
      description: "",
      icon: "",
      category_id: null,
      is_critical: false,
      email_template_key: "",
      default_email_enabled: true,
      default_in_app_enabled: true,
      order_index: 0,
    });
  };

  const resetCategoryForm = () => {
    setCategoryForm({ key: "", name: "", description: "", icon: "", order_index: 0 });
  };

  const handleOpenTypeDialog = (type?: NotificationType) => {
    if (type) {
      setEditingType(type);
      setTypeForm({
        key: type.key,
        name: type.name,
        description: type.description || "",
        icon: type.icon || "",
        category_id: type.category_id,
        is_critical: type.is_critical ?? false,
        email_template_key: type.email_template_key || "",
        default_email_enabled: type.default_email_enabled ?? true,
        default_in_app_enabled: type.default_in_app_enabled ?? true,
        order_index: type.order_index ?? 0,
      });
    } else {
      setEditingType(null);
      resetTypeForm();
    }
    setIsTypeDialogOpen(true);
  };

  const handleOpenCategoryDialog = (category?: NotificationCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        key: category.key,
        name: category.name,
        description: category.description || "",
        icon: category.icon || "",
        order_index: category.order_index ?? 0,
      });
    } else {
      setEditingCategory(null);
      resetCategoryForm();
    }
    setIsCategoryDialogOpen(true);
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = {
      ...typeForm,
      category_id: typeForm.category_id || null,
    };
    if (editingType) {
      // For system types, exclude key from update
      const updateData = editingType.is_system
        ? { ...formData, key: undefined }
        : formData;
      updateTypeMutation.mutate({ id: editingType.id, data: updateData as typeof typeForm });
    } else {
      createTypeMutation.mutate(formData);
    }
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      const updateData = editingCategory.is_system
        ? { ...categoryForm, key: undefined }
        : categoryForm;
      updateCategoryMutation.mutate({ id: editingCategory.id, data: updateData });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // ── Group types by category ──────────────────────────────────────────

  const groupedTypes =
    types?.reduce(
      (acc, type) => {
        const categoryId = type.category_id || "uncategorized";
        if (!acc[categoryId]) acc[categoryId] = [];
        acc[categoryId].push(type);
        return acc;
      },
      {} as Record<string, NotificationType[]>,
    ) || {};

  const sortedCategoryIds = [
    ...(categories?.map((c) => c.id) || []),
    "uncategorized",
  ].filter((id) => groupedTypes[id]?.length > 0);

  const isLoading = categoriesLoading || typesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notification Types
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage notification categories and types used across the platform
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => handleOpenCategoryDialog()}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Add Category
          </Button>
          <Button onClick={() => handleOpenTypeDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Type
          </Button>
        </div>
      </div>

      <Tabs defaultValue="types" className="space-y-6">
        <TabsList>
          <TabsTrigger value="types">Notification Types</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        {/* ── Types Tab ─────────────────────────────────────────────── */}
        <TabsContent value="types">
          <Card>
            <CardHeader>
              <CardTitle>All Notification Types</CardTitle>
              <CardDescription>
                Notification types grouped by category. Each type controls what
                notifications users can receive and how they are delivered.
                <span className="block mt-1 text-xs">
                  <Lock className="h-3 w-3 inline mr-1" />
                  <strong>System</strong> types are used by platform logic and cannot be deleted or
                  have their key renamed. Display properties are still editable.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedCategoryIds.map((categoryId) => {
                const category = categories?.find((c) => c.id === categoryId);
                const categoryTypes = groupedTypes[categoryId] || [];
                const isExpanded = expandedCategories.has(categoryId);

                return (
                  <Collapsible
                    key={categoryId}
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(categoryId)}
                    className="border rounded-lg"
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {category?.name || "Uncategorized"}
                        </span>
                        {category?.icon && (
                          <code className="text-xs text-muted-foreground">
                            {category.icon}
                          </code>
                        )}
                        <Badge variant="secondary" className="ml-2">
                          {categoryTypes.length}
                        </Badge>
                        {category && !(category.is_active ?? true) && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Email Template</TableHead>
                            <TableHead className="text-center">Defaults</TableHead>
                            <TableHead className="text-center">Active</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryTypes
                            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                            .map((type) => (
                            <TableRow key={type.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {type.name}
                                  {type.is_system && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge
                                            variant="outline"
                                            className="gap-1 text-xs border-amber-500/50 text-amber-600 cursor-help"
                                          >
                                            <Lock className="h-3 w-3" />
                                            System
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs">
                                          <p className="font-medium">Protected System Type</p>
                                          <p className="text-xs mt-1">
                                            This notification type is used by platform code
                                            (edge functions, cron jobs, etc). Its key cannot be
                                            changed and it cannot be deleted.
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {type.is_critical && (
                                    <Badge variant="destructive" className="gap-1 text-xs">
                                      <AlertTriangle className="h-3 w-3" />
                                      Critical
                                    </Badge>
                                  )}
                                </div>
                                {type.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {type.description}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <code className="rounded bg-muted px-2 py-1 text-sm">
                                  {type.key}
                                </code>
                              </TableCell>
                              <TableCell>
                                {type.email_template_key ? (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <code className="text-xs">{type.email_template_key}</code>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-3">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1">
                                          <Bell className={`h-3 w-3 ${type.default_in_app_enabled ? "text-primary" : "text-muted-foreground/40"}`} />
                                          <span className="text-xs">{type.default_in_app_enabled ? "On" : "Off"}</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>In-app default</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1">
                                          <Mail className={`h-3 w-3 ${type.default_email_enabled ? "text-primary" : "text-muted-foreground/40"}`} />
                                          <span className="text-xs">{type.default_email_enabled ? "On" : "Off"}</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>Email default</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={type.is_active ?? true}
                                  onCheckedChange={(checked) =>
                                    toggleTypeActiveMutation.mutate({
                                      id: type.id,
                                      isActive: checked,
                                    })
                                  }
                                  disabled={type.is_critical}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenTypeDialog(type)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteTypeMutation.mutate(type.id)}
                                  disabled={type.is_system}
                                  title={
                                    type.is_system
                                      ? "System types cannot be deleted"
                                      : "Delete notification type"
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              {sortedCategoryIds.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No notification types yet. Add your first type to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Categories Tab ────────────────────────────────────────── */}
        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Notification Categories</CardTitle>
              <CardDescription>
                Organize notification types into categories shown in user preferences.
                <span className="block mt-1 text-xs">
                  <Lock className="h-3 w-3 inline mr-1" />
                  <strong>System</strong> categories are referenced by platform code. Their key
                  cannot be changed and they cannot be deleted.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Icon</TableHead>
                    <TableHead>Types</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <Badge variant="outline">{category.order_index ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {category.name}
                          {category.is_system && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="gap-1 text-xs border-amber-500/50 text-amber-600 cursor-help"
                                  >
                                    <Lock className="h-3 w-3" />
                                    System
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="font-medium">Protected System Category</p>
                                  <p className="text-xs mt-1">
                                    This category is used by platform code. Its key cannot be
                                    changed and it cannot be deleted.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {category.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {category.key}
                        </code>
                      </TableCell>
                      <TableCell>
                        {category.icon ? (
                          <code className="text-xs">{category.icon}</code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {groupedTypes[category.id]?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={category.is_active ?? true}
                          onCheckedChange={(checked) =>
                            toggleCategoryActiveMutation.mutate({
                              id: category.id,
                              isActive: checked,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenCategoryDialog(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCategoryMutation.mutate(category.id)}
                          disabled={category.is_system}
                          title={
                            category.is_system
                              ? "System categories cannot be deleted"
                              : "Delete category"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!categories || categories.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No categories yet. Add a category to organize notification types.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Type Dialog ───────────────────────────────────────────────── */}
      <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleTypeSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Edit Notification Type" : "Create New Notification Type"}
              </DialogTitle>
              <DialogDescription>
                {editingType
                  ? "Update notification type details"
                  : "Add a new notification type to the system"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="tname">Name</Label>
                <Input
                  id="tname"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="Session Reminder"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tkey">Key</Label>
                <Input
                  id="tkey"
                  value={typeForm.key}
                  onChange={(e) => setTypeForm({ ...typeForm, key: e.target.value })}
                  placeholder="session_reminder"
                  required
                  disabled={editingType?.is_system}
                />
                {editingType?.is_system && (
                  <p className="text-xs text-amber-600">
                    System type keys cannot be changed — they are used by platform code.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tcategory">Category</Label>
                <Select
                  value={typeForm.category_id || "none"}
                  onValueChange={(value) =>
                    setTypeForm({ ...typeForm, category_id: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tdesc">Description</Label>
                <Textarea
                  id="tdesc"
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  placeholder="When a session is about to start"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticon">Icon</Label>
                  <Input
                    id="ticon"
                    value={typeForm.icon}
                    onChange={(e) => setTypeForm({ ...typeForm, icon: e.target.value })}
                    placeholder="bell"
                  />
                  <p className="text-xs text-muted-foreground">Lucide icon name</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="torder">Order</Label>
                  <Input
                    id="torder"
                    type="number"
                    value={typeForm.order_index}
                    onChange={(e) =>
                      setTypeForm({ ...typeForm, order_index: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ttemplate">Email Template Key</Label>
                <Input
                  id="ttemplate"
                  value={typeForm.email_template_key}
                  onChange={(e) =>
                    setTypeForm({ ...typeForm, email_template_key: e.target.value })
                  }
                  placeholder="session_reminder"
                />
                <p className="text-xs text-muted-foreground">
                  Maps to a template in process-email-queue. Leave empty to skip email delivery.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">Defaults</Label>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">In-App Enabled by Default</Label>
                    <p className="text-xs text-muted-foreground">
                      Users see this notification in-app unless they opt out
                    </p>
                  </div>
                  <Switch
                    checked={typeForm.default_in_app_enabled}
                    onCheckedChange={(checked) =>
                      setTypeForm({ ...typeForm, default_in_app_enabled: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Email Enabled by Default</Label>
                    <p className="text-xs text-muted-foreground">
                      Users receive email unless they opt out
                    </p>
                  </div>
                  <Switch
                    checked={typeForm.default_email_enabled}
                    onCheckedChange={(checked) =>
                      setTypeForm({ ...typeForm, default_email_enabled: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Critical Notification</Label>
                    <p className="text-xs text-muted-foreground">
                      Critical notifications cannot be disabled by users
                    </p>
                  </div>
                  <Switch
                    checked={typeForm.is_critical}
                    onCheckedChange={(checked) =>
                      setTypeForm({ ...typeForm, is_critical: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTypeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingType ? "Update" : "Create"} Type
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Category Dialog ───────────────────────────────────────────── */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCategorySubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : "Create New Category"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? "Update category details"
                  : "Add a new category to organize notification types"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cname">Category Name</Label>
                <Input
                  id="cname"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Scheduling & Reminders"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ckey">Key</Label>
                <Input
                  id="ckey"
                  value={categoryForm.key}
                  onChange={(e) => setCategoryForm({ ...categoryForm, key: e.target.value })}
                  placeholder="scheduling"
                  required
                  disabled={editingCategory?.is_system}
                />
                {editingCategory?.is_system && (
                  <p className="text-xs text-amber-600">
                    System category keys cannot be changed — they are used by platform code.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cdesc">Description</Label>
                <Textarea
                  id="cdesc"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, description: e.target.value })
                  }
                  placeholder="Notifications related to scheduling"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cicon">Icon</Label>
                  <Input
                    id="cicon"
                    value={categoryForm.icon}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, icon: e.target.value })
                    }
                    placeholder="calendar"
                  />
                  <p className="text-xs text-muted-foreground">Lucide icon name</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="corder">Display Order</Label>
                  <Input
                    id="corder"
                    type="number"
                    value={categoryForm.order_index}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        order_index: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Lower = first</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCategoryDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingCategory ? "Update" : "Create"} Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
