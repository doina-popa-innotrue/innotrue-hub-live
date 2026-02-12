import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  User,
  Calendar,
  Eye,
  ChevronRight,
  Loader2,
  UserCheck,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CapabilitySnapshotView } from "@/components/capabilities/CapabilitySnapshotView";

interface SharedSnapshot {
  id: string;
  title: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  status: string;
  is_self_assessment: boolean;
  shared_with_coach: boolean;
  shared_with_instructor: boolean;
  user_id: string;
  evaluator_id: string | null;
  assessment_id: string;
  capability_assessments: {
    id: string;
    name: string;
    slug: string;
    rating_scale: number;
  };
  profiles: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  capability_snapshot_ratings: Array<{
    id: string;
    question_id: string;
    rating: number;
    question_text_snapshot: string | null;
    domain_name_snapshot: string | null;
  }>;
  capability_domain_notes: Array<{
    id: string;
    domain_id: string;
    content: string;
  }>;
  capability_question_notes: Array<{
    id: string;
    question_id: string;
    content: string;
  }>;
}

interface ClientInfo {
  id: string;
  name: string;
  avatar_url: string | null;
}

export default function SharedAssessments() {
  const { user, userRoles } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"shared" | "given">("shared");
  const [viewingSnapshot, setViewingSnapshot] = useState<SharedSnapshot | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("all");

  const isCoach = userRoles.includes("coach");
  const isInstructor = userRoles.includes("instructor");

  // Fetch clients assigned to this coach/instructor
  const { data: assignedClients } = useQuery({
    queryKey: ["assigned-clients", user?.id, isCoach, isInstructor],
    queryFn: async () => {
      if (!user) return [];

      const [coachClients, instructorClients] = await Promise.all([
        isCoach
          ? supabase.from("client_coaches").select("client_id").eq("coach_id", user.id)
          : Promise.resolve({ data: [] }),
        isInstructor
          ? supabase.from("client_instructors").select("client_id").eq("instructor_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      const coachClientIds = (coachClients.data || []).map((c: any) => c.client_id);
      const instructorClientIds = (instructorClients.data || []).map((c: any) => c.client_id);
      const allClientIds = [...new Set([...coachClientIds, ...instructorClientIds])];

      if (allClientIds.length === 0) return [];

      // Fetch client profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", allClientIds)
        .order("name");

      return (profiles || []) as ClientInfo[];
    },
    enabled: !!user && (isCoach || isInstructor),
  });

  // Fetch assessments shared with this coach/instructor
  const { data: sharedAssessments, isLoading: sharedLoading } = useQuery({
    queryKey: ["shared-assessments", user?.id, isCoach, isInstructor],
    queryFn: async () => {
      if (!user) return [];

      // Get clients assigned to this coach/instructor
      const [coachClients, instructorClients] = await Promise.all([
        isCoach
          ? supabase.from("client_coaches").select("client_id").eq("coach_id", user.id)
          : Promise.resolve({ data: [] }),
        isInstructor
          ? supabase.from("client_instructors").select("client_id").eq("instructor_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      const coachClientIds = (coachClients.data || []).map((c: any) => c.client_id);
      const instructorClientIds = (instructorClients.data || []).map((c: any) => c.client_id);

      // Combine unique client IDs
      const allClientIds = [...new Set([...coachClientIds, ...instructorClientIds])];

      if (allClientIds.length === 0) return [];

      // Build the filter for shared assessments
      let query = supabase
        .from("capability_snapshots")
        .select(
          `
          id,
          title,
          notes,
          completed_at,
          created_at,
          status,
          is_self_assessment,
          shared_with_coach,
          shared_with_instructor,
          user_id,
          evaluator_id,
          assessment_id,
          capability_assessments!inner(id, name, slug, rating_scale),
          profiles!capability_snapshots_user_id_fkey(id, name, avatar_url),
          capability_snapshot_ratings(id, question_id, rating, question_text_snapshot, domain_name_snapshot),
          capability_domain_notes(id, domain_id, content),
          capability_question_notes(id, question_id, content)
        `,
        )
        .eq("status", "completed")
        .in("user_id", allClientIds);

      // Filter based on sharing preferences
      if (isCoach && isInstructor) {
        query = query.or("shared_with_coach.eq.true,shared_with_instructor.eq.true");
      } else if (isCoach) {
        query = query.eq("shared_with_coach", true);
      } else if (isInstructor) {
        query = query.eq("shared_with_instructor", true);
      }

      const { data, error } = await query.order("completed_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SharedSnapshot[];
    },
    enabled: !!user && (isCoach || isInstructor),
  });

  // Fetch assessments given by this coach/instructor
  const { data: givenAssessments, isLoading: givenLoading } = useQuery({
    queryKey: ["given-assessments", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          id,
          title,
          notes,
          completed_at,
          created_at,
          status,
          is_self_assessment,
          shared_with_coach,
          shared_with_instructor,
          user_id,
          evaluator_id,
          assessment_id,
          capability_assessments!inner(id, name, slug, rating_scale),
          profiles!capability_snapshots_user_id_fkey(id, name, avatar_url),
          capability_snapshot_ratings(id, question_id, rating, question_text_snapshot, domain_name_snapshot),
          capability_domain_notes(id, domain_id, content),
          capability_question_notes(id, question_id, content)
        `,
        )
        .eq("evaluator_id", user.id)
        .eq("is_self_assessment", false)
        .order("completed_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data || []) as unknown as SharedSnapshot[];
    },
    enabled: !!user,
  });

  // Extract unique assessment types from both lists for the filter
  const assessmentTypes = useMemo(() => {
    const allSnapshots = [...(sharedAssessments || []), ...(givenAssessments || [])];
    const typesMap = new Map<string, { id: string; name: string }>();
    allSnapshots.forEach((s) => {
      if (s.capability_assessments?.id) {
        typesMap.set(s.capability_assessments.id, {
          id: s.capability_assessments.id,
          name: s.capability_assessments.name,
        });
      }
    });
    return Array.from(typesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sharedAssessments, givenAssessments]);

  // Filter assessments by selected client and assessment type
  const filteredSharedAssessments = useMemo(() => {
    if (!sharedAssessments) return [];
    return sharedAssessments.filter((s) => {
      const clientMatch = selectedClientId === "all" || s.user_id === selectedClientId;
      const assessmentMatch =
        selectedAssessmentId === "all" || s.assessment_id === selectedAssessmentId;
      return clientMatch && assessmentMatch;
    });
  }, [sharedAssessments, selectedClientId, selectedAssessmentId]);

  const filteredGivenAssessments = useMemo(() => {
    if (!givenAssessments) return [];
    return givenAssessments.filter((s) => {
      const clientMatch = selectedClientId === "all" || s.user_id === selectedClientId;
      const assessmentMatch =
        selectedAssessmentId === "all" || s.assessment_id === selectedAssessmentId;
      return clientMatch && assessmentMatch;
    });
  }, [givenAssessments, selectedClientId, selectedAssessmentId]);

  const hasActiveFilters = selectedClientId !== "all" || selectedAssessmentId !== "all";

  const clearAllFilters = () => {
    setSelectedClientId("all");
    setSelectedAssessmentId("all");
  };

  const getAverageScore = (snapshot: SharedSnapshot) => {
    const ratings = snapshot.capability_snapshot_ratings || [];
    if (ratings.length === 0) return null;
    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    return (total / ratings.length).toFixed(1);
  };

  const renderAssessmentCard = (snapshot: SharedSnapshot, type: "shared" | "given") => {
    const avgScore = getAverageScore(snapshot);
    const assessment = snapshot.capability_assessments;
    const profile = snapshot.profiles;

    return (
      <Card key={snapshot.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{profile?.name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{profile?.name || "Unknown"}</p>
                  {type === "given" && (
                    <Badge variant="secondary" className="shrink-0">
                      <UserCheck className="h-3 w-3 mr-1" />
                      You evaluated
                    </Badge>
                  )}
                  {type === "shared" && snapshot.is_self_assessment && (
                    <Badge variant="outline" className="shrink-0">
                      <User className="h-3 w-3 mr-1" />
                      Self-assessment
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">{assessment?.name}</p>
                {snapshot.title && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">"{snapshot.title}"</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {snapshot.completed_at
                      ? format(new Date(snapshot.completed_at), "MMM d, yyyy")
                      : "Draft"}
                  </span>
                  {avgScore && (
                    <Badge variant="outline" className="text-xs">
                      Avg: {avgScore}/{assessment?.rating_scale}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setViewingSnapshot(snapshot)}>
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/capabilities/${assessment.id}?snapshotId=${snapshot.id}`)}
              >
                Go to Assessment
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Assessments</h1>
        </div>
        <p className="text-muted-foreground">
          View capability assessments shared by clients and evaluations you've given
        </p>
      </div>

      {/* Filters */}
      {(assignedClients && assignedClients.length > 0) || assessmentTypes.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />

          {/* Client Filter */}
          {assignedClients && assignedClients.length > 0 && (
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {assignedClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={client.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {client.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      {client.name || "Unknown"}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Assessment Type Filter */}
          {assessmentTypes.length > 0 && (
            <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Filter by assessment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assessments</SelectItem>
                {assessmentTypes.map((assessment) => (
                  <SelectItem key={assessment.id} value={assessment.id}>
                    {assessment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "shared" | "given")}>
        <TabsList className="mb-6">
          <TabsTrigger value="shared" className="gap-2">
            <User className="h-4 w-4" />
            Shared with me
            {filteredSharedAssessments.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {filteredSharedAssessments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="given" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Evaluations I gave
            {filteredGivenAssessments.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {filteredGivenAssessments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shared">
          {sharedLoading ? (
            <Card>
              <CardContent className="py-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : filteredSharedAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {hasActiveFilters ? "No matching assessments" : "No shared assessments yet"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters
                    ? "Try adjusting your filters to see more results"
                    : "Clients will share their capability assessments with you for review and feedback"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSharedAssessments.map((snapshot) =>
                renderAssessmentCard(snapshot, "shared"),
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="given">
          {givenLoading ? (
            <Card>
              <CardContent className="py-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : filteredGivenAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UserCheck className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {hasActiveFilters ? "No matching evaluations" : "No evaluations given yet"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters
                    ? "Try adjusting your filters to see more results"
                    : "Evaluations you give to clients will appear here"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredGivenAssessments.map((snapshot) => renderAssessmentCard(snapshot, "given"))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* View Snapshot Dialog */}
      <Dialog open={!!viewingSnapshot} onOpenChange={(open) => !open && setViewingSnapshot(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Assessment Details
            </DialogTitle>
          </DialogHeader>
          {viewingSnapshot && (
            <CapabilitySnapshotView
              snapshot={{
                ...viewingSnapshot,
                completed_at: viewingSnapshot.completed_at || viewingSnapshot.created_at,
              }}
              assessment={{
                id: viewingSnapshot.capability_assessments.id,
                name: viewingSnapshot.capability_assessments.name,
                rating_scale: viewingSnapshot.capability_assessments.rating_scale,
                capability_domains: [],
              }}
              compact={false}
              isEvaluatorAssessment={!viewingSnapshot.is_self_assessment}
              evaluatorName={viewingSnapshot.evaluator_id === user?.id ? "You" : undefined}
              canAddDevelopmentItems={true}
              forUserId={viewingSnapshot.user_id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
