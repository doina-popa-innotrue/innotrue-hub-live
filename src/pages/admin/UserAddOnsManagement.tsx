import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Trash2, Package, User, Calendar, Coins, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface UserAddOn {
  id: string;
  user_id: string;
  add_on_id: string;
  granted_at: string;
  expires_at: string | null;
  granted_by: string | null;
  notes: string | null;
  quantity_granted: number | null;
  quantity_remaining: number | null;
  quantity_used: number;
}

interface AddOn {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_consumable: boolean;
  initial_quantity: number | null;
}

interface Profile {
  id: string;
  name: string;
}

export default function UserAddOnsManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    add_on_id: '',
    expires_at: '',
    notes: '',
    custom_quantity: '',
  });

  const { data: userAddOns, isLoading } = useQuery({
    queryKey: ['user-add-ons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_add_ons')
        .select('*')
        .order('granted_at', { ascending: false });
      if (error) throw error;
      return data as UserAddOn[];
    },
  });

  const { data: addOns } = useQuery({
    queryKey: ['add-ons-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('add_ons')
        .select('id, key, name, description, is_active, is_consumable, initial_quantity')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as AddOn[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-addons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Profile[];
    },
  });

  const selectedAddOn = addOns?.find(a => a.id === formData.add_on_id);

  const assignMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const addOn = addOns?.find(a => a.id === data.add_on_id);
      const quantity = addOn?.is_consumable 
        ? (data.custom_quantity ? parseInt(data.custom_quantity) : addOn.initial_quantity)
        : null;

      const { error } = await supabase.from('user_add_ons').insert({
        user_id: data.user_id,
        add_on_id: data.add_on_id,
        expires_at: data.expires_at || null,
        notes: data.notes || null,
        granted_by: user?.id,
        quantity_granted: quantity,
        quantity_remaining: quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-add-ons'] });
      toast.success('Add-on assigned to user');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to assign add-on: ' + error.message);
    },
  });

  const addCreditsMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const ua = userAddOns?.find(u => u.id === id);
      if (!ua) throw new Error('User add-on not found');
      
      const { error } = await supabase
        .from('user_add_ons')
        .update({
          quantity_granted: (ua.quantity_granted || 0) + amount,
          quantity_remaining: (ua.quantity_remaining || 0) + amount,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-add-ons'] });
      toast.success('Credits added');
    },
    onError: (error) => {
      toast.error('Failed to add credits: ' + error.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_add_ons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-add-ons'] });
      toast.success('Add-on removed from user');
    },
    onError: (error) => {
      toast.error('Failed to remove add-on: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      user_id: '',
      add_on_id: '',
      expires_at: '',
      notes: '',
      custom_quantity: '',
    });
    setDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.user_id || !formData.add_on_id) {
      toast.error('Please select a user and add-on');
      return;
    }
    assignMutation.mutate(formData);
  };

  const getUserName = (userId: string) => {
    return profiles?.find((p) => p.id === userId)?.name || 'Unknown User';
  };

  const getAddOn = (addOnId: string) => {
    return addOns?.find((a) => a.id === addOnId);
  };

  const getAddOnName = (addOnId: string) => {
    return getAddOn(addOnId)?.name || 'Unknown Add-On';
  };

  const getGranterName = (granterId: string | null) => {
    if (!granterId) return '-';
    return profiles?.find((p) => p.id === granterId)?.name || 'Unknown';
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Add-Ons</h1>
          <p className="text-muted-foreground">
            Assign add-on packages to individual users
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-fit">
          <Plus className="mr-2 h-4 w-4" />
          Assign Add-On
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Assignments</CardTitle>
          <CardDescription>
            Users with add-ons assigned beyond their base plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Add-On</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userAddOns?.map((ua) => {
                  const addOn = getAddOn(ua.add_on_id);
                  const isConsumable = addOn?.is_consumable;
                  const usagePercent = ua.quantity_granted 
                    ? ((ua.quantity_remaining || 0) / ua.quantity_granted) * 100 
                    : 0;
                  
                  return (
                    <TableRow key={ua.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {getUserName(ua.user_id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isConsumable ? (
                            <Coins className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                          {getAddOnName(ua.add_on_id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isConsumable ? (
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex items-center justify-between text-xs">
                              <span>{ua.quantity_remaining || 0} / {ua.quantity_granted || 0}</span>
                              <span className="text-muted-foreground">
                                ({ua.quantity_used || 0} used)
                              </span>
                            </div>
                            <Progress value={usagePercent} className="h-2" />
                          </div>
                        ) : (
                          <Badge variant="secondary">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(ua.granted_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {ua.expires_at ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className={isExpired(ua.expires_at) ? 'text-destructive' : ''}>
                              {format(new Date(ua.expires_at), 'MMM d, yyyy')}
                            </span>
                            {isExpired(ua.expires_at) && (
                              <Badge variant="destructive">Expired</Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">No expiration</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {ua.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isConsumable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Add 1 credit"
                              onClick={() => addCreditsMutation.mutate({ id: ua.id, amount: 1 })}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMutation.mutate(ua.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {(!userAddOns || userAddOns.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No add-ons assigned yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Add-On to User</DialogTitle>
            <DialogDescription>
              Grant a user access to additional features beyond their base plan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select
                value={formData.user_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, user_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Add-On</Label>
              <Select
                value={formData.add_on_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, add_on_id: value, custom_quantity: '' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an add-on" />
                </SelectTrigger>
                <SelectContent>
                  {addOns?.map((addOn) => (
                    <SelectItem key={addOn.id} value={addOn.id}>
                      <div className="flex items-center gap-2">
                        {addOn.is_consumable ? (
                          <Coins className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                        {addOn.name}
                        {addOn.is_consumable && (
                          <span className="text-muted-foreground">
                            ({addOn.initial_quantity} credits)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAddOn?.is_consumable && (
              <div className="space-y-2 p-3 border rounded-md bg-amber-50 dark:bg-amber-950/20">
                <Label htmlFor="custom_quantity">
                  Credits to Grant
                </Label>
                <Input
                  id="custom_quantity"
                  type="number"
                  value={formData.custom_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, custom_quantity: e.target.value })
                  }
                  placeholder={`Default: ${selectedAddOn.initial_quantity}`}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use the default ({selectedAddOn.initial_quantity} credits)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">
                Notes <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="e.g., Purchased during Q4 promotion"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Assign Add-On</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
