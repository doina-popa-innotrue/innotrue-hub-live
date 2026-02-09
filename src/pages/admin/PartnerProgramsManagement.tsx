import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, ExternalLink, Users, Building2, GraduationCap, Loader2, Star, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';

interface PartnerProgram {
  id: string;
  name: string;
  description: string | null;
  provider_name: string;
  provider_type: string;
  provider_logo_url: string | null;
  program_url: string;
  referral_code: string | null;
  category_id: string | null;
  price_info: string | null;
  duration_info: string | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  click_count?: number;
}

interface ProgramCategory {
  id: string;
  name: string;
}

const PROVIDER_TYPES = [
  { value: 'partner', label: 'Partner', icon: Users },
  { value: 'trainer', label: 'Trainer', icon: Users },
  { value: 'coach', label: 'Coach', icon: Users },
  { value: 'institution', label: 'Academic Institution', icon: GraduationCap },
  { value: 'company', label: 'Company', icon: Building2 },
];

export default function PartnerProgramsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<PartnerProgram | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    provider_name: '',
    provider_type: 'partner',
    provider_logo_url: '',
    program_url: '',
    referral_code: '',
    category_id: '',
    price_info: '',
    duration_info: '',
    is_active: true,
    is_featured: false,
    display_order: 0,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['program-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_categories')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as ProgramCategory[];
    },
  });

  // Fetch partner programs with click counts
  const { data: programs, isLoading } = useQuery({
    queryKey: ['partner-programs'],
    queryFn: async () => {
      const { data: programsData, error: programsError } = await supabase
        .from('partner_programs')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (programsError) throw programsError;

      // Get click counts
      const { data: clicksData } = await supabase
        .from('partner_program_clicks')
        .select('partner_program_id');

      const clickCounts: Record<string, number> = {};
      clicksData?.forEach(click => {
        clickCounts[click.partner_program_id] = (clickCounts[click.partner_program_id] || 0) + 1;
      });

      return (programsData as PartnerProgram[]).map(p => ({
        ...p,
        click_count: clickCounts[p.id] || 0,
      }));
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('partner_programs').insert({
        name: data.name,
        description: data.description || null,
        provider_name: data.provider_name,
        provider_type: data.provider_type,
        provider_logo_url: data.provider_logo_url || null,
        program_url: data.program_url,
        referral_code: data.referral_code || null,
        category_id: data.category_id || null,
        price_info: data.price_info || null,
        duration_info: data.duration_info || null,
        is_active: data.is_active,
        is_featured: data.is_featured,
        display_order: data.display_order,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-programs'] });
      toast({ title: 'Partner program created successfully' });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating partner program', description: error.message, variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('partner_programs').update({
        name: data.name,
        description: data.description || null,
        provider_name: data.provider_name,
        provider_type: data.provider_type,
        provider_logo_url: data.provider_logo_url || null,
        program_url: data.program_url,
        referral_code: data.referral_code || null,
        category_id: data.category_id || null,
        price_info: data.price_info || null,
        duration_info: data.duration_info || null,
        is_active: data.is_active,
        is_featured: data.is_featured,
        display_order: data.display_order,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-programs'] });
      toast({ title: 'Partner program updated successfully' });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating partner program', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('partner_programs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-programs'] });
      toast({ title: 'Partner program deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting partner program', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      provider_name: '',
      provider_type: 'partner',
      provider_logo_url: '',
      program_url: '',
      referral_code: '',
      category_id: '',
      price_info: '',
      duration_info: '',
      is_active: true,
      is_featured: false,
      display_order: 0,
    });
    setEditingProgram(null);
  };

  const handleEdit = (program: PartnerProgram) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      description: program.description || '',
      provider_name: program.provider_name,
      provider_type: program.provider_type,
      provider_logo_url: program.provider_logo_url || '',
      program_url: program.program_url,
      referral_code: program.referral_code || '',
      category_id: program.category_id || '',
      price_info: program.price_info || '',
      duration_info: program.duration_info || '',
      is_active: program.is_active,
      is_featured: program.is_featured,
      display_order: program.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProgram) {
      updateMutation.mutate({ id: editingProgram.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getProviderIcon = (type: string) => {
    const providerType = PROVIDER_TYPES.find(p => p.value === type);
    const Icon = providerType?.icon || Users;
    return <Icon className="h-4 w-4" />;
  };

  const getProviderLabel = (type: string) => {
    return PROVIDER_TYPES.find(p => p.value === type)?.label || type;
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories?.find(c => c.id === categoryId)?.name;
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Partner Programs</h1>
            <p className="text-muted-foreground">
              Manage external partner offerings from trainers, coaches, and institutions
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Partner Program
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProgram ? 'Edit Partner Program' : 'Add Partner Program'}</DialogTitle>
                <DialogDescription>
                  Add an external program from a partner, trainer, coach, or institution
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Program Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider_name">Provider Name *</Label>
                    <Input
                      id="provider_name"
                      value={formData.provider_name}
                      onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                      placeholder="e.g., John Smith Coaching"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider_type">Provider Type</Label>
                    <Select
                      value={formData.provider_type}
                      onValueChange={(value) => setFormData({ ...formData, provider_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category_id">Category</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="program_url">Program URL *</Label>
                    <Input
                      id="program_url"
                      type="url"
                      value={formData.program_url}
                      onChange={(e) => setFormData({ ...formData, program_url: e.target.value })}
                      placeholder="https://..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referral_code">Referral Code</Label>
                    <Input
                      id="referral_code"
                      value={formData.referral_code}
                      onChange={(e) => setFormData({ ...formData, referral_code: e.target.value })}
                      placeholder="Optional tracking code"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price_info">Price Info</Label>
                    <Input
                      id="price_info"
                      value={formData.price_info}
                      onChange={(e) => setFormData({ ...formData, price_info: e.target.value })}
                      placeholder="e.g., $299, Free, Contact for pricing"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration_info">Duration Info</Label>
                    <Input
                      id="duration_info"
                      value={formData.duration_info}
                      onChange={(e) => setFormData({ ...formData, duration_info: e.target.value })}
                      placeholder="e.g., 6 weeks, Self-paced"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider_logo_url">Provider Logo URL</Label>
                  <Input
                    id="provider_logo_url"
                    type="url"
                    value={formData.provider_logo_url}
                    onChange={(e) => setFormData({ ...formData, provider_logo_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_featured"
                      checked={formData.is_featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                    />
                    <Label htmlFor="is_featured">Featured</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingProgram ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : programs?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Partner Programs Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add programs from partner trainers, coaches, or institutions to offer alongside your own programs.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Partner Program
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {programs?.map((program) => (
              <Card key={program.id} className={!program.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {program.provider_logo_url ? (
                        <img
                          src={program.provider_logo_url}
                          alt={program.provider_name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                          {getProviderIcon(program.provider_type)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{program.name}</CardTitle>
                          {program.is_featured && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-2">
                          {getProviderIcon(program.provider_type)}
                          <span>{program.provider_name}</span>
                          <Badge variant="outline">{getProviderLabel(program.provider_type)}</Badge>
                          {getCategoryName(program.category_id) && (
                            <Badge variant="secondary">{getCategoryName(program.category_id)}</Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={program.is_active ? 'default' : 'secondary'}>
                        {program.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(program)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this partner program?')) {
                            deleteMutation.mutate(program.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {program.description && (
                    <p className="text-sm text-muted-foreground mb-3">{program.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {program.price_info && (
                      <span className="text-muted-foreground">
                        <strong>Price:</strong> {program.price_info}
                      </span>
                    )}
                    {program.duration_info && (
                      <span className="text-muted-foreground">
                        <strong>Duration:</strong> {program.duration_info}
                      </span>
                    )}
                    {program.referral_code && (
                      <span className="text-muted-foreground">
                        <strong>Referral:</strong> {program.referral_code}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      {program.click_count || 0} clicks
                    </span>
                    <a
                      href={program.program_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Program
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
  );
}
