import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, UserCheck, UserX, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

interface Client {
  id: string;
  user_id: string;
  status: string;
  status_marker: string | null;
  profiles: {
    name: string;
    id: string;
  };
  user_email: string;
  enrollmentCount: number;
  coaches: { id: string; name: string }[];
  plan: { id: string; name: string; key: string } | null;
}

interface StatusMarker {
  id: string;
  name: string;
}

export default function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [statusMarkers, setStatusMarkers] = useState<StatusMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  async function fetchClients() {
    // Fetch status markers
    const { data: markers } = await supabase
      .from('status_markers')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order');
    setStatusMarkers(markers || []);

    // Get all users with client role from user_roles table
    const { data: clientRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'client');

    if (!clientRoles || clientRoles.length === 0) {
      setClients([]);
    } else {
      const enrichedClients = await Promise.all(
        clientRoles.map(async (roleEntry) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, id, plan_id, plans(id, name, key)')
            .eq('id', roleEntry.user_id)
            .single();

          const { data: clientProfile } = await supabase
            .from('client_profiles')
            .select('id, status, status_marker')
            .eq('user_id', roleEntry.user_id)
            .maybeSingle();
          
          const { count } = await supabase
            .from('client_enrollments')
            .select('id', { count: 'exact', head: true })
            .eq('client_user_id', roleEntry.user_id)
            .eq('status', 'active');

          // Get assigned coaches
          const { data: coachRelations } = await supabase
            .from('client_coaches')
            .select('coach_id')
            .eq('client_id', roleEntry.user_id);

          let coaches: { id: string; name: string }[] = [];
          if (coachRelations && coachRelations.length > 0) {
            const coachIds = coachRelations.map(c => c.coach_id);
            const { data: coachProfiles } = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', coachIds);
            coaches = coachProfiles || [];
          }

          return {
            id: clientProfile?.id || roleEntry.user_id,
            user_id: roleEntry.user_id,
            status: clientProfile?.status || 'active',
            status_marker: clientProfile?.status_marker || null,
            profiles: { name: profile?.name || 'Unknown', id: roleEntry.user_id },
            user_email: '',
            enrollmentCount: count || 0,
            coaches,
            plan: profile?.plans || null,
          };
        })
      );

      setClients(enrichedClients as Client[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
  }, []);

  async function toggleUserStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('client_profiles')
      .update({ status: newStatus })
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to update user status');
    } else {
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchClients();
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;

    try {
      // Call secure edge function to delete user
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete },
      });

      if (error) throw error;

      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchClients();
    } catch (error: unknown) {
      console.error('Delete user error:', error);
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to delete user');
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Clients</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Clients</h1>
        <p className="text-muted-foreground mt-1">
          Manage client accounts. Use Users Management to create placeholder users for clients not yet registered.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>Users with the client role in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status Marker</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Coach(es)</TableHead>
                <TableHead>Active Programs</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.profiles.name}</TableCell>
                  <TableCell>
                    {client.status_marker ? (
                      <Badge variant="secondary">{client.status_marker}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.plan ? (
                      <Badge variant="outline">{client.plan.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No plan</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {client.coaches.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {client.coaches.map((coach) => (
                          <Badge key={coach.id} variant="outline">{coach.name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">None assigned</span>
                    )}
                  </TableCell>
                  <TableCell>{client.enrollmentCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/clients/${client.user_id}`)}
                      >
                        View Details
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleUserStatus(client.user_id, client.status)}>
                            {client.status === 'active' ? (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              setUserToDelete(client.user_id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No clients found. Create users with the "client" role in Users Management.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account and all associated data including enrollments and progress. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
