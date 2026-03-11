import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUp,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getTierDisplayName } from "@/lib/tierUtils";

interface TierUpgradeRequest {
  id: string;
  user_id: string;
  enrollment_id: string;
  current_tier: string;
  requested_tier: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined from client_enrollments
  enrollment?: {
    id: string;
    program_id: string;
    tier: string | null;
  } | null;
  // Batch-fetched
  profile?: {
    id: string;
    name: string;
  } | null;
  program?: {
    id: string;
    name: string;
    tiers: string[] | null;
  } | null;
}

export default function TierUpgradeRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<TierUpgradeRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Fetch requests with enrollment FK join + batch profiles + programs
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-tier-upgrade-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tier_upgrade_requests")
        .select("*, enrollment:client_enrollments!tier_upgrade_requests_enrollment_id_fkey(id, program_id, tier)")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Batch-fetch profiles (user_id → auth.users, NOT safe for FK hints)
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Batch-fetch programs for name + tiers
      const programIds = [
        ...new Set(
          data
            .map((r) => {
              const enrollment = r.enrollment as { id: string; program_id: string; tier: string | null } | null;
              return enrollment?.program_id;
            })
            .filter(Boolean) as string[],
        ),
      ];

      let programsMap = new Map<string, { id: string; name: string; tiers: string[] | null }>();
      if (programIds.length > 0) {
        const { data: programs } = await supabase
          .from("programs")
          .select("id, name, tiers")
          .in("id", programIds);
        programsMap = new Map(
          programs?.map((p) => [p.id, { ...p, tiers: p.tiers as string[] | null }]) || [],
        );
      }

      return data.map((r) => {
        const enrollment = r.enrollment as { id: string; program_id: string; tier: string | null } | null;
        return {
          ...r,
          enrollment,
          profile: profilesMap.get(r.user_id) || null,
          program: enrollment ? programsMap.get(enrollment.program_id) || null : null,
        };
      }) as TierUpgradeRequest[];
    },
  });

  // Approve mutation: update enrollment tier + request status
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error("Invalid state");

      // 1. Update enrollment tier
      const { error: enrollmentError } = await supabase
        .from("client_enrollments")
        .update({ tier: selectedRequest.requested_tier })
        .eq("id", selectedRequest.enrollment_id);
      if (enrollmentError) throw enrollmentError;

      // 2. Update request status
      const { error } = await supabase
        .from("tier_upgrade_requests")
        .update({
          status: "approved",
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tier-upgrade-requests"] });
      toast.success("Tier upgrade approved and enrollment updated");
      closeDialog();
    },
    onError: (error) => {
      console.error("Failed to approve tier upgrade:", error);
      toast.error("Failed to approve request", { description: error.message });
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error("Invalid state");

      const { error } = await supabase
        .from("tier_upgrade_requests")
        .update({
          status: "declined",
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tier-upgrade-requests"] });
      toast.success("Tier upgrade request declined");
      closeDialog();
    },
    onError: (error) => {
      console.error("Failed to decline tier upgrade:", error);
      toast.error("Failed to decline request", { description: error.message });
    },
  });

  const openReviewDialog = (request: TierUpgradeRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedRequest(null);
    setAdminNotes("");
  };

  const isPending = approveMutation.isPending || declineMutation.isPending;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" /> Approved
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Declined
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tier Upgrade Requests"
        description="Review and manage client requests for program tier upgrades"
        showCreateButton={false}
        actions={
          pendingCount > 0 && statusFilter !== "pending" ? (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {pendingCount} pending
            </Badge>
          ) : undefined
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {statusFilter === "all"
                ? "All Requests"
                : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Requests`}
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No {statusFilter === "all" ? "" : statusFilter} requests</p>
              <p className="text-sm">
                {statusFilter === "pending"
                  ? "No tier upgrade requests awaiting review"
                  : "No requests match the selected filter"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Tier Change</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.profile?.name || "Unknown"}
                    </TableCell>
                    <TableCell>{request.program?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Badge variant="outline" className="text-xs">
                          {getTierDisplayName(
                            request.program?.tiers || null,
                            request.current_tier,
                          )}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Badge variant="secondary" className="text-xs">
                          {getTierDisplayName(
                            request.program?.tiers || null,
                            request.requested_tier,
                          )}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm text-muted-foreground truncate block">
                        {request.reason || "—"}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(request.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openReviewDialog(request)}
                        className="gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Tier Upgrade Request</DialogTitle>
            <DialogDescription>
              Review and approve or decline this tier upgrade request.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              {/* Client info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Client:</span>
                  <p className="font-medium">{selectedRequest.profile?.name || "Unknown"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Program:</span>
                  <p className="font-medium">{selectedRequest.program?.name || "Unknown"}</p>
                </div>
              </div>

              {/* Tier change */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground mb-2">Requested tier change:</p>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {getTierDisplayName(
                      selectedRequest.program?.tiers || null,
                      selectedRequest.current_tier,
                    )}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {getTierDisplayName(
                      selectedRequest.program?.tiers || null,
                      selectedRequest.requested_tier,
                    )}
                  </Badge>
                </div>
              </div>

              {/* Reason */}
              {selectedRequest.reason && (
                <div>
                  <Label className="text-muted-foreground">Client's reason:</Label>
                  <p className="mt-1 text-sm bg-muted/30 rounded-md border p-3">
                    {selectedRequest.reason}
                  </p>
                </div>
              )}

              {/* Status (if already reviewed) */}
              {selectedRequest.status !== "pending" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(selectedRequest.status)}
                  {selectedRequest.reviewed_at && (
                    <span className="text-xs text-muted-foreground">
                      on {format(new Date(selectedRequest.reviewed_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              )}

              {/* Admin notes */}
              <div className="space-y-2">
                <Label htmlFor="admin-notes">
                  Admin notes {selectedRequest.status === "pending" ? "(optional)" : ""}
                </Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add notes about this decision..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  disabled={selectedRequest.status !== "pending"}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              {selectedRequest?.status === "pending" ? "Cancel" : "Close"}
            </Button>
            {selectedRequest?.status === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => declineMutation.mutate()}
                  disabled={isPending}
                  className="gap-1.5"
                >
                  {declineMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Decline
                </Button>
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={isPending}
                  className="gap-1.5"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve & Upgrade
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
