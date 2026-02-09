import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCRUD } from '@/hooks/useAdminCRUD';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Calendar, Settings, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Group {
  id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  theme: string | null;
  join_type: 'invitation_only' | 'open';
  status: 'draft' | 'active' | 'completed' | 'archived';
  start_date: string | null;
  end_date: string | null;
  max_members: number | null;
  circle_group_url: string | null;
  created_at: string;
  programs?: { name: string } | null;
  member_count?: number;
}

const defaultFormData = {
  name: '',
  description: '',
  program_id: '',
  theme: '',
  join_type: 'invitation_only' as 'invitation_only' | 'open',
  status: 'draft' as 'draft' | 'active' | 'completed' | 'archived',
  start_date: '',
  end_date: '',
  max_members: '',
  circle_group_url: '',
  calcom_mapping_id: ''
};

export default function GroupsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(defaultFormData);

  // Fetch all groups with member counts
  const { data: groups, isLoading } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          programs (name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get member counts
      const groupsWithCounts = await Promise.all(
        (data || []).map(async (group) => {
          const { count } = await supabase
            .from('group_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .eq('status', 'active');
          
          return { ...group, member_count: count || 0 } as Group;
        })
      );
      
      return groupsWithCounts;
    }
  });

  // Fetch programs for dropdown
  const { data: programs } = useQuery({
    queryKey: ['programs-for-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch Cal.com mappings for group sessions
  const { data: calcomMappings } = useQuery({
    queryKey: ['calcom-mappings-for-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calcom_event_type_mappings')
        .select('id, calcom_event_type_name, scheduling_url')
        .eq('session_target', 'group_session')
        .eq('is_active', true)
        .order('calcom_event_type_name');
      
      if (error) throw error;
      return data;
    }
  });

  const {
    isDialogOpen,
    setIsDialogOpen,
    openCreate,
  } = useAdminCRUD<Group, typeof defaultFormData>({
    queryKey: 'admin-groups',
    tableName: 'groups',
    entityName: 'Group',
    initialFormData: defaultFormData,
    mapItemToForm: (group) => ({
      name: group.name,
      description: group.description || '',
      program_id: group.program_id || '',
      theme: group.theme || '',
      join_type: group.join_type as 'invitation_only' | 'open',
      status: group.status as 'draft' | 'active' | 'completed' | 'archived',
      start_date: group.start_date || '',
      end_date: group.end_date || '',
      max_members: group.max_members?.toString() || '',
      circle_group_url: group.circle_group_url || '',
      calcom_mapping_id: (group as any).calcom_mapping_id || ''
    }),
  });

  // Create group mutation
  const createGroup = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('groups')
        .insert({
          name: data.name,
          description: data.description || null,
          program_id: data.program_id && data.program_id !== 'none' ? data.program_id : null,
          theme: data.theme || null,
          join_type: data.join_type,
          status: data.status,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          max_members: data.max_members ? parseInt(data.max_members) : null,
          circle_group_url: data.circle_group_url || null,
          calcom_mapping_id: data.calcom_mapping_id && data.calcom_mapping_id !== 'none' ? data.calcom_mapping_id : null,
          created_by: user?.id ?? ''
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      toast({ title: 'Group created', description: 'The group has been created successfully.' });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Delete group mutation
  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      toast({ title: 'Group deleted', description: 'The group has been deleted.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGroup.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge>Active</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'archived':
        return <Badge variant="destructive">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Groups Management</h1>
          <p className="text-muted-foreground">
            Create and manage study groups for your programs
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Create a new study group for your clients
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
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
              
              <div className="space-y-2">
                <Label htmlFor="program">Linked Program</Label>
                <Select
                  value={formData.program_id}
                  onValueChange={(value) => setFormData({ ...formData, program_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a program (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No program</SelectItem>
                    {programs?.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="join_type">Join Type</Label>
                  <Select
                    value={formData.join_type}
                    onValueChange={(value: 'invitation_only' | 'open') => setFormData({ ...formData, join_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invitation_only">Invitation Only</SelectItem>
                      <SelectItem value="open">Open for Joining</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'draft' | 'active' | 'completed' | 'archived') => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme/Topic</Label>
                  <Input
                    id="theme"
                    value={formData.theme}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                    placeholder="e.g., Leadership, AI"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max_members">Max Members</Label>
                  <Input
                    id="max_members"
                    type="number"
                    min="1"
                    value={formData.max_members}
                    onChange={(e) => setFormData({ ...formData, max_members: e.target.value })}
                    placeholder="No limit"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="circle_group_url">Community URL</Label>
                <Input
                  id="circle_group_url"
                  value={formData.circle_group_url}
                  onChange={(e) => setFormData({ ...formData, circle_group_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calcom_mapping">Calendar Booking Type</Label>
                <Select
                  value={formData.calcom_mapping_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, calcom_mapping_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select booking type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No calendar booking</SelectItem>
                    {calcomMappings?.map((mapping) => (
                      <SelectItem key={mapping.id} value={mapping.id}>
                        {mapping.calcom_event_type_name || 'Unnamed Event'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link a Cal.com event type for group session booking
                </p>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createGroup.isPending}>
                  {createGroup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Group
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Groups</CardTitle>
          <CardDescription>
            {groups?.length || 0} groups total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : groups && groups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Join Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{group.programs?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {group.member_count}
                        {group.max_members && `/${group.max_members}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.join_type === 'open' ? 'outline' : 'secondary'}>
                        {group.join_type === 'open' ? 'Open' : 'Invite Only'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(group.status)}</TableCell>
                    <TableCell>
                      {group.start_date ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(group.start_date), 'MMM d')}
                          {group.end_date && ` - ${format(new Date(group.end_date), 'MMM d')}`}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/groups/${group.id}`}>
                            <Settings className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this group?')) {
                              deleteGroup.mutate(group.id);
                            }
                          }}
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
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No groups created yet.</p>
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Group
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
