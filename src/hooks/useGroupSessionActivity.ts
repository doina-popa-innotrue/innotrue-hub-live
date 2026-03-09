import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface SessionActivity {
  id: string;
  session_id: string;
  topic_title: string;
  topic_description: string | null;
  scenario_template_id: string | null;
  resource_id: string | null;
  resource_url: string | null;
  assignment_type_id: string | null;
  capability_assessment_id: string | null;
  presenter_user_id: string | null;
  assessor_user_id: string | null;
  responses: Json | null;
  overall_comments: string | null;
  submitted_at: string | null;
  scoring_snapshot_id: string | null;
  evaluator_notes: string | null;
  evaluated_at: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  assignment_type: { id: string; name: string; structure: Json } | null;
  capability_assessment: { id: string; name: string; slug: string } | null;
  scenario_template: { id: string; title: string } | null;
  resource: { id: string; title: string } | null;
  // Profile lookups (fetched separately due to auth.users FK)
  presenter_profile: { id: string; name: string; avatar_url: string | null } | null;
  assessor_profile: { id: string; name: string; avatar_url: string | null } | null;
}

interface SetupActivityParams {
  sessionId: string;
  topicTitle: string;
  topicDescription?: string;
  scenarioTemplateId?: string;
  resourceId?: string;
  resourceUrl?: string;
  assignmentTypeId?: string;
  capabilityAssessmentId?: string;
  volunteerAsPresenter?: boolean;
}

interface SubmitPresentationParams {
  activityId: string;
  responses: Record<string, unknown>;
  overallComments?: string;
}

interface SubmitEvaluationParams {
  activityId: string;
  scoringSnapshotId?: string;
  evaluatorNotes?: string;
}

export function useGroupSessionActivity(sessionId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["group-session-activity", sessionId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<SessionActivity | null> => {
      if (!sessionId) return null;

      const { data, error } = await supabase
        .from("group_session_activities")
        .select(`
          *,
          assignment_type:module_assignment_types!group_session_activities_assignment_type_id_fkey(id, name, structure),
          capability_assessment:capability_assessments!group_session_activities_capability_assessment_id_fkey(id, name, slug),
          scenario_template:scenario_templates!group_session_activities_scenario_template_id_fkey(id, title),
          resource:resource_library!group_session_activities_resource_id_fkey(id, title)
        `)
        .eq("session_id", sessionId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching session activity:", error);
        throw error;
      }
      if (!data) return null;

      // Batch-fetch profiles for presenter and assessor (FK to auth.users — can't use PostgREST hints)
      const userIds = [data.presenter_user_id, data.assessor_user_id].filter(Boolean) as string[];
      let profiles: Record<string, { id: string; name: string; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .in("id", userIds);
        if (profileData) {
          profiles = Object.fromEntries(profileData.map((p) => [p.id, p]));
        }
      }

      return {
        ...data,
        presenter_profile: data.presenter_user_id ? profiles[data.presenter_user_id] ?? null : null,
        assessor_profile: data.assessor_user_id ? profiles[data.assessor_user_id] ?? null : null,
      } as SessionActivity;
    },
    enabled: !!sessionId,
  });

  const setupActivity = useMutation({
    mutationFn: async (params: SetupActivityParams) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("group_session_activities")
        .insert({
          session_id: params.sessionId,
          topic_title: params.topicTitle,
          topic_description: params.topicDescription || null,
          scenario_template_id: params.scenarioTemplateId || null,
          resource_id: params.resourceId || null,
          resource_url: params.resourceUrl || null,
          assignment_type_id: params.assignmentTypeId || null,
          capability_assessment_id: params.capabilityAssessmentId || null,
          presenter_user_id: params.volunteerAsPresenter ? user.id : null,
          status: params.volunteerAsPresenter ? "presenter_assigned" : "open",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Presentation activity created");
    },
    onError: (err) => {
      console.error("Error creating activity:", err);
      toast.error("Failed to create activity");
    },
  });

  const volunteerAsPresenter = useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("group_session_activities")
        .update({
          presenter_user_id: user.id,
          status: "presenter_assigned",
        })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("You're now the presenter");
    },
    onError: (err) => {
      console.error("Error volunteering as presenter:", err);
      toast.error("Failed to volunteer as presenter");
    },
  });

  const volunteerAsAssessor = useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("group_session_activities")
        .update({
          assessor_user_id: user.id,
          status: "assessor_assigned",
        })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("You're now the assessor");
    },
    onError: (err) => {
      console.error("Error volunteering as assessor:", err);
      toast.error("Failed to volunteer as assessor");
    },
  });

  const submitPresentation = useMutation({
    mutationFn: async (params: SubmitPresentationParams) => {
      const { error } = await supabase
        .from("group_session_activities")
        .update({
          responses: params.responses as unknown as Json,
          overall_comments: params.overallComments || null,
          submitted_at: new Date().toISOString(),
          status: "submitted",
        })
        .eq("id", params.activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Presentation submitted");
    },
    onError: (err) => {
      console.error("Error submitting presentation:", err);
      toast.error("Failed to submit presentation");
    },
  });

  const submitEvaluation = useMutation({
    mutationFn: async (params: SubmitEvaluationParams) => {
      const { error } = await supabase
        .from("group_session_activities")
        .update({
          scoring_snapshot_id: params.scoringSnapshotId || null,
          evaluator_notes: params.evaluatorNotes || null,
          evaluated_at: new Date().toISOString(),
          status: "evaluated",
        })
        .eq("id", params.activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Evaluation submitted");
    },
    onError: (err) => {
      console.error("Error submitting evaluation:", err);
      toast.error("Failed to submit evaluation");
    },
  });

  return {
    activity: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    setupActivity,
    volunteerAsPresenter,
    volunteerAsAssessor,
    submitPresentation,
    submitEvaluation,
  };
}
