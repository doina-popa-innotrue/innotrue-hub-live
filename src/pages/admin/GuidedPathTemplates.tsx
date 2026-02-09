import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader, AdminTable, AdminEmptyState, AdminLoadingState, AdminTableColumn } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Eye, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Template {
  id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  family_id: string | null;
  is_active: boolean;
  is_base_template: boolean;
  order_in_family: number;
  created_at: string;
  programs?: { name: string } | null;
  guided_path_template_families?: { id: string; name: string } | null;
  _count?: { goals: number };
  conditions?: { id: string; question_id: string; operator: string; value: unknown }[];
}

interface Family {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  description: string;
  program_id: string;
  family_id: string;
  is_active: boolean;
  is_base_template: boolean;
}

export default function GuidedPathTemplates() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    program_id: '',
    family_id: '',
    is_active: true,
    is_base_template: false,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['guided-path-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guided_path_templates')
        .select(`
          *,
          programs(name),
          guided_path_template_families(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get goal counts and conditions for each template
      const templateIds = (data || []).map(t => t.id);
      
      const [goalsResult, conditionsResult] = await Promise.all([
        supabase
          .from('guided_path_template_goals')
          .select('template_id')
          .in('template_id', templateIds),
        supabase
          .from('template_conditions')
          .select('id, template_id, question_id, operator, value')
          .in('template_id', templateIds),
      ]);

      const goalCounts = (goalsResult.data || []).reduce((acc, g) => {
        acc[g.template_id] = (acc[g.template_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const conditionsByTemplate = (conditionsResult.data || []).reduce((acc, c) => {
        if (!acc[c.template_id]) acc[c.template_id] = [];
        acc[c.template_id].push(c);
        return acc;
      }, {} as Record<string, typeof conditionsResult.data>);

      return (data || []).map(t => ({
        ...t,
        _count: { goals: goalCounts[t.id] || 0 },
        conditions: conditionsByTemplate[t.id] || [],
      }));
    },
  });

  const { data: families = [] } = useQuery({
    queryKey: ['guided-path-families-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guided_path_template_families')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Family[];
    },
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['programs-for-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        program_id: data.program_id || null,
        family_id: data.family_id || null,
        is_active: data.is_active,
        is_base_template: data.is_base_template,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('guided_path_templates')
          .update(payload)
          .eq('id', editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('guided_path_templates')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guided-path-templates'] });
      toast({
        title: 'Success',
        description: `Template ${editingTemplate ? 'updated' : 'created'} successfully`,
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('guided_path_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guided-path-templates'] });
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      program_id: '',
      family_id: '',
      is_active: true,
      is_base_template: false,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      program_id: template.program_id || '',
      family_id: template.family_id || '',
      is_active: template.is_active,
      is_base_template: template.is_base_template,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      program_id: '',
      family_id: '',
      is_active: true,
      is_base_template: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleDelete = (template: Template) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  };

  const columns: AdminTableColumn<Template>[] = [
    {
      key: 'name',
      header: 'Name',
      accessor: (template: Template) => (
        <div>
          <div className="font-medium">{template.name}</div>
          {template.description && (
            <div className="text-sm text-muted-foreground line-clamp-1">
              {template.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'family',
      header: 'Family',
      accessor: (template: Template) => (
        template.guided_path_template_families?.name ? (
          <Badge variant="outline">{template.guided_path_template_families.name}</Badge>
        ) : (
          <span className="text-muted-foreground italic">None</span>
        )
      ),
    },
    {
      key: 'program',
      header: 'Program',
      accessor: (template: Template) => (
        template.programs?.name || (
          <span className="text-muted-foreground italic">General</span>
        )
      ),
    },
    {
      key: 'type',
      header: 'Type',
      accessor: (template: Template) => (
        template.is_base_template ? (
          <Badge>Base</Badge>
        ) : template.conditions && template.conditions.length > 0 ? (
          <Badge variant="secondary">{template.conditions.length} condition{template.conditions.length !== 1 ? 's' : ''}</Badge>
        ) : (
          <Badge variant="outline">Conditional</Badge>
        )
      ),
    },
    {
      key: 'goals',
      header: 'Goals',
      accessor: (template: Template) => template._count?.goals || 0,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (template: Template) => (
        <Badge variant={template.is_active ? 'default' : 'secondary'}>
          {template.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const actions = (template: Template) => (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(`/admin/guided-path-templates/${template.id}`)}
        title="View & Edit Content"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleOpenEdit(template)}
        title="Edit Details"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleDelete(template)}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  if (isLoading) return <AdminLoadingState />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Guided Path Templates"
        description="Create and manage templates that clients can copy to create their own goals, milestones, and tasks"
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        }
      />

      {templates.length === 0 ? (
        <AdminEmptyState
          icon={Map}
          title="No Templates Yet"
          description="Create your first guided path template to help clients plan their journey"
          actionLabel="Create Template"
          onAction={handleOpenCreate}
        />
      ) : (
        <AdminTable
          data={templates}
          columns={columns}
          renderActions={actions}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Review Board Preparation Path"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this template helps clients achieve"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program">Linked Program (optional)</Label>
              <Select
                value={formData.program_id}
                onValueChange={(value) => setFormData({ ...formData, program_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a program or leave as General" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">General (Available to all)</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="family">Template Family (optional)</Label>
              <Select
                value={formData.family_id}
                onValueChange={(value) => setFormData({ ...formData, family_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a family or leave standalone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Standalone (no family)</SelectItem>
                  {families.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link to a family to enable survey-based path selection
              </p>
            </div>

            {formData.family_id && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="is_base">Base Template</Label>
                  <p className="text-xs text-muted-foreground">
                    Always included regardless of survey answers
                  </p>
                </div>
                <Switch
                  id="is_base"
                  checked={formData.is_base_template}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_base_template: checked })}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive templates are only visible to admins
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This will also delete all
              associated goals, milestones, and tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTemplate && deleteMutation.mutate(deletingTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
