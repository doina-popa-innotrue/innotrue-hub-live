import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Target,
  Plus,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileEdit,
  Users,
  ChevronDown,
  ChevronRight,
  User,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { FeatureGate } from "@/components/FeatureGate";

interface AssessmentFamily {
  id: string;
  name: string;
  description: string | null;
  slug: string;
}

interface Assessment {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  rating_scale: number;
  program_id: string | null;
  feature_key: string | null;
  family_id: string | null;
  programs: { id: string; name: string } | null;
  assessment_families: AssessmentFamily | null;
}

interface Snapshot {
  id: string;
  assessment_id: string;
  title: string | null;
  completed_at: string | null;
  created_at: string;
  status: string;
  is_self_assessment: boolean;
  evaluator_id: string | null;
  notes: string | null;
  evaluator?: { name: string | null } | null;
}

export default function CapabilityAssessments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  // Fetch assessment families
  const { data: families } = useQuery({
    queryKey: ["assessment-families-client"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_families")
        .select("id, name, description, slug")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as AssessmentFamily[];
    },
  });

  // Fetch available assessments with family info
  // Only show assessments where mode allows self-assessment
  const { data: assessments, isLoading: assessmentsLoading } = useQuery({
    queryKey: ["capability-assessments-client"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select(
          `
          id,
          name,
          description,
          slug,
          is_public,
          rating_scale,
          program_id,
          feature_key,
          family_id,
          assessment_mode,
          programs:program_id (id, name),
          assessment_families:family_id (id, name, description, slug)
        `,
        )
        .eq("is_active", true)
        .in("assessment_mode", ["self", "both"])
        .order("name");

      if (error) throw error;
      return data as (Assessment & { assessment_mode: string })[];
    },
  });

  // Fetch user's active program enrollments to check program-based access
  const { data: userEnrollments } = useQuery({
    queryKey: ["user-enrollments-programs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("client_enrollments")
        .select("program_id")
        .eq("client_user_id", user.id)
        .eq("status", "active");
      if (error) throw error;
      return data?.map((e) => e.program_id) || [];
    },
    enabled: !!user,
  });

  // Fetch user's snapshots - both self and evaluator assessments
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ["my-capability-snapshots-all"],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          id,
          assessment_id,
          title,
          completed_at,
          created_at,
          status,
          is_self_assessment,
          evaluator_id,
          notes
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch evaluator names separately if needed
      const snapshotsWithEvaluators = await Promise.all(
        data.map(async (s) => {
          if (s.evaluator_id) {
            const { data: evaluator } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", s.evaluator_id)
              .single();
            return { ...s, evaluator };
          }
          return { ...s, evaluator: null };
        }),
      );

      return snapshotsWithEvaluators as Snapshot[];
    },
    enabled: !!user,
  });

  const getSnapshotsForAssessment = (assessmentId: string, selfOnly?: boolean) => {
    return (
      snapshots?.filter((s) => {
        const matchAssessment = s.assessment_id === assessmentId && s.status === "completed";
        if (selfOnly !== undefined) {
          return matchAssessment && s.is_self_assessment === selfOnly;
        }
        return matchAssessment;
      }) || []
    );
  };

  const getLatestSnapshot = (assessmentId: string, selfOnly?: boolean) => {
    const assessmentSnapshots = getSnapshotsForAssessment(assessmentId, selfOnly);
    return assessmentSnapshots[0];
  };

  const getDraftForAssessment = (assessmentId: string) => {
    return snapshots?.find(
      (s) => s.assessment_id === assessmentId && s.status === "draft" && s.is_self_assessment,
    );
  };

  const toggleFamily = (familyId: string) => {
    setExpandedFamilies((prev) => ({ ...prev, [familyId]: !prev[familyId] }));
  };

  // Group assessments by family
  const groupedAssessments =
    assessments?.reduce(
      (acc, assessment) => {
        const familyId = assessment.family_id || "ungrouped";
        if (!acc[familyId]) {
          acc[familyId] = [];
        }
        acc[familyId].push(assessment);
        return acc;
      },
      {} as Record<string, Assessment[]>,
    ) || {};

  const renderAssessmentCard = (assessment: Assessment) => {
    const selfSnapshots = getSnapshotsForAssessment(assessment.id, true);
    const evaluatorSnapshots = getSnapshotsForAssessment(assessment.id, false);
    const latestSelfSnapshot = getLatestSnapshot(assessment.id, true);
    const latestEvalSnapshot = getLatestSnapshot(assessment.id, false);
    const draftSnapshot = getDraftForAssessment(assessment.id);
    const totalSnapshots = selfSnapshots.length + evaluatorSnapshots.length;

    const content = (
      <Card key={assessment.id} className="hover:border-primary/50 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{assessment.name}</CardTitle>
              <div className="flex flex-wrap gap-1 mt-1">
                {assessment.programs && (
                  <Badge variant="outline">{(assessment.programs as { name: string }).name}</Badge>
                )}
                {assessment.assessment_families && (
                  <Badge variant="secondary" className="text-xs">
                    {assessment.assessment_families.name}
                  </Badge>
                )}
              </div>
            </div>
            {totalSnapshots > 0 && (
              <Badge variant="secondary">
                {totalSnapshots} {totalSnapshots === 1 ? "result" : "results"}
              </Badge>
            )}
          </div>
          {assessment.description && (
            <CardDescription className="line-clamp-2 mt-2">
              {assessment.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Draft indicator */}
          {draftSnapshot && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <FileEdit className="h-4 w-4" />
              <span>Self-assessment draft in progress</span>
            </div>
          )}

          {/* Self-assessment status */}
          {selfSnapshots.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4 text-blue-500" />
              <span>
                {selfSnapshots.length} self-assessment{selfSnapshots.length !== 1 ? "s" : ""}
                {latestSelfSnapshot?.completed_at && (
                  <span className="ml-1">
                    (latest: {format(new Date(latestSelfSnapshot.completed_at), "MMM d, yyyy")})
                  </span>
                )}
              </span>
            </div>
          ) : (
            !draftSnapshot && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Self-assessment not started</span>
              </div>
            )
          )}

          {/* Evaluator assessment status */}
          {evaluatorSnapshots.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4 text-green-500" />
              <span>
                {evaluatorSnapshots.length} evaluator assessment
                {evaluatorSnapshots.length !== 1 ? "s" : ""}
                {latestEvalSnapshot?.completed_at && (
                  <span className="ml-1">
                    (latest: {format(new Date(latestEvalSnapshot.completed_at), "MMM d, yyyy")})
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              variant={draftSnapshot ? "outline" : "default"}
              onClick={() => navigate(`/assessments/capabilities/${assessment.id}`)}
            >
              {draftSnapshot ? (
                <>
                  <FileEdit className="mr-2 h-4 w-4" />
                  Resume Draft
                </>
              ) : totalSnapshots > 0 ? (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Progress
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Start Assessment
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );

    // If user has existing results, bypass the feature gate
    const hasExistingResults = totalSnapshots > 0 || draftSnapshot;

    // If assessment is linked to a program the user is enrolled in, grant access
    const isEnrolledInProgram =
      assessment.program_id && userEnrollments?.includes(assessment.program_id);

    // Wrap in FeatureGate if feature_key is set AND user has no existing results AND not enrolled in program
    if (assessment.feature_key && !hasExistingResults && !isEnrolledInProgram) {
      return (
        <FeatureGate
          key={assessment.id}
          featureKey={assessment.feature_key}
          fallback={
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{assessment.name}</CardTitle>
                    <Badge variant="outline" className="mt-1">
                      Premium
                    </Badge>
                  </div>
                </div>
                {assessment.description && (
                  <CardDescription className="line-clamp-2 mt-2">
                    {assessment.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/subscription")}
                >
                  Upgrade to Access
                </Button>
              </CardContent>
            </Card>
          }
        >
          {content}
        </FeatureGate>
      );
    }

    return content;
  };

  if (assessmentsLoading || snapshotsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const hasFamilies = families && families.length > 0;
  const ungroupedAssessments = groupedAssessments["ungrouped"] || [];
  const familyIds = Object.keys(groupedAssessments).filter((id) => id !== "ungrouped");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Capability Assessments</h1>
            <p className="text-muted-foreground">
              Track your growth through self-assessments and evaluator feedback
            </p>
          </div>
        </div>
      </div>

      {assessments && assessments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Assessments Available</h3>
            <p className="text-muted-foreground mt-2">
              Check back later for capability assessments.
            </p>
          </CardContent>
        </Card>
      ) : hasFamilies && familyIds.length > 0 ? (
        <div className="space-y-6">
          {/* Grouped by family */}
          {familyIds.map((familyId) => {
            const family = families?.find((f) => f.id === familyId);
            const familyAssessments = groupedAssessments[familyId];
            const isExpanded = expandedFamilies[familyId] !== false; // default expanded

            if (!family || !familyAssessments?.length) return null;

            return (
              <Collapsible
                key={familyId}
                open={isExpanded}
                onOpenChange={() => toggleFamily(familyId)}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 p-2 rounded-lg transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold">{family.name}</h2>
                    {family.description && (
                      <p className="text-sm text-muted-foreground">{family.description}</p>
                    )}
                  </div>
                  <Badge variant="outline">
                    {familyAssessments.length} assessment{familyAssessments.length !== 1 ? "s" : ""}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                    {familyAssessments.map((assessment) => renderAssessmentCard(assessment))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Ungrouped assessments */}
          {ungroupedAssessments.length > 0 && (
            <div className="space-y-4">
              {familyIds.length > 0 && <h2 className="text-xl font-semibold">Other Assessments</h2>}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ungroupedAssessments.map((assessment) => renderAssessmentCard(assessment))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assessments?.map((assessment) => renderAssessmentCard(assessment))}
        </div>
      )}
    </div>
  );
}
