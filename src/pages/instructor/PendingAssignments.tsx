import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  Filter,
  ClipboardCheck,
  Clock,
  User,
  BookOpen,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ClientFilterCombobox } from "@/components/instructor/ClientFilterCombobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { TransferAssignmentDialog } from "@/components/instructor/TransferAssignmentDialog";
import { ArrowRightLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Assignment {
  id: string;
  module_progress_id: string;
  assignment_type_id: string;
  assignment_type_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  scored_at: string | null;
  scored_by: string | null;
  scorer_name: string | null;
  overall_score: number | null;
  client_name: string;
  client_email: string;
  client_user_id: string;
  module_title: string;
  module_id: string;
  program_name: string;
  program_id: string;
  enrollment_id: string;
  days_pending: number;
}

type TabType = "pending" | "scored";

export default function PendingAssignments() {
  const { user, userRole, userRoles } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get("tab") as TabType) || "pending",
  );

  // Pending assignments state
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [filteredPendingAssignments, setFilteredPendingAssignments] = useState<Assignment[]>([]);

  // Scored assignments state
  const [scoredAssignments, setScoredAssignments] = useState<Assignment[]>([]);
  const [filteredScoredAssignments, setFilteredScoredAssignments] = useState<Assignment[]>([]);
  const [loadingScored, setLoadingScored] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "client" | "program">("date");
  const [scoredTimeFilter, setScoredTimeFilter] = useState<"7days" | "30days" | "90days" | "all">(
    "30days",
  );

  // My Queue state
  const [queueFilter, setQueueFilter] = useState<"all" | "mine">(
    (searchParams.get("queue") as "all" | "mine") || "all",
  );
  const [myEnrollmentPairs, setMyEnrollmentPairs] = useState<
    Set<string>
  >(new Set());
  const [loadingMyQueue, setLoadingMyQueue] = useState(false);

  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferAssignments, setTransferAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    if (user) {
      loadPendingAssignments();
      loadMyEnrollmentPairs();
      // Mark that the user has visited the assignments page (for staff onboarding card)
      try {
        localStorage.setItem("innotrue_staff_viewed_assignments", "true");
      } catch {
        // ignore storage errors
      }
    }
  }, [user, userRole]);

  const loadMyEnrollmentPairs = async () => {
    if (!user) return;
    try {
      setLoadingMyQueue(true);
      const { data } = await supabase
        .from("enrollment_module_staff")
        .select("enrollment_id, module_id")
        .eq("staff_user_id", user.id);

      if (data) {
        const pairs = new Set(data.map((d) => `${d.enrollment_id}:${d.module_id}`));
        setMyEnrollmentPairs(pairs);
      }
    } catch (error) {
      console.error("Error loading enrollment module staff:", error);
    } finally {
      setLoadingMyQueue(false);
    }
  };

  useEffect(() => {
    if (activeTab === "scored" && scoredAssignments.length === 0 && !loadingScored) {
      loadScoredAssignments();
    }
  }, [activeTab]);

  useEffect(() => {
    filterAndSortAssignments();
  }, [
    pendingAssignments,
    scoredAssignments,
    searchQuery,
    programFilter,
    clientFilter,
    sortBy,
    scoredTimeFilter,
    activeTab,
    queueFilter,
    myEnrollmentPairs,
  ]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("tab", tab);
      return params;
    });
  };

  const handleQueueFilterChange = (queue: "all" | "mine") => {
    setQueueFilter(queue);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (queue === "all") {
        params.delete("queue");
      } else {
        params.set("queue", queue);
      }
      return params;
    });
  };

  // Compute My Queue count for badge display
  const myQueueCount = myEnrollmentPairs.size > 0
    ? pendingAssignments.filter((a) =>
        myEnrollmentPairs.has(`${a.enrollment_id}:${a.module_id}`),
      ).length
    : 0;

  const getModuleIdsForUser = async () => {
    const showInstructor = userRole === "instructor";
    const showCoach = userRole === "coach";

    const programInstructorPromise =
      showInstructor && userRoles.includes("instructor") && user
        ? supabase.from("program_instructors").select("program_id").eq("instructor_id", user.id)
        : Promise.resolve({ data: [], error: null });

    const programCoachPromise =
      showCoach && userRoles.includes("coach") && user
        ? supabase.from("program_coaches").select("program_id").eq("coach_id", user.id)
        : Promise.resolve({ data: [], error: null });

    const moduleInstructorPromise =
      showInstructor && userRoles.includes("instructor") && user
        ? supabase.from("module_instructors").select("module_id").eq("instructor_id", user.id)
        : Promise.resolve({ data: [], error: null });

    const moduleCoachPromise =
      showCoach && userRoles.includes("coach") && user
        ? supabase.from("module_coaches").select("module_id").eq("coach_id", user.id)
        : Promise.resolve({ data: [], error: null });

    const [instructorPrograms, coachPrograms, instructorModules, coachModules] = await Promise.all([
      programInstructorPromise,
      programCoachPromise,
      moduleInstructorPromise,
      moduleCoachPromise,
    ]);

    const programIds = new Set([
      ...(instructorPrograms.data || []).map((p) => p.program_id),
      ...(coachPrograms.data || []).map((p) => p.program_id),
    ]);

    const moduleIds = new Set([
      ...(instructorModules.data || []).map((m) => m.module_id),
      ...(coachModules.data || []).map((m) => m.module_id),
    ]);

    if (programIds.size === 0 && moduleIds.size === 0) {
      return null;
    }

    let allModuleIds = new Set(moduleIds);
    if (programIds.size > 0) {
      const { data: programModules } = await supabase
        .from("program_modules")
        .select("id")
        .in("program_id", Array.from(programIds))
        .eq("is_active", true);

      programModules?.forEach((m) => allModuleIds.add(m.id));
    }

    return allModuleIds.size > 0 ? allModuleIds : null;
  };

  const loadPendingAssignments = async () => {
    try {
      setLoading(true);

      const allModuleIds = await getModuleIdsForUser();
      if (!allModuleIds) {
        setPendingAssignments([]);
        setLoading(false);
        return;
      }

      const { data: moduleProgressData } = await supabase
        .from("module_progress")
        .select(
          `
          id,
          enrollment_id,
          module_id,
          client_enrollments!inner(
            client_user_id,
            program_id,
            programs(name)
          ),
          program_modules!inner(
            title,
            program_id
          )
        `,
        )
        .in("module_id", Array.from(allModuleIds));

      if (!moduleProgressData || moduleProgressData.length === 0) {
        setPendingAssignments([]);
        setLoading(false);
        return;
      }

      const progressIds = moduleProgressData.map((mp) => mp.id);

      const { data: assignmentData, error: assignmentError } = await supabase
        .from("module_assignments")
        .select(
          `
          id,
          module_progress_id,
          assignment_type_id,
          status,
          created_at,
          updated_at,
          module_assignment_types(name)
        `,
        )
        .in("module_progress_id", progressIds)
        .in("status", ["submitted"]);

      if (assignmentError) throw assignmentError;

      if (!assignmentData || assignmentData.length === 0) {
        setPendingAssignments([]);
        setLoading(false);
        return;
      }

      const assignmentsList = await enrichAssignments(assignmentData, moduleProgressData, false);
      assignmentsList.sort((a, b) => b.days_pending - a.days_pending);

      setPendingAssignments(assignmentsList);
    } catch (error) {
      console.error("Error loading pending assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadScoredAssignments = async () => {
    try {
      setLoadingScored(true);

      const allModuleIds = await getModuleIdsForUser();
      if (!allModuleIds) {
        setScoredAssignments([]);
        setLoadingScored(false);
        return;
      }

      const { data: moduleProgressData } = await supabase
        .from("module_progress")
        .select(
          `
          id,
          enrollment_id,
          module_id,
          client_enrollments!inner(
            client_user_id,
            program_id,
            programs(name)
          ),
          program_modules!inner(
            title,
            program_id
          )
        `,
        )
        .in("module_id", Array.from(allModuleIds));

      if (!moduleProgressData || moduleProgressData.length === 0) {
        setScoredAssignments([]);
        setLoadingScored(false);
        return;
      }

      const progressIds = moduleProgressData.map((mp) => mp.id);

      // Get scored assignments (reviewed status with scored_at)
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("module_assignments")
        .select(
          `
          id,
          module_progress_id,
          assignment_type_id,
          status,
          created_at,
          updated_at,
          scored_at,
          scored_by,
          overall_score,
          module_assignment_types(name)
        `,
        )
        .in("module_progress_id", progressIds)
        .eq("status", "reviewed")
        .not("scored_at", "is", null)
        .order("scored_at", { ascending: false })
        .limit(200);

      if (assignmentError) throw assignmentError;

      if (!assignmentData || assignmentData.length === 0) {
        setScoredAssignments([]);
        setLoadingScored(false);
        return;
      }

      const assignmentsList = await enrichAssignments(assignmentData, moduleProgressData, true);
      setScoredAssignments(assignmentsList);
    } catch (error) {
      console.error("Error loading scored assignments:", error);
    } finally {
      setLoadingScored(false);
    }
  };

  const enrichAssignments = async (
    assignmentData: any[],
    moduleProgressData: any[],
    includeScorer: boolean,
  ): Promise<Assignment[]> => {
    const assignmentsList: Assignment[] = [];

    // Get unique client IDs and scorer IDs
    const clientIds = new Set<string>();
    const scorerIds = new Set<string>();

    for (const assignment of assignmentData) {
      const mp = moduleProgressData.find((m) => m.id === assignment.module_progress_id);
      if (mp) {
        const enrollment = mp.client_enrollments as any;
        clientIds.add(enrollment.client_user_id);
      }
      if (includeScorer && assignment.scored_by) {
        scorerIds.add(assignment.scored_by);
      }
    }

    // Batch fetch all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, username")
      .in("id", [...clientIds, ...scorerIds]);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    for (const assignment of assignmentData) {
      const mp = moduleProgressData.find((m) => m.id === assignment.module_progress_id);
      if (!mp) continue;

      const enrollment = mp.client_enrollments as any;
      const module = mp.program_modules as any;
      const profile = profileMap.get(enrollment.client_user_id);
      const scorer = assignment.scored_by ? profileMap.get(assignment.scored_by) : null;

      const now = new Date();
      const createdAt = new Date(assignment.created_at);
      const daysPending = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      assignmentsList.push({
        id: assignment.id,
        module_progress_id: assignment.module_progress_id,
        assignment_type_id: assignment.assignment_type_id,
        assignment_type_name: (assignment.module_assignment_types as any)?.name || "Unknown",
        status: assignment.status,
        created_at: assignment.created_at,
        updated_at: assignment.updated_at,
        scored_at: assignment.scored_at || null,
        scored_by: assignment.scored_by || null,
        scorer_name: scorer?.name || null,
        overall_score: assignment.overall_score ?? null,
        client_name: profile?.name || "Unknown",
        client_email: profile?.username || "",
        client_user_id: enrollment.client_user_id,
        module_title: module.title,
        module_id: mp.module_id,
        program_name: enrollment.programs?.name || "Unknown",
        program_id: enrollment.program_id,
        enrollment_id: mp.enrollment_id,
        days_pending: daysPending,
      });
    }

    return assignmentsList;
  };

  const filterAndSortAssignments = () => {
    const sourceAssignments = activeTab === "pending" ? pendingAssignments : scoredAssignments;
    let filtered = [...sourceAssignments];

    // My Queue filter — only show assignments for personally-assigned clients
    if (queueFilter === "mine" && myEnrollmentPairs.size > 0) {
      filtered = filtered.filter((a) =>
        myEnrollmentPairs.has(`${a.enrollment_id}:${a.module_id}`),
      );
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.client_name.toLowerCase().includes(query) ||
          a.module_title.toLowerCase().includes(query) ||
          a.program_name.toLowerCase().includes(query) ||
          a.assignment_type_name.toLowerCase().includes(query),
      );
    }

    // Program filter
    if (programFilter !== "all") {
      filtered = filtered.filter((a) => a.program_id === programFilter);
    }

    // Client filter
    if (clientFilter !== "all") {
      filtered = filtered.filter((a) => a.client_user_id === clientFilter);
    }

    // Time filter for scored assignments
    if (activeTab === "scored" && scoredTimeFilter !== "all") {
      const now = new Date();
      let cutoff: Date;
      switch (scoredTimeFilter) {
        case "7days":
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30days":
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90days":
          cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }
      filtered = filtered.filter((a) => a.scored_at && new Date(a.scored_at) >= cutoff);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          if (activeTab === "scored") {
            return new Date(b.scored_at || 0).getTime() - new Date(a.scored_at || 0).getTime();
          }
          return b.days_pending - a.days_pending;
        case "client":
          return a.client_name.localeCompare(b.client_name);
        case "program":
          return a.program_name.localeCompare(b.program_name);
        default:
          return 0;
      }
    });

    if (activeTab === "pending") {
      setFilteredPendingAssignments(filtered);
    } else {
      setFilteredScoredAssignments(filtered);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      submitted: "default",
      reviewed: "secondary",
    };
    const labels: Record<string, string> = {
      submitted: "Submitted",
      reviewed: "Reviewed",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  const getUrgencyBadge = (days: number) => {
    if (days >= 7) {
      return <Badge variant="destructive">{days} days</Badge>;
    }
    if (days >= 3) {
      return <Badge variant="default">{days} days</Badge>;
    }
    if (days >= 1) {
      return (
        <Badge variant="secondary">
          {days} day{days > 1 ? "s" : ""}
        </Badge>
      );
    }
    return <Badge variant="outline">Today</Badge>;
  };

  if (loading) {
    return <PageLoadingState />;
  }

  const allAssignments = [...pendingAssignments, ...scoredAssignments];
  const uniquePrograms = Array.from(
    new Map(
      allAssignments.map((a) => [a.program_id, { id: a.program_id, name: a.program_name }]),
    ).values(),
  );
  const uniqueClients = Array.from(
    new Map(
      allAssignments.map((a) => [a.client_user_id, { id: a.client_user_id, name: a.client_name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const currentAssignments =
    activeTab === "pending" ? filteredPendingAssignments : filteredScoredAssignments;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Assignments</h1>
        <p className="text-muted-foreground">
          Review pending and scored client assignments from your assigned programs and modules
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {pendingAssignments.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingAssignments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scored" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Scored
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          {/* Queue Toggle - only show when user has personal assignments */}
          {myEnrollmentPairs.size > 0 && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-lg border bg-card p-1">
                <button
                  onClick={() => handleQueueFilterChange("all")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    queueFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Assignments
                  <Badge variant={queueFilter === "all" ? "secondary" : "outline"} className="ml-1 text-xs">
                    {pendingAssignments.length}
                  </Badge>
                </button>
                <button
                  onClick={() => handleQueueFilterChange("mine")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    queueFilter === "mine"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  My Queue
                  <Badge variant={queueFilter === "mine" ? "secondary" : "outline"} className="ml-1 text-xs">
                    {myQueueCount}
                  </Badge>
                </button>
              </div>
              {queueFilter === "mine" && (
                <p className="text-xs text-muted-foreground">
                  Showing only assignments from your personally assigned clients
                </p>
              )}
            </div>
          )}

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingAssignments.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Assignments awaiting review</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue (7+ days)</CardTitle>
                <Clock className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {pendingAssignments.filter((a) => a.days_pending >= 7).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Need immediate attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Due Soon (3-6 days)</CardTitle>
                <Calendar className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {
                    pendingAssignments.filter((a) => a.days_pending >= 3 && a.days_pending < 7)
                      .length
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-1">Review soon</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent (&lt;3 days)</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {pendingAssignments.filter((a) => a.days_pending < 3).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recently submitted</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients, modules, assignments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ClientFilterCombobox
                  clients={uniqueClients}
                  value={clientFilter}
                  onChange={setClientFilter}
                />

                <Select value={programFilter} onValueChange={setProgramFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {uniquePrograms.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Days Pending</SelectItem>
                    <SelectItem value="client">Client Name</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Pending Assignments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Assignments ({filteredPendingAssignments.length})</CardTitle>
              <CardDescription>Click on an assignment to review and score it</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredPendingAssignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {pendingAssignments.length === 0
                    ? "No assignments waiting for review. When your students submit work, it will appear here for grading."
                    : "No assignments match your current filters. Try adjusting your search or filter criteria."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Assignment Type</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Days Pending</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPendingAssignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{assignment.client_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {assignment.client_email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ClipboardCheck className="h-4 w-4 text-primary" />
                              <span>{assignment.assignment_type_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{assignment.module_title}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{assignment.program_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                          <TableCell>{getUrgencyBadge(assignment.days_pending)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(assignment.created_at).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    `/teaching/students/${assignment.enrollment_id}?moduleId=${assignment.module_id}&moduleProgressId=${assignment.module_progress_id}`,
                                  )
                                }
                              >
                                Review
                              </Button>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setTransferAssignments([assignment]);
                                        setTransferDialogOpen(true);
                                      }}
                                    >
                                      <ArrowRightLeft className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Transfer to another instructor/coach</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transfer Dialog */}
          <TransferAssignmentDialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            assignments={transferAssignments}
            onTransferComplete={() => {
              loadPendingAssignments();
              loadMyEnrollmentPairs();
            }}
          />
        </TabsContent>

        <TabsContent value="scored" className="space-y-6">
          {/* Filters for Scored */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients, modules, assignments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ClientFilterCombobox
                  clients={uniqueClients}
                  value={clientFilter}
                  onChange={setClientFilter}
                />

                <Select value={programFilter} onValueChange={setProgramFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {uniquePrograms.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={scoredTimeFilter}
                  onValueChange={(value: any) => setScoredTimeFilter(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Time Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date Scored</SelectItem>
                    <SelectItem value="client">Client Name</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Scored Assignments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Scored Assignments ({filteredScoredAssignments.length})</CardTitle>
              <CardDescription>Previously reviewed and scored assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingScored ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredScoredAssignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {scoredAssignments.length === 0
                    ? "No scored assignments found"
                    : "No assignments match your filters"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Assignment Type</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Scored By</TableHead>
                        <TableHead>Scored At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScoredAssignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{assignment.client_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {assignment.client_email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ClipboardCheck className="h-4 w-4 text-primary" />
                              <span>{assignment.assignment_type_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{assignment.module_title}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{assignment.program_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {assignment.overall_score !== null ? (
                              <Badge variant="secondary">{assignment.overall_score}%</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{assignment.scorer_name || "Unknown"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {assignment.scored_at
                                ? formatDistanceToNow(new Date(assignment.scored_at), {
                                    addSuffix: true,
                                  })
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  `/teaching/students/${assignment.enrollment_id}?moduleId=${assignment.module_id}&moduleProgressId=${assignment.module_progress_id}`,
                                )
                              }
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
