import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CapabilitySnapshotForm } from "@/components/capabilities/CapabilitySnapshotForm";
import { PeerSubmissionForm } from "@/components/groups/sessions/PeerSubmissionForm";
import { ArrowLeft, Loader2, FileText, ExternalLink, BookOpen } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Domain {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  capability_domain_questions: {
    id: string;
    question_text: string;
    description: string | null;
    order_index: number;
    question_type?: string | null;
    type_weight?: number | null;
  }[];
}

export default function PeerSessionEvaluationPage() {
  const { groupId, sessionId, activityId } = useParams<{
    groupId: string;
    sessionId: string;
    activityId: string;
  }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draftSnapshotId, setDraftSnapshotId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Fetch activity with joins
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["peer-eval-activity", activityId],
    queryFn: async () => {
      if (!activityId) return null;
      const { data, error } = await supabase
        .from("group_session_activities")
        .select(`
          *,
          assignment_type:module_assignment_types!group_session_activities_assignment_type_id_fkey(id, name, structure),
          capability_assessment:capability_assessments!group_session_activities_capability_assessment_id_fkey(id, name, slug, rating_scale, instructions, instructions_self, instructions_evaluator, assessment_mode, question_types),
          scenario_template:scenario_templates!group_session_activities_scenario_template_id_fkey(id, title),
          resource:resource_library!group_session_activities_resource_id_fkey(id, title)
        `)
        .eq("id", activityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activityId,
  });

  // Fetch presenter profile (FK to auth.users — can't use PostgREST hints)
  const { data: presenterProfile } = useQuery({
    queryKey: ["peer-eval-presenter", activity?.presenter_user_id],
    queryFn: async () => {
      if (!activity?.presenter_user_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .eq("id", activity.presenter_user_id)
        .single();
      return data;
    },
    enabled: !!activity?.presenter_user_id,
  });

  // Fetch assessment domains + questions
  const { data: domains } = useQuery({
    queryKey: ["assessment-domains", activity?.capability_assessment_id],
    queryFn: async () => {
      if (!activity?.capability_assessment_id) return null;
      const { data, error } = await supabase
        .from("capability_domains")
        .select(`
          id, name, description, order_index,
          capability_domain_questions(id, question_text, description, order_index, question_type, type_weight)
        `)
        .eq("assessment_id", activity.capability_assessment_id)
        .order("order_index");
      if (error) throw error;
      // Sort questions within each domain
      return (data || []).map((d) => ({
        ...d,
        capability_domain_questions: [...d.capability_domain_questions].sort(
          (a, b) => a.order_index - b.order_index
        ),
      })) as Domain[];
    },
    enabled: !!activity?.capability_assessment_id,
  });

  // Check for existing draft snapshot for this activity
  const { data: existingDraft } = useQuery({
    queryKey: ["peer-eval-draft", activityId, user?.id],
    queryFn: async () => {
      if (!activity || !user) return null;
      // Check if activity already has a scoring snapshot
      if (activity.scoring_snapshot_id) return { id: activity.scoring_snapshot_id };
      // Check for any draft by this evaluator for this presenter + assessment
      const { data } = await supabase
        .from("capability_snapshots")
        .select("id")
        .eq("assessment_id", activity.capability_assessment_id!)
        .eq("user_id", activity.presenter_user_id!)
        .eq("evaluator_id", user.id)
        .eq("evaluation_relationship", "peer")
        .eq("status", "draft")
        .maybeSingle();
      return data;
    },
    enabled: !!activity?.capability_assessment_id && !!user,
  });

  // Create draft snapshot when page loads (if none exists)
  useEffect(() => {
    if (draftSnapshotId || creating) return;
    if (!activity || !user || !activity.capability_assessment_id) return;
    if (activity.assessor_user_id !== user.id) return;

    if (existingDraft?.id) {
      setDraftSnapshotId(existingDraft.id);
      return;
    }
    // Only create if we've checked for existing and found none
    if (existingDraft === null) {
      setCreating(true);
      supabase
        .from("capability_snapshots")
        .insert({
          assessment_id: activity.capability_assessment_id,
          user_id: activity.presenter_user_id!,
          evaluator_id: user.id,
          is_self_assessment: false,
          evaluation_relationship: "peer",
          status: "draft",
          title: `Peer evaluation: ${activity.topic_title}`,
        })
        .select("id")
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Error creating peer evaluation draft:", error);
          } else if (data) {
            setDraftSnapshotId(data.id);
          }
          setCreating(false);
        });
    }
  }, [activity, user, existingDraft, draftSnapshotId, creating]);

  const handleComplete = async () => {
    if (!activity || !draftSnapshotId) return;

    // Update activity with the scoring snapshot
    const { error } = await supabase
      .from("group_session_activities")
      .update({
        scoring_snapshot_id: draftSnapshotId,
        evaluated_at: new Date().toISOString(),
        status: "evaluated",
      })
      .eq("id", activity.id);

    if (error) {
      console.error("Error updating activity:", error);
    }

    // Invalidate relevant queries
    queryClient.invalidateQueries({ queryKey: ["group-session-activity", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["peer-eval-activity", activityId] });

    navigate(`/groups/${groupId}/sessions/${sessionId}`);
  };

  const goBack = () => navigate(`/groups/${groupId}/sessions/${sessionId}`);

  if (activityLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Activity not found.</p>
        <Button variant="ghost" onClick={goBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Session
        </Button>
      </div>
    );
  }

  // Auth check
  if (user?.id !== activity.assessor_user_id) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">You are not the designated assessor for this activity.</p>
        <Button variant="ghost" onClick={goBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Session
        </Button>
      </div>
    );
  }

  if (!activity.capability_assessment_id || !activity.capability_assessment) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">No capability assessment linked to this activity.</p>
        <Button variant="ghost" onClick={goBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Session
        </Button>
      </div>
    );
  }

  const assessmentForForm = domains
    ? {
        id: activity.capability_assessment.id,
        name: activity.capability_assessment.name,
        rating_scale: activity.capability_assessment.rating_scale as number,
        instructions: activity.capability_assessment.instructions as string | null,
        instructions_self: activity.capability_assessment.instructions_self as string | null,
        instructions_evaluator: activity.capability_assessment.instructions_evaluator as string | null,
        assessment_mode: (activity.capability_assessment.assessment_mode as "self" | "evaluator" | "both") || "evaluator",
        question_types: activity.capability_assessment.question_types,
        capability_domains: domains,
      }
    : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Button variant="ghost" onClick={goBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Session
      </Button>

      <h1 className="text-2xl font-bold">Peer Evaluation</h1>

      {/* Presenter's submission context */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {presenterProfile?.name || "Presenter"}&apos;s Submission
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{activity.topic_title}</Badge>
            {activity.scenario_template && (
              <Badge variant="outline" className="gap-1">
                <BookOpen className="h-3 w-3" />
                {(activity.scenario_template as { title: string }).title}
              </Badge>
            )}
            {activity.resource && (
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                {(activity.resource as { title: string }).title}
              </Badge>
            )}
            {activity.resource_url && (
              <a
                href={activity.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> External Resource
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activity.assignment_type ? (
            <PeerSubmissionForm
              activityId={activity.id}
              structure={(activity.assignment_type as { structure: Json }).structure}
              responses={(activity.responses as Record<string, unknown>) || {}}
              onResponsesChange={() => {}}
              readOnly
              overallComments={activity.overall_comments || ""}
            />
          ) : (
            activity.overall_comments && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Presentation Notes</Label>
                <p className="text-sm whitespace-pre-wrap">{activity.overall_comments}</p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Capability assessment form */}
      {assessmentForForm && draftSnapshotId ? (
        <CapabilitySnapshotForm
          assessment={assessmentForForm}
          existingDraftId={draftSnapshotId}
          onCancel={goBack}
          onComplete={handleComplete}
        />
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading assessment form...
        </div>
      )}
    </div>
  );
}
