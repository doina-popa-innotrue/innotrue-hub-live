import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_MAX_OCCURRENCES = 20;

/**
 * Hook to fetch the maximum number of recurring session occurrences allowed.
 * This value is stored in system_settings under the key 'max_recurrence_occurrences'.
 * 
 * @returns The maximum number of occurrences (defaults to 20 if not found)
 */
export function useRecurrenceSettings() {
  const { data: maxRecurrenceLimit, isLoading } = useQuery({
    queryKey: ['system-settings', 'max_recurrence_occurrences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'max_recurrence_occurrences')
        .single();
      
      if (error) return DEFAULT_MAX_OCCURRENCES;
      return parseInt(data?.value || String(DEFAULT_MAX_OCCURRENCES), 10);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    maxRecurrenceLimit: maxRecurrenceLimit ?? DEFAULT_MAX_OCCURRENCES,
    isLoading,
  };
}
