import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hasTierAccess } from "@/lib/tierUtils";

export type AccessStatus = "accessible" | "not_enrolled" | "tier_locked" | "prerequisites_locked";

export interface ResourceAccessInfo {
  status: AccessStatus;
  programId?: string;
  programName?: string;
  // For tier_locked
  requiredTier?: string;
  userTier?: string;
  // For prerequisites_locked
  missingPrerequisites?: { id: string; title: string }[];
}

interface EnrollmentInfo {
  programId: string;
  tier: string | null;
  status: string;
}

interface ModuleProgressInfo {
  moduleId: string;
  status: string;
}

export function useGuidedResourceAccess(
  programIds: string[],
  moduleIds: string[],
  moduleToProgram: Map<string, { programId: string; programName: string }>
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["guided-resource-access", user?.id, programIds, moduleIds],
    queryFn: async (): Promise<Map<string, ResourceAccessInfo>> => {
      const accessMap = new Map<string, ResourceAccessInfo>();

      if (!user) {
        // Not logged in - all resources require enrollment
        programIds.forEach((id) => {
          accessMap.set(`program-${id}`, { status: "not_enrolled" });
        });
        moduleIds.forEach((id) => {
          const info = moduleToProgram.get(id);
          accessMap.set(`module-${id}`, {
            status: "not_enrolled",
            programId: info?.programId,
            programName: info?.programName,
          });
        });
        return accessMap;
      }

      // Fetch user's enrollments
      const { data: enrollments } = await supabase
        .from("client_enrollments")
        .select("program_id, tier, status")
        .eq("client_user_id", user.id)
        .in("status", ["active", "completed"]);

      const enrollmentMap = new Map<string, EnrollmentInfo>();
      enrollments?.forEach((e) => {
        enrollmentMap.set(e.program_id, {
          programId: e.program_id,
          tier: e.tier,
          status: e.status,
        });
      });

      // Fetch program details for tier info
      const allProgramIds = new Set([
        ...programIds,
        ...Array.from(moduleToProgram.values()).map((m) => m.programId),
      ]);

      const { data: programs } = await supabase
        .from("programs")
        .select("id, name, tiers")
        .in("id", Array.from(allProgramIds));

      const programInfoMap = new Map<string, { name: string; tiers: string[] }>();
      programs?.forEach((p) => {
        programInfoMap.set(p.id, {
          name: p.name,
          tiers: Array.isArray(p.tiers) ? (p.tiers as string[]) : [],
        });
      });

      // Check program access
      programIds.forEach((programId) => {
        const enrollment = enrollmentMap.get(programId);
        if (enrollment) {
          accessMap.set(`program-${programId}`, { status: "accessible" });
        } else {
          const programInfo = programInfoMap.get(programId);
          accessMap.set(`program-${programId}`, {
            status: "not_enrolled",
            programId,
            programName: programInfo?.name,
          });
        }
      });

      // Fetch module details for tier requirements
      const { data: modules } = await supabase
        .from("program_modules")
        .select("id, program_id, tier_required, title")
        .in("id", moduleIds);

      const moduleInfoMap = new Map<
        string,
        { programId: string; tier: string | null; title: string }
      >();
      modules?.forEach((m) => {
        moduleInfoMap.set(m.id, {
          programId: m.program_id,
          tier: m.tier_required,
          title: m.title,
        });
      });

      // Fetch prerequisites for all modules
      const { data: prerequisites } = await supabase
        .from("module_prerequisites")
        .select("module_id, prerequisite_module_id")
        .in("module_id", moduleIds);

      const prereqMap = new Map<string, string[]>();
      prerequisites?.forEach((p) => {
        const existing = prereqMap.get(p.module_id) || [];
        existing.push(p.prerequisite_module_id);
        prereqMap.set(p.module_id, existing);
      });

      // Fetch prerequisite module titles for display
      const allPrereqIds = new Set<string>();
      prereqMap.forEach((ids) => ids.forEach((id) => allPrereqIds.add(id)));

      let prereqTitles = new Map<string, string>();
      if (allPrereqIds.size > 0) {
        const { data: prereqModules } = await supabase
          .from("program_modules")
          .select("id, title")
          .in("id", Array.from(allPrereqIds));
        prereqModules?.forEach((m) => {
          prereqTitles.set(m.id, m.title);
        });
      }

      // Fetch user's module progress for prerequisite checking
      const enrollmentIds = enrollments?.map((e) => e.program_id) || [];
      let moduleProgress = new Map<string, string>();

      if (enrollmentIds.length > 0) {
        const { data: userEnrollments } = await supabase
          .from("client_enrollments")
          .select("id")
          .eq("client_user_id", user.id);

        const userEnrollmentIds = userEnrollments?.map((e) => e.id) || [];

        if (userEnrollmentIds.length > 0) {
          const { data: progress } = await supabase
            .from("module_progress")
            .select("module_id, status")
            .in("enrollment_id", userEnrollmentIds);

          progress?.forEach((p) => {
            moduleProgress.set(p.module_id, p.status);
          });
        }
      }

      // Check module access
      moduleIds.forEach((moduleId) => {
        const moduleInfo = moduleInfoMap.get(moduleId);
        const moduleProgramInfo = moduleToProgram.get(moduleId);

        if (!moduleInfo) {
          accessMap.set(`module-${moduleId}`, { status: "accessible" });
          return;
        }

        const enrollment = enrollmentMap.get(moduleInfo.programId);
        const programInfo = programInfoMap.get(moduleInfo.programId);

        // Not enrolled in parent program
        if (!enrollment) {
          accessMap.set(`module-${moduleId}`, {
            status: "not_enrolled",
            programId: moduleInfo.programId,
            programName: programInfo?.name || moduleProgramInfo?.programName,
          });
          return;
        }

        // Check tier access
        const tierAccess = hasTierAccess(
          programInfo?.tiers || null,
          enrollment.tier,
          moduleInfo.tier
        );

        if (!tierAccess) {
          accessMap.set(`module-${moduleId}`, {
            status: "tier_locked",
            programId: moduleInfo.programId,
            programName: programInfo?.name,
            requiredTier: moduleInfo.tier || undefined,
            userTier: enrollment.tier || undefined,
          });
          return;
        }

        // Check prerequisites
        const modulePrereqs = prereqMap.get(moduleId) || [];
        const missingPrereqs = modulePrereqs.filter((prereqId) => {
          const status = moduleProgress.get(prereqId);
          return status !== "completed";
        });

        if (missingPrereqs.length > 0) {
          accessMap.set(`module-${moduleId}`, {
            status: "prerequisites_locked",
            programId: moduleInfo.programId,
            programName: programInfo?.name,
            missingPrerequisites: missingPrereqs.map((id) => ({
              id,
              title: prereqTitles.get(id) || "Unknown Module",
            })),
          });
          return;
        }

        // All checks passed
        accessMap.set(`module-${moduleId}`, { status: "accessible" });
      });

      return accessMap;
    },
    enabled: programIds.length > 0 || moduleIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
}
