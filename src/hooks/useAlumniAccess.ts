import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AlumniAccessResult {
  hasAccess: boolean;
  readOnly: boolean;
  inGracePeriod: boolean;
  graceExpiresAt: string | null;
  completedAt: string | null;
  daysRemaining: number;
  enrollmentId: string | null;
}

/**
 * Hook to check if current user has alumni (read-only) access to a program.
 * Returns null while loading, or the alumni access info.
 *
 * Usage:
 *   const alumni = useAlumniAccess(programId);
 *   if (alumni?.hasAccess && alumni.readOnly) { ... show read-only banner }
 */
export function useAlumniAccess(programId: string | undefined) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["alumni-access", user?.id, programId],
    queryFn: async (): Promise<AlumniAccessResult | null> => {
      if (!user?.id || !programId) return null;

      const { data: result, error } = await supabase.rpc("check_alumni_access", {
        p_user_id: user.id,
        p_program_id: programId,
      });

      if (error) {
        console.error("Error checking alumni access:", error);
        return null;
      }

      if (!result) return null;

      return {
        hasAccess: result.has_access ?? false,
        readOnly: result.read_only ?? true,
        inGracePeriod: result.in_grace_period ?? false,
        graceExpiresAt: result.grace_expires_at ?? null,
        completedAt: result.completed_at ?? null,
        daysRemaining: result.days_remaining ?? 0,
        enrollmentId: result.enrollment_id ?? null,
      };
    },
    enabled: !!user?.id && !!programId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { alumniAccess: data ?? null, isLoading };
}
