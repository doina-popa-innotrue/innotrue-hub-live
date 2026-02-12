import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to get the current user's timezone from their profile.
 * Falls back to browser timezone, then UTC if not set.
 */
export function useUserTimezone() {
  const { user } = useAuth();

  const { data: userTimezone, isLoading } = useQuery({
    queryKey: ["user-timezone", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data?.timezone || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get browser timezone as fallback
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Return user's timezone, or browser timezone, or UTC as final fallback
  const timezone = userTimezone || browserTimezone || "UTC";

  return {
    timezone,
    isLoading,
    isUserTimezoneSet: !!userTimezone,
  };
}
