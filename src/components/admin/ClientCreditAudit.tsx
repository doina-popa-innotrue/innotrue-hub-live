import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Coins, TrendingUp, TrendingDown, Gift, CalendarIcon, AlertTriangle, Plus, Pencil, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { formatCredits, useGrantCreditBatch } from '@/hooks/useCreditBatches';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ClientCreditAuditProps {
  userId: string;
}

interface CreditBatch {
  id: string;
  feature_key: string | null;
  original_amount: number;
  remaining_amount: number;
  granted_at: string;
  expires_at: string;
  source_type: string;
  description: string | null;
  is_expired: boolean;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  action_type: string | null;
  created_at: string;
}

export function ClientCreditAudit({ userId }: ClientCreditAuditProps) {
  const queryClient = useQueryClient();
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantAmount, setGrantAmount] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [grantExpiryDate, setGrantExpiryDate] = useState<Date | undefined>();
  const { grant, isGranting } = useGrantCreditBatch();

  // Edit batch state
  const [editBatch, setEditBatch] = useState<CreditBatch | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState<Date | undefined>();
  const [editDescription, setEditDescription] = useState('');

  // Fetch default expiry months for admin_grant
  const { data: sourceTypeConfig } = useQuery({
    queryKey: ['credit-source-type', 'admin_grant'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_source_types')
        .select('default_expiry_months')
        .eq('key', 'admin_grant')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Set default expiry date when dialog opens or config loads
  useEffect(() => {
    if (grantDialogOpen && sourceTypeConfig?.default_expiry_months) {
      setGrantExpiryDate(addMonths(new Date(), sourceTypeConfig.default_expiry_months));
    }
  }, [grantDialogOpen, sourceTypeConfig]);

  // Initialize edit form when batch is selected
  useEffect(() => {
    if (editBatch) {
      setEditAmount(editBatch.remaining_amount.toString());
      setEditExpiryDate(new Date(editBatch.expires_at));
      setEditDescription(editBatch.description || '');
    }
  }, [editBatch]);

  // Update batch mutation
  const updateBatchMutation = useMutation({
    mutationFn: async ({ batchId, updates }: { batchId: string; updates: { remaining_amount?: number; expires_at?: string; description?: string } }) => {
      const { error } = await supabase
        .from('credit_batches')
        .update(updates)
        .eq('id', batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Credit batch updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-user-credit-batches', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-credit-summary', userId] });
      setEditBatch(null);
    },
    onError: (error) => {
      toast.error('Failed to update batch: ' + (error as Error).message);
    },
  });

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase
        .from('credit_batches')
        .delete()
        .eq('id', batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Credit batch deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-user-credit-batches', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-credit-summary', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-credit-transactions', userId] });
    },
    onError: (error) => {
      toast.error('Failed to delete batch: ' + (error as Error).message);
    },
  });

  const handleUpdateBatch = () => {
    if (!editBatch || !editExpiryDate) return;
    
    const newAmount = parseInt(editAmount, 10);
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    updateBatchMutation.mutate({
      batchId: editBatch.id,
      updates: {
        remaining_amount: newAmount,
        expires_at: editExpiryDate.toISOString(),
        description: editDescription || undefined,
      },
    });
  };

  // Fetch credit summary
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['admin-user-credit-summary', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_credit_summary_v2', {
        p_user_id: userId,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!userId,
  });

  // Fetch credit batches
  const { data: batches, isLoading: batchesLoading, error: batchesError } = useQuery({
    queryKey: ['admin-user-credit-batches', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_batches')
        .select('*')
        .eq('owner_type', 'user')
        .eq('owner_id', userId)
        .order('expires_at', { ascending: true });
      if (error) throw error;
      return data as CreditBatch[];
    },
    enabled: !!userId,
  });

  // Fetch recent transactions
  const { data: transactions, isLoading: transactionsLoading, error: transactionsError } = useQuery({
    queryKey: ['admin-user-credit-transactions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!userId,
  });

  const isLoading = summaryLoading || batchesLoading || transactionsLoading;
  const hasError = summaryError || batchesError || transactionsError;

  const handleGrantCredits = async () => {
    const amount = parseInt(grantAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    if (!grantExpiryDate) {
      toast.error('Please select an expiry date');
      return;
    }

    try {
      await grant({
        ownerType: 'user',
        ownerId: userId,
        amount,
        expiresAt: grantExpiryDate,
        sourceType: 'admin_grant',
        description: grantReason || 'Discretionary credit grant',
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin-user-credit-summary', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-credit-batches', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-credit-transactions', userId] });
      
      setGrantDialogOpen(false);
      setGrantAmount('');
      setGrantReason('');
      setGrantExpiryDate(undefined);
    } catch (error) {
      console.error('Failed to grant credits:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    const errorMessage = summaryError?.message || batchesError?.message || transactionsError?.message || 'Unknown error';
    console.error('Credit Audit Error:', { summaryError, batchesError, transactionsError });
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Credit Audit Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Failed to load credit information: {errorMessage}
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-user-credit-summary', userId] });
              queryClient.invalidateQueries({ queryKey: ['admin-user-credit-batches', userId] });
              queryClient.invalidateQueries({ queryKey: ['admin-user-credit-transactions', userId] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeBatches = batches?.filter(b => !b.is_expired && b.remaining_amount > 0) || [];
  const expiredBatches = batches?.filter(b => b.is_expired || b.remaining_amount === 0) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Credit Audit
            </CardTitle>
            <CardDescription>
              Complete credit history across all sources
            </CardDescription>
          </div>
          <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1" />
                Grant Credits
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Discretionary Credits</DialogTitle>
                <DialogDescription>
                  Add bonus credits to this client's account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="grant-amount">Credit Amount</Label>
                  <Input
                    id="grant-amount"
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !grantExpiryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {grantExpiryDate ? format(grantExpiryDate, "PPP") : "Select expiry date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={grantExpiryDate}
                        onSelect={setGrantExpiryDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grant-reason">Reason (optional)</Label>
                  <Textarea
                    id="grant-reason"
                    placeholder="e.g., Compensation for service issue"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGrantCredits} disabled={isGranting || !grantAmount}>
                  {isGranting ? 'Granting...' : 'Grant Credits'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="p-4 rounded-lg border bg-primary/5">
            <div className="text-sm text-muted-foreground">Plan Credits</div>
            <div className="text-2xl font-bold">{formatCredits(summary?.plan_remaining ?? 0)}</div>
            <div className="text-xs text-muted-foreground">
              of {formatCredits(summary?.plan_allowance ?? 0)} monthly
            </div>
          </div>
          <div className="p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Program Credits</div>
            <div className="text-2xl font-bold">{formatCredits(summary?.program_remaining ?? 0)}</div>
            <div className="text-xs text-muted-foreground">
              from {summary?.program_details?.length ?? 0} enrollments
            </div>
          </div>
          <div className="p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Bonus Credits</div>
            <div className="text-2xl font-bold">{formatCredits(summary?.bonus_credits ?? 0)}</div>
            <div className="text-xs text-muted-foreground">
              {activeBatches.length} active batches
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-success/5">
            <div className="text-sm text-muted-foreground">Total Available</div>
            <div className="text-2xl font-bold text-success">{formatCredits(summary?.total_available ?? 0)}</div>
          </div>
        </div>

        {/* Expiring Soon Warning */}
        {(summary?.expiring_soon ?? 0) > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              {formatCredits(summary.expiring_soon)} credits expiring within 7 days
            </span>
          </div>
        )}

        {/* Active Credit Batches */}
        {activeBatches.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Active Credit Batches
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {batch.source_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{batch.feature_key || 'General'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCredits(batch.remaining_amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCredits(batch.original_amount)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(batch.expires_at), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditBatch(batch)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Credit Batch</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove {formatCredits(batch.remaining_amount)} credits from this user's account. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteBatchMutation.mutate(batch.id)}
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
        )}

        {/* Edit Batch Dialog */}
        <Dialog open={!!editBatch} onOpenChange={(open) => !open && setEditBatch(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Credit Batch</DialogTitle>
              <DialogDescription>
                Modify the remaining amount, expiry date, or description.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Remaining Credits</Label>
                <Input
                  type="number"
                  min="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Original: {formatCredits(editBatch?.original_amount ?? 0)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editExpiryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editExpiryDate ? format(editExpiryDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editExpiryDate}
                      onSelect={setEditExpiryDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Reason for the grant"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditBatch(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateBatch} 
                disabled={updateBatchMutation.isPending}
              >
                {updateBatchMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Recent Transactions */}
        {transactions && transactions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Transactions</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.amount >= 0 ? 'default' : 'secondary'} className="capitalize">
                        {tx.transaction_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`flex items-center justify-end gap-1 font-medium ${tx.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {tx.amount >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {tx.amount >= 0 ? '+' : ''}{formatCredits(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCredits(tx.balance_after)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {tx.description || tx.action_type || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}