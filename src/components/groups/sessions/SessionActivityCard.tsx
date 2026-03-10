import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupSessionActivity } from "@/hooks/useGroupSessionActivity";
import { PeerSubmissionForm } from "./PeerSubmissionForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Presentation,
  Plus,
  User,
  UserCheck,
  ExternalLink,
  FileText,
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface SessionActivityCardProps {
  sessionId: string;
  groupId: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  open: { label: "Open", variant: "outline" },
  presenter_assigned: { label: "Presenter Assigned", variant: "secondary" },
  submitted: { label: "Submitted", variant: "secondary" },
  assessor_assigned: { label: "Assessor Assigned", variant: "secondary" },
  evaluated: { label: "Evaluated", variant: "default" },
};

export function SessionActivityCard({ sessionId, groupId }: SessionActivityCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    activity,
    isLoading,
    setupActivity,
    volunteerAsPresenter,
    volunteerAsAssessor,
    createScenarioAssignment,
    submitPresentation,
    submitEvaluation,
  } = useGroupSessionActivity(sessionId);

  // Setup dialog state
  const [showSetup, setShowSetup] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicSourceType, setTopicSourceType] = useState<"none" | "scenario" | "resource" | "url">("none");
  const [resourceUrl, setResourceUrl] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [selectedAssignmentTypeId, setSelectedAssignmentTypeId] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [willPresent, setWillPresent] = useState(false);

  // Free feedback state
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Presentation form state
  const [presResponses, setPresResponses] = useState<Record<string, unknown>>({});
  const [presComments, setPresComments] = useState("");
  const [submittingPresentation, setSubmittingPresentation] = useState(false);

  // Fetch dropdown options for setup
  const { data: assignmentTypes } = useQuery({
    queryKey: ["assignment-types-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("module_assignment_types")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: showSetup,
  });

  const { data: assessments } = useQuery({
    queryKey: ["capability-assessments-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("capability_assessments")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: showSetup,
  });

  const { data: scenarioTemplates } = useQuery({
    queryKey: ["scenario-templates-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scenario_templates")
        .select("id, title")
        .eq("is_active", true)
        .order("title");
      return data || [];
    },
    enabled: showSetup && topicSourceType === "scenario",
  });

  const { data: resources } = useQuery({
    queryKey: ["resources-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("resource_library")
        .select("id, title")
        .eq("is_active", true)
        .order("title");
      return data || [];
    },
    enabled: showSetup && topicSourceType === "resource",
  });

  const handleSetup = () => {
    if (!topicTitle.trim()) {
      toast.error("Please enter a topic title");
      return;
    }
    setupActivity.mutate(
      {
        sessionId,
        topicTitle: topicTitle.trim(),
        topicDescription: topicDescription.trim() || undefined,
        scenarioTemplateId: topicSourceType === "scenario" && selectedScenarioId ? selectedScenarioId : undefined,
        resourceId: topicSourceType === "resource" && selectedResourceId ? selectedResourceId : undefined,
        resourceUrl: topicSourceType === "url" && resourceUrl.trim() ? resourceUrl.trim() : undefined,
        assignmentTypeId: selectedAssignmentTypeId || undefined,
        capabilityAssessmentId: selectedAssessmentId || undefined,
        volunteerAsPresenter: willPresent,
      },
      {
        onSuccess: () => {
          setShowSetup(false);
          resetSetupForm();
        },
      }
    );
  };

  const resetSetupForm = () => {
    setTopicTitle("");
    setTopicDescription("");
    setTopicSourceType("none");
    setResourceUrl("");
    setSelectedScenarioId("");
    setSelectedResourceId("");
    setSelectedAssignmentTypeId("");
    setSelectedAssessmentId("");
    setWillPresent(false);
  };

  const handleSubmitPresentation = () => {
    if (!activity) return;

    // Validate required fields
    if (activity.assignment_type) {
      const fields = (activity.assignment_type.structure as unknown as Array<{ id: string; required: boolean }>) || [];
      const missing = fields.filter((f) => f.required && !presResponses[f.id]);
      if (missing.length > 0) {
        toast.error("Please fill in all required fields");
        return;
      }
    }

    setSubmittingPresentation(true);
    submitPresentation.mutate(
      {
        activityId: activity.id,
        responses: presResponses,
        overallComments: presComments || undefined,
      },
      {
        onSettled: () => setSubmittingPresentation(false),
      }
    );
  };

  const handleSubmitFeedback = () => {
    if (!activity || !feedbackNotes.trim()) {
      toast.error("Please enter your feedback");
      return;
    }
    setSubmittingFeedback(true);
    submitEvaluation.mutate(
      {
        activityId: activity.id,
        evaluatorNotes: feedbackNotes.trim(),
      },
      {
        onSettled: () => setSubmittingFeedback(false),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading activity...
      </div>
    );
  }

  const isPresenter = user?.id === activity?.presenter_user_id;
  const isAssessor = user?.id === activity?.assessor_user_id;

  // Initialize form responses from activity data when presenter opens the form
  const initResponses = () => {
    if (activity?.responses && Object.keys(presResponses).length === 0) {
      setPresResponses(activity.responses as Record<string, unknown>);
    }
    if (activity?.overall_comments && !presComments) {
      setPresComments(activity.overall_comments);
    }
  };

  // ── No activity yet ──
  if (!activity) {
    return (
      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Presentation className="h-4 w-4" />
            Presentation Activity
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSetup(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Activity
          </Button>
        </div>

        {/* Setup dialog */}
        <Dialog open={showSetup} onOpenChange={setShowSetup}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Set Up Presentation Activity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Topic Title *</Label>
                <Input
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="What will be presented?"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={topicDescription}
                  onChange={(e) => setTopicDescription(e.target.value)}
                  placeholder="Additional context or instructions..."
                />
              </div>

              <div className="space-y-2">
                <Label>Topic Source</Label>
                <Select
                  value={topicSourceType}
                  onValueChange={(v) => setTopicSourceType(v as typeof topicSourceType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (title only)</SelectItem>
                    <SelectItem value="scenario">Scenario Template</SelectItem>
                    <SelectItem value="resource">Library Resource</SelectItem>
                    <SelectItem value="url">External URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {topicSourceType === "scenario" && (
                <div className="space-y-2">
                  <Label>Scenario Template</Label>
                  <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select scenario..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarioTemplates?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {topicSourceType === "resource" && (
                <div className="space-y-2">
                  <Label>Library Resource</Label>
                  <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select resource..." />
                    </SelectTrigger>
                    <SelectContent>
                      {resources?.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {topicSourceType === "url" && (
                <div className="space-y-2">
                  <Label>External URL</Label>
                  <Input
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Assignment Type (for presenter&apos;s submission form)</Label>
                <Select value={selectedAssignmentTypeId} onValueChange={setSelectedAssignmentTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None (freeform)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (freeform)</SelectItem>
                    {assignmentTypes?.map((at) => (
                      <SelectItem key={at.id} value={at.id}>
                        {at.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Evaluation Method</Label>
                <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Free feedback only" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Free feedback only</SelectItem>
                    {assessments?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={willPresent}
                  onCheckedChange={(c) => setWillPresent(!!c)}
                  id="will-present"
                />
                <label htmlFor="will-present" className="text-sm">
                  I&apos;ll be the presenter
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSetup(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSetup}
                disabled={setupActivity.isPending || !topicTitle.trim()}
              >
                {setupActivity.isPending ? "Creating..." : "Create Activity"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Activity exists ──
  const statusInfo = STATUS_LABELS[activity.status] || STATUS_LABELS.open;

  return (
    <div className="border-t pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Presentation className="h-4 w-4" />
          <span className="text-sm font-medium">Presentation Activity</span>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
      </div>

      {/* Topic info */}
      <div className="space-y-2">
        <h4 className="font-medium">{activity.topic_title}</h4>
        {activity.topic_description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {activity.topic_description}
          </p>
        )}

        {/* Topic source links */}
        <div className="flex flex-wrap gap-2">
          {activity.scenario_template && (
            <Badge variant="outline" className="gap-1">
              <BookOpen className="h-3 w-3" />
              Scenario: {activity.scenario_template.title}
            </Badge>
          )}
          {isPresenter && activity.scenario_template_id && (
            activity.scenario_assignment_id ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate(`/scenarios/${activity.scenario_assignment_id}`)}
                className="gap-1"
              >
                <BookOpen className="h-4 w-4" />
                Open Scenario
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  createScenarioAssignment.mutate(activity.id, {
                    onSuccess: (assignmentId) => navigate(`/scenarios/${assignmentId}`),
                  })
                }
                disabled={createScenarioAssignment.isPending}
                className="gap-1"
              >
                <BookOpen className="h-4 w-4" />
                {createScenarioAssignment.isPending ? "Starting..." : "Start Scenario"}
              </Button>
            )
          )}
          {activity.resource && (
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              Resource: {activity.resource.title}
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
          {activity.assignment_type && (
            <Badge variant="outline" className="gap-1">
              <ClipboardCheck className="h-3 w-3" />
              Form: {activity.assignment_type.name}
            </Badge>
          )}
          {activity.capability_assessment && (
            <Badge variant="outline" className="gap-1">
              <ClipboardCheck className="h-3 w-3" />
              Assessment: {activity.capability_assessment.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Presenter section */}
      <div className="border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Presenter
          </div>
          {activity.presenter_profile ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={activity.presenter_profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {activity.presenter_profile.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{activity.presenter_profile.name}</span>
            </div>
          ) : (
            activity.status === "open" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => volunteerAsPresenter.mutate(activity.id)}
                disabled={volunteerAsPresenter.isPending}
              >
                <User className="h-3 w-3 mr-1" /> Volunteer as Presenter
              </Button>
            )
          )}
        </div>

        {/* Presenter submission form or read-only view */}
        {activity.status === "presenter_assigned" && isPresenter && (
          <div className="space-y-3">
            {initResponses()}
            {activity.assignment_type ? (
              <PeerSubmissionForm
                activityId={activity.id}
                structure={activity.assignment_type.structure}
                responses={presResponses}
                onResponsesChange={setPresResponses}
                overallComments={presComments}
                onOverallCommentsChange={setPresComments}
              />
            ) : (
              <div className="space-y-2">
                <Label>Your Presentation Notes</Label>
                <Textarea
                  value={presComments}
                  onChange={(e) => setPresComments(e.target.value)}
                  placeholder="Describe your approach, solution, or key points..."
                />
              </div>
            )}
            <Button
              onClick={handleSubmitPresentation}
              disabled={submittingPresentation}
            >
              {submittingPresentation ? "Submitting..." : "Submit Presentation"}
            </Button>
          </div>
        )}

        {activity.status === "presenter_assigned" && !isPresenter && (
          <p className="text-sm text-muted-foreground">
            Waiting for {activity.presenter_profile?.name || "presenter"} to submit...
          </p>
        )}

        {/* Link to scenario for non-presenter after submission */}
        {["submitted", "assessor_assigned", "evaluated"].includes(activity.status) &&
          activity.scenario_assignment_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/scenarios/${activity.scenario_assignment_id}`)}
            className="gap-1"
          >
            <BookOpen className="h-4 w-4" />
            View Scenario Answers
          </Button>
        )}

        {/* Show submitted responses (read-only) */}
        {["submitted", "assessor_assigned", "evaluated"].includes(activity.status) && (
          <div className="space-y-2">
            {activity.assignment_type ? (
              <PeerSubmissionForm
                activityId={activity.id}
                structure={activity.assignment_type.structure}
                responses={(activity.responses as Record<string, unknown>) || {}}
                onResponsesChange={() => {}}
                readOnly
                overallComments={activity.overall_comments || ""}
              />
            ) : (
              activity.overall_comments && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Presentation Notes</Label>
                  <p className="text-sm whitespace-pre-wrap">{activity.overall_comments}</p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Assessor section */}
      {["submitted", "assessor_assigned", "evaluated"].includes(activity.status) && (
        <div className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserCheck className="h-4 w-4" />
              Assessor
            </div>
            {activity.assessor_profile ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={activity.assessor_profile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {activity.assessor_profile.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{activity.assessor_profile.name}</span>
              </div>
            ) : (
              activity.status === "submitted" &&
              !isPresenter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => volunteerAsAssessor.mutate(activity.id)}
                  disabled={volunteerAsAssessor.isPending}
                >
                  <UserCheck className="h-3 w-3 mr-1" /> Volunteer as Assessor
                </Button>
              )
            )}
          </div>

          {/* Assessor actions */}
          {activity.status === "assessor_assigned" && isAssessor && (
            <div className="space-y-3">
              {activity.capability_assessment_id ? (
                <Button
                  onClick={() =>
                    navigate(
                      `/groups/${groupId}/sessions/${sessionId}/evaluate/${activity.id}`
                    )
                  }
                >
                  <ClipboardCheck className="h-4 w-4 mr-1" /> Start Assessment
                </Button>
              ) : (
                <>
                  <Textarea
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="Write your feedback about the presentation..."
                  />
                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={submittingFeedback || !feedbackNotes.trim()}
                  >
                    {submittingFeedback ? "Submitting..." : "Submit Feedback"}
                  </Button>
                </>
              )}
            </div>
          )}

          {activity.status === "assessor_assigned" && !isAssessor && (
            <p className="text-sm text-muted-foreground">
              Waiting for {activity.assessor_profile?.name || "assessor"} to evaluate...
            </p>
          )}

          {/* Show completed evaluation */}
          {activity.status === "evaluated" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Evaluation completed
              </div>
              {activity.evaluator_notes && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3 inline mr-1" />
                    Feedback
                  </Label>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-2">
                    {activity.evaluator_notes}
                  </p>
                </div>
              )}
              {activity.scoring_snapshot_id && (
                <p className="text-sm text-muted-foreground">
                  Capability assessment completed
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
