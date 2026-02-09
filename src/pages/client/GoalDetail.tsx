import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, Share2, Plus, ListTodo, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MilestonesList from '@/components/goals/MilestonesList';
import GoalForm from '@/components/goals/GoalForm';
import ShareGoalDialog from '@/components/goals/ShareGoalDialog';
import GoalComments from '@/components/goals/GoalComments';
import GoalReflections from '@/components/goals/GoalReflections';
import GoalResources from '@/components/goals/GoalResources';
import LinkedDevelopmentItems from '@/components/goals/LinkedDevelopmentItems';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FeatureGate } from '@/components/FeatureGate';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  timeframe_type: string;
  priority: string;
  target_date: string | null;
  status: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

import { CATEGORY_LABELS } from '@/lib/wheelOfLifeCategories';

const TIMEFRAME_LABELS: Record<string, string> = {
  short_term: 'Short-term (1-6 months)',
  medium_term: 'Medium-term (12 months)',
  long_term: 'Long-term (3+ years)',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-primary/15 text-primary',
  on_hold: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  retired: 'bg-secondary text-secondary-foreground',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/15 text-primary',
  high: 'bg-destructive/15 text-destructive',
};

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  quadrant: string | null;
}

export default function GoalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharedCount, setSharedCount] = useState(0);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);

  useEffect(() => {
    if (id) {
      fetchGoal();
      fetchSharedCount();
      fetchLinkedTasks();
    }
  }, [id]);

  const fetchLinkedTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, quadrant')
        .eq('goal_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinkedTasks(data || []);
    } catch (error: any) {
      console.error('Error fetching linked tasks:', error);
    }
  };

  const fetchGoal = async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGoal(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load goal',
        variant: 'destructive',
      });
      navigate('/goals');
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedCount = async () => {
    try {
      const { count, error } = await supabase
        .from('goal_shares')
        .select('*', { count: 'exact', head: true })
        .eq('goal_id', id);

      if (error) throw error;
      setSharedCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching share count:', error);
    }
  };

  const handleDelete = async () => {
    if (!goal) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goal.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Goal deleted successfully',
      });
      navigate('/goals');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete goal',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleGoalUpdated = () => {
    setShowEditDialog(false);
    fetchGoal();
  };

  const handleShareDialogClose = () => {
    setShowShareDialog(false);
    fetchSharedCount();
  };

  if (loading || !goal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading goal...</div>
      </div>
    );
  }

  return (
    <FeatureGate featureKey="goals">
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/goals">Goals</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[200px] truncate">{goal.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_COLORS[goal.status]}>
                {goal.status.replace('_', ' ')}
              </Badge>
              <Badge className={PRIORITY_COLORS[goal.priority]}>
                {goal.priority} priority
              </Badge>
              <div className="flex-1" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowShareDialog(true)} className="hidden sm:flex">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share {sharedCount > 0 && `(${sharedCount})`}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setShowShareDialog(true)} className="sm:hidden">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setShowEditDialog(true)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl mb-2">{goal.title}</CardTitle>
              <p className="text-muted-foreground">{goal.description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{goal.progress_percentage}%</span>
            </div>
            <Progress value={goal.progress_percentage} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Category:</span>
              <p className="font-medium">{CATEGORY_LABELS[goal.category]}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Timeframe:</span>
              <p className="font-medium">{TIMEFRAME_LABELS[goal.timeframe_type]}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Target Date:</span>
              <p className="font-medium">
                {goal.target_date ? format(new Date(goal.target_date), 'MMM d, yyyy') : 'Not set'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>
              <p className="font-medium">{format(new Date(goal.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked Tasks Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 shrink-0" />
              Linked Tasks
            </CardTitle>
            <Button onClick={() => setShowCreateTaskDialog(true)} size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {linkedTasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No tasks linked to this goal yet
            </p>
          ) : (
            <div className="space-y-2">
              {linkedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <span className="font-medium">{task.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MilestonesList goalId={goal.id} onMilestoneChange={fetchGoal} />

      <LinkedDevelopmentItems goalId={goal.id} />

      <GoalReflections goalId={goal.id} />

      <GoalResources goalId={goal.id} />

      <GoalComments goalId={goal.id} />

      <ShareGoalDialog
        goalId={goal.id}
        open={showShareDialog}
        onOpenChange={handleShareDialogClose}
      />

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <GoalForm
            goalId={goal.id}
            onSuccess={handleGoalUpdated}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{goal.title}"? This action cannot be undone and will also delete all associated milestones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task for Goal</DialogTitle>
          </DialogHeader>
          <CreateTaskFromGoalForm 
            goalId={goal.id} 
            goalCategory={goal.category}
            onSuccess={() => {
              setShowCreateTaskDialog(false);
              fetchLinkedTasks();
            }} 
          />
        </DialogContent>
      </Dialog>
    </div>
    </FeatureGate>
  );
}

interface CreateTaskFromGoalFormProps {
  goalId: string;
  goalCategory: string;
  onSuccess: () => void;
}

function CreateTaskFromGoalForm({ goalId, goalCategory, onSuccess }: CreateTaskFromGoalFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [importance, setImportance] = useState(false);
  const [urgency, setUrgency] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  function getQuadrant(imp: boolean, urg: boolean) {
    if (imp && urg) return 'important_urgent';
    if (imp && !urg) return 'important_not_urgent';
    if (!imp && urg) return 'not_important_urgent';
    return 'not_important_not_urgent';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for your task',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('tasks').insert([
        {
          user_id: user?.id,
          title,
          description,
          goal_id: goalId,
          category: goalCategory,
          importance,
          urgency,
          quadrant: getQuadrant(importance, urgency),
          due_date: dueDate || null,
          source_type: 'goal',
          status: 'todo',
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Task created',
        description: 'Your task has been linked to this goal',
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error creating task',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">Title *</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Task description"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="task-importance">Important</Label>
        <Switch id="task-importance" checked={importance} onCheckedChange={setImportance} />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="task-urgency">Urgent</Label>
        <Switch id="task-urgency" checked={urgency} onCheckedChange={setUrgency} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-dueDate">Due Date</Label>
        <Input
          id="task-dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Creating...' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}
