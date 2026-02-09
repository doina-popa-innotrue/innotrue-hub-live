import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Calendar } from 'lucide-react';
import { format } from 'date-fns';

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
}

interface ClientGoalsSectionProps {
  clientId: string;
}

import { CATEGORY_LABELS } from '@/lib/wheelOfLifeCategories';

const TIMEFRAME_LABELS: Record<string, string> = {
  short: 'Short-term',
  medium: 'Medium-term',
  long: 'Long-term',
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-secondary',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  paused: 'bg-yellow-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-red-500',
};

export default function ClientGoalsSection({ clientId }: ClientGoalsSectionProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
  }, [clientId]);

  const fetchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error: any) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading goals...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goals ({goals.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No goals created yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map(goal => (
              <div key={goal.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={STATUS_COLORS[goal.status]}>
                        {goal.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={PRIORITY_COLORS[goal.priority]} variant="outline">
                        {goal.priority}
                      </Badge>
                    </div>
                    <h4 className="font-semibold text-lg">{goal.title}</h4>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{goal.progress_percentage}%</span>
                  </div>
                  <Progress value={goal.progress_percentage} className="h-2" />
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    <span>{CATEGORY_LABELS[goal.category]}</span>
                  </div>
                  <div>
                    <span>{TIMEFRAME_LABELS[goal.timeframe_type]}</span>
                  </div>
                  {goal.target_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Target: {format(new Date(goal.target_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
