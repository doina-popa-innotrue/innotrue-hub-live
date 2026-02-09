import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, UserCheck, Users, ArrowRight } from 'lucide-react';
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

interface CompletedUser {
  user_id: string;
  user_name: string;
  user_email: string;
  completed_programs: {
    program_name: string;
    completed_at: string;
  }[];
  last_completion_date: string;
}

export default function ProgramCompletions() {
  const queryClient = useQueryClient();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // Fetch users on Programs plan who have completed all their enrollments
  const { data: completedUsers, isLoading } = useQuery({
    queryKey: ['program-completions'],
    queryFn: async () => {
      // Get the Programs plan ID
      const { data: programsPlan } = await supabase
        .from('plans')
        .select('id')
        .eq('key', 'programs')
        .single();

      if (!programsPlan) return [];

      // Get users on Programs plan
      const { data: usersOnProgramsPlan } = await supabase
        .from('profiles')
        .select('id, name, email:id')
        .eq('plan_id', programsPlan.id);

      if (!usersOnProgramsPlan || usersOnProgramsPlan.length === 0) return [];

      // For each user, check their enrollments
      const completedUsers: CompletedUser[] = [];

      for (const profile of usersOnProgramsPlan) {
        // Get user's email from auth (via edge function or profiles)
        const { data: userEmail } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', profile.id)
          .single();

        // Get all enrollments for this user
        const { data: enrollments } = await supabase
          .from('client_enrollments')
          .select(`
            id,
            status,
            updated_at,
            programs!inner (
              name
            )
          `)
          .eq('client_user_id', profile.id);

        if (!enrollments || enrollments.length === 0) continue;

        // Check if all enrollments are completed
        const allCompleted = enrollments.every(e => e.status === 'completed');
        
        if (allCompleted) {
          const completedPrograms = enrollments.map(e => ({
            program_name: (e.programs as any).name,
            completed_at: e.updated_at,
          }));

          // Find the most recent completion date
          const lastCompletionDate = completedPrograms.reduce((latest, p) => 
            new Date(p.completed_at) > new Date(latest) ? p.completed_at : latest,
            completedPrograms[0].completed_at
          );

          completedUsers.push({
            user_id: profile.id,
            user_name: profile.name || 'Unknown',
            user_email: profile.id, // We'll display the ID; in production you'd fetch email
            completed_programs: completedPrograms,
            last_completion_date: lastCompletionDate,
          });
        }
      }

      // Sort by most recent completion first
      return completedUsers.sort((a, b) => 
        new Date(b.last_completion_date).getTime() - new Date(a.last_completion_date).getTime()
      );
    },
  });

  // Get Continuation plan ID
  const { data: continuationPlan } = useQuery({
    queryKey: ['continuation-plan'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans')
        .select('id, name')
        .eq('key', 'continuation')
        .single();
      return data;
    },
  });

  const moveToContinuationMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      if (!continuationPlan) throw new Error('Continuation plan not found');

      const { error } = await supabase
        .from('profiles')
        .update({ plan_id: continuationPlan.id })
        .in('id', userIds);

      if (error) throw error;
      return userIds.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} user${count > 1 ? 's' : ''} moved to Continuation plan`);
      queryClient.invalidateQueries({ queryKey: ['program-completions'] });
      setSelectedUsers(new Set());
      setConfirmDialogOpen(false);
      setTargetUserId(null);
      setBulkAction(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to move users');
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && completedUsers) {
      setSelectedUsers(new Set(completedUsers.map(u => u.user_id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleMoveIndividual = (userId: string) => {
    setTargetUserId(userId);
    setBulkAction(false);
    setConfirmDialogOpen(true);
  };

  const handleMoveBulk = () => {
    setBulkAction(true);
    setTargetUserId(null);
    setConfirmDialogOpen(true);
  };

  const confirmMove = () => {
    if (bulkAction) {
      moveToContinuationMutation.mutate(Array.from(selectedUsers));
    } else if (targetUserId) {
      moveToContinuationMutation.mutate([targetUserId]);
    }
  };

  const allSelected = completedUsers && completedUsers.length > 0 && 
    completedUsers.every(u => selectedUsers.has(u.user_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Program Completions</h1>
        <p className="text-muted-foreground">
          Manage users who have completed their programs and are ready to transition
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Ready for Continuation
              </CardTitle>
              <CardDescription>
                Users on the Programs plan who have completed all their enrollments
              </CardDescription>
            </div>
            {selectedUsers.size > 0 && (
              <Button onClick={handleMoveBulk} disabled={moveToContinuationMutation.isPending}>
                {moveToContinuationMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                Move {selectedUsers.size} to Continuation
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !completedUsers || completedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No users ready for continuation transition</p>
              <p className="text-sm mt-1">
                Users on the Programs plan will appear here once they complete all their enrollments
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Completed Programs</TableHead>
                  <TableHead>Last Completion</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.has(user.user_id)}
                        onCheckedChange={(checked) => 
                          handleSelectUser(user.user_id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.user_name}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {user.user_id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.completed_programs.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {p.program_name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(user.last_completion_date), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMoveIndividual(user.user_id)}
                        disabled={moveToContinuationMutation.isPending}
                      >
                        <ArrowRight className="mr-1 h-3 w-3" />
                        Move
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Continuation Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction ? (
                <>
                  You are about to move <strong>{selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''}</strong> from 
                  the Programs plan to the Continuation plan. They will see a notification on their dashboard 
                  encouraging them to upgrade to a paid subscription.
                </>
              ) : (
                <>
                  This user will be moved from the Programs plan to the Continuation plan. They will see a 
                  notification on their dashboard encouraging them to upgrade to a paid subscription.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMove} disabled={moveToContinuationMutation.isPending}>
              {moveToContinuationMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
