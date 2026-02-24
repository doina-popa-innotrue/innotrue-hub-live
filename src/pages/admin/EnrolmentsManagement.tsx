import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Users, ExternalLink, Search, X, Download, Loader2, UserPlus } from "lucide-react";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { BulkEnrollmentDialog } from "@/components/admin/BulkEnrollmentDialog";

const PAGE_SIZE = 25;

interface Program {
  id: string;
  name: string;
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "completed":
      return "secondary";
    case "paused":
      return "outline";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export default function EnrolmentsManagement() {
  const navigate = useNavigate();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Reset page when filters change
  const resetPage = () => setPage(0);

  // ── Programs for filter dropdown ─────────────────────────────────────
  const { data: programs } = useQuery({
    queryKey: ["admin-programs-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Program[];
    },
  });

  // ── Stats (lightweight count queries) ────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ["admin-enrolment-stats"],
    queryFn: async () => {
      const [totalRes, activeRes, completedRes, pausedRes] = await Promise.all([
        supabase.from("client_enrollments").select("id", { count: "exact", head: true }),
        supabase.from("client_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("client_enrollments").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("client_enrollments").select("id", { count: "exact", head: true }).eq("status", "paused"),
      ]);
      return {
        total: totalRes.count ?? 0,
        active: activeRes.count ?? 0,
        completed: completedRes.count ?? 0,
        paused: pausedRes.count ?? 0,
      };
    },
  });

  // ── Paginated enrolments query ───────────────────────────────────────
  const {
    data: enrolmentResult,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["admin-enrolments", page, statusFilter, programFilter, dateFrom, dateTo],
    queryFn: async () => {
      // Build server-side filtered query
      let countQuery = supabase
        .from("client_enrollments")
        .select("id", { count: "exact", head: true });

      let dataQuery = supabase
        .from("client_enrollments")
        .select(
          `id, client_user_id, program_id, status, tier, start_date, end_date, created_at,
           programs (id, name, slug),
           program_plans (id, name, tier_level)`,
        )
        .order("created_at", { ascending: false });

      // Apply server-side filters to both count and data queries
      if (statusFilter !== "all") {
        countQuery = countQuery.eq("status", statusFilter);
        dataQuery = dataQuery.eq("status", statusFilter);
      }
      if (programFilter !== "all") {
        countQuery = countQuery.eq("program_id", programFilter);
        dataQuery = dataQuery.eq("program_id", programFilter);
      }
      if (dateFrom) {
        countQuery = countQuery.gte("created_at", dateFrom);
        dataQuery = dataQuery.gte("created_at", dateFrom);
      }
      if (dateTo) {
        const toEnd = `${dateTo}T23:59:59.999Z`;
        countQuery = countQuery.lte("created_at", toEnd);
        dataQuery = dataQuery.lte("created_at", toEnd);
      }

      // Execute count + paginated data in parallel
      const [countResult, dataResult] = await Promise.all([
        countQuery,
        dataQuery.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
      ]);

      if (dataResult.error) throw dataResult.error;

      const enrolments = dataResult.data || [];
      const totalCount = countResult.count ?? 0;

      // Batch-fetch profiles for this page's user IDs
      const userIds = [...new Set(enrolments.map((e: any) => e.client_user_id).filter(Boolean))];
      let profilesMap: Record<string, { id: string; name: string; username: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, username")
          .in("id", userIds);

        profilesMap = (profilesData || []).reduce(
          (acc, p) => {
            acc[p.id] = p;
            return acc;
          },
          {} as Record<string, { id: string; name: string; username: string | null }>,
        );
      }

      // Batch-fetch module progress for this page's enrollment IDs
      const enrollmentIds = enrolments.map((e: any) => e.id);
      let progressMap: Record<string, { completed: number; total: number }> = {};

      if (enrollmentIds.length > 0) {
        const [progressResult, programIds] = await Promise.all([
          supabase
            .from("module_progress")
            .select("enrollment_id, status")
            .in("enrollment_id", enrollmentIds),
          // Get module counts per program
          (async () => {
            const pIds = [...new Set(enrolments.map((e: any) => e.program_id).filter(Boolean))];
            if (pIds.length === 0) return {};
            const { data } = await supabase
              .from("program_modules")
              .select("program_id, id")
              .in("program_id", pIds);
            // Group by program_id → count
            return (data || []).reduce(
              (acc, m) => {
                acc[m.program_id] = (acc[m.program_id] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            );
          })(),
        ]);

        // Aggregate completed counts per enrollment
        const completedByEnrollment: Record<string, number> = {};
        for (const p of progressResult.data || []) {
          if (p.status === "completed") {
            completedByEnrollment[p.enrollment_id] =
              (completedByEnrollment[p.enrollment_id] || 0) + 1;
          }
        }

        for (const e of enrolments) {
          const total = (programIds as Record<string, number>)[(e as any).program_id] || 0;
          const completed = completedByEnrollment[(e as any).id] || 0;
          progressMap[(e as any).id] = { completed, total };
        }
      }

      // Enrich enrolments with profiles
      const enriched = enrolments.map((e: any) => ({
        ...e,
        profiles: e.client_user_id ? profilesMap[e.client_user_id] || null : null,
        progress: progressMap[e.id] || { completed: 0, total: 0 },
      }));

      return { enrolments: enriched, totalCount };
    },
  });

  const enrolments = enrolmentResult?.enrolments || [];
  const totalCount = enrolmentResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Client-side search filter (search only applies to current page)
  const displayedEnrolments = useMemo(() => {
    if (!searchQuery) return enrolments;
    const query = searchQuery.toLowerCase();
    return enrolments.filter((e: any) => {
      const name = e.profiles?.name?.toLowerCase() || "";
      const email = e.profiles?.username?.toLowerCase() || "";
      return name.includes(query) || email.includes(query);
    });
  }, [enrolments, searchQuery]);

  // ── CSV Export ───────────────────────────────────────────────────────
  async function exportToCsv() {
    setIsExporting(true);
    try {
      let query = supabase
        .from("client_enrollments")
        .select(
          `id, client_user_id, program_id, status, tier, start_date, created_at,
           programs (name),
           program_plans (name)`,
        )
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (programFilter !== "all") query = query.eq("program_id", programFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);

      const { data: allData, error } = await query;
      if (error) throw error;

      // Fetch profiles for all
      const userIds = [...new Set((allData || []).map((e: any) => e.client_user_id).filter(Boolean))];
      let profilesMap: Record<string, { name: string; username: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, username")
          .in("id", userIds);
        profilesMap = (profilesData || []).reduce(
          (acc, p) => {
            acc[p.id] = p;
            return acc;
          },
          {} as Record<string, { name: string; username: string | null }>,
        );
      }

      const headers = ["Client Name", "Email", "Programme", "Status", "Tier", "Plan", "Start Date", "Enrolled On"];
      const rows = (allData || []).map((e: any) => {
        const profile = profilesMap[e.client_user_id];
        return [
          profile?.name || "Unknown",
          profile?.username || "",
          e.programs?.name || "",
          e.status,
          e.tier || "",
          e.program_plans?.name || "",
          e.start_date ? format(new Date(e.start_date), "yyyy-MM-dd") : "",
          format(new Date(e.created_at), "yyyy-MM-dd"),
        ];
      });

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `enrolments-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to export CSV");
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }

  // ── Pagination helpers ───────────────────────────────────────────────
  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const pages: (number | "ellipsis")[] = [0];
    if (page > 2) pages.push("ellipsis");
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 3) pages.push("ellipsis");
    pages.push(totalPages - 1);
    return pages;
  }

  if (isLoading) {
    return <PageLoadingState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Enrolments</h1>
          <p className="text-muted-foreground">View and manage all programme enrolments</p>
        </div>
        <BulkEnrollmentDialog
          trigger={
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Bulk Enrol
            </Button>
          }
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completed ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Paused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.paused ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Search Client</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Programme</Label>
              <Select
                value={programFilter}
                onValueChange={(v) => {
                  setProgramFilter(v);
                  resetPage();
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programmes</SelectItem>
                  {programs?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  resetPage();
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Enrolled From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  resetPage();
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Enrolled To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  resetPage();
                }}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setProgramFilter("all");
                setSearchQuery("");
                setDateFrom("");
                setDateTo("");
                resetPage();
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCsv} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Enrolments
            {isFetching && !isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{" "}
            {totalCount} enrolments
            {searchQuery && ` (${displayedEnrolments.length} matching search)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayedEnrolments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No enrolments found matching your filters.
            </div>
          ) : (
            <ScrollArea className="w-full whitespace-nowrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Client</TableHead>
                    <TableHead className="min-w-[150px]">Programme</TableHead>
                    <TableHead className="min-w-[90px]">Status</TableHead>
                    <TableHead className="min-w-[130px]">Progress</TableHead>
                    <TableHead className="min-w-[90px]">Tier</TableHead>
                    <TableHead className="min-w-[100px]">Plan</TableHead>
                    <TableHead className="min-w-[110px]">Start Date</TableHead>
                    <TableHead className="min-w-[110px]">Enrolled On</TableHead>
                    <TableHead className="min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedEnrolments.map((enrolment: any) => {
                    const progress = enrolment.progress || { completed: 0, total: 0 };
                    const pct =
                      progress.total > 0
                        ? Math.round((progress.completed / progress.total) * 100)
                        : 0;

                    return (
                      <TableRow key={enrolment.id}>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <div className="font-medium truncate">
                              {enrolment.profiles?.name || "Unknown"}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {enrolment.profiles?.username}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="truncate max-w-[200px]">
                          {enrolment.programs?.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(enrolment.status)}>
                            {enrolment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {progress.total > 0 ? (
                            <div className="min-w-[120px] space-y-1">
                              <div className="flex items-center gap-2">
                                <Progress value={pct} className="h-2 flex-1" />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {pct}%
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {progress.completed}/{progress.total} modules
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {enrolment.tier ? (
                            <Badge variant="outline" className="capitalize">
                              {enrolment.tier}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {enrolment.program_plans ? (
                            <Badge variant="secondary">{enrolment.program_plans.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {enrolment.start_date ? (
                            format(new Date(enrolment.start_date), "dd MMM yyyy")
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(enrolment.created_at), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              navigate(`/admin/clients/${enrolment.client_user_id}`)
                            }
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4">
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
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={page === p}
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
        </CardContent>
      </Card>
    </div>
  );
}
