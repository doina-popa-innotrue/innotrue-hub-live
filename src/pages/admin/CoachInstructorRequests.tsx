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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Clock, CheckCircle, XCircle, Eye, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CoachInstructorRequest {
  id: string;
  user_id: string;
  request_type: "coach" | "instructor" | "both";
  source_type: string | null;
  message: string | null;
  status: "pending" | "approved" | "declined";
  admin_notes: string | null;
  specialties: string | null;
  certifications: string | null;
  bio: string | null;
  scheduling_url: string | null;
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
  const [activeTab, setActiveTab] = useState<"assignments" | "applications">("applications");
  const [selectedRequest, setSelectedRequest] = useState<CoachInstructorRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedCoach, setSelectedCoach] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Determine source_type filter based on active tab
  const isApplicationsTab = activeTab === "applications";

  // Fetch requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-coach-instructor-requests", statusFilter, activeTab],
    queryFn: async () => {
      let query = supabase
        .from("coach_instructor_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (isApplicationsTab) {
        query = query.eq("source_type", "role_application");
      } else {
        // Coach assignments: source_type is null or 'client_request'
        query = query.or("source_type.is.null,source_type.eq.client_request");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles for each request
      const userIds = [...new Set(data.map((r) => r.user_id))];
      if (userIds.length === 0) return [];

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

  // Fetch available coaches (for assignment tab only)
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
    enabled: !isApplicationsTab,
  });

  // Fetch available instructors (for assignment tab only)
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
    enabled: !isApplicationsTab,
  });

  // Approve assignment (existing flow — assigns a coach/instructor TO the client)
  const approveAssignmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error("Invalid state");

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

  // Approve role application (Phase 5 — grants the applicant a coach/instructor role)
  const approveApplicationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error("Invalid state");

      // Add requested role(s) to user_roles
      const rolesToAdd: string[] = [];
      if (selectedRequest.request_type === "coach" || selectedRequest.request_type === "both") {
        rolesToAdd.push("coach");
      }
      if (selectedRequest.request_type === "instructor" || selectedRequest.request_type === "both") {
        rolesToAdd.push("instructor");
      }

      for (const role of rolesToAdd) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert({ user_id: selectedRequest.user_id, role }, { onConflict: "user_id,role" });
        if (roleError) throw roleError;
      }

      // Update profile: registration_status, verification_status, and application data
      const profileUpdate: Record<string, string | null> = {
        registration_status: "complete",
        verification_status: "verified",
        verified_at: new Date().toISOString(),
      };
      if (selectedRequest.bio) profileUpdate.bio = selectedRequest.bio;
      if (selectedRequest.scheduling_url) profileUpdate.scheduling_url = selectedRequest.scheduling_url;
      if (selectedRequest.certifications) profileUpdate.certifications = selectedRequest.certifications;

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", selectedRequest.user_id);
      if (profileError) throw profileError;

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
      toast.success("Role application approved! User now has coach/instructor access.");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Failed to approve application", { description: error.message });
    },
  });

  // Decline mutation (shared for both tabs)
  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error("Invalid state");

      // Update request status
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

      // For role applications: set registration_status to 'complete' (they keep client role)
      if (selectedRequest.source_type === "role_application") {
        await supabase
          .from("profiles")
          .update({ registration_status: "complete" })
          .eq("id", selectedRequest.user_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coach-instructor-requests"] });
      toast.success(
        isApplicationsTab
          ? "Application declined. User continues as a client."
          : "Request declined",
      );
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

  const isPending =
    approveAssignmentMutation.isPending ||
    approveApplicationMutation.isPending ||
    declineMutation.isPending;

  const handleApprove = () => {
    if (isApplicationsTab) {
      approveApplicationMutation.mutate();
    } else {
      approveAssignmentMutation.mutate();
    }
  };

  // For assignments tab, approval requires selecting a coach/instructor
  const isApproveDisabled = () => {
    if (isPending) return true;
    if (!isApplicationsTab && selectedRequest) {
      if (selectedRequest.request_type === "coach" && !selectedCoach) return true;
      if (selectedRequest.request_type === "instructor" && !selectedInstructor) return true;
      if (selectedRequest.request_type === "both" && (!selectedCoach || !selectedInstructor))
        return true;
    }
    return false;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserPlus className="h-8 w-8" />
          Coach & Instructor Requests
        </h1>
        <p className="text-muted-foreground mt-1">
          Review coach/instructor assignment requests and role applications
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "assignments" | "applications")}>
        <TabsList>
          <TabsTrigger value="applications" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Role Applications
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Coach Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Role Applications</CardTitle>
                  <CardDescription>
                    Users who signed up and applied to be a coach or instructor.
                    Approving grants them the requested role.
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
              {renderRequestsTable()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Coach Assignments</CardTitle>
                  <CardDescription>
                    Clients requesting a coach or instructor to be assigned to them.
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
              {renderRequestsTable()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isApplicationsTab ? "Review Role Application" : "Review Request"}
            </DialogTitle>
            <DialogDescription>
              {isApplicationsTab
                ? "Review this user's application to become a coach or instructor"
                : "Review and take action on this coach/instructor request"}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">
                    {isApplicationsTab ? "Applicant" : "Client"}
                  </Label>
                  <p className="font-medium">{selectedRequest.profiles?.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedRequest.profiles?.username}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    {isApplicationsTab ? "Applying as" : "Request Type"}
                  </Label>
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

              {/* Application details (role applications only) */}
              {isApplicationsTab && (
                <div className="space-y-3 rounded-md border p-3">
                  {selectedRequest.bio && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Bio</Label>
                      <p className="text-sm">{selectedRequest.bio}</p>
                    </div>
                  )}
                  {selectedRequest.specialties && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Specialties</Label>
                      <p className="text-sm">{selectedRequest.specialties}</p>
                    </div>
                  )}
                  {selectedRequest.certifications && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Certifications</Label>
                      <p className="text-sm">{selectedRequest.certifications}</p>
                    </div>
                  )}
                  {selectedRequest.scheduling_url && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Scheduling URL</Label>
                      <p className="text-sm">
                        <a
                          href={selectedRequest.scheduling_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          {selectedRequest.scheduling_url}
                        </a>
                      </p>
                    </div>
                  )}
                  {!selectedRequest.bio &&
                    !selectedRequest.specialties &&
                    !selectedRequest.certifications &&
                    !selectedRequest.scheduling_url && (
                      <p className="text-sm text-muted-foreground">
                        No additional details provided.
                      </p>
                    )}
                </div>
              )}

              {selectedRequest.message && (
                <div>
                  <Label className="text-muted-foreground">Message</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedRequest.message}</p>
                </div>
              )}

              {selectedRequest.status === "pending" && (
                <>
                  {/* Assignment Selectors (assignments tab only) */}
                  {!isApplicationsTab && (
                    <>
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
                    </>
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
                <Button onClick={handleApprove} disabled={isApproveDisabled()}>
                  {approveAssignmentMutation.isPending || approveApplicationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  {isApplicationsTab ? "Approve Role" : "Approve & Assign"}
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

  function renderRequestsTable() {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (requests.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No requests found</div>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{isApplicationsTab ? "Applicant" : "Client"}</TableHead>
            <TableHead>{isApplicationsTab ? "Applying as" : "Request Type"}</TableHead>
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
    );
  }
}
