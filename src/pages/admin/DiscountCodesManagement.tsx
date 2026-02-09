import { useState, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag, Loader2, CalendarIcon, Copy, Users, Percent, Share2, Sparkles, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Helper to generate unique referral codes
function generateReferralCode(): string {
  const prefix = 'REF';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, I, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${code}`;
}

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed_amount';
  discount_value: number;
  valid_for_program_ids: string[] | null;
  valid_for_tier_names: string[] | null;
  max_uses: number | null;
  uses_count: number;
  assigned_user_id: string | null;
  assigned_user_email: string | null;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface Program {
  id: string;
  name: string;
  tiers: string[] | null;
}

const defaultFormData = {
  code: '',
  description: '',
  discount_type: 'percent' as 'percent' | 'fixed_amount',
  discount_value: '',
  valid_for_program_ids: [] as string[],
  valid_for_tier_names: [] as string[],
  max_uses: '',
  assigned_user_email: '',
  starts_at: new Date(),
  expires_at: null as Date | null,
  is_active: true,
};

export default function DiscountCodesManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(defaultFormData);
  
  // Referral code generator state
  const [referralDiscountPercent, setReferralDiscountPercent] = useState('5');
  const [generatedReferralCode, setGeneratedReferralCode] = useState('');
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);

  // Generate a new unique referral code
  const generateNewReferralCode = useCallback(() => {
    setGeneratedReferralCode(generateReferralCode());
  }, []);

  // Create referral code mutation
  const createReferralMutation = useMutation({
    mutationFn: async () => {
      if (!generatedReferralCode) {
        throw new Error('Please generate a code first');
      }
      const discountValue = parseFloat(referralDiscountPercent);
      if (isNaN(discountValue) || discountValue <= 0 || discountValue > 100) {
        throw new Error('Discount must be between 1 and 100%');
      }

      const insertData = {
        code: generatedReferralCode.toUpperCase(),
        description: `Referral code - ${discountValue}% discount`,
        discount_type: 'percent' as const,
        discount_value: discountValue,
        valid_for_program_ids: null,
        valid_for_tier_names: null,
        max_uses: 1, // Single use by default for referral codes
        assigned_user_email: null,
        starts_at: new Date().toISOString(),
        expires_at: null, // No expiry
        is_active: true,
        created_by: user?.id,
      };

      const { error } = await supabase.from('discount_codes').insert(insertData);
      if (error) throw error;
      return generatedReferralCode;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      navigator.clipboard.writeText(code);
      toast.success(`Referral code ${code} created and copied to clipboard!`);
      setGeneratedReferralCode('');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This code already exists. Generate a new one.');
        setGeneratedReferralCode('');
      } else {
        toast.error(error.message || 'Failed to create referral code');
      }
    },
  });

  // Fetch programs for restriction selection
  const { data: programs } = useQuery({
    queryKey: ['programs-for-discount'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name, tiers')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Program[];
    },
  });

  // Get unique tiers from all programs
  const allTiers = [...new Set(programs?.flatMap(p => p.tiers || []) || [])];

  const {
    data: discountCodes,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    openCreate,
    openEdit,
  } = useAdminCRUD<DiscountCode, typeof defaultFormData>({
    queryKey: 'discount-codes',
    tableName: 'discount_codes',
    entityName: 'Discount Code',
    initialFormData: defaultFormData,
    mapItemToForm: (code) => ({
      code: code.code,
      description: code.description || '',
      discount_type: code.discount_type,
      discount_value: code.discount_value.toString(),
      valid_for_program_ids: code.valid_for_program_ids || [],
      valid_for_tier_names: code.valid_for_tier_names || [],
      max_uses: code.max_uses?.toString() || '',
      assigned_user_email: code.assigned_user_email || '',
      starts_at: new Date(code.starts_at),
      expires_at: code.expires_at ? new Date(code.expires_at) : null,
      is_active: code.is_active,
    }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const insertData: any = {
        code: data.code.toUpperCase().trim(),
        description: data.description || null,
        discount_type: data.discount_type,
        discount_value: parseFloat(data.discount_value),
        valid_for_program_ids: data.valid_for_program_ids.length > 0 ? data.valid_for_program_ids : null,
        valid_for_tier_names: data.valid_for_tier_names.length > 0 ? data.valid_for_tier_names : null,
        max_uses: data.max_uses ? parseInt(data.max_uses) : null,
        assigned_user_email: data.assigned_user_email || null,
        starts_at: data.starts_at.toISOString(),
        expires_at: data.expires_at?.toISOString() || null,
        is_active: data.is_active,
        created_by: user?.id,
      };

      const { error } = await supabase.from('discount_codes').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast.success('Discount code created');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('A discount code with this code already exists');
      } else {
        toast.error(error.message || 'Failed to create discount code');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!editingItem) return;
      
      const updateData: any = {
        code: data.code.toUpperCase().trim(),
        description: data.description || null,
        discount_type: data.discount_type,
        discount_value: parseFloat(data.discount_value),
        valid_for_program_ids: data.valid_for_program_ids.length > 0 ? data.valid_for_program_ids : null,
        valid_for_tier_names: data.valid_for_tier_names.length > 0 ? data.valid_for_tier_names : null,
        max_uses: data.max_uses ? parseInt(data.max_uses) : null,
        assigned_user_email: data.assigned_user_email || null,
        starts_at: data.starts_at.toISOString(),
        expires_at: data.expires_at?.toISOString() || null,
        is_active: data.is_active,
      };

      const { error } = await supabase
        .from('discount_codes')
        .update(updateData)
        .eq('id', editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast.success('Discount code updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update discount code');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discount_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      toast.success('Discount code deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete discount code');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast.error('Code is required');
      return;
    }
    if (!formData.discount_value || parseFloat(formData.discount_value) <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    if (formData.discount_type === 'percent' && parseFloat(formData.discount_value) > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    if (editingItem) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenCreate = () => {
    setFormData(defaultFormData);
    openCreate();
  };

  const handleOpenEdit = (code: DiscountCode) => {
    openEdit(code);
    setFormData({
      code: code.code,
      description: code.description || '',
      discount_type: code.discount_type,
      discount_value: code.discount_value.toString(),
      valid_for_program_ids: code.valid_for_program_ids || [],
      valid_for_tier_names: code.valid_for_tier_names || [],
      max_uses: code.max_uses?.toString() || '',
      assigned_user_email: code.assigned_user_email || '',
      starts_at: new Date(code.starts_at),
      expires_at: code.expires_at ? new Date(code.expires_at) : null,
      is_active: code.is_active,
    });
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const toggleProgramSelection = (programId: string) => {
    setFormData(prev => ({
      ...prev,
      valid_for_program_ids: prev.valid_for_program_ids.includes(programId)
        ? prev.valid_for_program_ids.filter(id => id !== programId)
        : [...prev.valid_for_program_ids, programId],
    }));
  };

  const toggleTierSelection = (tier: string) => {
    setFormData(prev => ({
      ...prev,
      valid_for_tier_names: prev.valid_for_tier_names.includes(tier)
        ? prev.valid_for_tier_names.filter(t => t !== tier)
        : [...prev.valid_for_tier_names, tier],
    }));
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const getStatusBadge = (code: DiscountCode) => {
    if (!code.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (code.max_uses && code.uses_count >= code.max_uses) {
      return <Badge variant="outline">Used Up</Badge>;
    }
    return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tag className="h-8 w-8" />
            Discount Codes
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage discount codes for program enrollments
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Code
        </Button>
      </div>

      {/* Quick Referral Code Generator */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Quick Referral Code Generator
          </CardTitle>
          <CardDescription>
            Generate single-use referral codes for clients or partners. Codes are automatically copied to your clipboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Discount Percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={referralDiscountPercent}
                  onChange={(e) => setReferralDiscountPercent(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Generated Code</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedReferralCode}
                  readOnly
                  placeholder="Click generate"
                  className="w-40 font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={generateNewReferralCode}
                  title="Generate new code"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              onClick={() => createReferralMutation.mutate()}
              disabled={!generatedReferralCode || createReferralMutation.isPending}
              className="gap-2"
            >
              {createReferralMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Create & Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Each referral code is single-use and valid for all programs. 
            <Button variant="link" size="sm" className="h-auto p-0 ml-1" onClick={handleOpenCreate}>
              Create a custom code
            </Button> for more options.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Discount Codes</CardTitle>
          <CardDescription>
            {discountCodes?.length || 0} discount codes configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : discountCodes && discountCodes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Restrictions</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {code.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(code.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {code.description && (
                        <p className="text-xs text-muted-foreground mt-1">{code.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {code.discount_type === 'percent' 
                          ? `${code.discount_value}%` 
                          : `€${code.discount_value}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        {code.valid_for_program_ids && code.valid_for_program_ids.length > 0 && (
                          <div className="text-muted-foreground">
                            {code.valid_for_program_ids.length} program(s)
                          </div>
                        )}
                        {code.valid_for_tier_names && code.valid_for_tier_names.length > 0 && (
                          <div className="text-muted-foreground">
                            Tiers: {code.valid_for_tier_names.join(', ')}
                          </div>
                        )}
                        {code.assigned_user_email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {code.assigned_user_email}
                          </div>
                        )}
                        {!code.valid_for_program_ids && !code.valid_for_tier_names && !code.assigned_user_email && (
                          <span className="text-muted-foreground">All programs</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {code.uses_count}
                        {code.max_uses ? ` / ${code.max_uses}` : ' uses'}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(code)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(code)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(code.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No discount codes yet</p>
              <p className="text-sm">Create your first discount code to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Discount Code' : 'Create Discount Code'}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Update the discount code settings' 
                : 'Create a new discount code for program enrollments'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code and Description */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SUMMER25"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Summer promotion"
                />
              </div>
            </div>

            {/* Discount Type and Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(v) => setFormData({ ...formData, discount_type: v as 'percent' | 'fixed_amount' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value">
                  Discount Value * {formData.discount_type === 'percent' ? '(%)' : '(€)'}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  max={formData.discount_type === 'percent' ? '100' : undefined}
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  placeholder={formData.discount_type === 'percent' ? 'e.g. 25' : 'e.g. 500'}
                />
              </div>
            </div>

            {/* Program Restrictions */}
            <div className="space-y-2">
              <Label>Valid for Programs (leave empty for all)</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {programs?.map((program) => (
                  <div key={program.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`program-${program.id}`}
                      checked={formData.valid_for_program_ids.includes(program.id)}
                      onCheckedChange={() => toggleProgramSelection(program.id)}
                    />
                    <Label htmlFor={`program-${program.id}`} className="text-sm font-normal cursor-pointer">
                      {program.name}
                    </Label>
                  </div>
                ))}
                {(!programs || programs.length === 0) && (
                  <p className="text-sm text-muted-foreground">No programs available</p>
                )}
              </div>
            </div>

            {/* Tier Restrictions */}
            {allTiers.length > 0 && (
              <div className="space-y-2">
                <Label>Valid for Tiers (leave empty for all)</Label>
                <div className="flex flex-wrap gap-2">
                  {allTiers.map((tier) => (
                    <Badge
                      key={tier}
                      variant={formData.valid_for_tier_names.includes(tier) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTierSelection(tier)}
                    >
                      {tier}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_uses">Max Uses (leave empty for unlimited)</Label>
                <Input
                  id="max_uses"
                  type="number"
                  min="1"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  placeholder="e.g. 100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_user_email">Assign to User Email (optional)</Label>
                <Input
                  id="assigned_user_email"
                  type="email"
                  value={formData.assigned_user_email}
                  onChange={(e) => setFormData({ ...formData, assigned_user_email: e.target.value })}
                  placeholder="user@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  If set, only this user can use the code
                </p>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Starts At</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.starts_at && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.starts_at ? format(formData.starts_at, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.starts_at}
                      onSelect={(date) => setFormData({ ...formData, starts_at: date || new Date() })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Expires At (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.expires_at && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.expires_at ? format(formData.expires_at, "PPP") : "No expiry"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.expires_at || undefined}
                      onSelect={(date) => setFormData({ ...formData, expires_at: date || null })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
