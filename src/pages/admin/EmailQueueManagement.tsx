import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { RefreshCw, Trash2, Send, Search, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailQueueItem {
  id: string;
  notification_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  template_key: string;
  template_data: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

export default function EmailQueueManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<EmailQueueItem | null>(null);

  const { data: queueItems, isLoading } = useQuery({
    queryKey: ['email-queue', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('email_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as EmailQueueItem[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_queue')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-queue'] });
      toast.success("Email removed from queue");
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    }
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_queue')
        .update({ 
          status: 'pending', 
          attempts: 0,
          error_message: null,
          last_attempt_at: null
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-queue'] });
      toast.success("Email queued for retry");
    },
    onError: (error) => {
      toast.error("Failed to retry: " + error.message);
    }
  });

  const filteredItems = queueItems?.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.recipient_email.toLowerCase().includes(search) ||
      item.recipient_name?.toLowerCase().includes(search) ||
      item.template_key.toLowerCase().includes(search)
    );
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-chart-2" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-chart-4" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-chart-1 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-chart-2">{status}</Badge>;
      case 'failed':
        return <Badge variant="destructive">{status}</Badge>;
      case 'pending':
        return <Badge variant="secondary">{status}</Badge>;
      case 'processing':
        return <Badge variant="outline">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <AdminLoadingState />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Email Queue"
        description="Monitor and manage outgoing email queue"
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or template..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['email-queue'] })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {!filteredItems?.length ? (
        <AdminEmptyState
          icon={Send}
          title="No emails in queue"
          description="The email queue is empty or no emails match your filters."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="hidden md:table-cell">Template</TableHead>
                  <TableHead className="hidden md:table-cell">Attempts</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="hidden lg:table-cell">Sent At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        {getStatusBadge(item.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.recipient_name || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">{item.recipient_email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="font-mono text-sm">{item.template_key}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.attempts} / {item.max_attempts}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {format(new Date(item.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {item.sent_at ? format(new Date(item.sent_at), 'MMM d, HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedItem(item)}
                        >
                          View
                        </Button>
                        {item.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryMutation.mutate(item.id)}
                            disabled={retryMutation.isPending}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email from Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this email from the queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail View Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(selectedItem.status)}
                    {getStatusBadge(selectedItem.status)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Template</label>
                  <p className="font-mono">{selectedItem.template_key}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Recipient Name</label>
                  <p>{selectedItem.recipient_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Recipient Email</label>
                  <p>{selectedItem.recipient_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Attempts</label>
                  <p>{selectedItem.attempts} / {selectedItem.max_attempts}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created At</label>
                  <p>{format(new Date(selectedItem.created_at), 'PPpp')}</p>
                </div>
                {selectedItem.scheduled_for && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Scheduled For</label>
                    <p>{format(new Date(selectedItem.scheduled_for), 'PPpp')}</p>
                  </div>
                )}
                {selectedItem.sent_at && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Sent At</label>
                    <p>{format(new Date(selectedItem.sent_at), 'PPpp')}</p>
                  </div>
                )}
                {selectedItem.last_attempt_at && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Attempt</label>
                    <p>{format(new Date(selectedItem.last_attempt_at), 'PPpp')}</p>
                  </div>
                )}
              </div>

              {selectedItem.error_message && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Error Message</label>
                  <div className="mt-1 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{selectedItem.error_message}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Template Data</label>
                <pre className="mt-1 p-3 bg-muted rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(selectedItem.template_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
