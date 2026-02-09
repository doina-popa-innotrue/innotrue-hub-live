import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseModuleTypeRequiresSessionOptions {
  moduleType: string | null | undefined;
  enabled?: boolean;
}

interface ModuleTypeSessionCapability {
  requiresSession: boolean;
  hasMapping: boolean;
  mappingId: string | null;
  eventTypeName: string | null;
}

/**
 * Hook to determine if a module type supports live sessions.
 * 
 * Session capability is determined by checking if the module type
 * has an active mapping in calcom_event_type_mappings table.
 * 
 * This is a data-driven approach that avoids hardcoding:
 * - If a module type has an active Cal.com mapping → sessions are supported
 * - If no mapping exists → this is a self-study module (e.g., content, learning)
 */
export function useModuleTypeRequiresSession({
  moduleType,
  enabled = true,
}: UseModuleTypeRequiresSessionOptions) {
  return useQuery({
    queryKey: ['module-type-session-capability', moduleType],
    queryFn: async (): Promise<ModuleTypeSessionCapability> => {
      if (!moduleType) {
        return {
          requiresSession: false,
          hasMapping: false,
          mappingId: null,
          eventTypeName: null,
        };
      }

      // Check if this module type has an active Cal.com event type mapping
      const { data: mapping, error } = await supabase
        .from('calcom_event_type_mappings')
        .select('id, calcom_event_type_name')
        .eq('module_type', moduleType)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking module type session capability:', error);
        return {
          requiresSession: false,
          hasMapping: false,
          mappingId: null,
          eventTypeName: null,
        };
      }

      const hasMapping = !!mapping;

      return {
        requiresSession: hasMapping,
        hasMapping,
        mappingId: mapping?.id || null,
        eventTypeName: mapping?.calcom_event_type_name || null,
      };
    },
    enabled: enabled && !!moduleType,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - mappings rarely change
  });
}

/**
 * Simpler hook variant that just returns boolean for session requirement.
 * Fetches module type from module ID first.
 */
export function useModuleRequiresSession(moduleId: string | undefined, enabled = true) {
  // First fetch the module's type
  const { data: moduleData, isLoading: isLoadingModule } = useQuery({
    queryKey: ['module-type-for-session-check', moduleId],
    queryFn: async () => {
      if (!moduleId) return null;
      const { data, error } = await supabase
        .from('program_modules')
        .select('module_type')
        .eq('id', moduleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: enabled && !!moduleId,
  });

  // Then check if that type requires sessions
  const { data: capability, isLoading: isLoadingCapability } = useModuleTypeRequiresSession({
    moduleType: moduleData?.module_type,
    enabled: enabled && !!moduleData?.module_type,
  });

  return {
    requiresSession: capability?.requiresSession ?? false,
    hasMapping: capability?.hasMapping ?? false,
    isLoading: isLoadingModule || isLoadingCapability,
    moduleType: moduleData?.module_type ?? null,
  };
}
