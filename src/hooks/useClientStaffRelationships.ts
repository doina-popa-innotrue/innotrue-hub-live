import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StaffRelationships {
  hasCoach: boolean;
  hasInstructor: boolean;
}

export function useClientStaffRelationships() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-staff-relationships", user?.id],
    queryFn: async (): Promise<StaffRelationships> => {
      if (!user) return { hasCoach: false, hasInstructor: false };

      // Check for direct coach assignments
      const { data: directCoaches } = await supabase
        .from("client_coaches")
        .select("coach_id")
        .eq("client_id", user.id)
        .limit(1);

      // Check for direct instructor assignments
      const { data: directInstructors } = await supabase
        .from("client_instructors")
        .select("instructor_id")
        .eq("client_id", user.id)
        .limit(1);

      // Check for program-based assignments via enrollments
      const { data: enrollments } = await supabase
        .from("client_enrollments")
        .select("program_id")
        .eq("client_user_id", user.id)
        .in("status", ["active"]);

      let hasProgramCoach = false;
      let hasProgramInstructor = false;

      if (enrollments && enrollments.length > 0) {
        const programIds = enrollments.map((e) => e.program_id);

        // Check for program-level coaches
        const { data: programCoaches } = await supabase
          .from("program_coaches")
          .select("coach_id")
          .in("program_id", programIds)
          .limit(1);

        // Check for program-level instructors
        const { data: programInstructors } = await supabase
          .from("program_instructors")
          .select("instructor_id")
          .in("program_id", programIds)
          .limit(1);

        hasProgramCoach = (programCoaches?.length ?? 0) > 0;
        hasProgramInstructor = (programInstructors?.length ?? 0) > 0;
      }

      return {
        hasCoach: (directCoaches?.length ?? 0) > 0 || hasProgramCoach,
        hasInstructor: (directInstructors?.length ?? 0) > 0 || hasProgramInstructor,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
