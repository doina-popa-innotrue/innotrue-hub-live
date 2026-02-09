import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Camera, History, Share2, FileEdit, Trash2, User, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { CapabilitySnapshotForm } from "@/components/capabilities/CapabilitySnapshotForm";
import { CapabilityEvolutionChart } from "@/components/capabilities/CapabilityEvolutionChart";
import { CapabilitySnapshotView } from "@/components/capabilities/CapabilitySnapshotView";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type SnapshotTypeFilter = "all" | "self" | "instructor" | "peer";

export default function CapabilityAssessmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<SnapshotTypeFilter>("all");
  const [activeTab, setActiveTab] = useState<string>("current");

  // Check for snapshotId in URL params to auto-open the form or view
  const urlSnapshotId = searchParams.get('snapshotId');

  // Fetch assessment with domains and questions
  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["capability-assessment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select(`
          *,
          capability_domains (
            id,
            name,
            description,
            order_index,
            capability_domain_questions (
              id,
              question_text,
              description,
              order_index
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Sort domains and questions by order_index
      if (data.capability_domains) {
        data.capability_domains.sort((a: any, b: any) => a.order_index - b.order_index);
        data.capability_domains.forEach((domain: any) => {
          if (domain.capability_domain_questions) {
            domain.capability_domain_questions.sort((a: any, b: any) => a.order_index - b.order_index);
          }
        });
      }
      
      return data;
    },
    enabled: !!id,
  });

  // Fetch user's snapshots for this assessment (both self and evaluator)
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ["capability-snapshots", id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(`
          *,
          capability_snapshot_ratings (
            id,
            question_id,
            rating,
            question_text_snapshot,
            domain_name_snapshot
          ),
          capability_domain_notes (
            id,
            domain_id,
            content
          ),
          capability_question_notes (
            id,
            question_id,
            content
          )
        `)
        .eq("assessment_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch evaluator names for non-self assessments
      const snapshotsWithEvaluators = await Promise.all(
        data.map(async (s: any) => {
          if (s.evaluator_id && !s.is_self_assessment) {
            const { data: evaluator } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", s.evaluator_id)
              .single();
            return { ...s, evaluator_name: evaluator?.name || null };
          }
          return { ...s, evaluator_name: null };
        })
      );
      
      return snapshotsWithEvaluators;
    },
    enabled: !!id && !!user,
  });

  // Fetch the target snapshot by ID if provided in URL
  // This is needed because instructors viewing client snapshots won't have them in the user's snapshots array
  const { data: urlTargetSnapshot } = useQuery({
    queryKey: ["capability-snapshot-by-id", urlSnapshotId],
    queryFn: async () => {
      if (!urlSnapshotId) return null;
      const { data, error } = await supabase
        .from("capability_snapshots")
        .select("id, status, user_id, is_self_assessment, evaluator_id")
        .eq("id", urlSnapshotId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!urlSnapshotId,
  });

  // Handle snapshotId URL parameter - show view mode for completed, form for drafts
  useEffect(() => {
    if (urlSnapshotId && urlTargetSnapshot) {
      if (urlTargetSnapshot.status === 'completed') {
        // For completed snapshots, show in view mode (history tab)
        setShowForm(false);
        setSelectedSnapshotId(urlSnapshotId);
        setActiveTab("history");
      } else {
        // For drafts, open the form
        setShowForm(true);
        setSelectedSnapshotId(urlSnapshotId);
      }
    }
  }, [urlSnapshotId, urlTargetSnapshot]);

  const toggleShareMutation = useMutation({
    mutationFn: async ({ snapshotId, shared }: { snapshotId: string; shared: boolean }) => {
      const { error } = await supabase
        .from("capability_snapshots")
        .update({ shared_with_coach: shared })
        .eq("id", snapshotId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-snapshots", id] });
      toast({ description: "Sharing settings updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      // Delete related data first
      await supabase.from("capability_snapshot_ratings").delete().eq("snapshot_id", snapshotId);
      await supabase.from("capability_domain_notes").delete().eq("snapshot_id", snapshotId);
      await supabase.from("capability_question_notes").delete().eq("snapshot_id", snapshotId);
      
      const { error } = await supabase
        .from("capability_snapshots")
        .delete()
        .eq("id", snapshotId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-snapshots", id] });
      queryClient.invalidateQueries({ queryKey: ["my-capability-snapshots-results"] });
      queryClient.invalidateQueries({ queryKey: ["my-capability-snapshots-all"] });
      toast({ description: "Assessment instance deleted" });
      setSelectedSnapshotId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const completedSnapshots = snapshots?.filter((s) => s.status === 'completed') || [];
  const draftSnapshot = snapshots?.find((s) => s.status === 'draft');
  const latestSnapshot = completedSnapshots[0];

  // Filter snapshots for history tab
  const filteredHistorySnapshots = useMemo(() => {
    if (historyFilter === "all") return completedSnapshots;
    if (historyFilter === "self") return completedSnapshots.filter((s) => s.is_self_assessment);
    if (historyFilter === "peer") return completedSnapshots.filter((s) => !s.is_self_assessment && s.evaluation_relationship === 'peer');
    // instructor filter: non-self, non-peer (instructor or coach)
    return completedSnapshots.filter((s) => !s.is_self_assessment && s.evaluation_relationship !== 'peer');
  }, [completedSnapshots, historyFilter]);

  // Separate self, peer, and instructor snapshots for evolution chart filtering
  const selfSnapshots = useMemo(() => completedSnapshots.filter((s) => s.is_self_assessment), [completedSnapshots]);
  const peerSnapshots = useMemo(() => completedSnapshots.filter((s) => !s.is_self_assessment && s.evaluation_relationship === 'peer'), [completedSnapshots]);
  const instructorSnapshots = useMemo(() => completedSnapshots.filter((s) => !s.is_self_assessment && s.evaluation_relationship !== 'peer'), [completedSnapshots]);

  if (assessmentLoading || snapshotsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Assessment not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/capabilities")}>
          Back to Assessments
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/capabilities">Capability Assessments</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{assessment.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">{assessment.name}</h1>
          {assessment.description && (
            <p className="text-muted-foreground mt-1">{assessment.description}</p>
          )}
        </div>
        {draftSnapshot && !showForm && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => setShowForm(true)}>
              <FileEdit className="mr-2 h-4 w-4" />
              Resume Draft
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                if (confirm("Delete this draft? This cannot be undone.")) {
                  deleteSnapshotMutation.mutate(draftSnapshot.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        {!draftSnapshot && (
          <Button onClick={() => setShowForm(true)} className="shrink-0 w-full sm:w-auto">
            <Camera className="mr-2 h-4 w-4" />
            Take Snapshot
          </Button>
        )}
      </div>

      {showForm ? (
        <CapabilitySnapshotForm
          assessment={{
            ...assessment,
            assessment_mode: (assessment.assessment_mode as 'self' | 'evaluator' | 'both') || 'both'
          }}
          existingDraftId={urlSnapshotId ?? draftSnapshot?.id}
          onCancel={() => setShowForm(false)}
          onComplete={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["capability-snapshots", id] });
            queryClient.invalidateQueries({ queryKey: ["capability-draft", id] });
          }}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="current">Current</TabsTrigger>
            <TabsTrigger value="evolution">Evolution</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            {latestSnapshot ? (
              <CapabilitySnapshotView
                snapshot={latestSnapshot}
                assessment={assessment}
                isEvaluatorAssessment={!latestSnapshot.is_self_assessment}
                evaluatorName={(latestSnapshot as any).evaluator_name}
                canAddDevelopmentItems={true}
                forUserId={user?.id}
                onToggleShare={latestSnapshot.is_self_assessment ? (shared) =>
                  toggleShareMutation.mutate({ snapshotId: latestSnapshot.id, shared })
                : undefined}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Snapshots Yet</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Take your first snapshot to assess your capabilities across each domain and question.
                  </p>
                  <Button className="mt-4" onClick={() => setShowForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Take First Snapshot
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="evolution" className="space-y-6">
            {completedSnapshots.length >= 2 ? (
              <CapabilityEvolutionChart
                snapshots={completedSnapshots}
                selfSnapshots={selfSnapshots}
                peerSnapshots={peerSnapshots}
                instructorSnapshots={instructorSnapshots}
                assessment={assessment}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Not Enough Data</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Complete at least 2 snapshots to see your evolution over time.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by:</span>
              <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as SnapshotTypeFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Snapshots</SelectItem>
                  <SelectItem value="self">Self-Evaluations</SelectItem>
                  <SelectItem value="instructor">Instructor/Coach Graded</SelectItem>
                  <SelectItem value="peer">Peer Reviews</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground ml-2">
                ({filteredHistorySnapshots.length} of {completedSnapshots.length})
              </span>
            </div>

            {filteredHistorySnapshots.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {completedSnapshots.length === 0 
                    ? "No completed snapshots yet."
                    : `No ${historyFilter === "self" ? "self-evaluation" : historyFilter === "peer" ? "peer review" : "instructor/coach graded"} snapshots found.`
                  }
                </CardContent>
              </Card>
            ) : (
              filteredHistorySnapshots.map((snapshot) => (
                <Card
                  key={snapshot.id}
                  className={`cursor-pointer transition-colors ${
                    selectedSnapshotId === snapshot.id ? "border-primary" : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedSnapshotId(
                    selectedSnapshotId === snapshot.id ? null : snapshot.id
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {snapshot.title || format(new Date(snapshot.completed_at!), "MMMM d, yyyy")}
                            {/* Type badge */}
                            {snapshot.is_self_assessment ? (
                              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                <User className="h-3 w-3" />
                                Self
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                <UserCheck className="h-3 w-3" />
                                Evaluator{(snapshot as any).evaluator_name ? `: ${(snapshot as any).evaluator_name}` : ""}
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {format(new Date(snapshot.completed_at!), "PPP 'at' p")}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {snapshot.is_self_assessment && (
                          <div className="flex items-center gap-2">
                            <Share2 className={`h-4 w-4 ${snapshot.shared_with_coach ? "text-primary" : "text-muted-foreground"}`} />
                            <Switch
                              checked={snapshot.shared_with_coach}
                              onCheckedChange={(checked) => {
                                toggleShareMutation.mutate({ snapshotId: snapshot.id, shared: checked });
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        <Badge variant={snapshot.shared_with_coach ? "default" : "secondary"}>
                          {snapshot.shared_with_coach ? "Shared" : "Private"}
                        </Badge>
                        {/* Delete button for self-assessments */}
                        {snapshot.is_self_assessment && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Delete this assessment instance? This cannot be undone.")) {
                                deleteSnapshotMutation.mutate(snapshot.id);
                              }
                            }}
                            disabled={deleteSnapshotMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {selectedSnapshotId === snapshot.id && (
                    <CardContent>
                      <CapabilitySnapshotView
                        snapshot={snapshot}
                        assessment={assessment}
                        compact
                        isEvaluatorAssessment={!snapshot.is_self_assessment}
                        evaluatorName={(snapshot as any).evaluator_name}
                        canAddDevelopmentItems={true}
                        forUserId={user?.id}
                        onToggleShare={snapshot.is_self_assessment ? (shared: boolean) =>
                          toggleShareMutation.mutate({ snapshotId: snapshot.id, shared })
                        : undefined}
                      />
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
