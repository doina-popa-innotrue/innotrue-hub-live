import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, UserPlus, ExternalLink, Clock, Check, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface CircleUser {
  id: string;
  user_id: string;
  circle_user_id: string;
  circle_email: string;
  created_at: string;
}

interface CircleRequest {
  id: string;
  user_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  name: string;
}

export default function CircleManagement() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [circleUserId, setCircleUserId] = useState('');
  const [circleEmail, setCircleEmail] = useState('');

  // Fetch all Circle mappings
  const { data: circleUsers, isLoading: loadingMappings } = useQuery({
    queryKey: ['circle-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CircleUser[];
    },
  });

  // Fetch pending Circle requests
  const { data: pendingRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ['circle-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_interest_registrations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CircleRequest[];
    },
  });

  // Fetch all profiles to get user names
  const { data: profiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Get profiles that don't have Circle mappings
  const unmappedProfiles = profiles?.filter(
    profile => !circleUsers?.some(cu => cu.user_id === profile.id)
  ) || [];

  // Add Circle mapping
  const addMappingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !circleEmail) {
        throw new Error('User and Circle email are required');
      }

      // Circle User ID is optional: if omitted, store the email as a placeholder.
      // The backend SSO flow will resolve it to the correct numeric member id.
      const resolvedCircleUserId = (circleUserId || circleEmail).trim();

      const { error } = await supabase
        .from('circle_users')
        .insert({
          user_id: selectedUserId,
          circle_user_id: resolvedCircleUserId,
          circle_email: circleEmail.trim(),
        });

      if (error) throw error;

      // Update any pending request to approved
      await supabase
        .from('circle_interest_registrations')
        .update({ status: 'approved' })
        .eq('user_id', selectedUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circle-users'] });
      queryClient.invalidateQueries({ queryKey: ['circle-requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      setSelectedUserId('');
      setCircleUserId('');
      setCircleEmail('');
      toast.success('Community mapping added successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add mapping: ${error.message}`);
    },
  });

  // Update request status
  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      const { error } = await supabase
        .from('circle_interest_registrations')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circle-requests'] });
      toast.success('Request status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update request: ${error.message}`);
    },
  });

  // Delete Circle mapping
  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from('circle_users')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circle-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast.success('Community mapping deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete mapping: ${error.message}`);
    },
  });

  const getUserName = (userId: string) => {
    return profiles?.find(p => p.id === userId)?.name || 'Unknown User';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = pendingRequests?.filter(r => r.status === 'pending').length || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">InnoTrue Community Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage user mappings between InnoTrue Hub and InnoTrue Community
        </p>
      </div>

      {/* Pending Requests Card */}
      {pendingCount > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Pending Connection Requests
              <Badge variant="secondary">{pendingCount}</Badge>
            </CardTitle>
            <CardDescription>
              Users requesting access to the InnoTrue Community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests?.filter(r => r.status === 'pending').map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {getUserName(request.user_id)}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUserId(request.user_id);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add Mapping
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateRequestMutation.mutate({ 
                          requestId: request.id, 
                          status: 'rejected' 
                        })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add New Mapping Card */}
      <Card>
        <CardHeader>
          <CardTitle>Add Community User Mapping</CardTitle>
          <CardDescription>
            Connect an InnoTrue Hub user to their InnoTrue Community account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="user-select">InnoTrue User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {unmappedProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="circle-user-id">Community User ID (optional)</Label>
              <Input
                id="circle-user-id"
                placeholder="Leave blank to auto-resolve"
                value={circleUserId}
                onChange={(e) => setCircleUserId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If you don’t know the numeric Circle ID, leave this blank and we’ll resolve it by email.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="circle-email">Community Email</Label>
              <Input
                id="circle-email"
                type="email"
                placeholder="user@example.com"
                value={circleEmail}
                onChange={(e) => setCircleEmail(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={() => addMappingMutation.mutate()}
            disabled={!selectedUserId || !circleEmail || addMappingMutation.isPending}
            className="w-full md:w-auto"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Mapping
          </Button>
        </CardContent>
      </Card>

      {/* Existing Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Community Mappings</CardTitle>
          <CardDescription>
            View and manage existing user mappings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMappings ? (
            <p className="text-muted-foreground">Loading mappings...</p>
          ) : circleUsers && circleUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>InnoTrue User</TableHead>
                  <TableHead>Community User ID</TableHead>
                  <TableHead>Community Email</TableHead>
                  <TableHead>Mapped On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {circleUsers.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">
                      {getUserName(mapping.user_id)}
                    </TableCell>
                    <TableCell>{mapping.circle_user_id}</TableCell>
                    <TableCell>{mapping.circle_email}</TableCell>
                    <TableCell>
                      {new Date(mapping.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Community Mapping?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the connection between {getUserName(mapping.user_id)} and their InnoTrue Community account.
                              They will need to be reconnected to access the InnoTrue Community.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMappingMutation.mutate(mapping.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No Community mappings found</p>
          )}
        </CardContent>
      </Card>

      {/* All Requests History */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Request History</CardTitle>
            <CardDescription>
              All Community connection requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested On</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {getUserName(request.user_id)}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(request.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Community Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>InnoTrue Community Info</CardTitle>
          <CardDescription>
            Access your InnoTrue Community dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="https://innotrue.circle.so/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open InnoTrue Community
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
