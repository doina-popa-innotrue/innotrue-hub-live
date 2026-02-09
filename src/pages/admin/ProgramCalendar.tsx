import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Users, ChevronRight, Edit } from 'lucide-react';

interface ScheduledProgram {
  id: string;
  name: string;
  category: string;
  scheduled_dates: Array<{
    id: string;
    date: string;
    title: string;
    capacity?: number;
    enrolled_count?: number;
  }>;
}

interface EditingSchedule {
  programId: string;
  scheduleId: string;
  title: string;
  date: string;
  capacity: number;
}

export default function ProgramCalendar() {
  const { toast } = useToast();
  const [programs, setPrograms] = useState<ScheduledProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<EditingSchedule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name, category, scheduled_dates')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const programsWithSchedules = (data || [])
        .map((p: any) => ({
          ...p,
          scheduled_dates: (p.scheduled_dates || []).map((sd: any) => ({
            ...sd,
            enrolled_count: sd.enrolled_count || 0,
          })),
        }))
        .filter((p: any) => p.scheduled_dates && p.scheduled_dates.length > 0);

      setPrograms(programsWithSchedules);
    } catch (error) {
      console.error('Error loading programs:', error);
      toast({
        title: 'Error loading programs',
        description: 'Failed to fetch scheduled programs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (program: ScheduledProgram, schedule: any) => {
    setEditingSchedule({
      programId: program.id,
      scheduleId: schedule.id,
      title: schedule.title,
      date: schedule.date,
      capacity: schedule.capacity || 0,
    });
  };

  const handleSave = async () => {
    if (!editingSchedule) return;

    setIsSaving(true);
    try {
      const program = programs.find((p) => p.id === editingSchedule.programId);
      if (!program) throw new Error('Program not found');

      const updatedSchedules = program.scheduled_dates.map((sd) =>
        sd.id === editingSchedule.scheduleId
          ? {
              ...sd,
              title: editingSchedule.title,
              date: editingSchedule.date,
              capacity: editingSchedule.capacity,
            }
          : sd
      );

      const { error } = await supabase
        .from('programs')
        .update({ scheduled_dates: updatedSchedules })
        .eq('id', editingSchedule.programId);

      if (error) throw error;

      toast({
        title: 'Schedule updated',
        description: 'Program schedule has been updated successfully',
      });

      await loadPrograms();
      setEditingSchedule(null);
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: 'Error updating schedule',
        description: 'Failed to update program schedule',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cta':
        return 'bg-purple-500/10 text-purple-500';
      case 'leadership':
        return 'bg-blue-500/10 text-blue-500';
      case 'executive':
        return 'bg-orange-500/10 text-orange-500';
      case 'ai':
        return 'bg-cyan-500/10 text-cyan-500';
      case 'deep-dive':
        return 'bg-pink-500/10 text-pink-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const groupByMonth = (programs: ScheduledProgram[]) => {
    const grouped: Record<string, Array<{ program: ScheduledProgram; schedule: any }>> = {};

    programs.forEach((program) => {
      program.scheduled_dates.forEach((schedule) => {
        const date = new Date(schedule.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!grouped[monthKey]) grouped[monthKey] = [];
        grouped[monthKey].push({ program, schedule });
      });
    });

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  const monthlyGroups = groupByMonth(programs);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Program Schedule Calendar</h1>
        <p className="text-muted-foreground">
          View and manage all scheduled program dates with enrollment tracking
        </p>
      </div>

      {monthlyGroups.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled programs found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {monthlyGroups.map(([monthKey, items]) => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString(
              'default',
              { month: 'long', year: 'numeric' }
            );

            return (
              <Card key={monthKey}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    {monthName}
                  </CardTitle>
                  <CardDescription>{items.length} scheduled sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {items
                      .sort((a, b) => new Date(a.schedule.date).getTime() - new Date(b.schedule.date).getTime())
                      .map(({ program, schedule }) => {
                        const date = new Date(schedule.date);
                        const capacity = schedule.capacity || 0;
                        const enrolled = schedule.enrolled_count || 0;
                        const isFull = capacity > 0 && enrolled >= capacity;

                        return (
                          <div
                            key={`${program.id}-${schedule.id}`}
                            className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-medium truncate">{program.name}</div>
                                <Badge className={getCategoryColor(program.category)} variant="outline">
                                  {program.category}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {schedule.title}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="font-medium">
                                  {date.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {date.toLocaleDateString('en-US', { year: 'numeric' })}
                                </div>
                              </div>

                              {capacity > 0 && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <div className="text-sm">
                                    <span className={isFull ? 'text-destructive font-medium' : ''}>
                                      {enrolled}
                                    </span>
                                    <span className="text-muted-foreground"> / {capacity}</span>
                                  </div>
                                </div>
                              )}

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(program, schedule)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSchedule} onOpenChange={(open) => !open && setEditingSchedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Update the schedule details for this program session
            </DialogDescription>
          </DialogHeader>

          {editingSchedule && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Session Title</Label>
                <Input
                  id="title"
                  value={editingSchedule.title}
                  onChange={(e) =>
                    setEditingSchedule({ ...editingSchedule, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={editingSchedule.date}
                  onChange={(e) =>
                    setEditingSchedule({ ...editingSchedule, date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="0"
                  value={editingSchedule.capacity}
                  onChange={(e) =>
                    setEditingSchedule({
                      ...editingSchedule,
                      capacity: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSchedule(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
