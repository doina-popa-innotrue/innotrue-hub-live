import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
  ClipboardList,
  Clock,
  Circle,
  BookOpen,
  Send,
  CheckCircle,
  ChevronRight,
  Lightbulb,
  Target,
} from "lucide-react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { PageLoadingState } from "@/components/ui/page-loading-state";

interface Assignment {
  id: string;
  module_progress_id: string;
  assignment_type_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  scored_at: string | null;
  overall_score: number | null;
  module_title: string;
  module_id: string;
  program_name: string;
  program_id: string;
  enrollment_id: string;
  type: "module" | "scenario" | "assessment";
  scenario_assignment_id?: string;
  assessment_id?: string;
}

type TabType = "pending" | "submitted" | "reviewed";

const PAGE_SIZE = 25;

export default function ClientAssignments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get("tab") as TabType) || "pending",
  );
  const [page, setPage] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");

  const resetPage = () => setPage(0);

  const { data: assignments = [], isLoading: loading } = useQuery({
    queryKey: ["client-assignments", user.id],
    queryFn: async () => {
      // Get the user's enrollments
      const { data: enrollments, error: enrollmentError } = await supabase
        .from("client_enrollments")
        .select(
          `
          id,
          program_id,
          programs(name)
        `,
        )
        .eq("client_user_id", user.id)
        .eq("status", "active");

      if (enrollmentError) throw enrollmentError;
      if (!enrollments || enrollments.length === 0) return [];

      const enrollmentIds = enrollments.map((e) => e.id);
      const programIds = enrollments.map((e) => e.program_id);

      // Get module progress + ALL program modules in parallel
      const [progressResult, modulesResult] = await Promise.all([
        supabase
          .from("module_progress")
          .select(
            `
            id,
            enrollment_id,
            module_id,
            program_modules(title, program_id)
          `,
          )
          .in("enrollment_id", enrollmentIds),
        supabase
          .from("program_modules")
          .select("id, title, program_id, order_index, capability_assessment_id, capability_assessments(id, name)")
          .in("program_id", programIds),
      ]);

      if (progressResult.error) throw progressResult.error;
      if (modulesResult.error) throw modulesResult.error;

      const progressData = progressResult.data || [];
      const allModules = modulesResult.data || [];
      const progressIds = progressData.map((p) => p.id);
      const allModuleIds = allModules.map((m) => m.id);

      // Get started assignments + scenario assignments + all assignment configs in parallel
      const queries: [
        ReturnType<typeof supabase.from>,
        ReturnType<typeof supabase.from>,
        ReturnType<typeof supabase.from>,
      ] = [] as any;

      const [assignmentResult, scenarioResult, configsResult] = await Promise.all([
        progressIds.length > 0
          ? supabase
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
                overall_score,
                module_assignment_types(name)
              `,
              )
              .in("module_progress_id", progressIds)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase
          .from("scenario_assignments")
          .select(
            `
            id,
            template_id,
            module_id,
            status,
            created_at,
            updated_at,
            evaluated_at,
            enrollment_id,
            scenario_templates(title),
            program_modules(id, title, program_id)
          `,
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        allModuleIds.length > 0
          ? supabase
              .from("module_assignment_configs")
              .select("module_id, assignment_type_id, module_assignment_types(id, name)")
              .in("module_id", allModuleIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (assignmentResult.error) throw assignmentResult.error;

      // Build a set of started assignment keys: "moduleProgressId:assignmentTypeId"
      const startedKeys = new Set<string>();
      // Also track started assignments by module: "moduleId:assignmentTypeId"
      const startedModuleKeys = new Set<string>();

      // Combine the module assignment data (started ones)
      const moduleAssignmentsList: Assignment[] = (assignmentResult.data || []).map(
        (assignment) => {
          const progress = progressData.find((p) => p.id === assignment.module_progress_id);
          const enrollment = enrollments.find((e) => e.id === progress?.enrollment_id);
          const mod = progress?.program_modules as any;

          startedKeys.add(`${assignment.module_progress_id}:${assignment.assignment_type_id}`);
          if (progress?.module_id) {
            startedModuleKeys.add(`${progress.module_id}:${assignment.assignment_type_id}`);
          }

          return {
            id: assignment.id,
            module_progress_id: assignment.module_progress_id,
            assignment_type_name:
              (assignment.module_assignment_types as any)?.name || "Assignment",
            status: assignment.status,
            created_at: assignment.created_at,
            updated_at: assignment.updated_at,
            scored_at: assignment.scored_at,
            overall_score: assignment.overall_score ?? null,
            module_title: mod?.title || "Unknown Module",
            module_id: progress?.module_id || "",
            program_name: (enrollment?.programs as any)?.name || "Unknown Program",
            program_id: enrollment?.program_id || "",
            enrollment_id: progress?.enrollment_id || "",
            type: "module" as const,
          };
        },
      );

      // Discover unstarted assignments from module configs
      const unstartedAssignments: Assignment[] = [];
      if (!configsResult.error && configsResult.data) {
        for (const config of configsResult.data) {
          const moduleId = config.module_id;
          const typeId = config.assignment_type_id;

          // Skip if client already has a module_assignment for this config
          if (startedModuleKeys.has(`${moduleId}:${typeId}`)) continue;

          const mod = allModules.find((m) => m.id === moduleId);
          if (!mod) continue;

          const enrollment = enrollments.find((e) => e.program_id === mod.program_id);
          if (!enrollment) continue;

          const typeName = (config.module_assignment_types as any)?.name || "Assignment";

          unstartedAssignments.push({
            id: `unstarted-${moduleId}-${typeId}`,
            module_progress_id: "",
            assignment_type_name: typeName,
            status: "not_started",
            created_at: "",
            updated_at: "",
            scored_at: null,
            overall_score: null,
            module_title: mod.title,
            module_id: moduleId,
            program_name: (enrollment.programs as any)?.name || "Unknown Program",
            program_id: mod.program_id,
            enrollment_id: enrollment.id,
            type: "module" as const,
          });
        }
      }

      if (scenarioResult.error) {
        console.error("Error loading scenario assignments:", scenarioResult.error);
      }

      // Map scenario assignments to the common Assignment interface
      // Filter out peer-session scenarios (no enrollment) — those are managed from the group session page
      // Deduplicate by (template_id, module_id): query is ordered by updated_at DESC,
      // so first occurrence per key is the most recent (handles duplicate starts + revisions)
      const seenScenarioKeys = new Set<string>();
      const scenarioAssignmentsList: Assignment[] = (scenarioResult.data || [])
        .filter((sa) => sa.enrollment_id || sa.module_id)
        .filter((sa) => {
          const key = `${sa.template_id}:${sa.module_id || ""}`;
          if (seenScenarioKeys.has(key)) return false;
          seenScenarioKeys.add(key);
          return true;
        })
        .map((sa) => {
        const enrollment = enrollments.find((e) => e.id === sa.enrollment_id);
        const scenarioModule = sa.program_modules as any;
        let mappedStatus = sa.status;
        if (sa.status === "evaluated") mappedStatus = "reviewed";

        const templateTitle = (sa.scenario_templates as any)?.title || "Untitled Scenario";
        // If linked to a module, show module title; otherwise show template title
        const moduleTitle = scenarioModule?.title || templateTitle;
        // Derive program from the module join or fall back to enrollment
        const moduleProgramId = scenarioModule?.program_id || enrollment?.program_id || "";
        const moduleProgramName =
          enrollments.find((e) => e.program_id === moduleProgramId)?.programs;

        return {
          id: sa.id,
          module_progress_id: "",
          assignment_type_name: `Scenario: ${templateTitle}`,
          status: mappedStatus,
          created_at: sa.created_at,
          updated_at: sa.updated_at,
          scored_at: sa.evaluated_at,
          overall_score: null as number | null,
          module_title: moduleTitle,
          module_id: sa.module_id || "",
          program_name: (moduleProgramName as any)?.name || (enrollment?.programs as any)?.name || "Unknown Program",
          program_id: moduleProgramId,
          enrollment_id: sa.enrollment_id || "",
          type: "scenario" as const,
          scenario_assignment_id: sa.id,
        };
      });

      // Build module-linked assessment tasks from modules with capability_assessment_id
      const assessmentAssignments: Assignment[] = [];
      const modulesWithAssessment = allModules.filter(
        (m: any) => m.capability_assessment_id,
      );

      if (modulesWithAssessment.length > 0) {
        const assessmentIds = [
          ...new Set(modulesWithAssessment.map((m: any) => m.capability_assessment_id as string)),
        ];

        // Check user's completion status via capability_snapshots
        const { data: snapshots } = await supabase
          .from("capability_snapshots")
          .select("id, assessment_id, status, completed_at, is_self_assessment")
          .eq("user_id", user.id)
          .eq("is_self_assessment", true)
          .in("assessment_id", assessmentIds);

        const snapshotsByAssessment = new Map<string, any[]>();
        (snapshots || []).forEach((s) => {
          const existing = snapshotsByAssessment.get(s.assessment_id) || [];
          existing.push(s);
          snapshotsByAssessment.set(s.assessment_id, existing);
        });

        // Deduplicate by capability_assessment_id — multiple modules may share the
        // same assessment; show one entry per unique assessment, using the first module
        // (by order_index) as the display context.
        const seenAssessmentIds = new Set<string>();
        const sortedModules = [...modulesWithAssessment].sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
        );

        for (const mod of sortedModules) {
          const modAny = mod as any;
          const assessmentId = modAny.capability_assessment_id as string;
          if (seenAssessmentIds.has(assessmentId)) continue;
          seenAssessmentIds.add(assessmentId);

          const enrollment = enrollments.find((e) => e.program_id === modAny.program_id);
          if (!enrollment) continue;

          const assessmentSnapshots = snapshotsByAssessment.get(assessmentId) || [];
          const hasCompleted = assessmentSnapshots.some((s: any) => s.status === "completed");
          const hasDraft = assessmentSnapshots.some((s: any) => s.status === "draft");

          let status = "not_started";
          let updatedAt = "";
          if (hasCompleted) {
            status = "reviewed";
            const latestCompleted = assessmentSnapshots
              .filter((s: any) => s.status === "completed")
              .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];
            updatedAt = latestCompleted?.completed_at || "";
          } else if (hasDraft) {
            status = "in_progress";
          }

          const assessmentName = modAny.capability_assessments?.name || "Assessment";

          assessmentAssignments.push({
            id: `assessment-${modAny.id}-${assessmentId}`,
            module_progress_id: "",
            assignment_type_name: `Self-Assessment: ${assessmentName}`,
            status,
            created_at: "",
            updated_at: updatedAt,
            scored_at: null,
            overall_score: null,
            module_title: modAny.title,
            module_id: modAny.id,
            program_name: (enrollment.programs as any)?.name || "Unknown Program",
            program_id: modAny.program_id,
            enrollment_id: enrollment.id,
            type: "assessment" as const,
            assessment_id: assessmentId,
          });
        }
      }

      // Combine all lists: started first (sorted by updated_at), then unstarted (sorted by program + module order)
      const startedAssignments = [...moduleAssignmentsList, ...scenarioAssignmentsList];
      startedAssignments.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

      // Separate assessment items by status
      const startedAssessments = assessmentAssignments.filter(
        (a) => a.status !== "not_started",
      );
      const unstartedAssessments = assessmentAssignments.filter(
        (a) => a.status === "not_started",
      );

      // Sort unstarted by program name then module order
      const allUnstarted = [...unstartedAssignments, ...unstartedAssessments];
      allUnstarted.sort((a, b) => {
        if (a.program_name !== b.program_name) return a.program_name.localeCompare(b.program_name);
        const aOrder = allModules.find((m) => m.id === a.module_id)?.order_index ?? 0;
        const bOrder = allModules.find((m) => m.id === b.module_id)?.order_index ?? 0;
        return aOrder - bOrder;
      });

      return [...startedAssignments, ...startedAssessments, ...allUnstarted];
    },
    enabled: !!user,
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    setSearchParams({ tab });
    resetPage();
  };

  const filteredAssignments = useMemo(() => {
    let filtered = [...assignments];

    // Filter by tab status
    switch (activeTab) {
      case "pending":
        filtered = filtered.filter(
          (a) => a.status === "not_started" || a.status === "draft" || a.status === "in_progress",
        );
        break;
      case "submitted":
        filtered = filtered.filter((a) => a.status === "submitted");
        break;
      case "reviewed":
        filtered = filtered.filter((a) => a.status === "reviewed");
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.module_title.toLowerCase().includes(query) ||
          a.program_name.toLowerCase().includes(query) ||
          a.assignment_type_name.toLowerCase().includes(query),
      );
    }

    // Program filter
    if (programFilter !== "all") {
      filtered = filtered.filter((a) => a.program_id === programFilter);
    }

    return filtered;
  }, [assignments, activeTab, searchQuery, programFilter]);

  const totalPages = Math.ceil(filteredAssignments.length / PAGE_SIZE);
  const paginatedAssignments = filteredAssignments.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 2) pages.push("ellipsis");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++)
        pages.push(i);
      if (page < totalPages - 3) pages.push("ellipsis");
      pages.push(totalPages - 1);
    }
    return pages;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "outline"; label: string; icon: React.ReactNode }
    > = {
      not_started: {
        variant: "outline",
        label: "Not Started",
        icon: <Circle className="h-3 w-3" />,
      },
      draft: { variant: "outline", label: "Draft", icon: <Clock className="h-3 w-3" /> },
      in_progress: {
        variant: "secondary",
        label: "In Progress",
        icon: <Clock className="h-3 w-3" />,
      },
      submitted: { variant: "default", label: "Submitted", icon: <Send className="h-3 w-3" /> },
      reviewed: {
        variant: "secondary",
        label: "Reviewed",
        icon: <CheckCircle className="h-3 w-3" />,
      },
    };
    const c = config[status] || { variant: "outline" as const, label: status, icon: null };
    return (
      <Badge variant={c.variant} className="flex items-center gap-1">
        {c.icon}
        {c.label}
      </Badge>
    );
  };

  if (loading) {
    return <PageLoadingState />;
  }

  const uniquePrograms = Array.from(
    new Map(
      assignments
        .filter((a) => a.program_id) // exclude assignments without a program (safety)
        .map((a) => [a.program_id, { id: a.program_id, name: a.program_name }]),
    ).values(),
  );

  const pendingCount = assignments.filter(
    (a) => a.status === "not_started" || a.status === "draft" || a.status === "in_progress",
  ).length;
  const submittedCount = assignments.filter((a) => a.status === "submitted").length;
  const reviewedCount = assignments.filter((a) => a.status === "reviewed").length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Assignments</h1>
        <p className="text-muted-foreground">
          View and manage all your assignments, scenarios, and assessments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="submitted" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Submitted
            {submittedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {submittedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Reviewed
            {reviewedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {reviewedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assignments..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    resetPage();
                  }}
                  className="pl-10"
                />
              </div>
              {uniquePrograms.length > 1 && (
                <Select
                  value={programFilter}
                  onValueChange={(v) => {
                    setProgramFilter(v);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {uniquePrograms.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assignment List */}
        {filteredAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {activeTab === "pending" && "No Pending Assignments"}
                {activeTab === "submitted" && "No Submitted Assignments"}
                {activeTab === "reviewed" && "No Reviewed Assignments"}
              </h3>
              <p className="text-muted-foreground">
                {activeTab === "pending" && "You have no assignments waiting to be completed."}
                {activeTab === "submitted" && "You have no assignments awaiting review."}
                {activeTab === "reviewed" && "No assignments have been reviewed yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  {activeTab === "reviewed" && <TableHead>Score</TableHead>}
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssignments.map((assignment) => (
                  <TableRow
                    key={`${assignment.type}-${assignment.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (assignment.type === "scenario" && assignment.scenario_assignment_id) {
                        navigate(`/scenarios/${assignment.scenario_assignment_id}`);
                      } else if (assignment.type === "assessment" && assignment.assessment_id) {
                        const params = assignment.enrollment_id
                          ? `?enrollment_id=${assignment.enrollment_id}`
                          : "";
                        navigate(`/capabilities/${assignment.assessment_id}${params}`);
                      } else {
                        navigate(
                          `/programs/${assignment.program_id}/modules/${assignment.module_id}`,
                        );
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {assignment.type === "scenario" && (
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        {assignment.type === "assessment" && (
                          <Target className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        )}
                        {assignment.assignment_type_name}
                      </div>
                    </TableCell>
                    <TableCell>{assignment.module_title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{assignment.program_name}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                    {activeTab === "reviewed" && (
                      <TableCell>
                        {assignment.overall_score !== null ? (
                          <Badge variant="secondary">{assignment.overall_score}%</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-muted-foreground">
                      {assignment.updated_at
                        ? formatDistanceToNow(new Date(assignment.updated_at), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, filteredAssignments.length)} of{" "}
                  {filteredAssignments.length}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {getPageNumbers().map((p, i) =>
                      p === "ellipsis" ? (
                        <PaginationItem key={`e${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === page}
                            onClick={() => setPage(p)}
                            className="cursor-pointer"
                          >
                            {p + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        className={
                          page >= totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </Card>
        )}
      </Tabs>
    </div>
  );
}
