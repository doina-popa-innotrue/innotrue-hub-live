import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Gauge, FolderOpen, GripVertical, Lock, Info, Download } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FeatureCategory {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
}

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_consumable: boolean;
  is_system: boolean;
  category_id: string | null;
  feature_categories?: FeatureCategory | null;
}

interface Plan {
  id: string;
  name: string;
  key: string;
}

interface PlanFeature {
  id: string;
  plan_id: string;
  feature_id: string;
  enabled: boolean;
  limit_value: number | null;
  plans: { name: string };
  features: { name: string; key: string };
}

export default function FeaturesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [editingCategory, setEditingCategory] = useState<FeatureCategory | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['uncategorized']));
  const [featureForm, setFeatureForm] = useState({
    key: '',
    name: '',
    description: '',
    is_consumable: false,
    category_id: '' as string | null,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    display_order: 0,
  });

  const { data: categories } = useQuery({
    queryKey: ['feature-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as FeatureCategory[];
    },
  });

  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('features')
        .select('*, feature_categories(*)')
        .order('name');

      if (error) throw error;
      return data as Feature[];
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, key')
        .eq('is_active', true)
        .order('tier_level', { ascending: true, nullsFirst: true });

      if (error) throw error;
      return data as Plan[];
    },
  });

  const { data: planFeatures } = useQuery({
    queryKey: ['plan-features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_features')
        .select(`
          *,
          plans!inner(name),
          features!inner(name, key)
        `);

      if (error) throw error;
      return data as PlanFeature[];
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: async (data: typeof featureForm) => {
      const { error } = await supabase.from('features').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      setIsFeatureDialogOpen(false);
      resetFeatureForm();
      toast({ title: 'Feature created successfully' });
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof featureForm }) => {
      const { error } = await supabase.from('features').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      setIsFeatureDialogOpen(false);
      setEditingFeature(null);
      resetFeatureForm();
      toast({ title: 'Feature updated successfully' });
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('features').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      toast({ title: 'Feature deleted successfully' });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const { error } = await supabase.from('feature_categories').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-categories'] });
      setIsCategoryDialogOpen(false);
      resetCategoryForm();
      toast({ title: 'Category created successfully' });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof categoryForm }) => {
      const { error } = await supabase.from('feature_categories').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-categories'] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      resetCategoryForm();
      toast({ title: 'Category updated successfully' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feature_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-categories'] });
      queryClient.invalidateQueries({ queryKey: ['features'] });
      toast({ title: 'Category deleted successfully' });
    },
  });


  const togglePlanFeatureMutation = useMutation({
    mutationFn: async ({
      planId,
      featureId,
      enabled,
      limitValue,
    }: {
      planId: string;
      featureId: string;
      enabled: boolean;
      limitValue?: number | null;
    }) => {
      const { data: existing } = await supabase
        .from('plan_features')
        .select('id')
        .eq('plan_id', planId)
        .eq('feature_id', featureId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('plan_features')
          .update({ enabled, limit_value: limitValue })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('plan_features').insert({
          plan_id: planId,
          feature_id: featureId,
          enabled,
          limit_value: limitValue,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
      toast({ title: 'Feature access updated' });
    },
  });

  const resetFeatureForm = () => {
    setFeatureForm({ key: '', name: '', description: '', is_consumable: false, category_id: null });
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '', display_order: 0 });
  };

  const handleOpenFeatureDialog = (feature?: Feature) => {
    if (feature) {
      setEditingFeature(feature);
      setFeatureForm({
        key: feature.key,
        name: feature.name,
        description: feature.description || '',
        is_consumable: feature.is_consumable,
        category_id: feature.category_id,
      });
    } else {
      setEditingFeature(null);
      resetFeatureForm();
    }
    setIsFeatureDialogOpen(true);
  };

  const handleOpenCategoryDialog = (category?: FeatureCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        display_order: category.display_order,
      });
    } else {
      setEditingCategory(null);
      resetCategoryForm();
    }
    setIsCategoryDialogOpen(true);
  };

  const handleFeatureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = {
      ...featureForm,
      category_id: featureForm.category_id || null,
    };
    if (editingFeature) {
      updateFeatureMutation.mutate({ id: editingFeature.id, data: formData });
    } else {
      createFeatureMutation.mutate(formData);
    }
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryForm });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const getPlanFeatureStatus = (planId: string, featureId: string) => {
    return planFeatures?.find(
      (pf) => pf.plan_id === planId && pf.feature_id === featureId
    );
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Export configuration functions
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportConfig = async (exportType: 'feature-assignments' | 'credit-config') => {
    setIsExporting(exportType);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({ title: 'Not authenticated', variant: 'destructive' });
        return;
      }

      const response = await supabase.functions.invoke('export-feature-config', {
        body: { exportType },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Export failed');
      }

      // Create download
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: 'Configuration exported successfully' });
    } catch (error) {
      console.error('Export error:', error);
      toast({ 
        title: 'Export failed', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    } finally {
      setIsExporting(null);
    }
  };

  // Group features by category
  const groupedFeatures = features?.reduce((acc, feature) => {
    const categoryId = feature.category_id || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>) || {};

  // Sort categories by display_order, with uncategorized at the end
  const sortedCategoryIds = [
    ...(categories?.map(c => c.id) || []),
    'uncategorized',
  ].filter(id => groupedFeatures[id]?.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Features Management</h1>
          <p className="text-muted-foreground">
            Manage features and configure access per plan
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting !== null}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export Config'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem 
                onClick={() => handleExportConfig('feature-assignments')}
                disabled={isExporting !== null}
              >
                Feature Assignments (Plans, Tracks, Add-ons)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleExportConfig('credit-config')}
                disabled={isExporting !== null}
              >
                Credit Configuration
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => handleOpenCategoryDialog()}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Add Category
          </Button>
          <Button onClick={() => handleOpenFeatureDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Feature
          </Button>
        </div>
      </div>

      <Tabs defaultValue="features" className="space-y-6">
        <TabsList>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="configuration">Plan Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Available Features</CardTitle>
              <CardDescription>
                Manage all features available in the system, organized by category
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedCategoryIds.map((categoryId) => {
                const category = categories?.find(c => c.id === categoryId);
                const categoryFeatures = groupedFeatures[categoryId] || [];
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
                          {category?.name || 'Uncategorized'}
                        </span>
                        <Badge variant="secondary" className="ml-2">
                          {categoryFeatures.length}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryFeatures.map((feature) => (
                            <TableRow key={feature.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {feature.name}
                                  {feature.is_system && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="gap-1 text-xs border-amber-500/50 text-amber-600 cursor-help">
                                            <Lock className="h-3 w-3" />
                                            System
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs">
                                          <p className="font-medium">Protected System Feature</p>
                                          <p className="text-xs mt-1">
                                            This feature controls core platform functionality or navigation visibility. 
                                            Removing or disabling it may break essential features or hide critical menu items.
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="rounded bg-muted px-2 py-1 text-sm">
                                  {feature.key}
                                </code>
                              </TableCell>
                              <TableCell>
                                {feature.is_consumable ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <Gauge className="h-3 w-3" />
                                    Consumable
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Access</Badge>
                                )}
                              </TableCell>
                              <TableCell className="max-w-md">
                                {feature.description ? (
                                  <RichTextDisplay content={feature.description} className="text-sm" />
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenFeatureDialog(feature)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteFeatureMutation.mutate(feature.id)}
                                  disabled={feature.is_system}
                                  title={feature.is_system ? "System features cannot be deleted" : "Delete feature"}
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
                  No features yet. Add your first feature to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Feature Categories</CardTitle>
              <CardDescription>
                Organize features into logical categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="w-16">
                        <Badge variant="outline">{category.display_order}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="max-w-md text-muted-foreground">
                        {category.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {groupedFeatures[category.id]?.length || 0}
                        </Badge>
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
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!categories || categories.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No categories yet. Add a category to organize your features.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle>Plan Feature Configuration</CardTitle>
              <CardDescription>
                Configure which features are available for each plan.
                <span className="block mt-1 text-xs">
                  <Lock className="h-3 w-3 inline mr-1" />
                  <strong>System</strong> features are required for core functionality or menu visibility.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 z-10 [&_tr]:border-b">
                  <tr className="border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-card">Feature</th>
                    {plans?.map((plan) => (
                      <th key={plan.id} className="h-12 px-4 text-center align-middle font-medium text-muted-foreground bg-card">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {sortedCategoryIds.map((categoryId) => {
                    const category = categories?.find(c => c.id === categoryId);
                    const categoryFeatures = groupedFeatures[categoryId] || [];

                    return (
                      <>
                        <tr key={`header-${categoryId}`} className="bg-muted/30">
                          <td colSpan={(plans?.length || 0) + 1} className="p-3 font-medium">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              {category?.name || 'Uncategorized'}
                            </div>
                          </td>
                        </tr>
                        {categoryFeatures.map((feature) => (
                          <tr key={feature.id} className="border-b transition-colors hover:bg-muted/50">
                            <td className="p-4 pl-8 align-middle font-medium">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {feature.name}
                                    {feature.is_system && (
                                      <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                        <Lock className="h-3 w-3 mr-1" />
                                        System
                                      </Badge>
                                    )}
                                    {feature.is_consumable && (
                                      <Badge variant="secondary" className="text-xs">
                                        <Gauge className="h-3 w-3 mr-1" />
                                        Uses
                                      </Badge>
                                    )}
                                  </div>
                                  <code className="text-xs text-muted-foreground">
                                    {feature.key}
                                  </code>
                                </div>
                              </div>
                            </td>
                            {plans?.map((plan) => {
                              const status = getPlanFeatureStatus(plan.id, feature.id);
                              const isEnabled = status?.enabled ?? false;
                              return (
                                <td key={plan.id} className="p-4 align-middle text-center">
                                  <div className="flex flex-col items-center space-y-2">
                                    <Switch
                                      checked={isEnabled}
                                      onCheckedChange={(enabled) =>
                                        togglePlanFeatureMutation.mutate({
                                          planId: plan.id,
                                          featureId: feature.id,
                                          enabled,
                                          limitValue: status?.limit_value,
                                        })
                                      }
                                    />
                                    {isEnabled && feature.is_consumable && (
                                      <Input
                                        type="number"
                                        className="w-20 h-8 text-center"
                                        value={status?.limit_value ?? ''}
                                        onChange={(e) =>
                                          togglePlanFeatureMutation.mutate({
                                            planId: plan.id,
                                            featureId: feature.id,
                                            enabled: true,
                                            limitValue: e.target.value ? parseInt(e.target.value) : null,
                                          })
                                        }
                                        placeholder="∞"
                                      />
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feature Dialog */}
      <Dialog open={isFeatureDialogOpen} onOpenChange={setIsFeatureDialogOpen}>
        <DialogContent>
          <form onSubmit={handleFeatureSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingFeature ? 'Edit Feature' : 'Create New Feature'}
              </DialogTitle>
              <DialogDescription>
                {editingFeature
                  ? 'Update feature details'
                  : 'Add a new feature to the system'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fname">Feature Name</Label>
                <Input
                  id="fname"
                  value={featureForm.name}
                  onChange={(e) =>
                    setFeatureForm({ ...featureForm, name: e.target.value })
                  }
                  placeholder="Advanced Decision Toolkit"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fkey">Feature Key</Label>
                <Input
                  id="fkey"
                  value={featureForm.key}
                  onChange={(e) =>
                    setFeatureForm({ ...featureForm, key: e.target.value })
                  }
                  placeholder="decision_toolkit_advanced"
                  required
                  disabled={editingFeature?.is_system}
                />
                {editingFeature?.is_system && (
                  <p className="text-xs text-amber-600">
                    System feature keys cannot be changed as they are used by the application code.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fcategory">Category</Label>
                <Select
                  value={featureForm.category_id || 'none'}
                  onValueChange={(value) =>
                    setFeatureForm({ ...featureForm, category_id: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <RichTextEditor
                  value={featureForm.description}
                  onChange={(value) =>
                    setFeatureForm({ ...featureForm, description: value })
                  }
                  placeholder="Advanced decision-making tools and analytics"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="fconsumable"
                  checked={featureForm.is_consumable}
                  onCheckedChange={(checked) =>
                    setFeatureForm({ ...featureForm, is_consumable: checked === true })
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="fconsumable" className="cursor-pointer">
                    Consumable Feature
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Track usage per request (e.g., AI credits, mock interviews). Set monthly limits per plan.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFeatureDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingFeature ? 'Update' : 'Create'} Feature
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCategorySubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Update category details'
                  : 'Add a new category to organize features'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cname">Category Name</Label>
                <Input
                  id="cname"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  placeholder="Decision Tools"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cdesc">Description (optional)</Label>
                <Input
                  id="cdesc"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, description: e.target.value })
                  }
                  placeholder="Tools for making better decisions"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="corder">Display Order</Label>
                <Input
                  id="corder"
                  type="number"
                  value={categoryForm.display_order}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, display_order: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first
                </p>
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
                {editingCategory ? 'Update' : 'Create'} Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
