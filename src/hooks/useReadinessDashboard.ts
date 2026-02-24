import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AlertLevel = "green" | "amber" | "red" | "stalled";

export interface ClientReadiness {
  userId: string;
  userName: string;
  enrollmentId: string;
  programName: string;
  pathName: string;
  instantiationId: string;
  totalGates: number;
  metGates: number;
  readinessPercent: number;
  currentMilestoneTitle: string | null;
  alertLevel: AlertLevel;
  daysSinceLastProgress: number;
  estimatedCompletionDate: string | null;
  startedAt: string;
}

/**
 * Compute gate readiness for a set of gates and a user's capability scores.
 * Shared logic extracted from useMilestoneGateStatus.
 */
async function computeGateStatuses(
  gates: Array<{
    id: string;
    capability_domain_id: string | null;
    min_score: number;
  }>,
  userId: string,
): Promise<{ met: number; total: number }> {
  if (gates.length === 0) return { met: 0, total: 0 };

  const capDomainIds = gates
    .filter((g) => g.capability_domain_id)
    .map((g) => g.capability_domain_id!);

  const domainScores = new Map<string, number>();

  if (capDomainIds.length > 0) {
    const { data: snapshots } = await supabase
      .from("capability_snapshots")
      .select(
        `
        id, assessment_id, completed_at,
        capability_snapshot_ratings(question_id, rating),
        capability_assessments!inner(
          rating_scale,
          capability_domains!inner(
            id,
            capability_domain_questions(id)
          )
        )
      `,
      )
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(10);

    if (snapshots) {
      const seenAssessments = new Set<string>();
      for (const snap of snapshots) {
        if (seenAssessments.has(snap.assessment_id)) continue;
        seenAssessments.add(snap.assessment_id);

        const assessment = snap.capability_assessments as any;
        const domains = assessment?.capability_domains || [];
        const ratings = (snap.capability_snapshot_ratings || []) as any[];

        for (const domain of Array.isArray(domains) ? domains : [domains]) {
          if (!capDomainIds.includes(domain.id)) continue;
          const qIds = new Set(
            (domain.capability_domain_questions || []).map((q: any) => q.id),
          );
          const domainRatings = ratings.filter((r: any) =>
            qIds.has(r.question_id),
          );
          if (domainRatings.length === 0) continue;

          const avg =
            domainRatings.reduce((sum: number, r: any) => sum + r.rating, 0) /
            domainRatings.length;
          domainScores.set(domain.id, avg);
        }
      }
    }
  }

  let met = 0;
  for (const gate of gates) {
    if (gate.capability_domain_id) {
      const score = domainScores.get(gate.capability_domain_id);
      if (score != null && score >= gate.min_score) {
        met++;
      }
    }
    // Gates without capability_domain_id are counted but can't be evaluated yet
  }

  return { met, total: gates.length };
}

/**
 * Hook that fetches readiness data for all of a coach's clients on guided paths.
 */
export function useReadinessDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["readiness-dashboard", user?.id],
    queryFn: async (): Promise<ClientReadiness[]> => {
      if (!user) return [];

      // 1. Get coach's/instructor's assigned programs (union of both roles)
      const [{ data: instructorAssignments }, { data: coachAssignments }] =
        await Promise.all([
          supabase
            .from("program_instructors")
            .select("program_id")
            .eq("instructor_id", user.id),
          supabase
            .from("program_coaches")
            .select("program_id")
            .eq("coach_id", user.id),
        ]);

      const allAssignments = [
        ...(instructorAssignments || []),
        ...(coachAssignments || []),
      ];
      if (allAssignments.length === 0) return [];

      const programIds = [
        ...new Set(allAssignments.map((a) => a.program_id)),
      ];

      // 2. Get all enrollments for these programs
      const { data: enrollments } = await supabase
        .from("staff_enrollments" as string)
        .select(
          `
          id, client_user_id, program_id,
          programs!inner(name)
        `,
        )
        .in("program_id", programIds);

      if (!enrollments || enrollments.length === 0) return [];

      // 3. Get all client user IDs and their profiles
      const clientUserIds = [
        ...new Set(enrollments.map((e: any) => e.client_user_id)),
      ];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", clientUserIds);

      const profileMap = new Map<string, string>();
      for (const p of profiles || []) {
        profileMap.set(p.id, p.full_name || "Unknown");
      }

      // 4. Get all guided path instantiations for these users
      const { data: instantiations } = await supabase
        .from("guided_path_instantiations" as string)
        .select(
          `
          id, user_id, template_id, status, started_at,
          estimated_completion_date, pace_multiplier,
          guided_path_templates!template_id(name)
        `,
        )
        .in("user_id", clientUserIds)
        .in("status", ["active", "in_progress"]);

      if (!instantiations || instantiations.length === 0) return [];

      // 5. For each instantiation, get template milestones and their gates
      const templateIds = [
        ...new Set(instantiations.map((inst: any) => inst.template_id)),
      ];

      // Get template goals
      const { data: templateGoals } = await supabase
        .from("guided_path_template_goals" as string)
        .select("id, template_id, name")
        .in("template_id", templateIds);

      const goalIds = (templateGoals || []).map((g: any) => g.id);

      // Get milestones for these goals
      const { data: milestones } = await supabase
        .from("guided_path_template_milestones" as string)
        .select("id, template_goal_id, title, order_index")
        .in("template_goal_id", goalIds.length > 0 ? goalIds : ["__none__"])
        .order("order_index");

      const milestoneIds = (milestones || []).map((m: any) => m.id);

      // Get gates for these milestones
      const { data: allGates } = await supabase
        .from("guided_path_milestone_gates" as string)
        .select("id, template_milestone_id, capability_domain_id, min_score")
        .in(
          "template_milestone_id",
          milestoneIds.length > 0 ? milestoneIds : ["__none__"],
        );

      // Build lookup maps
      const gatesByMilestone = new Map<string, typeof allGates>();
      for (const gate of allGates || []) {
        const msId = (gate as any).template_milestone_id;
        if (!gatesByMilestone.has(msId)) gatesByMilestone.set(msId, []);
        gatesByMilestone.get(msId)!.push(gate);
      }

      const milestonesByGoal = new Map<string, typeof milestones>();
      for (const ms of milestones || []) {
        const goalId = (ms as any).template_goal_id;
        if (!milestonesByGoal.has(goalId)) milestonesByGoal.set(goalId, []);
        milestonesByGoal.get(goalId)!.push(ms);
      }

      const goalsByTemplate = new Map<string, typeof templateGoals>();
      for (const goal of templateGoals || []) {
        const tmplId = (goal as any).template_id;
        if (!goalsByTemplate.has(tmplId)) goalsByTemplate.set(tmplId, []);
        goalsByTemplate.get(tmplId)!.push(goal);
      }

      // 6. Get user goal progress to determine current milestone
      const { data: userGoals } = await supabase
        .from("goals")
        .select("id, user_id, status, updated_at, template_goal_id")
        .in("user_id", clientUserIds)
        .not("template_goal_id", "is", null);

      const userGoalMap = new Map<string, any[]>();
      for (const g of userGoals || []) {
        const key = `${g.user_id}-${g.template_goal_id}`;
        if (!userGoalMap.has(key)) userGoalMap.set(key, []);
        userGoalMap.get(key)!.push(g);
      }

      // 7. Build readiness entries
      const results: ClientReadiness[] = [];

      for (const inst of instantiations) {
        const instData = inst as any;
        const userId = instData.user_id;
        const templateId = instData.template_id;
        const pathName =
          instData.guided_path_templates?.name || "Guided Path";

        // Find the enrollment for this user
        const enrollment = enrollments.find(
          (e: any) => e.client_user_id === userId,
        ) as any;
        if (!enrollment) continue;

        // Collect all gates across all milestones for this template
        const goals = goalsByTemplate.get(templateId) || [];
        const allTemplateGates: Array<{
          id: string;
          capability_domain_id: string | null;
          min_score: number;
        }> = [];
        let firstIncompleteMilestone: string | null = null;

        for (const goal of goals) {
          const goalId = (goal as any).id;
          const goalMilestones = milestonesByGoal.get(goalId) || [];

          for (const ms of goalMilestones) {
            const msId = (ms as any).id;
            const msGates = gatesByMilestone.get(msId) || [];
            for (const gate of msGates) {
              allTemplateGates.push(gate as any);
            }

            // Check if user has completed this goal milestone
            const userGoalEntry = userGoalMap.get(`${userId}-${goalId}`);
            const isGoalComplete = userGoalEntry?.some(
              (g: any) => g.status === "completed",
            );

            if (!isGoalComplete && !firstIncompleteMilestone) {
              firstIncompleteMilestone = (ms as any).title;
            }
          }
        }

        // Compute gate statuses
        const { met, total } = await computeGateStatuses(
          allTemplateGates,
          userId,
        );

        const readinessPercent =
          total > 0 ? Math.round((met / total) * 100) : 100;

        // Calculate days since last progress
        const userGoalList = (userGoals || []).filter(
          (g) => g.user_id === userId && g.template_goal_id,
        );
        const lastUpdate = userGoalList.reduce<string | null>((latest, g) => {
          if (!latest) return g.updated_at;
          return g.updated_at > latest ? g.updated_at : latest;
        }, null);
        const daysSinceLastProgress = lastUpdate
          ? Math.floor(
              (Date.now() - new Date(lastUpdate).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 999;

        // Determine alert level
        const isOnSchedule =
          !instData.estimated_completion_date ||
          new Date(instData.estimated_completion_date) >= new Date();
        let alertLevel: AlertLevel;
        if (daysSinceLastProgress >= 30) {
          alertLevel = "stalled";
        } else if (readinessPercent >= 80 && isOnSchedule) {
          alertLevel = "green";
        } else if (isOnSchedule) {
          alertLevel = "amber";
        } else {
          alertLevel = "red";
        }

        results.push({
          userId,
          userName: profileMap.get(userId) || "Unknown",
          enrollmentId: enrollment.id,
          programName: enrollment.programs?.name || "Program",
          pathName,
          instantiationId: instData.id,
          totalGates: total,
          metGates: met,
          readinessPercent,
          currentMilestoneTitle: firstIncompleteMilestone,
          alertLevel,
          daysSinceLastProgress,
          estimatedCompletionDate:
            instData.estimated_completion_date || null,
          startedAt: instData.started_at,
        });
      }

      // Sort: red first, then stalled, amber, green
      const alertOrder: Record<AlertLevel, number> = {
        red: 0,
        stalled: 1,
        amber: 2,
        green: 3,
      };
      results.sort(
        (a, b) => alertOrder[a.alertLevel] - alertOrder[b.alertLevel],
      );

      return results;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });
}

/**
 * Hook for a single user's readiness (used by client widget).
 */
export function useUserReadiness(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-readiness", userId],
    queryFn: async (): Promise<ClientReadiness[]> => {
      if (!userId) return [];

      // Get user's active path instantiations
      const { data: instantiations } = await supabase
        .from("guided_path_instantiations" as string)
        .select(
          `
          id, user_id, template_id, status, started_at,
          estimated_completion_date, pace_multiplier,
          guided_path_templates!template_id(name)
        `,
        )
        .eq("user_id", userId)
        .in("status", ["active", "in_progress"]);

      if (!instantiations || instantiations.length === 0) return [];

      const templateIds = instantiations.map((i: any) => i.template_id);

      // Get template goals
      const { data: templateGoals } = await supabase
        .from("guided_path_template_goals" as string)
        .select("id, template_id, name")
        .in("template_id", templateIds);

      const goalIds = (templateGoals || []).map((g: any) => g.id);

      // Get milestones
      const { data: milestones } = await supabase
        .from("guided_path_template_milestones" as string)
        .select("id, template_goal_id, title, order_index")
        .in("template_goal_id", goalIds.length > 0 ? goalIds : ["__none__"])
        .order("order_index");

      const milestoneIds = (milestones || []).map((m: any) => m.id);

      // Get gates
      const { data: allGates } = await supabase
        .from("guided_path_milestone_gates" as string)
        .select("id, template_milestone_id, capability_domain_id, min_score")
        .in(
          "template_milestone_id",
          milestoneIds.length > 0 ? milestoneIds : ["__none__"],
        );

      // Build lookup maps
      const gatesByMilestone = new Map<string, typeof allGates>();
      for (const gate of allGates || []) {
        const msId = (gate as any).template_milestone_id;
        if (!gatesByMilestone.has(msId)) gatesByMilestone.set(msId, []);
        gatesByMilestone.get(msId)!.push(gate);
      }

      const milestonesByGoal = new Map<string, typeof milestones>();
      for (const ms of milestones || []) {
        const goalId = (ms as any).template_goal_id;
        if (!milestonesByGoal.has(goalId)) milestonesByGoal.set(goalId, []);
        milestonesByGoal.get(goalId)!.push(ms);
      }

      const goalsByTemplate = new Map<string, typeof templateGoals>();
      for (const goal of templateGoals || []) {
        const tmplId = (goal as any).template_id;
        if (!goalsByTemplate.has(tmplId)) goalsByTemplate.set(tmplId, []);
        goalsByTemplate.get(tmplId)!.push(goal);
      }

      // Get user goal progress
      const { data: userGoals } = await supabase
        .from("goals")
        .select("id, user_id, status, updated_at, template_goal_id")
        .eq("user_id", userId)
        .not("template_goal_id", "is", null);

      const results: ClientReadiness[] = [];

      for (const inst of instantiations) {
        const instData = inst as any;
        const templateId = instData.template_id;
        const pathName =
          instData.guided_path_templates?.name || "Guided Path";

        const goals = goalsByTemplate.get(templateId) || [];
        const allTemplateGates: Array<{
          id: string;
          capability_domain_id: string | null;
          min_score: number;
        }> = [];
        let firstIncompleteMilestone: string | null = null;

        for (const goal of goals) {
          const goalId = (goal as any).id;
          const goalMilestones = milestonesByGoal.get(goalId) || [];

          for (const ms of goalMilestones) {
            const msId = (ms as any).id;
            const msGates = gatesByMilestone.get(msId) || [];
            for (const gate of msGates) {
              allTemplateGates.push(gate as any);
            }

            const isGoalComplete = (userGoals || []).some(
              (g) =>
                g.template_goal_id === goalId && g.status === "completed",
            );

            if (!isGoalComplete && !firstIncompleteMilestone) {
              firstIncompleteMilestone = (ms as any).title;
            }
          }
        }

        const { met, total } = await computeGateStatuses(
          allTemplateGates,
          userId,
        );

        const readinessPercent =
          total > 0 ? Math.round((met / total) * 100) : 100;

        const lastUpdate = (userGoals || []).reduce<string | null>(
          (latest, g) => {
            if (!latest) return g.updated_at;
            return g.updated_at > latest ? g.updated_at : latest;
          },
          null,
        );
        const daysSinceLastProgress = lastUpdate
          ? Math.floor(
              (Date.now() - new Date(lastUpdate).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 999;

        const isOnSchedule =
          !instData.estimated_completion_date ||
          new Date(instData.estimated_completion_date) >= new Date();
        let alertLevel: AlertLevel;
        if (daysSinceLastProgress >= 30) {
          alertLevel = "stalled";
        } else if (readinessPercent >= 80 && isOnSchedule) {
          alertLevel = "green";
        } else if (isOnSchedule) {
          alertLevel = "amber";
        } else {
          alertLevel = "red";
        }

        results.push({
          userId,
          userName: "",
          enrollmentId: "",
          programName: "",
          pathName,
          instantiationId: instData.id,
          totalGates: total,
          metGates: met,
          readinessPercent,
          currentMilestoneTitle: firstIncompleteMilestone,
          alertLevel,
          daysSinceLastProgress,
          estimatedCompletionDate:
            instData.estimated_completion_date || null,
          startedAt: instData.started_at,
        });
      }

      return results;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}
