import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AccessType = 
  | 'view_profile' 
  | 'view_goals' 
  | 'view_decisions' 
  | 'view_tasks' 
  | 'view_assessments' 
  | 'view_progress'
  | 'view_development_items';

interface LogAccessParams {
  clientId: string;
  accessType: AccessType;
  entityType?: string;
  entityId?: string;
}

export function useCoachAccessLog() {
  const { user, userRoles } = useAuth();

  const logAccess = async ({ clientId, accessType, entityType, entityId }: LogAccessParams) => {
    // Only log if user is a coach or instructor
    if (!user || !userRoles.some(r => r === 'coach' || r === 'instructor')) {
      return;
    }

    // Don't log access to own data
    if (user.id === clientId) {
      return;
    }

    try {
      await supabase
        .from('coach_access_logs' as any)
        .insert({
          coach_id: user.id,
          client_id: clientId,
          access_type: accessType,
          entity_type: entityType || null,
          entity_id: entityId || null,
          user_agent: navigator.userAgent,
        });
    } catch (error) {
      // Silently fail - don't break the app for logging failures
      console.error('Failed to log coach access:', error);
    }
  };

  return { logAccess };
}
