import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCRUD } from '@/hooks/useAdminCRUD';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, Coins, Loader2 } from 'lucide-react';

interface AddOn {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  is_active: boolean;
  is_consumable: boolean;
  initial_quantity: number | null;
  created_at: string;
}

interface Feature {
  id: string;
  key: string;
  name: string;
}

interface AddOnFeature {
  id: string;
  add_on_id: string;
  feature_id: string;
}

const defaultFormData = {
  key: '',
  name: '',
  display_name: '',
  description: '',
  price_cents: '',
  is_active: true,
  is_consumable: false,
  initial_quantity: '',
  selectedFeatures: [] as string[],
};

export default function AddOnsManagement() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(defaultFormData);

  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('features')
        .select('id, key, name')
        .order('name');
      if (error) throw error;
      return data as Feature[];
    },
  });

  const { data: addOnFeatures } = useQuery({
    queryKey: ['add-on-features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('add_on_features')
        .select('*');
      if (error) throw error;
      return data as AddOnFeature[];
    },
  });

  const {
    data: addOns,
    isLoading: addOnsLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    openCreate,
    openEdit,
    isMutating: isSubmitting,
  } = useAdminCRUD<AddOn, typeof defaultFormData>({
    queryKey: 'add-ons',
    tableName: 'add_ons',
    entityName: 'Add-on',
    initialFormData: defaultFormData,
    mapItemToForm: (addOn) => {
      const linkedFeatures = addOnFeatures
        ?.filter((af) => af.add_on_id === addOn.id)
        .map((af) => af.feature_id) || [];
      return {
        key: addOn.key || '',
        name: addOn.name,
        display_name: (addOn as any).display_name || '',
        description: addOn.description || '',
        price_cents: addOn.price_cents?.toString() || '',
        is_active: addOn.is_active,
        is_consumable: addOn.is_consumable,
        initial_quantity: addOn.initial_quantity?.toString() || '',
        selectedFeatures: linkedFeatures,
      };
    },
  });

  // Custom mutations for handling features
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: addOn, error } = await supabase
        .from('add_ons')
        .insert({
          key: data.key,
          name: data.name,
          display_name: data.display_name || null,
          description: data.description || null,
          price_cents: data.price_cents ? parseInt(data.price_cents) : null,
          is_active: data.is_active,
          is_consumable: data.is_consumable,
          initial_quantity: data.is_consumable && data.initial_quantity ? parseInt(data.initial_quantity) : null,
        })
        .select()
        .single();
      if (error) throw error;

      if (data.selectedFeatures.length > 0) {
        const { error: featuresError } = await supabase
          .from('add_on_features')
          .insert(
            data.selectedFeatures.map((featureId) => ({
              add_on_id: addOn.id,
              feature_id: featureId,
            }))
          );
        if (featuresError) throw featuresError;
      }

      return addOn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['add-ons'] });
      queryClient.invalidateQueries({ queryKey: ['add-on-features'] });
      toast.success('Add-on created');
      setIsDialogOpen(false);
      setFormData(defaultFormData);
    },
    onError: (error) => {
      toast.error('Failed to create add-on: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('add_ons')
        .update({
          key: data.key,
          name: data.name,
          display_name: data.display_name || null,
          description: data.description || null,
          price_cents: data.price_cents ? parseInt(data.price_cents) : null,
          is_active: data.is_active,
          is_consumable: data.is_consumable,
          initial_quantity: data.is_consumable && data.initial_quantity ? parseInt(data.initial_quantity) : null,
        })
        .eq('id', id);
      if (error) throw error;

      // Remove existing feature links
      await supabase.from('add_on_features').delete().eq('add_on_id', id);

      // Add new feature links
      if (data.selectedFeatures.length > 0) {
        const { error: featuresError } = await supabase
          .from('add_on_features')
          .insert(
            data.selectedFeatures.map((featureId) => ({
              add_on_id: id,
              feature_id: featureId,
            }))
          );
        if (featuresError) throw featuresError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['add-ons'] });
      queryClient.invalidateQueries({ queryKey: ['add-on-features'] });
      toast.success('Add-on updated');
      setIsDialogOpen(false);
      setFormData(defaultFormData);
    },
    onError: (error) => {
      toast.error('Failed to update add-on: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('add_ons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['add-ons'] });
      queryClient.invalidateQueries({ queryKey: ['add-on-features'] });
      toast.success('Add-on deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete add-on: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.key.trim()) {
      toast.error('Key is required');
      return;
    }
    if (formData.is_consumable && !formData.initial_quantity) {
      toast.error('Initial quantity is required for consumable add-ons');
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getAddOnFeatures = (addOnId: string) => {
    const featureIds = addOnFeatures
      ?.filter((af) => af.add_on_id === addOnId)
      .map((af) => af.feature_id) || [];
    return features?.filter((f) => featureIds.includes(f.id)) || [];
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (addOnsLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Add-Ons Management</h1>
          <p className="text-muted-foreground">
            Create and manage feature add-on packages that can be assigned to users
          </p>
        </div>
        <Button onClick={openCreate} className="w-fit">
          <Plus className="mr-2 h-4 w-4" />
          New Add-On
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Add-Ons</CardTitle>
          <CardDescription>
            Add-ons are bundles of features that can be assigned to users on top of their base plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addOns?.map((addOn) => (
                <TableRow key={addOn.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {addOn.is_consumable ? (
                        <Coins className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <div>{addOn.name}</div>
                        {addOn.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {addOn.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{addOn.key}</code>
                  </TableCell>
                  <TableCell>
                    {addOn.is_consumable ? (
                      <Badge variant="outline" className="gap-1">
                        <Coins className="h-3 w-3" />
                        {addOn.initial_quantity} credits
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Feature</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatPrice(addOn.price_cents)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getAddOnFeatures(addOn.id).map((feature) => (
                        <Badge key={feature.id} variant="secondary">
                          {feature.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={addOn.is_active ? 'default' : 'outline'}>
                      {addOn.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(addOn)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(addOn.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!addOns || addOns.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No add-ons created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Add-On' : 'Create Add-On'}
            </DialogTitle>
            <DialogDescription>
              Configure the add-on package and select which features it includes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., AI Credits Pack"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) =>
                    setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                  }
                  placeholder="e.g., ai_credits"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name (for upsell messages)</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                placeholder="e.g. add-on"
              />
              <p className="text-xs text-muted-foreground">
                How this add-on type is described in upgrade prompts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe what this add-on includes..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (cents)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price_cents}
                onChange={(e) =>
                  setFormData({ ...formData, price_cents: e.target.value })
                }
                placeholder="e.g., 4999 for $49.99"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_consumable"
                checked={formData.is_consumable}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_consumable: checked, initial_quantity: checked ? formData.initial_quantity : '' })
                }
              />
              <Label htmlFor="is_consumable">Consumable (credits/uses)</Label>
            </div>

            {formData.is_consumable && (
              <div className="space-y-2 pl-6 border-l-2 border-amber-200">
                <Label htmlFor="initial_quantity">Credits per Purchase</Label>
                <Input
                  id="initial_quantity"
                  type="number"
                  value={formData.initial_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, initial_quantity: e.target.value })
                  }
                  placeholder="e.g., 5 for 5 review board mocks"
                />
                <p className="text-xs text-muted-foreground">
                  How many uses/credits the user gets when this add-on is assigned
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="space-y-2">
              <Label>Features Included</Label>
              <div className="max-h-[200px] overflow-y-auto rounded-md border p-3 space-y-2">
                {features?.map((feature) => (
                  <div key={feature.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`feature-${feature.id}`}
                      checked={formData.selectedFeatures.includes(feature.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            selectedFeatures: [
                              ...formData.selectedFeatures,
                              feature.id,
                            ],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            selectedFeatures: formData.selectedFeatures.filter(
                              (id) => id !== feature.id
                            ),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`feature-${feature.id}`} className="text-sm cursor-pointer">
                      {feature.name}
                      <span className="text-muted-foreground ml-1">({feature.key})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
