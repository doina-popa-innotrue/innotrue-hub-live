import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MilestoneGate {
  id: string;
  template_milestone_id: string;
  capability_assessment_id: string | null;
  capability_domain_id: string | null;
  assessment_definition_id: string | null;
  assessment_dimension_id: string | null;
  min_score: number;
  gate_label: string | null;
  created_at: string;
  // Joined fields
  domain_name?: string | null;
  assessment_name?: string | null;
  dimension_name?: string | null;
}

export interface GateOverride {
  id: string;
  goal_milestone_id: string;
  gate_id: string;
  overridden_by: string;
  reason: string;
  created_at: string;
  overrider_name?: string | null;
}

export type GateStatus = "met" | "close" | "unmet" | "unknown" | "overridden";

export function useMilestoneGates(templateMilestoneId: string | undefined) {
  return useQuery({
    queryKey: ["milestone-gates", templateMilestoneId],
    queryFn: async () => {
      if (!templateMilestoneId) return [];

      const { data, error } = await supabase
        .from("guided_path_milestone_gates" as string)
        .select(
          `
          *,
          capability_domains:capability_domain_id(name),
          capability_assessments:capability_assessment_id(name, rating_scale),
          assessment_dimensions:assessment_dimension_id(name)
        `,
        )
        .eq("template_milestone_id", templateMilestoneId)
        .order("created_at");

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        domain_name: row.capability_domains?.name ?? null,
        assessment_name: row.capability_assessments?.name ?? null,
        dimension_name: row.assessment_dimensions?.name ?? null,
      })) as MilestoneGate[];
    },
    enabled: !!templateMilestoneId,
  });
}

/**
 * Batch-fetch gates for multiple template milestones (for admin config view)
 */
export function useMilestoneGatesBatch(templateMilestoneIds: string[]) {
  return useQuery({
    queryKey: ["milestone-gates-batch", templateMilestoneIds],
    queryFn: async () => {
      if (templateMilestoneIds.length === 0) return {};

      const { data, error } = await supabase
        .from("guided_path_milestone_gates" as string)
        .select(
          `
          *,
          capability_domains:capability_domain_id(name),
          capability_assessments:capability_assessment_id(name, rating_scale),
          assessment_dimensions:assessment_dimension_id(name)
        `,
        )
        .in("template_milestone_id", templateMilestoneIds)
        .order("created_at");

      if (error) throw error;

      const gateMap: Record<string, MilestoneGate[]> = {};
      for (const row of data || []) {
        const milestoneId = (row as any).template_milestone_id;
        if (!gateMap[milestoneId]) gateMap[milestoneId] = [];
        gateMap[milestoneId].push({
          ...(row as any),
          domain_name: (row as any).capability_domains?.name ?? null,
          assessment_name: (row as any).capability_assessments?.name ?? null,
          dimension_name: (row as any).assessment_dimensions?.name ?? null,
        });
      }
      return gateMap;
    },
    enabled: templateMilestoneIds.length > 0,
  });
}

interface CreateGateParams {
  template_milestone_id: string;
  capability_assessment_id?: string | null;
  capability_domain_id?: string | null;
  assessment_definition_id?: string | null;
  assessment_dimension_id?: string | null;
  min_score: number;
  gate_label?: string | null;
}

export function useCreateMilestoneGate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateGateParams) => {
      const { data, error } = await supabase
        .from("guided_path_milestone_gates" as string)
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["milestone-gates", variables.template_milestone_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["milestone-gates-batch"],
      });
    },
  });
}

export function useDeleteMilestoneGate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      templateMilestoneId,
    }: {
      id: string;
      templateMilestoneId: string;
    }) => {
      const { error } = await supabase
        .from("guided_path_milestone_gates" as string)
        .delete()
        .eq("id", id);

      if (error) throw error;
      return templateMilestoneId;
    },
    onSuccess: (templateMilestoneId) => {
      queryClient.invalidateQueries({
        queryKey: ["milestone-gates", templateMilestoneId],
      });
      queryClient.invalidateQueries({
        queryKey: ["milestone-gates-batch"],
      });
    },
  });
}

/**
 * Compute traffic-light gate status for a user's milestone.
 * Gates are advisory, not blocking.
 */
export function useMilestoneGateStatus(
  goalMilestoneId: string | undefined,
  gates: MilestoneGate[],
  userId: string | undefined,
) {
  return useQuery({
    queryKey: ["milestone-gate-status", goalMilestoneId, gates.map((g) => g.id), userId],
    queryFn: async () => {
      if (!userId || gates.length === 0) return [];

      // Fetch overrides for this milestone
      const { data: overrides } = await supabase
        .from("milestone_gate_overrides" as string)
        .select("gate_id, reason, overridden_by, created_at")
        .eq("goal_milestone_id", goalMilestoneId);

      const overrideMap = new Map<string, GateOverride>();
      for (const ov of overrides || []) {
        overrideMap.set((ov as any).gate_id, ov as any);
      }

      // Fetch user's latest capability scores
      const capDomainIds = gates
        .filter((g) => g.capability_domain_id)
        .map((g) => g.capability_domain_id!);

      let domainScores = new Map<string, number>();
      if (capDomainIds.length > 0) {
        // Get latest snapshot ratings for these domains
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
          // Take latest per assessment
          const seenAssessments = new Set<string>();
          for (const snap of snapshots) {
            if (seenAssessments.has(snap.assessment_id)) continue;
            seenAssessments.add(snap.assessment_id);

            const assessment = snap.capability_assessments as any;
            const ratingScale = assessment?.rating_scale || 10;
            const domains = assessment?.capability_domains || [];
            const ratings = (snap.capability_snapshot_ratings || []) as any[];

            for (const domain of Array.isArray(domains) ? domains : [domains]) {
              if (!capDomainIds.includes(domain.id)) continue;
              const qIds = new Set(
                (domain.capability_domain_questions || []).map((q: any) => q.id),
              );
              const domainRatings = ratings.filter((r: any) => qIds.has(r.question_id));
              if (domainRatings.length === 0) continue;

              const avg =
                domainRatings.reduce((sum: number, r: any) => sum + r.rating, 0) /
                domainRatings.length;
              domainScores.set(domain.id, avg);
            }
          }
        }
      }

      // Compute status per gate
      return gates.map((gate) => {
        if (overrideMap.has(gate.id)) {
          return {
            gateId: gate.id,
            status: "overridden" as GateStatus,
            currentScore: null,
            override: overrideMap.get(gate.id)!,
          };
        }

        let currentScore: number | null = null;

        if (gate.capability_domain_id) {
          currentScore = domainScores.get(gate.capability_domain_id) ?? null;
        }
        // TODO: Add assessment_definition_id dimension score lookup

        if (currentScore == null) {
          return { gateId: gate.id, status: "unknown" as GateStatus, currentScore: null, override: null };
        }

        let status: GateStatus;
        if (currentScore >= gate.min_score) {
          status = "met";
        } else if (currentScore >= gate.min_score - 1) {
          status = "close";
        } else {
          status = "unmet";
        }

        return { gateId: gate.id, status, currentScore, override: null };
      });
    },
    enabled: !!goalMilestoneId && !!userId && gates.length > 0,
  });
}

/**
 * Create a gate override (coach/instructor waive)
 */
export function useCreateGateOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      goal_milestone_id: string;
      gate_id: string;
      overridden_by: string;
      reason: string;
    }) => {
      const { data, error } = await supabase
        .from("milestone_gate_overrides" as string)
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["milestone-gate-status", variables.goal_milestone_id],
      });
    },
  });
}
