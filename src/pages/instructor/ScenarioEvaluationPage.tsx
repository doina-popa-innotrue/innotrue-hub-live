import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  User,
  FileText,
  CheckCircle,
  Clock,
  Send,
  MessageSquare,
  Star,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLoadingState } from "@/components/admin";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import {
  useScenarioAssignment,
  useScenarioSections,
  useSectionParagraphs,
  useParagraphResponses,
  useParagraphEvaluations,
  useParagraphEvaluationMutations,
  useParagraphQuestionScores,
  useParagraphQuestionScoreMutations,
  useScenarioAssignmentMutations,
  useScenarioScoreSummary,
} from "@/hooks/useScenarios";
import type { ScenarioSection, SectionParagraph, ParagraphQuestionLink } from "@/types/scenarios";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { ErrorState } from "@/components/ui/error-state";

export default function ScenarioEvaluationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [overallNotes, setOverallNotes] = useState("");
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  const { data: assignment, isLoading: assignmentLoading } = useScenarioAssignment(id);
  const { data: sections, isLoading: sectionsLoading } = useScenarioSections(
    assignment?.template_id,
  );
  const { data: responses } = useParagraphResponses(id);
  const { data: evaluations } = useParagraphEvaluations(id);
  const { data: scores } = useParagraphQuestionScores(id);
  const { updateStatusMutation, requestRevisionMutation } = useScenarioAssignmentMutations();

  const ratingScale = assignment?.scenario_templates?.capability_assessments?.rating_scale || 5;
  const scoreSummary = useScenarioScoreSummary(id, ratingScale);

  const currentSection = sections?.[currentSectionIndex];

  const isLoading = assignmentLoading || sectionsLoading;

  // Initialize overall notes from assignment
  useEffect(() => {
    if (assignment?.overall_notes) {
      setOverallNotes(assignment.overall_notes);
    }
  }, [assignment?.overall_notes]);

  if (isLoading) {
    return <AdminLoadingState message="Loading scenario evaluation..." />;
  }

  if (!assignment) {
    return (
      <ErrorState title="Not Found" description="The requested assignment could not be found." />
    );
  }

  const handleCompleteEvaluation = () => {
    updateStatusMutation.mutate(
      { id: assignment.id, status: "evaluated", notes: overallNotes },
      {
        onSuccess: () => {
          toast({ description: "Evaluation completed!" });
          navigate("/teaching/scenarios");
        },
      },
    );
  };

  const handleSaveOverallNotes = () => {
    updateStatusMutation.mutate(
      { id: assignment.id, status: assignment.status, notes: overallNotes },
      {
        onSuccess: () => {
          toast({ description: "Notes saved" });
        },
      },
    );
  };

  const handleStartReview = () => {
    if (assignment.status === "submitted") {
      updateStatusMutation.mutate({ id: assignment.id, status: "in_review" });
    }
  };

  const handleRequestRevision = () => {
    if (!revisionNotes.trim()) return;
    requestRevisionMutation.mutate(
      {
        parentAssignment: {
          id: assignment.id,
          template_id: assignment.template_id,
          user_id: assignment.user_id,
          enrollment_id: assignment.enrollment_id,
          module_id: assignment.module_id,
          attempt_number: assignment.attempt_number,
        },
        revisionNotes: revisionNotes.trim(),
      },
      {
        onSuccess: () => {
          setShowRevisionDialog(false);
          setRevisionNotes("");
          toast({ description: "Revision requested — new attempt created for the client" });
        },
      },
    );
  };

  const allowsResubmission = assignment.scenario_templates?.allows_resubmission ?? false;
  const attemptNumber = assignment.attempt_number ?? 1;

  // Start review when page loads if status is submitted
  if (assignment.status === "submitted") {
    handleStartReview();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teaching/scenarios")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {assignment.scenario_templates?.title}
              {attemptNumber > 1 && (
                <Badge variant="outline" className="text-xs">
                  Attempt #{attemptNumber}
                </Badge>
              )}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{assignment.profiles?.name}</span>
              <span>•</span>
              <span>
                Submitted{" "}
                {assignment.submitted_at &&
                  format(new Date(assignment.submitted_at), "MMM d, yyyy")}
              </span>
              {assignment.parent_assignment_id && (
                <>
                  <span>•</span>
                  <Link
                    to={`/teaching/scenarios/${assignment.parent_assignment_id}/evaluate`}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <History className="h-3 w-3" />
                    Previous attempt
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={assignment.status === "evaluated" ? "default" : "secondary"}>
            {assignment.status === "in_review" ? "In Review" : assignment.status}
          </Badge>
          {assignment.status !== "evaluated" && (
            <Button onClick={handleCompleteEvaluation} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Evaluation
            </Button>
          )}
          {assignment.status === "evaluated" && allowsResubmission && (
            <Button variant="outline" onClick={() => setShowRevisionDialog(true)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Request Revision
            </Button>
          )}
        </div>
      </div>

      {/* Score Summary */}
      {scoreSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Overall Score</span>
                  <span className="text-xl font-bold">
                    {scoreSummary.overall_percentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={scoreSummary.overall_percentage} className="h-3" />
              </div>
              {scoreSummary.domain_scores.length > 0 && (
                <div className="grid gap-2 mt-4">
                  <p className="text-sm font-medium text-muted-foreground">By Domain</p>
                  {scoreSummary.domain_scores.map((domain) => (
                    <div
                      key={domain.domain_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{domain.domain_name}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={domain.percentage} className="w-24 h-2" />
                        <span className="w-12 text-right">{domain.percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Evaluation Notes */}
      {assignment.status !== "evaluated" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Overall Evaluation Notes
            </CardTitle>
            <CardDescription>
              Add summary notes that will be visible to the client upon completion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RichTextEditor
              value={overallNotes}
              onChange={setOverallNotes}
              placeholder="Enter overall feedback, observations, and recommendations..."
            />
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleSaveOverallNotes}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Notes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {sections?.map((section, index) => (
            <Button
              key={section.id}
              variant={index === currentSectionIndex ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentSectionIndex(index)}
            >
              Section {index + 1}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentSectionIndex(Math.max(0, currentSectionIndex - 1))}
            disabled={currentSectionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentSectionIndex + 1} of {sections?.length || 0}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setCurrentSectionIndex(Math.min((sections?.length || 1) - 1, currentSectionIndex + 1))
            }
            disabled={currentSectionIndex === (sections?.length || 1) - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Revision Notes (if this is a revision attempt) */}
      {assignment.revision_notes && attemptNumber > 1 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <RotateCcw className="h-4 w-4 text-amber-600" />
              Revision Notes (Attempt #{attemptNumber})
            </div>
            <p className="text-sm text-muted-foreground">{assignment.revision_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Current Section Content */}
      {currentSection && (
        <SectionEvaluationView
          section={currentSection}
          assignmentId={id!}
          responses={responses || []}
          evaluations={evaluations || []}
          scores={scores || []}
          ratingScale={ratingScale}
        />
      )}

      {/* Request Revision Dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              This will create a new attempt for the client, pre-populated with their previous
              responses. The current evaluation will be preserved as an immutable snapshot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Revision Notes</Label>
            <Textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Describe what the client should revise or improve..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestRevision}
              disabled={!revisionNotes.trim() || requestRevisionMutation.isPending}
            >
              {requestRevisionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <RotateCcw className="h-4 w-4 mr-2" />
              Create Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Section Evaluation View
// ============================================================================

function SectionEvaluationView({
  section,
  assignmentId,
  responses,
  evaluations,
  scores,
  ratingScale,
}: {
  section: ScenarioSection;
  assignmentId: string;
  responses: any[];
  evaluations: any[];
  scores: any[];
  ratingScale: number;
}) {
  const { data: paragraphs, isLoading } = useSectionParagraphs(section.id);

  if (isLoading) {
    return <PageLoadingState message="Loading section..." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
        {section.instructions && <CardDescription>{section.instructions}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {paragraphs?.map((paragraph, index) => (
          <ParagraphEvaluationItem
            key={paragraph.id}
            paragraph={paragraph}
            paragraphNumber={index + 1}
            assignmentId={assignmentId}
            response={responses.find((r) => r.paragraph_id === paragraph.id)}
            evaluation={evaluations.find((e) => e.paragraph_id === paragraph.id)}
            existingScores={scores.filter((s) => s.paragraph_id === paragraph.id)}
            ratingScale={ratingScale}
            sectionId={section.id}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Paragraph Evaluation Item
// ============================================================================

function ParagraphEvaluationItem({
  paragraph,
  paragraphNumber,
  assignmentId,
  response,
  evaluation,
  existingScores,
  ratingScale,
  sectionId,
}: {
  paragraph: SectionParagraph & { paragraph_question_links?: ParagraphQuestionLink[] };
  paragraphNumber: number;
  assignmentId: string;
  response: any;
  evaluation: any;
  existingScores: any[];
  ratingScale: number;
  sectionId: string;
}) {
  const [feedback, setFeedback] = useState(evaluation?.feedback || "");
  const [localScores, setLocalScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    existingScores.forEach((s) => {
      initial[s.question_id] = s.score;
    });
    return initial;
  });

  const { upsertMutation: evaluationMutation } = useParagraphEvaluationMutations(assignmentId);
  const { upsertMutation: scoreMutation } = useParagraphQuestionScoreMutations(assignmentId);

  const questionLinks = paragraph.paragraph_question_links || [];

  const handleSaveFeedback = () => {
    evaluationMutation.mutate({ paragraphId: paragraph.id, feedback });
  };

  const handleScoreChange = (questionId: string, score: number) => {
    setLocalScores((prev) => ({ ...prev, [questionId]: score }));
    scoreMutation.mutate({ paragraphId: paragraph.id, questionId, score });
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Scenario Content */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline">¶{paragraphNumber}</Badge>
          <span className="text-xs text-muted-foreground">Scenario Content</span>
        </div>
        <div className="text-sm bg-muted/50 p-3 rounded">
          <RichTextDisplay content={paragraph.content} />
        </div>
      </div>

      {/* Client Response */}
      {paragraph.requires_response && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Client Response</span>
          </div>
          {response?.response_text ? (
            <div className="border-l-4 border-primary pl-4 py-2">
              <RichTextDisplay content={response.response_text} className="text-sm" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              No response provided
            </div>
          )}
        </div>
      )}

      {/* Question Scoring */}
      {questionLinks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Domain Scoring</span>
          </div>
          <div className="space-y-3">
            {questionLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded"
              >
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    [{link.capability_domain_questions?.capability_domains?.name}]
                  </p>
                  <p className="text-sm">{link.capability_domain_questions?.question_text}</p>
                  {link.rubric_text && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">
                      Rubric: {link.rubric_text}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: ratingScale + 1 }, (_, i) => i).map((score) => (
                    <Button
                      key={score}
                      variant={localScores[link.question_id] === score ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => handleScoreChange(link.question_id, score)}
                    >
                      {score}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluator Feedback */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Evaluator Feedback</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveFeedback}
            disabled={evaluationMutation.isPending}
          >
            {evaluationMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save Feedback
          </Button>
        </div>
        <RichTextEditor
          value={feedback}
          onChange={setFeedback}
          placeholder="Add feedback for this response..."
        />
      </div>
    </div>
  );
}
