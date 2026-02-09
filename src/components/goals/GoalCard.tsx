import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trash2, Calendar, Target, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCategoryLookup } from '@/hooks/useWheelCategories';

interface GoalCardProps {
  goal: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    timeframe_type: string;
    priority: string;
    target_date: string | null;
    status: string;
    progress_percentage: number;
    is_private?: boolean;
  };
  onDelete?: () => void;
}

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

export default function GoalCard({ goal, onDelete }: GoalCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { labels, colors } = useCategoryLookup();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const categoryColor = colors[goal.category] || '#6B7280';
  const categoryLabel = labels[goal.category] || goal.category;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      onDelete?.();
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

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => navigate(`/goals/${goal.id}`)}
      >
        <CardHeader>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge className={STATUS_COLORS[goal.status]}>
                {goal.status.replace('_', ' ')}
              </Badge>
              <Badge className={PRIORITY_COLORS[goal.priority]} variant="outline">
                {goal.priority}
              </Badge>
              {goal.is_private && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Private
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
          <CardTitle className="text-lg">{goal.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {goal.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {goal.description}
            </p>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{goal.progress_percentage}%</span>
            </div>
            <Progress value={goal.progress_percentage} className="h-2" />
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: categoryColor }}
              />
              <span>{categoryLabel}</span>
            </div>
            {goal.target_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(goal.target_date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{goal.title}"? This action cannot be undone.
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
    </>
  );
}
