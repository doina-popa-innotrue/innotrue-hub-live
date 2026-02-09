import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateRecurringDatesSimple } from '@/lib/recurringDates';
import { useRecurrenceSettings } from '@/hooks/useRecurrenceSettings';

export interface SessionFormData {
  title: string;
  description: string;
  session_date: string;
  session_time?: string;
  duration_minutes: string;
  location: string;
  is_recurring: boolean;
  recurrence_pattern: string;
  recurrence_end_date: string;
  timezone?: string;
}

export interface CreateSessionParams {
  groupId: string;
  userId: string;
  formData: SessionFormData;
}

export interface UpdateSessionParams {
  sessionId: string;
  formData: SessionFormData;
  updateAll: boolean;
  session: {
    id: string;
    is_recurring: boolean;
    parent_session_id: string | null;
  };
}

export interface DeleteSessionParams {
  sessionId: string;
  deleteAll: boolean;
  session: {
    id: string;
    is_recurring: boolean;
    parent_session_id: string | null;
  };
}

export interface UpdateSessionStatusParams {
  sessionId: string;
  status: string;
}

/**
 * Shared hook for group session mutations.
 * Consolidates create, update, delete, and status change logic for group sessions.
 */
export function useGroupSessionMutations(groupId: string | undefined, queryKeyPrefix: string = 'group-sessions') {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { maxRecurrenceLimit } = useRecurrenceSettings();

  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, groupId] });
  };

  // Create session mutation
  const createSession = useMutation({
    mutationFn: async ({ groupId, userId, formData }: CreateSessionParams) => {
      // Build datetime - client page uses session_time, admin page uses just session_date with time included
      const sessionDateTime = formData.session_time
        ? new Date(`${formData.session_date}T${formData.session_time}`)
        : new Date(formData.session_date);

      // Fetch all active group members first
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_memberships')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('status', 'active');

      if (membersError) {
        console.error('Failed to fetch group members:', membersError);
        // Continue without members - session can still be created
      }

      // Create the master session
      const { data: masterSession, error } = await supabase
        .from('group_sessions')
        .insert({
          group_id: groupId,
          title: formData.title,
          description: formData.description || null,
          session_date: sessionDateTime.toISOString(),
          duration_minutes: parseInt(formData.duration_minutes) || 60,
          location: formData.location || null,
          booked_by: userId,
          status: 'scheduled',
          is_recurring: formData.is_recurring,
          recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern || null : null,
          recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? formData.recurrence_end_date : null,
          timezone: formData.timezone || 'UTC',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Helper function to add participants to a session
      const addParticipantsToSession = async (sessionId: string) => {
        if (!groupMembers || groupMembers.length === 0) return;
        
        const participants = groupMembers.map((m) => ({
          session_id: sessionId,
          group_id: groupId,
          user_id: m.user_id,
          response_status: m.user_id === userId ? 'accepted' : 'pending', // Creator is auto-accepted
          responded_at: m.user_id === userId ? new Date().toISOString() : null,
        }));

        const { error: participantError } = await supabase
          .from('group_session_participants')
          .upsert(participants, { onConflict: 'session_id,user_id', ignoreDuplicates: true });

        if (participantError) {
          console.error('Failed to add participants to session:', participantError);
        }
      };

      // Add participants to master session
      await addParticipantsToSession(masterSession.id);

      // Generate recurring instances if this is a recurring session
      if (formData.is_recurring && formData.recurrence_pattern && masterSession) {
        const recurringDates = generateRecurringDatesSimple(
          sessionDateTime,
          formData.recurrence_pattern,
          formData.recurrence_end_date || null,
          maxRecurrenceLimit
        );

        if (recurringDates.length > 0) {
          const childSessions = recurringDates.map((date) => ({
            group_id: groupId,
            title: formData.title,
            description: formData.description || null,
            session_date: date.toISOString(),
            duration_minutes: parseInt(formData.duration_minutes) || 60,
            location: formData.location || null,
            booked_by: userId,
            status: 'scheduled',
            is_recurring: false, // Child sessions are not recurring themselves
            recurrence_pattern: null,
            recurrence_end_date: null,
            parent_session_id: masterSession.id,
            timezone: formData.timezone || 'UTC',
          }));

          const { data: createdChildSessions, error: childError } = await supabase
            .from('group_sessions')
            .insert(childSessions)
            .select('id');

          if (childError) {
            console.error('Failed to create recurring instances:', childError);
          } else if (createdChildSessions) {
            // Add participants to all child sessions
            for (const childSession of createdChildSessions) {
              await addParticipantsToSession(childSession.id);
            }
          }
        }
      }

      return masterSession;
    },
    onSuccess: () => {
      invalidateSessions();
      toast({ title: 'Session created' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update session mutation
  const updateSession = useMutation({
    mutationFn: async ({ sessionId, formData, updateAll, session }: UpdateSessionParams) => {
      const sessionDateTime = formData.session_time
        ? new Date(`${formData.session_date}T${formData.session_time}`)
        : new Date(formData.session_date);

      const updatePayload = {
        title: formData.title,
        description: formData.description || null,
        duration_minutes: parseInt(formData.duration_minutes) || 60,
        location: formData.location || null,
      };

      if (updateAll && (session.is_recurring || session.parent_session_id)) {
        // Find the master session ID
        const masterSessionId = session.parent_session_id || session.id;

        // Update the current session with its specific date
        const { error: currentError } = await supabase
          .from('group_sessions')
          .update({ ...updatePayload, session_date: sessionDateTime.toISOString() })
          .eq('id', sessionId);
        if (currentError) throw currentError;

        // Update all future sessions in the series (same title, description, duration, location but keep their dates)
        const { error: futureError } = await supabase
          .from('group_sessions')
          .update(updatePayload)
          .or(`id.eq.${masterSessionId},parent_session_id.eq.${masterSessionId}`)
          .neq('id', sessionId)
          .gte('session_date', new Date().toISOString());
        if (futureError) throw futureError;
      } else {
        // Update only this session
        const { error } = await supabase
          .from('group_sessions')
          .update({ ...updatePayload, session_date: sessionDateTime.toISOString() })
          .eq('id', sessionId);
        if (error) throw error;
      }
    },
    onSuccess: (_, { updateAll }) => {
      invalidateSessions();
      toast({ title: updateAll ? 'All future sessions updated' : 'Session updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete session mutation
  const deleteSession = useMutation({
    mutationFn: async ({ sessionId, deleteAll, session }: DeleteSessionParams) => {
      if (deleteAll && (session.is_recurring || session.parent_session_id)) {
        // Find the master session ID
        const masterSessionId = session.parent_session_id || session.id;

        // Delete all future sessions in the series
        const { error } = await supabase
          .from('group_sessions')
          .delete()
          .or(`id.eq.${masterSessionId},parent_session_id.eq.${masterSessionId}`)
          .gte('session_date', new Date().toISOString());
        if (error) throw error;
      } else {
        // Delete only this session
        const { error } = await supabase
          .from('group_sessions')
          .delete()
          .eq('id', sessionId);
        if (error) throw error;
      }
    },
    onSuccess: (_, { deleteAll }) => {
      invalidateSessions();
      toast({ title: deleteAll ? 'All future sessions deleted' : 'Session deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update session status mutation
  const updateSessionStatus = useMutation({
    mutationFn: async ({ sessionId, status }: UpdateSessionStatusParams) => {
      const { error } = await supabase
        .from('group_sessions')
        .update({ status })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateSessions();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createSession,
    updateSession,
    deleteSession,
    updateSessionStatus,
    maxRecurrenceLimit,
  };
}

/**
 * Get initial/empty session form data
 */
export function getEmptySessionForm(): SessionFormData {
  return {
    title: '',
    description: '',
    session_date: '',
    session_time: '',
    duration_minutes: '60',
    location: '',
    is_recurring: false,
    recurrence_pattern: '',
    recurrence_end_date: '',
    timezone: 'UTC',
  };
}
