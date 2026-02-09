import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, Calendar, UserCheck, Link, Pencil } from 'lucide-react';

interface InstructorEventType {
  id: string;
  instructor_id: string;
  module_type: string;
  child_event_type_id: number;
  booking_url: string | null;
  created_at: string;
  updated_at: string;
  instructor?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

interface ModuleType {
  id: string;
  name: string;
  description: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  avatar_url: string | null;
}

export function InstructorCalcomEventTypes() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<InstructorEventType | null>(null);
  const [formData, setFormData] = useState({
    instructor_id: '',
    module_type: '',
    child_event_type_id: '',
    booking_url: '',
  });

  // Fetch existing mappings
  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['instructor-calcom-event-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_calcom_event_types')
        .select('*')
        .order('module_type', { ascending: true });
      
      if (error) throw error;

      // Fetch instructor profiles
      const instructorIds = [...new Set(data.map(m => m.instructor_id))];
      if (instructorIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', instructorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(m => ({
        ...m,
        instructor: profileMap.get(m.instructor_id),
      })) as InstructorEventType[];
    },
  });

  // Fetch module types
  const { data: moduleTypes = [] } = useQuery({
    queryKey: ['module-types-for-instructor-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_types')
        .select('id, name, description')
        .order('name');
      if (error) throw error;
      return data as ModuleType[];
    },
  });

  // Fetch instructors and coaches
  const { data: staffMembers = [] } = useQuery({
    queryKey: ['staff-for-instructor-events'],
    queryFn: async () => {
      // Get user IDs with instructor or coach roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['instructor', 'coach']);

      if (!roles || roles.length === 0) return [];

      const userIds = [...new Set(roles.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds)
        .order('name');

      return (profiles || []) as StaffMember[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('instructor_calcom_event_types')
        .insert({
          instructor_id: data.instructor_id,
          module_type: data.module_type,
          child_event_type_id: parseInt(data.child_event_type_id, 10),
          booking_url: data.booking_url?.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-calcom-event-types'] });
      toast.success('Event type mapping created');
      setDialogOpen(false);
      setFormData({ instructor_id: '', module_type: '', child_event_type_id: '', booking_url: '' });
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This instructor already has a mapping for this module type');
      } else {
        toast.error('Failed to create mapping');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; child_event_type_id: string; booking_url: string }) => {
      const { error } = await supabase
        .from('instructor_calcom_event_types')
        .update({
          child_event_type_id: parseInt(data.child_event_type_id, 10),
          booking_url: data.booking_url?.trim() || null,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-calcom-event-types'] });
      toast.success('Event type mapping updated');
      closeDialog();
    },
    onError: () => {
      toast.error('Failed to update mapping');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instructor_calcom_event_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-calcom-event-types'] });
      toast.success('Event type mapping deleted');
    },
    onError: () => {
      toast.error('Failed to delete mapping');
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMapping(null);
    setFormData({ instructor_id: '', module_type: '', child_event_type_id: '', booking_url: '' });
  };

  const openEditDialog = (mapping: InstructorEventType) => {
    setEditingMapping(mapping);
    setFormData({
      instructor_id: mapping.instructor_id,
      module_type: mapping.module_type,
      child_event_type_id: String(mapping.child_event_type_id),
      booking_url: mapping.booking_url || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.child_event_type_id) {
      toast.error('Please enter the Child Event Type ID');
      return;
    }
    
    if (editingMapping) {
      updateMutation.mutate({
        id: editingMapping.id,
        child_event_type_id: formData.child_event_type_id,
        booking_url: formData.booking_url,
      });
    } else {
      if (!formData.instructor_id || !formData.module_type) {
        toast.error('Please fill in all required fields');
        return;
      }
      createMutation.mutate(formData);
    }
  };

  // Group mappings by instructor for better display
  const groupedByInstructor = mappings.reduce((acc, mapping) => {
    const key = mapping.instructor_id;
    if (!acc[key]) {
      acc[key] = {
        instructor: mapping.instructor,
        mappings: [],
      };
    }
    acc[key].mappings.push(mapping);
    return acc;
  }, {} as Record<string, { instructor?: InstructorEventType['instructor']; mappings: InstructorEventType[] }>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col space-y-4 pb-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Instructor Event Type Mappings
            </CardTitle>
            <CardDescription>
              Map each instructor's Cal.com child event type ID per module type for personalized booking
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) closeDialog();
            else setDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={() => setEditingMapping(null)}>
                <Plus className="h-4 w-4" />
                Add Mapping
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMapping ? 'Edit Instructor Event Type Mapping' : 'Add Instructor Event Type Mapping'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingMapping ? (
                  <>
                    <div className="space-y-2">
                      <Label>Instructor/Coach *</Label>
                      <Select
                        value={formData.instructor_id}
                        onValueChange={(value) => setFormData({ ...formData, instructor_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select instructor or coach" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="max-h-60">
                            {staffMembers.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={staff.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {staff.name?.charAt(0) || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {staff.name}
                                </div>
                              </SelectItem>
                            ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Module Type *</Label>
                      <Select
                        value={formData.module_type}
                        onValueChange={(value) => setFormData({ ...formData, module_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select module type" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="max-h-60">
                            {moduleTypes.map((type) => (
                              <SelectItem key={type.id} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Editing mapping for <strong>{editingMapping.instructor?.name}</strong> on <strong>{editingMapping.module_type}</strong>
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Cal.com Child Event Type ID *</Label>
                  <Input
                    type="number"
                    value={formData.child_event_type_id}
                    onChange={(e) => setFormData({ ...formData, child_event_type_id: e.target.value })}
                    placeholder="e.g., 789012"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the <strong>instructor's child event type ID</strong> (not the parent team ID). 
                    Find this in Cal.com → Team → Managed Event → Click the specific instructor's version to get their unique ID.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Booking URL (Optional - Recommended for Managed Events)</Label>
                  <Input
                    type="url"
                    value={formData.booking_url}
                    onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                    placeholder="https://cal.com/team/instructor/event-type"
                  />
                  <p className="text-xs text-muted-foreground">
                    <strong>For managed events:</strong> Copy the full booking URL from Cal.com. The system will use this directly instead of making API calls.
                    Leave empty if you want the system to resolve the URL automatically via the Cal.com API.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingMapping 
                      ? (updateMutation.isPending ? 'Saving...' : 'Save Changes')
                      : (createMutation.isPending ? 'Creating...' : 'Create Mapping')
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="rounded-lg border p-3 bg-muted/30 text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Purpose:</strong> These mappings generate <strong>personalized booking URLs</strong> for 
            clients. When a client needs to book a session, the system uses this table to find the instructor's specific 
            Cal.com Child Event Type ID for that module type, ensuring correct session duration and calendar routing.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No instructor event type mappings yet</p>
            <p className="text-sm mt-1">Add mappings to enable personalized booking URLs per instructor</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByInstructor).map(([instructorId, { instructor, mappings: instructorMappings }]) => (
              <div key={instructorId} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar>
                    <AvatarImage src={instructor?.avatar_url || undefined} />
                    <AvatarFallback>{instructor?.name?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{instructor?.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">
                      {instructorMappings.length} module type{instructorMappings.length !== 1 ? 's' : ''} configured
                    </div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module Type</TableHead>
                      <TableHead>Child Event ID</TableHead>
                      <TableHead>Booking URL</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instructorMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">{mapping.module_type}</TableCell>
                        <TableCell className="font-mono text-sm">{mapping.child_event_type_id}</TableCell>
                        <TableCell>
                          {mapping.booking_url ? (
                            <Badge variant="outline" className="text-xs">
                              <Link className="h-3 w-3 mr-1" />
                              Direct URL
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">API Lookup</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => openEditDialog(mapping)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Mapping</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Remove this event type mapping for {instructor?.name} on {mapping.module_type}?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(mapping.id)}
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}