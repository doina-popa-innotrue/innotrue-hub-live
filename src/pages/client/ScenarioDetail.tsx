import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useScenarioAssignment,
  useScenarioSections,
  useSectionParagraphs,
  useParagraphResponses,
  useParagraphResponseMutations,
  useScenarioAssignmentMutations,
  useParagraphEvaluations,
  useParagraphQuestionScores,
  useScenarioScoreSummary,
  useScenarioProgress,
} from "@/hooks/useScenarios";
import { ScenarioSaveIndicator, SaveStatus } from "@/components/scenarios/ScenarioSaveIndicator";
import { ScenarioViewModeToggle } from "@/components/scenarios/ScenarioViewModeToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  ArrowLeft,
  FileText,
  Shield,
  Lock,
  CheckCircle2,
  MessageSquare,
  Star,
  Eye,
  RotateCcw,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScenarioSection, SectionParagraph, ParagraphQuestionLink } from "@/types/scenarios";
import { ScenarioErrorBoundary } from "@/components/scenarios/ScenarioErrorBoundary";
import { ErrorState } from "@/components/ui/error-state";

function ScenarioDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core data
  const { data: assignment, isLoading: loadingAssignment } = useScenarioAssignment(id);
  const templateId = assignment?.template_id;
  const {
    data: sections,
    isLoading: loadingSections,
    isFetching: fetchingSections,
  } = useScenarioSections(templateId);
  const { data: responses } = useParagraphResponses(id);
  const { data: evaluations } = useParagraphEvaluations(id);
  const { data: scores } = useParagraphQuestionScores(id);

  // Mutations
  const { upsertMutation } = useParagraphResponseMutations(id || "");
  const { updateStatusMutation } = useScenarioAssignmentMutations();

  // UI state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [localResponses, setLocalResponses] = useState<Record<string, string>>({});
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const pendingSaves = useRef<Set<string>>(new Set());

  const template = assignment?.scenario_templates;
  const isProtected = template?.is_protected ?? false;
  const isReadOnly = assignment?.status !== "draft";
  const isEvaluated = assignment?.status === "evaluated";

  const ratingScale = template?.capability_assessments?.rating_scale ?? 5;
  const scoreSummary = useScenarioScoreSummary(id, ratingScale);
  const { data: progress } = useScenarioProgress(assignment?.template_id, id);
  const attemptNumber = assignment?.attempt_number ?? 1;
  const isRevision = attemptNumber > 1;

  // Initialize local responses from fetched data
  useEffect(() => {
    if (responses) {
      const responseMap: Record<string, string> = {};
      responses.forEach((r) => {
        if (r.response_text) {
          responseMap[r.paragraph_id] = r.response_text;
        }
      });
      setLocalResponses(responseMap);
    }
  }, [responses]);

  // Auto-save handler with status tracking
  const handleResponseChange = useCallback(
    (paragraphId: string, value: string) => {
      setLocalResponses((prev) => ({ ...prev, [paragraphId]: value }));
      pendingSaves.current.add(paragraphId);

      // Debounced save
      if (saveTimeout) clearTimeout(saveTimeout);
      const timeout = setTimeout(() => {
        setSaveStatus("saving");
        upsertMutation.mutate(
          { paragraphId, responseText: value },
          {
            onSuccess: () => {
              pendingSaves.current.delete(paragraphId);
              if (pendingSaves.current.size === 0) {
                setSaveStatus("saved");
                // Reset to idle after 2 seconds
                setTimeout(() => setSaveStatus("idle"), 2000);
              }
            },
            onError: () => {
              setSaveStatus("error");
            },
          },
        );
      }, 1000);
      setSaveTimeout(timeout);
    },
    [saveTimeout, upsertMutation],
  );

  // Manual save all pending changes
  const handleManualSave = useCallback(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      setSaveTimeout(null);
    }

    const paragraphIds = Object.keys(localResponses);
    if (paragraphIds.length === 0) return;

    setSaveStatus("saving");
    let completed = 0;
    let hasError = false;

    paragraphIds.forEach((paragraphId) => {
      const value = localResponses[paragraphId];
      upsertMutation.mutate(
        { paragraphId, responseText: value },
        {
          onSuccess: () => {
            completed++;
            pendingSaves.current.delete(paragraphId);
            if (completed === paragraphIds.length && !hasError) {
              setSaveStatus("saved");
              setTimeout(() => setSaveStatus("idle"), 2000);
            }
          },
          onError: () => {
            hasError = true;
            setSaveStatus("error");
          },
        },
      );
    });
  }, [saveTimeout, localResponses, upsertMutation]);

  const currentSection = sections?.[currentSectionIndex];

  const handleSubmit = () => {
    updateStatusMutation.mutate(
      { id: id!, status: "submitted" },
      { onSuccess: () => setShowSubmitDialog(false) },
    );
  };

  // Show loading if assignment is loading, or if we have a template but sections haven't loaded yet
  const isLoadingSections = loadingSections || fetchingSections || (!!templateId && !sections);

  if (loadingAssignment || isLoadingSections) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="container py-6">
        <ErrorState title="Not Found" description="The requested scenario assignment could not be found." />
      </div>
    );
  }

  return (
    <div
      className={cn("container py-6 space-y-6", isProtected && "select-none")}
      onContextMenu={isProtected ? (e) => e.preventDefault() : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/scenarios")}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Scenarios
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            {template?.title || "Untitled Scenario"}
            {isRevision && (
              <Badge variant="outline" className="text-xs">
                Attempt #{attemptNumber}
              </Badge>
            )}
            {isProtected && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Protected
              </Badge>
            )}
          </h1>
          {template?.description && <p className="text-muted-foreground">{template.description}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View mode toggle (only for drafts) */}
          {!isReadOnly && (
            <ScenarioViewModeToggle
              isPreviewMode={isPreviewMode}
              onToggle={() => setIsPreviewMode((prev) => !prev)}
            />
          )}

          {/* Save controls (only for drafts and not in preview mode) */}
          {!isReadOnly && !isPreviewMode && (
            <ScenarioSaveIndicator
              status={saveStatus}
              onManualSave={handleManualSave}
              disabled={Object.keys(localResponses).length === 0}
            />
          )}

          {!isReadOnly && !isPreviewMode && (
            <Button onClick={() => setShowSubmitDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              Submit
            </Button>
          )}
          {isEvaluated && (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Evaluated
            </Badge>
          )}
        </div>
      </div>

      {/* IP Protection Watermark */}
      {isProtected && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center opacity-5">
          <div className="text-6xl font-bold text-foreground rotate-[-30deg] whitespace-nowrap">
            {user?.email || "Confidential"}
          </div>
        </div>
      )}

      {/* Progress Indicator (for draft assignments) */}
      {!isReadOnly && progress && progress.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Your Progress</span>
              <span className="text-sm text-muted-foreground">
                {progress.answered} of {progress.total} responses completed
              </span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Revision Banner (for revision drafts) */}
      {isRevision && assignment?.revision_notes && assignment.status === "draft" && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Revision Requested by Your Instructor</p>
                <p className="text-sm text-muted-foreground">{assignment.revision_notes}</p>
                {assignment.parent_assignment_id && (
                  <Link
                    to={`/scenarios/${assignment.parent_assignment_id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
                  >
                    <History className="h-3 w-3" />
                    View previous attempt
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous attempt link (for evaluated revisions) */}
      {isRevision && assignment?.parent_assignment_id && assignment.status === "evaluated" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="h-4 w-4" />
          <Link
            to={`/scenarios/${assignment.parent_assignment_id}`}
            className="text-primary hover:underline"
          >
            View previous attempt (Attempt #{attemptNumber - 1})
          </Link>
        </div>
      )}

      {/* Score Summary (if evaluated) */}
      {isEvaluated && scoreSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Evaluation Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-primary">
                {scoreSummary.overall_percentage.toFixed(0)}%
              </div>
              <Progress value={scoreSummary.overall_percentage} className="flex-1" />
            </div>
            {scoreSummary.domain_scores.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {scoreSummary.domain_scores.map((ds) => (
                  <div key={ds.domain_id} className="p-3 rounded-lg bg-muted/50">
                    <div className="text-sm font-medium">{ds.domain_name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={ds.percentage} className="flex-1 h-2" />
                      <span className="text-sm text-muted-foreground">
                        {ds.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {assignment.overall_notes && (
              <div className="mt-4 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Evaluator Notes
                </div>
                <RichTextDisplay content={assignment.overall_notes} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section Navigation */}
      {sections && sections.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentSectionIndex((i) => Math.max(0, i - 1))}
                disabled={currentSectionIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {sections.map((section, idx) => (
                  <button
                    key={section.id}
                    onClick={() => setCurrentSectionIndex(idx)}
                    className={cn(
                      "w-8 h-8 rounded-full text-sm font-medium transition-colors",
                      idx === currentSectionIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80",
                    )}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentSectionIndex((i) => Math.min(sections.length - 1, i + 1))}
                disabled={currentSectionIndex === sections.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Section Content */}
      {currentSection && (
        <SectionContent
          section={currentSection}
          assignmentId={id!}
          localResponses={localResponses}
          onResponseChange={handleResponseChange}
          isReadOnly={isReadOnly || isPreviewMode}
          isProtected={isProtected}
          evaluations={evaluations}
          scores={scores}
          ratingScale={ratingScale}
          isPreviewMode={isPreviewMode}
        />
      )}

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, you won't be able to make further changes. Your responses will be sent
              for evaluation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>Submit for Evaluation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Default export with error boundary
export default function ScenarioDetail() {
  return (
    <ScenarioErrorBoundary fallbackPath="/scenarios" fallbackLabel="Back to Scenarios">
      <ScenarioDetailContent />
    </ScenarioErrorBoundary>
  );
}

// Section Content Component
interface SectionContentProps {
  section: ScenarioSection;
  assignmentId: string;
  localResponses: Record<string, string>;
  onResponseChange: (paragraphId: string, value: string) => void;
  isReadOnly: boolean;
  isProtected: boolean;
  evaluations: any[] | undefined;
  scores: any[] | undefined;
  ratingScale: number;
  isPreviewMode?: boolean;
}

function SectionContent({
  section,
  assignmentId,
  localResponses,
  onResponseChange,
  isReadOnly,
  isProtected,
  evaluations,
  scores,
  ratingScale,
  isPreviewMode,
}: SectionContentProps) {
  const { data: paragraphs, isLoading } = useSectionParagraphs(section.id);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
        {section.instructions && (
          <CardDescription>
            <RichTextDisplay content={section.instructions} />
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {paragraphs?.map((paragraph, idx) => (
          <ParagraphBlock
            key={paragraph.id}
            paragraph={paragraph}
            index={idx}
            response={localResponses[paragraph.id] || ""}
            onResponseChange={(value) => onResponseChange(paragraph.id, value)}
            isReadOnly={isReadOnly}
            isProtected={isProtected}
            evaluation={evaluations?.find((e) => e.paragraph_id === paragraph.id)}
            paragraphScores={scores?.filter((s) => s.paragraph_id === paragraph.id)}
            ratingScale={ratingScale}
            isPreviewMode={isPreviewMode}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// Paragraph Block Component
interface ParagraphBlockProps {
  paragraph: SectionParagraph & { paragraph_question_links?: ParagraphQuestionLink[] };
  index: number;
  response: string;
  onResponseChange: (value: string) => void;
  isReadOnly: boolean;
  isProtected: boolean;
  evaluation: any | undefined;
  paragraphScores: any[] | undefined;
  ratingScale: number;
  isPreviewMode?: boolean;
}

function ParagraphBlock({
  paragraph,
  index,
  response,
  onResponseChange,
  isReadOnly,
  isProtected,
  evaluation,
  paragraphScores,
  ratingScale,
  isPreviewMode,
}: ParagraphBlockProps) {
  return (
    <div className="space-y-4">
      {index > 0 && <Separator />}

      {/* Paragraph Content */}
      <div
        className={cn("prose prose-sm max-w-none dark:prose-invert", isProtected && "select-none")}
      >
        <RichTextDisplay content={paragraph.content} />
      </div>

      {/* Response Area */}
      {paragraph.requires_response && (
        <div className="pl-4 border-l-2 border-primary/30 space-y-3">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {isReadOnly && <Lock className="h-3 w-3" />}
            {isPreviewMode && <Eye className="h-3 w-3" />}
            Your Response
          </div>
          {isReadOnly ? (
            <div
              className={cn(
                "p-3 rounded-lg",
                isPreviewMode ? "bg-primary/5 border border-primary/20" : "bg-muted/50",
              )}
            >
              {response ? (
                <RichTextDisplay content={response} />
              ) : (
                <span className="text-muted-foreground italic">No response provided</span>
              )}
            </div>
          ) : (
            <RichTextEditor
              value={response}
              onChange={onResponseChange}
              placeholder="Enter your response..."
              disabled={isReadOnly}
            />
          )}
        </div>
      )}

      {/* Evaluation Feedback (if evaluated) */}
      {evaluation?.feedback && (
        <div className="mt-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Instructor Feedback
          </div>
          <RichTextDisplay content={evaluation.feedback} />
        </div>
      )}

      {/* Domain Scores (if evaluated) */}
      {paragraphScores && paragraphScores.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {paragraphScores.map((score) => (
            <Badge key={score.id} variant="outline" className="flex items-center gap-1">
              <span className="font-normal">
                {score.capability_domain_questions?.capability_domains?.name}:
              </span>
              <span className="font-semibold">
                {score.score}/{ratingScale}
              </span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
