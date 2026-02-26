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
  BookOpen,
  Send,
  CheckCircle,
  ChevronRight,
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
  type: "module" | "scenario";
  scenario_assignment_id?: string;
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

      // Get module progress for these enrollments
      const { data: progressData, error: progressError } = await supabase
        .from("module_progress")
        .select(
          `
          id,
          enrollment_id,
          module_id,
          program_modules(title, program_id)
        `,
        )
        .in("enrollment_id", enrollmentIds);

      if (progressError) throw progressError;
      if (!progressData || progressData.length === 0) return [];

      const progressIds = progressData.map((p) => p.id);

      // Get all assignments + scenario assignments in parallel
      const [assignmentResult, scenarioResult] = await Promise.all([
        supabase
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
          .order("updated_at", { ascending: false }),
        supabase
          .from("scenario_assignments")
          .select(
            `
            id,
            template_id,
            status,
            created_at,
            updated_at,
            evaluated_at,
            enrollment_id,
            scenario_templates(title)
          `,
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);

      if (assignmentResult.error) throw assignmentResult.error;

      // Combine the module assignment data
      const moduleAssignmentsList: Assignment[] = (assignmentResult.data || []).map(
        (assignment) => {
          const progress = progressData.find((p) => p.id === assignment.module_progress_id);
          const enrollment = enrollments.find((e) => e.id === progress?.enrollment_id);
          const module = progress?.program_modules as any;

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
            module_title: module?.title || "Unknown Module",
            module_id: progress?.module_id || "",
            program_name: (enrollment?.programs as any)?.name || "Unknown Program",
            program_id: enrollment?.program_id || "",
            enrollment_id: progress?.enrollment_id || "",
            type: "module" as const,
          };
        },
      );

      if (scenarioResult.error) {
        console.error("Error loading scenario assignments:", scenarioResult.error);
      }

      // Map scenario assignments to the common Assignment interface
      const scenarioAssignmentsList: Assignment[] = (scenarioResult.data || []).map((sa) => {
        const enrollment = enrollments.find((e) => e.id === sa.enrollment_id);
        let mappedStatus = sa.status;
        if (sa.status === "evaluated") mappedStatus = "reviewed";

        return {
          id: sa.id,
          module_progress_id: "",
          assignment_type_name: "Scenario",
          status: mappedStatus,
          created_at: sa.created_at,
          updated_at: sa.updated_at,
          scored_at: sa.evaluated_at,
          overall_score: null as number | null,
          module_title: (sa.scenario_templates as any)?.title || "Untitled Scenario",
          module_id: "",
          program_name: (enrollment?.programs as any)?.name || "Unknown Program",
          program_id: enrollment?.program_id || "",
          enrollment_id: sa.enrollment_id || "",
          type: "scenario" as const,
          scenario_assignment_id: sa.id,
        };
      });

      // Combine both lists and sort by updated_at descending
      const allAssignments = [...moduleAssignmentsList, ...scenarioAssignmentsList];
      allAssignments.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      return allAssignments;
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
        filtered = filtered.filter((a) => a.status === "draft" || a.status === "in_progress");
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
      assignments.map((a) => [a.program_id, { id: a.program_id, name: a.program_name }]),
    ).values(),
  );

  const pendingCount = assignments.filter(
    (a) => a.status === "draft" || a.status === "in_progress",
  ).length;
  const submittedCount = assignments.filter((a) => a.status === "submitted").length;
  const reviewedCount = assignments.filter((a) => a.status === "reviewed").length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Assignments</h1>
        <p className="text-muted-foreground">
          View and manage your module assignments across all programs
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
                      } else {
                        navigate(
                          `/programs/${assignment.program_id}/modules/${assignment.module_id}`,
                        );
                      }
                    }}
                  >
                    <TableCell className="font-medium">{assignment.assignment_type_name}</TableCell>
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
                      {formatDistanceToNow(new Date(assignment.updated_at), { addSuffix: true })}
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
