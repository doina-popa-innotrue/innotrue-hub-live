import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Loader2, Calendar } from 'lucide-react';
import { GroupSessionCard } from './GroupSessionCard';
import { GroupSessionForm } from './GroupSessionForm';
import { SessionFormData, getEmptySessionForm } from '@/hooks/useGroupSessionMutations';
import { addMonths, isAfter, isBefore, startOfDay, format } from 'date-fns';
import { getNextRecurringDate } from '@/lib/recurringDates';

// Helper functions for session filtering
const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

const getUpcomingSessionsWithOccurrences = (sessions: any[]): any[] => {
  if (!sessions) return [];
  
  const now = new Date();
  const maxEndDate = addMonths(now, 3);
  const result: any[] = [];
  
  for (const session of sessions) {
    const sessionDate = new Date(session.session_date);
    
    if (session.status === 'scheduled' && (isAfter(sessionDate, now) || isSameDay(sessionDate, now))) {
      result.push(session);
    }
    
    if (session.is_recurring && session.recurrence_pattern && !session.parent_session_id) {
      let nextDate = sessionDate;
      let occurrenceCount = 0;
      const maxOccurrences = 10;
      
      while (occurrenceCount < maxOccurrences) {
        nextDate = getNextRecurringDate(nextDate, session.recurrence_pattern);
        
        if (isAfter(nextDate, maxEndDate)) break;
        if (session.recurrence_end_date && isAfter(nextDate, new Date(session.recurrence_end_date))) break;
        
        if (isAfter(nextDate, now) || isSameDay(nextDate, now)) {
          result.push({
            ...session,
            id: `${session.id}-occurrence-${occurrenceCount}`,
            session_date: nextDate.toISOString(),
            isGeneratedOccurrence: true,
            parentSessionId: session.id,
          });
        }
        occurrenceCount++;
      }
    }
  }
  
  return result.sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());
};

const getPastSessions = (sessions: any[]): any[] => {
  if (!sessions) return [];
  const now = new Date();
  return sessions.filter(session => {
    const sessionDate = new Date(session.session_date);
    return session.status === 'completed' || (isBefore(sessionDate, startOfDay(now)) && session.status !== 'scheduled');
  }).sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
};

interface GroupSessionsListProps {
  sessions: any[];
  groupId: string;
  userTimezone: string;
  isAdmin?: boolean;
  linkPrefix?: string;
  calcomMappingName?: string;
  // Session mutations
  onCreateSession: (formData: SessionFormData, timezone?: string, useGoogleCalendar?: boolean) => Promise<void>;
  onEditSession?: (session: any, formData: SessionFormData, updateAll: boolean) => void;
  onDeleteSession?: (session: any, deleteAll: boolean) => void;
  onStatusChange?: (sessionId: string, status: string) => void;
  // Bulk actions (admin only)
  onBulkDelete?: (sessionIds: string[]) => void;
  isBulkDeleting?: boolean;
  // Client features
  onDownloadICS?: (session: any) => void;
  // Loading states
  isCreating?: boolean;
  isUpdating?: boolean;
  // Admin-specific form options
  showTimezone?: boolean;
  initialTimezone?: string;
  showGoogleCalendarOption?: boolean;
  initialUseGoogleCalendar?: boolean;
  // Show past sessions for non-admin as well
  showPastSessions?: boolean;
}

export function GroupSessionsList({
  sessions,
  groupId,
  userTimezone,
  isAdmin = false,
  linkPrefix = '/groups',
  calcomMappingName,
  onCreateSession,
  onEditSession,
  onDeleteSession,
  onStatusChange,
  onBulkDelete,
  isBulkDeleting = false,
  onDownloadICS,
  isCreating = false,
  isUpdating = false,
  showTimezone = false,
  initialTimezone,
  showGoogleCalendarOption = false,
  initialUseGoogleCalendar = true,
  showPastSessions = false,
}: GroupSessionsListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState<SessionFormData>(getEmptySessionForm());
  const [editingSession, setEditingSession] = useState<any>(null);
  const [updateAllFuture, setUpdateAllFuture] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  
  // Local state for timezone and google calendar (admin features)
  const [sessionTimezone, setSessionTimezone] = useState(initialTimezone || userTimezone);
  const [useGoogleCalendar, setUseGoogleCalendar] = useState(initialUseGoogleCalendar);

  const upcomingSessions = useMemo(() => getUpcomingSessionsWithOccurrences(sessions), [sessions]);
  const pastSessions = useMemo(() => (isAdmin || showPastSessions) ? getPastSessions(sessions) : [], [sessions, isAdmin, showPastSessions]);
  // Only real sessions (not generated) for selection
  const realSessions = useMemo(() => sessions?.filter(s => !s.isGeneratedOccurrence) || [], [sessions]);

  const handleOpenForm = (session?: any) => {
    if (session) {
      const sessionDate = new Date(session.session_date);
      setSessionForm({
        title: session.title,
        description: session.description || '',
        session_date: format(sessionDate, 'yyyy-MM-dd'),
        session_time: format(sessionDate, 'HH:mm'),
        duration_minutes: String(session.duration_minutes || 60),
        location: session.location || '',
        is_recurring: false,
        recurrence_pattern: '',
        recurrence_end_date: '',
      });
      setEditingSession(session);
    } else {
      setSessionForm(getEmptySessionForm());
      setEditingSession(null);
    }
    setUpdateAllFuture(false);
    setIsFormOpen(true);
  };

  const handleEditParent = (parentSessionId: string) => {
    const parentSession = sessions?.find((s: any) => s.id === parentSessionId);
    if (parentSession) {
      handleOpenForm(parentSession);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingSession(null);
    setUpdateAllFuture(false);
    setSessionForm(getEmptySessionForm());
  };

  const handleSubmit = async () => {
    if (editingSession && onEditSession) {
      onEditSession(editingSession, sessionForm, updateAllFuture);
    } else {
      await onCreateSession(sessionForm, showTimezone ? sessionTimezone : undefined, showGoogleCalendarOption ? useGoogleCalendar : undefined);
    }
    handleCloseForm();
    // Reset timezone and google calendar options for next creation
    setSessionTimezone(initialTimezone || userTimezone);
    setUseGoogleCalendar(initialUseGoogleCalendar);
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const toggleAllSessions = () => {
    if (selectedSessionIds.size === realSessions.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(realSessions.map(s => s.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedSessionIds.size === 0 || !onBulkDelete) return;
    if (confirm(`Delete ${selectedSessionIds.size} selected session(s)?`)) {
      onBulkDelete(Array.from(selectedSessionIds));
      setSelectedSessionIds(new Set());
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{isAdmin ? 'Group Sessions' : 'Upcoming Sessions'}</h3>
          {calcomMappingName && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Calendar type: <span className="font-medium">{calcomMappingName}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Bulk delete button (admin only) */}
          {isAdmin && selectedSessionIds.size > 0 && onBulkDelete && (
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({selectedSessionIds.size})
            </Button>
          )}
          
          {/* Select all checkbox (admin only) */}
          {isAdmin && realSessions.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedSessionIds.size === realSessions.length && realSessions.length > 0}
                onCheckedChange={toggleAllSessions}
              />
              <span className="text-sm text-muted-foreground">Select all</span>
            </div>
          )}
          
          {/* Add Session button */}
          <Button size="sm" onClick={() => handleOpenForm()}>
            <Plus className="mr-2 h-4 w-4" />Add Session
          </Button>
        </div>
      </div>

      {/* Session form dialog */}
      <GroupSessionForm
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseForm();
          else setIsFormOpen(true);
        }}
        sessionForm={sessionForm}
        setSessionForm={setSessionForm}
        onSubmit={handleSubmit}
        isPending={isCreating || isUpdating}
        editingSession={editingSession}
        updateAllFuture={updateAllFuture}
        setUpdateAllFuture={setUpdateAllFuture}
        showTimezone={showTimezone}
        timezone={sessionTimezone}
        setTimezone={setSessionTimezone}
        showGoogleCalendarOption={showGoogleCalendarOption}
        useGoogleCalendar={useGoogleCalendar}
        setUseGoogleCalendar={setUseGoogleCalendar}
      />

      {/* Upcoming sessions */}
      {upcomingSessions.length > 0 ? (
        <div className="space-y-3">
          {upcomingSessions.map((session) => (
            <GroupSessionCard
              key={session.id}
              session={session}
              groupId={groupId}
              userTimezone={userTimezone}
              linkPrefix={linkPrefix}
              isAdmin={isAdmin}
              isSelected={selectedSessionIds.has(session.id)}
              onToggleSelect={isAdmin ? toggleSessionSelection : undefined}
              onEdit={onEditSession ? () => handleOpenForm(session) : undefined}
              onEditParent={onEditSession ? handleEditParent : undefined}
              onDelete={onDeleteSession ? (s) => onDeleteSession(s, false) : undefined}
              onStatusChange={onStatusChange}
              onDownloadICS={onDownloadICS}
              sessions={sessions}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No upcoming sessions</p>
          <p className="text-sm">Click "Add Session" to schedule one</p>
        </div>
      )}

      {/* Past sessions */}
      {(isAdmin || showPastSessions) && pastSessions.length > 0 && (
        <div className="space-y-3 pt-6 border-t">
          <h4 className="text-md font-medium text-muted-foreground">Past Sessions</h4>
          {pastSessions.map((session) => (
            <GroupSessionCard
              key={session.id}
              session={session}
              groupId={groupId}
              userTimezone={userTimezone}
              linkPrefix={linkPrefix}
              isAdmin={isAdmin}
              isSelected={selectedSessionIds.has(session.id)}
              onToggleSelect={isAdmin ? toggleSessionSelection : undefined}
              onDelete={onDeleteSession ? (s) => onDeleteSession(s, false) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}