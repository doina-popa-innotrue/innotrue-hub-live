import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Check, X, Trash2, Loader2 } from 'lucide-react';

interface DeletionRequest {
  id: string;
  user_id: string;
  status: string;
  reason: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    name: string | null;
  };
  email?: string;
}

export default function AccountDeletionRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['account-deletion-requests'],
    queryFn: async () => {
      // Fetch deletion requests
      const { data: requestsData, error } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for all user_ids
      const userIds = requestsData?.map(r => r.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      // Fetch emails using edge function
      const enrichedRequests: DeletionRequest[] = [];
      for (const request of requestsData || []) {
        const profile = profiles?.find(p => p.id === request.user_id);
        
        // Get user email
        let email = 'Unknown';
        try {
          const { data: emailData } = await supabase.functions.invoke('get-user-email', {
            body: { userId: request.user_id },
          });
          if (emailData?.email) {
            email = emailData.email;
          }
        } catch (e) {
          console.error('Failed to get email for user:', request.user_id);
        }

        enrichedRequests.push({
          ...request,
          profile: profile || undefined,
          email,
        });
      }

      return enrichedRequests;
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, notes }: { requestId: string; status: string; notes: string }) => {
      const { error } = await supabase
        .from('account_deletion_requests')
        .update({
          status,
          admin_notes: notes,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-deletion-requests'] });
      toast({
        title: 'Request updated',
        description: `The deletion request has been ${actionType === 'approve' ? 'approved' : 'rejected'}.`,
      });
      setSelectedRequest(null);
      setActionType(null);
      setAdminNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update request',
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-deletion-requests'] });
      toast({
        title: 'User deleted',
        description: 'The user account has been permanently deleted.',
      });
      setSelectedRequest(null);
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    },
  });

  const handleAction = (request: DeletionRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes('');
  };

  const handleConfirmAction = () => {
    if (!selectedRequest || !actionType) return;
    
    updateRequestMutation.mutate({
      requestId: selectedRequest.id,
      status: actionType === 'approve' ? 'approved' : 'rejected',
      notes: adminNotes,
    });
  };

  const handleDeleteUser = (request: DeletionRequest) => {
    setSelectedRequest(request);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (!selectedRequest) return;
    deleteUserMutation.mutate(selectedRequest.user_id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const processedRequests = requests?.filter(r => r.status !== 'pending') || [];

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Account Deletion Requests</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">Account Deletion Requests</h1>
        <p className="text-muted-foreground">Review and manage user account deletion requests</p>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pending Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.profile?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{request.email}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {request.reason || '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(request, 'reject')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => handleAction(request, 'approve')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(request)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Processed Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No processed requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admin Notes</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.profile?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{request.email}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {request.admin_notes || '-'}
                    </TableCell>
                    <TableCell>
                      {request.reviewed_at
                        ? format(new Date(request.reviewed_at), 'MMM d, yyyy HH:mm')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => {
        setSelectedRequest(null);
        setActionType(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} Deletion Request
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' 
                ? 'Approving this request will mark it for deletion. You will still need to manually delete the user.'
                : 'Rejecting this request will notify the user that their request has been declined.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Admin Notes (optional)</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this decision..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedRequest(null);
              setActionType(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={updateRequestMutation.isPending}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
            >
              {updateRequestMutation.isPending ? 'Processing...' : `Confirm ${actionType === 'approve' ? 'Approval' : 'Rejection'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this user's account? This action cannot be undone.
              <br /><br />
              <strong>User:</strong> {selectedRequest?.profile?.name || 'Unknown'}<br />
              <strong>Email:</strong> {selectedRequest?.email}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
