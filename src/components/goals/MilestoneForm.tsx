import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type MilestoneStatus = Database['public']['Enums']['milestone_status'];

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  is_private: boolean;
  order_index: number;
}

interface MilestoneFormProps {
  goalId: string;
  orderIndex: number;
  milestone?: Milestone | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MilestoneForm({ goalId, orderIndex, milestone, onSuccess, onCancel }: MilestoneFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    status: MilestoneStatus;
    due_date: string;
    is_private: boolean;
  }>({
    title: '',
    description: '',
    status: 'not_started' as MilestoneStatus,
    due_date: '',
    is_private: false,
  });

  const isEditing = !!milestone;

  useEffect(() => {
    if (milestone) {
      setFormData({
        title: milestone.title,
        description: milestone.description || '',
        status: milestone.status as MilestoneStatus,
        due_date: milestone.due_date || '',
        is_private: milestone.is_private || false,
      });
    }
  }, [milestone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('goal_milestones')
          .update({
            title: formData.title,
            description: formData.description || null,
            status: formData.status,
            due_date: formData.due_date || null,
            is_private: formData.is_private,
          })
          .eq('id', milestone.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Milestone updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('goal_milestones')
          .insert([{
            goal_id: goalId,
            title: formData.title,
            description: formData.description || null,
            status: formData.status,
            due_date: formData.due_date || null,
            order_index: orderIndex,
            is_private: formData.is_private,
          }]);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Milestone created successfully',
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: isEditing ? 'Failed to update milestone' : 'Failed to create milestone',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          placeholder="Enter milestone title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe this milestone"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as MilestoneStatus })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Due Date</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="is_private">Private Milestone</Label>
          <p className="text-xs text-muted-foreground">
            Only visible to you and admins
          </p>
        </div>
        <Switch
          id="is_private"
          checked={formData.is_private}
          onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked })}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Milestone' : 'Create Milestone')}
        </Button>
      </div>
    </form>
  );
}
