import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Share2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  UserCheck,
  User,
  Lightbulb,
  StickyNote,
  Target,
  FileText,
  Link2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { DevelopmentItemDialog } from "@/components/capabilities/DevelopmentItemDialog";
import { GuidedLearningSection } from "@/components/capabilities/GuidedLearningSection";

interface SnapshotRating {
  id: string;
  question_id: string;
  rating: number;
  question_text_snapshot?: string | null;
  domain_name_snapshot?: string | null;
}

interface DomainNote {
  id: string;
  domain_id: string;
  content: string;
}

interface QuestionNote {
  id: string;
  question_id: string;
  content: string;
}

interface Snapshot {
  id: string;
  title: string | null;
  notes: string | null;
  completed_at: string;
  shared_with_coach: boolean;
  capability_snapshot_ratings: SnapshotRating[];
  capability_domain_notes: DomainNote[];
  capability_question_notes?: QuestionNote[];
}

interface Domain {
  id: string;
  name: string;
  description: string | null;
  capability_domain_questions: {
    id: string;
    question_text: string;
    description: string | null;
  }[];
}

interface Assessment {
  id: string;
  name: string;
  rating_scale: number;
  pass_fail_enabled?: boolean;
  pass_fail_mode?: string | null;
  pass_fail_threshold?: number | null;
  capability_domains: Domain[];
}

interface CapabilitySnapshotViewProps {
  snapshot: Snapshot;
  assessment: Assessment;
  compact?: boolean;
  onToggleShare?: (shared: boolean) => void;
  /** If true, this is an evaluator assessment (hide self-add buttons, show instructor info) */
  isEvaluatorAssessment?: boolean;
  /** Evaluator name to display */
  evaluatorName?: string | null;
  /** Allow adding development items (defaults to true for self-assessments, false for evaluator views) */
  canAddDevelopmentItems?: boolean;
  /** The user ID to create development items for (required for evaluator mode) */
  forUserId?: string;
  /** Module progress ID for instructor authorization */
  moduleProgressId?: string;
}

export function CapabilitySnapshotView({
  snapshot,
  assessment,
  compact = false,
  onToggleShare,
  isEvaluatorAssessment = false,
  evaluatorName,
  canAddDevelopmentItems,
  forUserId,
  moduleProgressId,
}: CapabilitySnapshotViewProps) {
  // Determine if user can add development items
  // Self-assessments: always can add
  // Evaluator assessments: only if explicitly enabled via prop
  const showAddButtons =
    canAddDevelopmentItems !== undefined ? canAddDevelopmentItems : !isEvaluatorAssessment;
  const navigate = useNavigate();
  const [expandedDomains, setExpandedDomains] = useState<string[]>([]);
  const [devItemDialog, setDevItemDialog] = useState<{
    open: boolean;
    snapshotId: string;
    questionId?: string;
    domainId?: string;
  }>({ open: false, snapshotId: snapshot.id });

  // Fetch all development items linked to questions in this snapshot
  const { data: questionDevItems } = useQuery({
    queryKey: ["snapshot-question-dev-items", snapshot.id],
    queryFn: async () => {
      const { data: links, error: linksError } = await supabase
        .from("development_item_question_links")
        .select("question_id, development_item_id")
        .eq("snapshot_id", snapshot.id);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return {};

      const itemIds = [...new Set(links.map((l) => l.development_item_id))];
      const { data: items, error: itemsError } = await supabase
        .from("development_items")
        .select("id, item_type, title, content, resource_url, library_resource_id, file_path")
        .in("id", itemIds);

      if (itemsError) throw itemsError;

      // For items with library_resource_id, fetch the resource details
      const libraryResourceIds =
        items?.filter((i) => i.library_resource_id).map((i) => i.library_resource_id!) || [];
      let libraryResources: Record<string, { title: string; resource_url: string | null }> = {};

      if (libraryResourceIds.length > 0) {
        const { data: libRes } = await supabase
          .from("resource_library")
          .select("id, title, url")
          .in("id", libraryResourceIds);

        libraryResources = (libRes || []).reduce(
          (acc, r) => {
            acc[r.id] = { title: r.title, resource_url: r.url };
            return acc;
          },
          {} as Record<string, { title: string; resource_url: string | null }>,
        );
      }

      // Enhance items with library resource info
      const enhancedItems = items?.map((item) => {
        if (item.library_resource_id && libraryResources[item.library_resource_id]) {
          const libRes = libraryResources[item.library_resource_id];
          return {
            ...item,
            title: item.title || libRes.title,
            resource_url: item.resource_url || libRes.resource_url,
          };
        }
        return item;
      });

      // Group by question_id
      const grouped: Record<string, typeof enhancedItems> = {};
      for (const link of links) {
        const item = enhancedItems?.find((i) => i.id === link.development_item_id);
        if (item) {
          if (!grouped[link.question_id]) grouped[link.question_id] = [];
          grouped[link.question_id].push(item);
        }
      }
      return grouped;
    },
  });

  // Fetch instructor-added resources/notes linked to this snapshot (not to specific questions)
  const { data: linkedResources } = useQuery({
    queryKey: ["snapshot-linked-resources", snapshot.id],
    queryFn: async () => {
      const { data: links, error: linksError } = await supabase
        .from("development_item_snapshot_links")
        .select("development_item_id")
        .eq("snapshot_id", snapshot.id);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return [];

      const itemIds = links.map((l) => l.development_item_id);
      const { data: items, error: itemsError } = await supabase
        .from("development_items")
        .select("id, item_type, title, content, resource_url, author_id, user_id")
        .in("id", itemIds);

      if (itemsError) throw itemsError;

      // Filter to only show items added by someone else (instructor) or resources/notes
      return (items || []).filter(
        (item) =>
          item.author_id !== item.user_id ||
          item.item_type === "resource" ||
          item.item_type === "note",
      );
    },
  });

  const toggleDomain = (domainId: string, e?: React.MouseEvent) => {
    // Prevent event from bubbling to parent card's onClick handler
    e?.stopPropagation();
    setExpandedDomains((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId],
    );
  };

  const getRatingForQuestion = (questionId: string) => {
    return (
      snapshot.capability_snapshot_ratings.find((r) => r.question_id === questionId)?.rating || 0
    );
  };

  const getNoteForDomain = (domainId: string) => {
    return snapshot.capability_domain_notes.find((n) => n.domain_id === domainId)?.content;
  };

  const getNoteForQuestion = (questionId: string) => {
    return snapshot.capability_question_notes?.find((n) => n.question_id === questionId)?.content;
  };

  const getDomainAverage = (domain: Domain) => {
    const ratings = domain.capability_domain_questions.map((q) => getRatingForQuestion(q.id));
    if (ratings.length === 0) return 0;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  };

  const getOverallAverage = () => {
    const allRatings = snapshot.capability_snapshot_ratings.map((r) => r.rating);
    if (allRatings.length === 0) return 0;
    return allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
  };

  const getDomainPassFailStatus = (domain: Domain): { passed: boolean; label: string } | null => {
    if (!assessment.pass_fail_enabled || !assessment.pass_fail_threshold) {
      return null;
    }

    const threshold = assessment.pass_fail_threshold;
    const domainAvg = getDomainAverage(domain);
    const domainPercentage = (domainAvg / assessment.rating_scale) * 100;

    return domainPercentage >= threshold
      ? { passed: true, label: "Pass" }
      : { passed: false, label: "Needs Improvement" };
  };

  const getPassFailStatus = (): { passed: boolean; label: string } | null => {
    if (!assessment.pass_fail_enabled || !assessment.pass_fail_threshold) {
      return null;
    }

    const threshold = assessment.pass_fail_threshold;
    const overallPercentage = (getOverallAverage() / assessment.rating_scale) * 100;

    if (assessment.pass_fail_mode === "per_domain") {
      // Check if any domain is below threshold
      for (const domain of assessment.capability_domains) {
        const domainAvg = getDomainAverage(domain);
        const domainPercentage = (domainAvg / assessment.rating_scale) * 100;
        if (domainPercentage < threshold) {
          return { passed: false, label: "Needs Improvement" };
        }
      }
      return { passed: true, label: "Pass" };
    } else {
      // Overall mode - check overall average
      return overallPercentage >= threshold
        ? { passed: true, label: "Pass" }
        : { passed: false, label: "Needs Improvement" };
    }
  };

  const passFailStatus = getPassFailStatus();

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">
                {snapshot.title || format(new Date(snapshot.completed_at), "MMMM d, yyyy")}
              </h2>
              {/* Assessment type badge */}
              {isEvaluatorAssessment ? (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  {evaluatorName ? `Evaluator: ${evaluatorName}` : "Evaluator Graded"}
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Self
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Completed {format(new Date(snapshot.completed_at), "PPP 'at' p")}
            </p>
          </div>
          {onToggleShare && !isEvaluatorAssessment && (
            <div className="flex items-center gap-3 shrink-0">
              <Share2
                className={`h-4 w-4 ${
                  snapshot.shared_with_coach ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <Switch checked={snapshot.shared_with_coach} onCheckedChange={onToggleShare} />
              <span className="text-sm">{snapshot.shared_with_coach ? "Shared" : "Private"}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
          <span className="text-sm font-medium">Overall Score</span>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {passFailStatus && (
              <Badge
                variant={passFailStatus.passed ? "default" : "destructive"}
                className={`flex items-center gap-1 ${passFailStatus.passed ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
              >
                {passFailStatus.passed ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {passFailStatus.label}
              </Badge>
            )}
            <span className="text-2xl font-bold text-primary">
              {getOverallAverage().toFixed(1)}/{assessment.rating_scale}
            </span>
          </div>
        </div>
        <Progress value={(getOverallAverage() / assessment.rating_scale) * 100} className="h-3" />
      </div>

      <div className="space-y-3">
        {assessment.capability_domains.map((domain) => {
          const domainAvg = getDomainAverage(domain);
          const domainNote = getNoteForDomain(domain.id);
          const domainPassFail = getDomainPassFailStatus(domain);

          return (
            <Collapsible key={domain.id} open={expandedDomains.includes(domain.id)}>
              <Card onClick={(e) => e.stopPropagation()}>
                <CollapsibleTrigger asChild>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-3 sm:px-6"
                    onClick={(e) => toggleDomain(domain.id, e)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {expandedDomains.includes(domain.id) ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <span className="font-medium truncate">{domain.name}</span>
                        {domainNote && (
                          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
                        {domainPassFail && (
                          <Badge
                            variant={domainPassFail.passed ? "default" : "destructive"}
                            className={`flex items-center gap-1 ${domainPassFail.passed ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                          >
                            {domainPassFail.passed ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {domainPassFail.label}
                          </Badge>
                        )}
                        <Progress
                          value={(domainAvg / assessment.rating_scale) * 100}
                          className="w-16 sm:w-24 h-2"
                        />
                        <Badge variant="secondary" className="shrink-0">
                          {domainAvg.toFixed(1)}/{assessment.rating_scale}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {domain.capability_domain_questions.map((question) => {
                      const rating = getRatingForQuestion(question.id);
                      const ratingRecord = snapshot.capability_snapshot_ratings.find(
                        (r) => r.question_id === question.id,
                      );
                      const questionNote = getNoteForQuestion(question.id);
                      // Use snapshot text if available, fall back to current text
                      const displayText =
                        ratingRecord?.question_text_snapshot || question.question_text;
                      return (
                        <div key={question.id} className="space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-sm">{displayText}</p>
                              {question.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {question.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Progress
                                value={(rating / assessment.rating_scale) * 100}
                                className="w-16 h-2"
                              />
                              <Badge variant="outline" className="min-w-[3rem] justify-center">
                                {rating}/{assessment.rating_scale}
                              </Badge>
                              {showAddButtons && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDevItemDialog({
                                      open: true,
                                      snapshotId: snapshot.id,
                                      questionId: question.id,
                                      domainId: domain.id,
                                    });
                                  }}
                                  title="Add development item"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {questionNote && (
                            <p className="text-sm text-muted-foreground pl-4 border-l-2 border-muted">
                              {questionNote}
                            </p>
                          )}
                          {/* Show development items linked to this question */}
                          {questionDevItems?.[question.id] &&
                            questionDevItems[question.id].length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <Lightbulb className="h-3 w-3" />
                                  Development Items ({questionDevItems[question.id].length})
                                </p>
                                {questionDevItems[question.id].map((item) => {
                                  const TypeIcon =
                                    item.item_type === "reflection"
                                      ? StickyNote
                                      : item.item_type === "action_item"
                                        ? Target
                                        : item.item_type === "resource"
                                          ? Link2
                                          : FileText;
                                  // Check if item has a URL or is a library resource (file-based)
                                  const hasDirectUrl = !!item.resource_url;
                                  const hasLibraryResource = !!item.library_resource_id;
                                  const isClickable = hasDirectUrl || hasLibraryResource;

                                  const handleItemClick = () => {
                                    if (hasDirectUrl) {
                                      window.open(item.resource_url!, "_blank");
                                    } else if (hasLibraryResource) {
                                      navigate(`/resources/${item.library_resource_id}`);
                                    }
                                  };

                                  return (
                                    <div
                                      key={item.id}
                                      className={`flex items-start gap-2 pl-4 py-1.5 rounded-md bg-muted/30 text-sm ${isClickable ? "cursor-pointer hover:bg-muted/50" : ""}`}
                                      onClick={isClickable ? handleItemClick : undefined}
                                    >
                                      <TypeIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <span
                                          className={`font-medium ${isClickable ? "text-primary hover:underline" : ""}`}
                                        >
                                          {item.title}
                                        </span>
                                        {item.content && (
                                          <p className="text-xs text-muted-foreground line-clamp-1">
                                            {item.content}
                                          </p>
                                        )}
                                        {isClickable && (
                                          <span className="text-xs text-primary flex items-center gap-1 mt-0.5">
                                            <ExternalLink className="h-3 w-3" />
                                            {hasLibraryResource && !hasDirectUrl
                                              ? "View resource"
                                              : "Open resource"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                <Link
                                  to={`/development-items?snapshotId=${snapshot.id}&questionId=${question.id}`}
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 pl-4"
                                >
                                  View all in Development Items <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            )}
                        </div>
                      );
                    })}
                    {domainNote && (
                      <div className="pt-3 border-t">
                        <p className="text-sm font-medium mb-1">Reflections</p>
                        <p className="text-sm text-muted-foreground">{domainNote}</p>
                      </div>
                    )}

                    {/* Guided Learning Resources for this domain */}
                    <GuidedLearningSection
                      domainId={domain.id}
                      questionIds={domain.capability_domain_questions.map((q) => q.id)}
                      domainName={domain.name}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {snapshot.notes && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              {isEvaluatorAssessment ? "Evaluator Notes" : "Overall Notes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">{snapshot.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Linked Resources from Instructor */}
      {linkedResources && linkedResources.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {isEvaluatorAssessment ? "Resources from Evaluator" : "Linked Resources"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {linkedResources.map((item) => (
              <div key={item.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.item_type === "resource" ? "Resource" : "Note"}
                    </Badge>
                    <span className="font-medium text-sm truncate">{item.title}</span>
                  </div>
                  {item.content && (
                    <p className="text-xs text-muted-foreground mt-1">{item.content}</p>
                  )}
                  {item.resource_url && (
                    <a
                      href={item.resource_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open resource
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showAddButtons && (
        <DevelopmentItemDialog
          open={devItemDialog.open}
          onOpenChange={(open) => setDevItemDialog((prev) => ({ ...prev, open }))}
          snapshotId={devItemDialog.snapshotId}
          questionId={devItemDialog.questionId}
          domainId={devItemDialog.domainId}
          forUserId={forUserId}
          moduleProgressId={moduleProgressId}
        />
      )}
    </div>
  );
}
