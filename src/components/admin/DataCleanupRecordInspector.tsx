import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import type { CleanupFilters } from "./DataCleanupEntityCard";

// ── Types ──────────────────────────────────────────────────────────────

interface DataCleanupRecordInspectorProps {
  entityType: string;
  title: string;
  filters: CleanupFilters;
  status: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ColumnDef {
  header: string;
  accessor: (row: any, profileMap: Map<string, string>) => string | number | null;
  render?: "badge" | "date" | "score";
  className?: string;
}

// ── Column configs per entity type ─────────────────────────────────────

const formatDate = (val: string | null) =>
  val ? format(new Date(val), "MMM d, yyyy") : "—";

const profileName = (id: string | null, pm: Map<string, string>) =>
  id ? pm.get(id) || "Unknown" : "—";

const COLUMN_CONFIGS: Record<string, ColumnDef[]> = {
  scenario_assignments: [
    { header: "Client", accessor: (r, pm) => profileName(r.user_id, pm) },
    { header: "Template", accessor: (r) => r.template_title || "—" },
    { header: "Module", accessor: (r) => r.module_title || "—" },
    { header: "Status", accessor: (r) => r.status, render: "badge" },
    { header: "Attempt", accessor: (r) => r.attempt_number, className: "text-center" },
    { header: "Created", accessor: (r) => r.created_at, render: "date" },
    { header: "Submitted", accessor: (r) => r.submitted_at, render: "date" },
  ],
  capability_snapshots: [
    { header: "Client", accessor: (r, pm) => profileName(r.user_id, pm) },
    { header: "Assessment", accessor: (r) => r.assessment_name || "—" },
    {
      header: "Type",
      accessor: (r) =>
        r.is_self_assessment
          ? "Self"
          : r.evaluation_relationship || "Evaluator",
    },
    { header: "Status", accessor: (r) => r.status, render: "badge" },
    { header: "Created", accessor: (r) => r.created_at, render: "date" },
    { header: "Completed", accessor: (r) => r.completed_at, render: "date" },
    { header: "Evaluator", accessor: (r, pm) => profileName(r.evaluator_id, pm) },
  ],
  module_assignments: [
    { header: "Client", accessor: (r, pm) => profileName(r.user_id, pm) },
    { header: "Type", accessor: (r) => r.assignment_type_name || "—" },
    { header: "Module", accessor: (r) => r.module_title || "—" },
    { header: "Status", accessor: (r) => r.status, render: "badge" },
    { header: "Score", accessor: (r) => r.overall_score, render: "score" },
    { header: "Created", accessor: (r) => r.created_at, render: "date" },
    { header: "Completed", accessor: (r) => r.completed_at, render: "date" },
  ],
  module_progress: [
    { header: "Client", accessor: (r, pm) => profileName(r.user_id, pm) },
    { header: "Module", accessor: (r) => r.module_title || "—" },
    { header: "Program", accessor: (r) => r.program_name || "—" },
    { header: "Status", accessor: (r) => r.status, render: "badge" },
    { header: "Created", accessor: (r) => r.created_at, render: "date" },
    { header: "Completed", accessor: (r) => r.completed_at, render: "date" },
  ],
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  not_started: "outline",
  in_progress: "secondary",
  submitted: "default",
  in_review: "secondary",
  evaluated: "default",
  completed: "default",
  reviewed: "default",
  revision_requested: "destructive",
};

const PAGE_SIZE = 50;

// ── Component ──────────────────────────────────────────────────────────

export function DataCleanupRecordInspector({
  entityType,
  title,
  filters,
  status,
  open,
  onOpenChange,
}: DataCleanupRecordInspectorProps) {
  const [page, setPage] = useState(0);

  // Reset page when dialog opens or filters change
  useEffect(() => {
    if (open) setPage(0);
  }, [open, filters.userId, filters.programId, filters.createdBefore, status]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "cleanup-list-records",
      entityType,
      filters.userId,
      filters.programId,
      filters.createdBefore,
      status,
      page,
    ],
    queryFn: async () => {
      // 1. Fetch matched records from RPC
      const { data: rpcResult, error } = await supabase.rpc(
        "admin_data_cleanup_list_records" as never,
        {
          p_entity_type: entityType,
          p_user_id: filters.userId === "all" ? null : filters.userId,
          p_program_id: filters.programId === "all" ? null : filters.programId,
          p_created_before: filters.createdBefore || null,
          p_status: status === "all" ? null : status,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
        } as never,
      );

      if (error) throw error;

      const result = rpcResult as unknown as {
        total_count: number;
        records: any[];
      };

      // 2. Batch-fetch profile names for all user IDs in the results
      const userIdFields = ["user_id", "evaluator_id"];
      const userIds = [
        ...new Set(
          result.records.flatMap((r: any) =>
            userIdFields.map((f) => r[f]).filter(Boolean),
          ),
        ),
      ] as string[];

      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);

        profileMap = new Map(
          (profiles || []).map((p) => [p.id, p.name || "Unknown"]),
        );
      }

      return {
        totalCount: result.total_count,
        records: result.records,
        profileMap,
      };
    },
    enabled: open,
    staleTime: 0, // Always refetch — data may change between previews
  });

  const columns = COLUMN_CONFIGS[entityType] || [];
  const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 0;

  const renderCellValue = (col: ColumnDef, row: any, profileMap: Map<string, string>) => {
    const value = col.accessor(row, profileMap);

    if (col.render === "badge" && typeof value === "string") {
      return (
        <Badge variant={STATUS_VARIANT[value] || "outline"} className="text-xs">
          {value.replace(/_/g, " ")}
        </Badge>
      );
    }

    if (col.render === "date") {
      return (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {formatDate(value as string | null)}
        </span>
      );
    }

    if (col.render === "score") {
      return value !== null && value !== undefined ? (
        <Badge variant="secondary">{value}%</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }

    return <span className="text-sm">{value ?? "—"}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Inspect Records: {title}</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.totalCount.toLocaleString()} record${data.totalCount !== 1 ? "s" : ""} matching current filters`
              : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No records found matching current filters
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.header} className={col.className}>
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.records.map((row: any) => (
                  <TableRow key={row.id}>
                    {columns.map((col) => (
                      <TableCell key={col.header} className={col.className}>
                        {renderCellValue(col, row, data.profileMap)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, data?.totalCount || 0)} of{" "}
              {data?.totalCount.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
