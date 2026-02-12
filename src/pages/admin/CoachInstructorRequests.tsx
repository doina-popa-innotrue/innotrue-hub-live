import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { UserPlus, Clock, CheckCircle, XCircle, Eye, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CoachInstructorRequest {
  id: string;
  user_id: string;
  request_type: "coach" | "instructor" | "both";
  message: string | null;
  status: "pending" | "approved" | "declined";
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    name: string;
    username: string;
  };
}

export default function CoachInstructorRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<CoachInstructorRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedCoach, setSelectedCoach] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Fetch requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-coach-instructor-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("coach_instructor_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles for each request
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, username")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((r) => ({
        ...r,
        profiles: profilesMap.get(r.user_id) || null,
      })) as CoachInstructorRequest[];
    },
  });

  // Fetch available coaches
  const { data: availableCoaches = [] } = useQuery({
    queryKey: ["available-coaches"],
    queryFn: async () => {
      const { data: coachRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach");

      if (!coachRoles || coachRoles.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in(
          "id",
          coachRoles.map((r) => r.user_id),
        );

      return profiles || [];
    },
  });

  // Fetch available instructors
  const { data: availableInstructors = [] } = useQuery({
    queryKey: ["available-instructors"],
    queryFn: async () => {
      const { data: instructorRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "instructor");

      if (!instructorRoles || instructorRoles.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in(
          "id",
          instructorRoles.map((r) => r.user_id),
        );

      return profiles || [];
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error("Invalid state");

      // Assign coach if selected and requested
      if (
        selectedCoach &&
        (selectedRequest.request_type === "coach" || selectedRequest.request_type === "both")
      ) {
        const { error: coachError } = await supabase.from("client_coaches").insert({
          client_id: selectedRequest.user_id,
          coach_id: selectedCoach,
        });
        if (coachError) throw coachError;
      }

      // Assign instructor if selected and requested
      if (
        selectedInstructor &&
        (selectedRequest.request_type === "instructor" || selectedRequest.request_type === "both")
      ) {
        const { error: instructorError } = await supabase.from("client_instructors").insert({
          client_id: selectedRequest.user_id,
          instructor_id: selectedInstructor,
        });
        if (instructorError) throw instructorError;
      }

      // Update request status
      const { error } = await supabase
        .from("coach_instructor_requests")
        .update({
          status: "approved" as const,
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coach-instructor-requests"] });
      toast.success("Request approved and assignments made");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Failed to approve request", { description: error.message });
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error("Invalid state");

      const { error } = await supabase
        .from("coach_instructor_requests")
        .update({
          status: "declined" as const,
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coach-instructor-requests"] });
      toast.success("Request declined");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Failed to decline request", { description: error.message });
    },
  });

  const openReviewDialog = (request: CoachInstructorRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || "");
    setSelectedCoach("");
    setSelectedInstructor("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedRequest(null);
    setAdminNotes("");
    setSelectedCoach("");
    setSelectedInstructor("");
  };

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
        return null;
    }
  };

  const getRequestTypeBadge = (type: string) => {
    switch (type) {
      case "coach":
        return <Badge variant="secondary">Coach</Badge>;
      case "instructor":
        return <Badge variant="secondary">Instructor</Badge>;
      case "both":
        return <Badge variant="secondary">Both</Badge>;
      default:
        return null;
    }
  };

  const isPending = approveMutation.isPending || declineMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserPlus className="h-8 w-8" />
          Coach & Instructor Requests
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and manage client requests for coaches and instructors
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Requests</CardTitle>
              <CardDescription>
                {requests.length} request{requests.length !== 1 ? "s" : ""}{" "}
                {statusFilter !== "all" && `(${statusFilter})`}
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No requests found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.profiles?.name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground">
                          {request.profiles?.username}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRequestTypeBadge(request.request_type)}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>{format(new Date(request.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openReviewDialog(request)}>
                        <Eye className="h-4 w-4 mr-1" />
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

      {/* Review Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
            <DialogDescription>
              Review and take action on this coach/instructor request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Client</Label>
                  <p className="font-medium">{selectedRequest.profiles?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Request Type</Label>
                  <p className="capitalize font-medium">
                    {selectedRequest.request_type === "both"
                      ? "Coach & Instructor"
                      : selectedRequest.request_type}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p>{format(new Date(selectedRequest.created_at), "MMM d, yyyy")}</p>
                </div>
              </div>

              {selectedRequest.message && (
                <div>
                  <Label className="text-muted-foreground">Client Message</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedRequest.message}</p>
                </div>
              )}

              {selectedRequest.status === "pending" && (
                <>
                  {/* Assignment Selectors */}
                  {(selectedRequest.request_type === "coach" ||
                    selectedRequest.request_type === "both") && (
                    <div className="space-y-2">
                      <Label>Assign Coach</Label>
                      <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a coach to assign" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCoaches.map((coach) => (
                            <SelectItem key={coach.id} value={coach.id}>
                              {coach.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(selectedRequest.request_type === "instructor" ||
                    selectedRequest.request_type === "both") && (
                    <div className="space-y-2">
                      <Label>Assign Instructor</Label>
                      <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an instructor to assign" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableInstructors.map((instructor) => (
                            <SelectItem key={instructor.id} value={instructor.id}>
                              {instructor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Admin Notes</Label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Notes about this decision (visible to admins only)"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {selectedRequest.status !== "pending" && selectedRequest.admin_notes && (
                <div>
                  <Label className="text-muted-foreground">Admin Notes</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-sm">
                    {selectedRequest.admin_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedRequest?.status === "pending" ? (
              <>
                <Button variant="outline" onClick={closeDialog} disabled={isPending}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => declineMutation.mutate()}
                  disabled={isPending}
                >
                  {declineMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  Decline
                </Button>
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={
                    isPending ||
                    (selectedRequest?.request_type === "coach" && !selectedCoach) ||
                    (selectedRequest?.request_type === "instructor" && !selectedInstructor) ||
                    (selectedRequest?.request_type === "both" &&
                      (!selectedCoach || !selectedInstructor))
                  }
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Approve & Assign
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={closeDialog}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
