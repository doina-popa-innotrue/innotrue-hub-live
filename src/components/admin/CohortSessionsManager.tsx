import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Clock, MapPin, Video, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { TimezoneSelect } from '@/components/profile/TimezoneSelect';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CohortSessionsManagerProps {
  cohortId: string;
  programId: string;
}

interface CohortSession {
  id: string;
  cohort_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_link: string | null;
  notes: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface SessionFormData {
  title: string;
  description: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  meeting_link: string;
  module_id: string;
  notes: string;
}

const defaultFormData: SessionFormData = {
  title: '',
  description: '',
  session_date: '',
  start_time: '',
  end_time: '',
  location: '',
  meeting_link: '',
  module_id: '',
  notes: '',
};

interface SortableSessionProps {
  session: CohortSession;
  onEdit: (session: CohortSession) => void;
  onDelete: (sessionId: string) => void;
}

function SortableSession({ session, onEdit, onDelete }: SortableSessionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-3 rounded-lg border bg-card ${isDragging ? 'shadow-lg' : ''}`}
    >
      <button
        className="mt-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium">{session.title}</p>
            {session.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {session.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => onEdit(session)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(session.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(session.session_date), 'MMM d, yyyy')}
            {session.start_time && ` at ${session.start_time.slice(0, 5)}`}
            {session.end_time && ` - ${session.end_time.slice(0, 5)}`}
          </span>
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {session.location}
            </span>
          )}
          {session.meeting_link && (
            <Badge variant="outline" className="text-xs">
              <Video className="h-3 w-3 mr-1" />
              Virtual
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function CohortSessionsManager({ cohortId, programId }: CohortSessionsManagerProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<CohortSession | null>(null);
  const [formData, setFormData] = useState<SessionFormData>(defaultFormData);
  
  // Get user's timezone with fallback
  const { timezone: userTimezone } = useUserTimezone();
  const [selectedTimezone, setSelectedTimezone] = useState(userTimezone);
  
  // Update timezone when user timezone loads
  useEffect(() => {
    setSelectedTimezone(userTimezone);
  }, [userTimezone]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['cohort-sessions', cohortId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cohort_sessions')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('order_index');

      if (error) throw error;
      return data as CohortSession[];
    },
  });

  const { data: modules } = useQuery({
    queryKey: ['program-modules-select', programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_modules')
        .select('id, title, order_index')
        .eq('program_id', programId)
        .order('order_index');

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const payload = {
        cohort_id: cohortId,
        title: data.title,
        description: data.description || null,
        session_date: data.session_date,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        location: data.location || null,
        meeting_link: data.meeting_link || null,
        module_id: data.module_id || null,
        notes: data.notes || null,
        order_index: editingSession?.order_index ?? (sessions?.length || 0),
        timezone: selectedTimezone || 'UTC',
      };

      if (editingSession) {
        const { error } = await supabase
          .from('cohort_sessions')
          .update(payload)
          .eq('id', editingSession.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cohort_sessions')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-sessions', cohortId] });
      toast.success(editingSession ? 'Session updated' : 'Session added');
      handleCloseDialog();
    },
    onError: () => {
      toast.error('Failed to save session');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('cohort_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-sessions', cohortId] });
      toast.success('Session deleted');
    },
    onError: () => {
      toast.error('Failed to delete session');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (reorderedSessions: CohortSession[]) => {
      const updates = reorderedSessions.map((session, index) => ({
        id: session.id,
        order_index: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('cohort_sessions')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-sessions', cohortId] });
    },
    onError: () => {
      toast.error('Failed to reorder sessions');
    },
  });

  const handleOpenDialog = (session?: CohortSession) => {
    if (session) {
      setEditingSession(session);
      setFormData({
        title: session.title,
        description: session.description || '',
        session_date: session.session_date,
        start_time: session.start_time?.slice(0, 5) || '',
        end_time: session.end_time?.slice(0, 5) || '',
        location: session.location || '',
        meeting_link: session.meeting_link || '',
        module_id: session.module_id || '',
        notes: session.notes || '',
      });
    } else {
      setEditingSession(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSession(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Session title is required');
      return;
    }
    if (!formData.session_date) {
      toast.error('Session date is required');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleDelete = (sessionId: string) => {
    if (confirm('Are you sure you want to delete this session?')) {
      deleteMutation.mutate(sessionId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && sessions) {
      const oldIndex = sessions.findIndex((s) => s.id === active.id);
      const newIndex = sessions.findIndex((s) => s.id === over.id);

      const reordered = arrayMove(sessions, oldIndex, newIndex);
      reorderMutation.mutate(reordered);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading sessions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Live Sessions</h4>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-3 w-3" />
              Add Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSession ? 'Edit Session' : 'Add Session'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-title">Title *</Label>
                <Input
                  id="session-title"
                  placeholder="e.g., Week 1: Introduction Workshop"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-description">Description</Label>
                <Textarea
                  id="session-description"
                  placeholder="What will be covered in this session"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-date">Date *</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={formData.session_date}
                  onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Timezone Selection */}
              <TimezoneSelect
                value={selectedTimezone}
                onChange={setSelectedTimezone}
              />

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Room 101 or Online"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting-link">Meeting Link</Label>
                <Input
                  id="meeting-link"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={formData.meeting_link}
                  onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="module-link">Link to Module (optional)</Label>
                <Select
                  value={formData.module_id}
                  onValueChange={(value) => setFormData({ ...formData, module_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No module linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No module linked</SelectItem>
                    {modules?.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        Module {module.order_index}: {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Internal notes about this session"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : editingSession ? 'Update' : 'Add'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sessions?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No sessions scheduled. Click "Add Session" to create one.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sessions?.map((s) => s.id) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sessions?.map((session) => (
                <SortableSession
                  key={session.id}
                  session={session}
                  onEdit={handleOpenDialog}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
