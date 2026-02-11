import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Calendar, BookOpen, CheckSquare, MessageSquare, 
  FileText, Plus, ExternalLink, Loader2, Trash2, UserPlus, Video, Settings, Pencil, Link as LinkIcon, FolderOpen, Hash, ClipboardCheck, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useGroupSessionMutations, SessionFormData } from '@/hooks/useGroupSessionMutations';
import { GroupPeerAssessmentConfig } from '@/components/groups/GroupPeerAssessmentConfig';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { GroupSessionsList } from '@/components/groups/sessions';

export default function AdminGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('members');
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'leader'>('member');
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState('');
  const [slackChannelUrl, setSlackChannelUrl] = useState('');
  const [groupStatus, setGroupStatus] = useState<'draft' | 'active' | 'completed' | 'archived'>('draft');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [calcomMappingId, setCalcomMappingId] = useState('');
  
  // Get user's timezone with fallback
  const { timezone: userTimezone } = useUserTimezone();
  
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '' });

  // Fetch group details
  const { data: group, isLoading: loadingGroup } = useQuery({
    queryKey: ['admin-group', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select(`*, programs (name), calcom_event_type_mappings!groups_calcom_mapping_id_fkey (id, calcom_event_type_name, scheduling_url)`)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
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

  // Fetch members with profile data via FK relationship
  const { data: members } = useQuery({
    queryKey: ['admin-group-members', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_memberships')
        .select('*, profiles:user_id (id, name, avatar_url)')
        .eq('group_id', id!)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Fetch all users for adding members
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-group'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const userById = useMemo(() => {
    const map = new Map<string, { id: string; name: string | null; avatar_url: string | null }>();
    (allUsers ?? []).forEach((u: any) => map.set(u.id, u));
    return map;
  }, [allUsers]);

  // Fetch tasks
  const { data: tasks } = useQuery({
    queryKey: ['admin-group-tasks', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_tasks')
        .select('*')
        .eq('group_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Fetch check-ins
  const { data: checkIns } = useQuery({
    queryKey: ['admin-group-check-ins', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_check_ins')
        .select('*')
        .eq('group_id', id!)
        .order('check_in_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Fetch notes
  const { data: notes } = useQuery({
    queryKey: ['admin-group-notes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_notes')
        .select('*')
        .eq('group_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Fetch sessions
  const { data: sessions } = useQuery({
    queryKey: ['admin-group-sessions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_sessions')
        .select('*')
        .eq('group_id', id!)
        .order('session_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Fetch interest registrations
  const { data: pendingRequests } = useQuery({
    queryKey: ['group-interest-registrations', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_interest_registrations')
        .select('*')
        .eq('group_id', id!)
        .eq('status', 'pending');
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Add member mutation
  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('group_memberships')
        .insert([{
          group_id: id!,
          user_id: selectedUserId,
          role: selectedRole,
          status: 'active' as const
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-members', id] });
      toast({ title: 'Member added' });
      setIsAddMemberOpen(false);
      setSelectedUserId('');
      setSelectedRole('member');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Approve request mutation
  const approveRequest = useMutation({
    mutationFn: async (userId: string) => {
      // Add membership
      await supabase.from('group_memberships').insert([{
        group_id: id!,
        user_id: userId,
        role: 'member' as const,
        status: 'active' as const
      }]);
      // Update registration status
      await supabase.from('group_interest_registrations')
        .update({ status: 'approved' })
        .eq('group_id', id!)
        .eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-members', id] });
      queryClient.invalidateQueries({ queryKey: ['group-interest-registrations', id] });
      toast({ title: 'Request approved' });
    }
  });

  // Decline request mutation
  const declineRequest = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from('group_interest_registrations')
        .update({ status: 'declined' })
        .eq('group_id', id!)
        .eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-interest-registrations', id] });
      toast({ title: 'Request declined' });
    }
  });

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase
        .from('group_memberships')
        .update({ status: 'left', left_at: new Date().toISOString() })
        .eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-members', id] });
      toast({ title: 'Member removed' });
    }
  });

  // Update member role mutation
  const updateMemberRole = useMutation({
    mutationFn: async ({ membershipId, role }: { membershipId: string; role: 'member' | 'leader' }) => {
      const { error } = await supabase
        .from('group_memberships')
        .update({ role })
        .eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-members', id] });
    }
  });

  // Delete task
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      await supabase.from('group_tasks').delete().eq('id', taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-tasks', id] });
      toast({ title: 'Task deleted' });
    }
  });

  // Delete note
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      await supabase.from('group_notes').delete().eq('id', noteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-notes', id] });
      toast({ title: 'Note deleted' });
    }
  });

  // Delete check-in
  const deleteCheckIn = useMutation({
    mutationFn: async (checkInId: string) => {
      await supabase.from('group_check_ins').delete().eq('id', checkInId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-check-ins', id] });
      toast({ title: 'Check-in deleted' });
    }
  });

  // Update group settings (Calendly + Google Drive + Status)
  const updateGroupSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('groups')
        .update({ 
          name: groupName,
          description: groupDescription || null,
          google_drive_folder_url: googleDriveFolderUrl || null,
          slack_channel_url: slackChannelUrl || null,
          status: groupStatus,
          calcom_mapping_id: calcomMappingId && calcomMappingId !== 'none' ? calcomMappingId : null
        })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group', id] });
      toast({ title: 'Settings updated' });
      setIsSettingsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('group_tasks')
        .insert({
          group_id: id!,
          title: taskForm.title,
          description: taskForm.description || null,
          due_date: taskForm.due_date || null,
          created_by: user.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-tasks', id] });
      toast({ title: 'Task created' });
      setIsAddTaskOpen(false);
      setTaskForm({ title: '', description: '', due_date: '' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Use shared session mutations hook
  const {
    createSession: createSessionMutation,
    deleteSession: deleteSessionMutation,
    updateSessionStatus: updateSessionStatusMutation,
  } = useGroupSessionMutations(id, 'admin-group-sessions');

  // Handler for the shared component - creates session with Google Calendar integration
  const handleCreateSessionForList = async (formData: SessionFormData, timezone?: string, useGoogleCalendar?: boolean) => {
    if (!user) return;
    
    const sessionTimezoneToUse = timezone || userTimezone;
    
    // Build the session datetime
    const sessionDateTime = formData.session_time
      ? new Date(`${formData.session_date}T${formData.session_time}`)
      : new Date(formData.session_date);
    
    // Calculate end time based on duration
    const durationMinutes = parseInt(formData.duration_minutes) || 60;
    const endDateTime = new Date(sessionDateTime.getTime() + durationMinutes * 60 * 1000);
    
    return new Promise<void>((resolve, reject) => {
      createSessionMutation.mutate(
        { 
          groupId: id!,
          userId: user.id, 
          formData: { 
            ...formData, 
            location: formData.location,
            timezone: sessionTimezoneToUse
          } 
        },
        {
          onSuccess: async (masterSession) => {
            // Create Google Calendar event with Meet link only if enabled
            if (masterSession?.id && useGoogleCalendar) {
              try {
                // Get active member user IDs - the edge function will fetch their emails server-side
                const memberUserIds = members?.filter((m: any) => m.status === 'active').map((m: any) => m.user_id) || [];
                
                console.log('Creating Google Calendar event with:', {
                  summary: formData.title,
                  startTime: sessionDateTime.toISOString(),
                  endTime: endDateTime.toISOString(),
                  memberUserIdsCount: memberUserIds.length,
                  sessionId: masterSession.id,
                });
                
                const { data: calendarResult, error: calendarError } = await supabase.functions.invoke('google-calendar-create-event', {
                  body: {
                    summary: formData.title,
                    description: formData.description || `Group session for ${group?.name}`,
                    startTime: sessionDateTime.toISOString(),
                    endTime: endDateTime.toISOString(),
                    timezone: sessionTimezoneToUse,
                    memberUserIds, // Edge function will fetch emails from auth.users
                    sessionId: masterSession.id,
                    // Pass recurrence info for Google Calendar recurring event
                    recurrencePattern: formData.is_recurring ? formData.recurrence_pattern : undefined,
                    recurrenceEndDate: formData.is_recurring ? (formData.recurrence_end_date || undefined) : undefined,
                  },
                });
                
                console.log('Google Calendar result:', calendarResult, 'error:', calendarError);
                
                if (calendarError) {
                  console.error('Google Calendar error:', calendarError);
                  toast({
                    title: 'Session created',
                    description: 'Could not create Google Meet link. You can add one manually.',
                    variant: 'default',
                  });
                } else if (calendarResult?.meetingLink) {
                  toast({
                    title: 'Session created with Google Meet',
                    description: 'Calendar event and meeting link created successfully.',
                  });
                  // Refresh sessions to show updated meeting link
                  queryClient.invalidateQueries({ queryKey: ['admin-group-sessions', id] });
                } else {
                  toast({
                    title: 'Session created',
                    description: 'Calendar event created but no meeting link returned.',
                  });
                }
              } catch (err) {
                console.error('Error creating Google Calendar event:', err);
                toast({
                  title: 'Session created',
                  description: 'Could not create calendar event. Session saved without meeting link.',
                });
              }
            }
            resolve();
          },
          onError: (error) => {
            reject(error);
          }
        }
      );
    });
  };

  // Simple delete session wrapper
  const handleDeleteSession = (sessionId: string) => {
    deleteSessionMutation.mutate(
      { sessionId, deleteAll: false, session: { id: sessionId, is_recurring: false, parent_session_id: null } }
    );
  };

  // Bulk delete sessions mutation
  const bulkDeleteSessionsMutation = useMutation({
    mutationFn: async (sessionIds: string[]) => {
      const { error } = await supabase
        .from('group_sessions')
        .delete()
        .in('id', sessionIds);
      if (error) throw error;
    },
    onSuccess: (_, sessionIds) => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-sessions', id] });
      toast({ title: `${sessionIds.length} session(s) deleted` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Handler for bulk delete from shared component
  const handleBulkDeleteSessionsForList = (sessionIds: string[]) => {
    bulkDeleteSessionsMutation.mutate(sessionIds);
  };

  // Update session status wrapper
  const handleUpdateSessionStatus = (sessionId: string, status: string) => {
    updateSessionStatusMutation.mutate({ sessionId, status });
  };

  if (!id) return null;

  if (loadingGroup) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Group not found</p>
            <Button asChild className="mt-4">
              <Link to="/admin/groups">Back to Groups</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memberIds = members?.filter((m: any) => m.status === 'active').map((m: any) => m.user_id) || [];
  const availableUsers = allUsers?.filter((u: any) => !memberIds.includes(u.id)) || [];
  const activeMembers = members?.filter((m: any) => m.status === 'active') || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/admin/groups">Groups</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{group.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold break-words">{group.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>{group.status}</Badge>
            <Badge variant="outline">{group.join_type === 'open' ? 'Open' : 'Invite Only'}</Badge>
          </div>
          {group.programs?.name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{group.programs.name}</span>
            </div>
          )}
          {group.description && <p className="text-muted-foreground text-sm">{group.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {group.google_drive_folder_url && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(group.google_drive_folder_url!, '_blank', 'noopener,noreferrer')}
            >
              <FolderOpen className="mr-2 h-4 w-4" />Google Drive
            </Button>
          )}
          {group.slack_channel_url && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(group.slack_channel_url!, '_blank', 'noopener,noreferrer')}
            >
              <Hash className="mr-2 h-4 w-4" />Slack
            </Button>
          )}
          {group.circle_group_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={group.circle_group_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />Community
              </a>
            </Button>
          )}
          <Dialog open={isSettingsOpen} onOpenChange={(open) => {
            setIsSettingsOpen(open);
            if (open) {
              setGroupName(group.name || '');
              setGroupDescription(group.description || '');
              setGoogleDriveFolderUrl(group.google_drive_folder_url || '');
              setSlackChannelUrl(group.slack_channel_url || '');
              setGroupStatus(group.status || 'draft');
              setCalcomMappingId(group.calcom_mapping_id || '');
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Group Settings</DialogTitle>
                <DialogDescription>Configure status, links and resources for this group</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Group Name</Label>
                  <Input 
                    value={groupName} 
                    onChange={(e) => setGroupName(e.target.value)} 
                    placeholder="Enter group name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={groupDescription} 
                    onChange={(e) => setGroupDescription(e.target.value)} 
                    placeholder="Optional description for this group"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Group Status</Label>
                  <Select value={groupStatus} onValueChange={(v: 'draft' | 'active' | 'completed' | 'archived') => setGroupStatus(v)}>
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
                  <p className="text-xs text-muted-foreground">
                    Set to "Active" to make the group fully operational for members.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Google Drive Folder URL</Label>
                  <Input 
                    value={googleDriveFolderUrl} 
                    onChange={(e) => setGoogleDriveFolderUrl(e.target.value)} 
                    placeholder="https://drive.google.com/drive/folders/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste your Google Drive folder link. Group members will be able to access shared files.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Slack Channel URL</Label>
                  <Input 
                    value={slackChannelUrl} 
                    onChange={(e) => setSlackChannelUrl(e.target.value)} 
                    placeholder="https://yourworkspace.slack.com/archives/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Link to a private Slack channel for group collaboration.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Calendar Booking Type</Label>
                  <Select value={calcomMappingId || 'none'} onValueChange={(v) => setCalcomMappingId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select booking type" />
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
                    Link a Cal.com event type for group session booking.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button onClick={() => updateGroupSettings.mutate()} disabled={updateGroupSettings.isPending}>
                  {updateGroupSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card className="border-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Pending Join Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pendingRequests.map((req: any) => {
                const requester = userById.get(req.user_id);
                return (
                  <div key={req.id} className="flex items-center gap-2 p-2 rounded border bg-muted/50">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={requester?.avatar_url ?? undefined} />
                      <AvatarFallback>{requester?.name?.charAt(0) ?? '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{requester?.name ?? 'Unknown'}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => approveRequest.mutate(req.user_id)}>Approve</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={() => declineRequest.mutate(req.user_id)}>Decline</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="relative">
          {/* Scroll hint indicator - right fade with arrow */}
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background via-background/80 to-transparent pointer-events-none z-10 flex items-center justify-end pr-1 xl:hidden">
            <ChevronRight className="h-4 w-4 text-muted-foreground animate-pulse" />
          </div>
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 scrollbar-none scroll-smooth">
            <TabsTrigger value="members" className="text-xs sm:text-sm shrink-0">
              <Users className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Members ({activeMembers.length})
            </TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs sm:text-sm shrink-0">
              <Video className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Sessions ({sessions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="peer-assessments" className="text-xs sm:text-sm shrink-0">
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Peer Assessments
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm shrink-0">
              <CheckSquare className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Tasks ({tasks?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="check-ins" className="text-xs sm:text-sm shrink-0">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Check-ins ({checkIns?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs sm:text-sm shrink-0">
              <FileText className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Notes ({notes?.length || 0})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Manage Members</h3>
            <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Member</DialogTitle>
                  <DialogDescription>Add a user to this group</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger><SelectValue placeholder="Choose a user" /></SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selectedRole} onValueChange={(v: 'member' | 'leader') => setSelectedRole(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="leader">Leader</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
                  <Button onClick={() => addMember.mutate()} disabled={!selectedUserId || addMember.isPending}>
                    {addMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeMembers.map((member: any) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profiles?.avatar_url} />
                        <AvatarFallback>{member.profiles?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {member.profiles?.name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={member.role} onValueChange={(role: 'member' | 'leader') => updateMemberRole.mutate({ membershipId: member.id, role })}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="leader">Leader</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{format(new Date(member.joined_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => {
                      if (confirm('Remove this member?')) removeMember.mutate(member.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          {/* Info banner when no scheduling URL configured */}
          {group.calcom_mapping_id && !group.calcom_event_type_mappings?.scheduling_url && (
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50 text-sm">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">Calendar booking type assigned but no URL configured</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Add a scheduling URL in <a href="/admin/calcom-mappings" className="text-primary hover:underline">Calendar Mappings</a> to enable "Book via Cal.com"
                </p>
              </div>
            </div>
          )}
          
          <GroupSessionsList
            sessions={sessions || []}
            groupId={id}
            userTimezone={userTimezone}
            isAdmin={true}
            linkPrefix="/admin/groups"
            calcomMappingName={group.calcom_event_type_mappings?.calcom_event_type_name ?? undefined}
            onCreateSession={handleCreateSessionForList}
            onDeleteSession={(session, deleteAll) => handleDeleteSession(session.id)}
            onStatusChange={handleUpdateSessionStatus}
            onBulkDelete={handleBulkDeleteSessionsForList}
            isBulkDeleting={bulkDeleteSessionsMutation.isPending}
            isCreating={createSessionMutation.isPending}
            showTimezone={true}
            initialTimezone={userTimezone}
            showGoogleCalendarOption={true}
            initialUseGoogleCalendar={true}
          />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Group Tasks</h3>
            <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                  <DialogDescription>Add a new task for the group</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>Cancel</Button>
                  <Button onClick={() => createTask.mutate()} disabled={!taskForm.title || createTask.isPending}>
                    {createTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {tasks && tasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task: any) => {
                  const assignee = task.assigned_to ? userById.get(task.assigned_to) : null;
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{assignee?.name ?? 'Unassigned'}</TableCell>
                      <TableCell>
                      <Badge variant={task.status === 'completed' ? 'default' : task.status === 'in_progress' ? 'secondary' : 'outline'}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{task.due_date ? format(new Date(task.due_date), 'MMM d') : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm('Delete this task?')) deleteTask.mutate(task.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No tasks yet</CardContent></Card>
          )}
        </TabsContent>

        {/* Check-ins Tab */}
        <TabsContent value="check-ins" className="space-y-4">
          <h3 className="text-lg font-semibold">Accountability Check-ins</h3>
          {checkIns && checkIns.length > 0 ? (
            <div className="space-y-4">
              {checkIns.map((checkIn: any) => {
                const author = userById.get(checkIn.user_id);
                return (
                  <Card key={checkIn.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={author?.avatar_url ?? undefined} />
                          <AvatarFallback>{author?.name?.charAt(0) ?? '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{author?.name ?? 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(checkIn.check_in_date), 'MMM d, yyyy')}</span>
                            {checkIn.mood && <span>{checkIn.mood === 'great' ? '😊' : checkIn.mood === 'good' ? '🙂' : checkIn.mood === 'okay' ? '😐' : '😔'}</span>}
                          </div>
                          <p className="text-sm">{checkIn.content}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => {
                          if (confirm('Delete this check-in?')) deleteCheckIn.mutate(checkIn.id);
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No check-ins yet</CardContent></Card>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <h3 className="text-lg font-semibold">Shared Notes</h3>
          {notes && notes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((note: any) => (
                  <TableRow key={note.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{note.title}</p>
                        {note.content && <p className="text-sm text-muted-foreground line-clamp-1">{note.content}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{userById.get(note.created_by)?.name ?? 'Unknown'}</TableCell>
                    <TableCell>{format(new Date(note.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm('Delete this note?')) deleteNote.mutate(note.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No notes yet</CardContent></Card>
          )}
        </TabsContent>

        {/* Peer Assessments Tab */}
        <TabsContent value="peer-assessments" className="space-y-4">
          <GroupPeerAssessmentConfig groupId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}