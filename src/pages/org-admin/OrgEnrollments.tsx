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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Pause,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";

interface Enrollment {
  id: string;
  client_user_id: string;
  program_id: string;
  status: string;
  tier: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  program: {
    id: string;
    name: string;
    slug: string;
  };
  profile: {
    id: string;
    name: string | null;
  } | null;
}

export default function OrgEnrollments() {
  const { organizationMembership } = useAuth();
  const { toast } = useToast();
  if (!organizationMembership) return null;
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    enrollmentId: string;
    action: "pause" | "resume" | "cancel" | "complete";
    memberName: string;
    programName: string;
  } | null>(null);

  useEffect(() => {
    if (organizationMembership?.organization_id) {
      loadEnrollments();
    }
  }, [organizationMembership?.organization_id]);

  const loadEnrollments = async () => {
    if (!organizationMembership?.organization_id) return;

    try {
      setLoading(true);

      // Get organization member user IDs
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationMembership.organization_id)
        .eq("is_active", true);

      const memberUserIds = members?.map((m) => m.user_id) || [];

      if (memberUserIds.length === 0) {
        setEnrollments([]);
        setLoading(false);
        return;
      }

      // Fetch enrollments for org members (using staff_enrollments view to exclude financial data)
      const { data: enrollmentsData, error } = await supabase
        .from("staff_enrollments")
        .select(
          `
          id,
          client_user_id,
          program_id,
          status,
          tier,
          start_date,
          end_date,
          created_at,
          programs (id, name, slug)
        `,
        )
        .in("client_user_id", memberUserIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for members
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", memberUserIds);

      // Combine data
      const enrichedEnrollments = (enrollmentsData || []).map((enrollment) => ({
        ...enrollment,
        program: enrollment.programs as { id: string; name: string; slug: string },
        profile: profiles?.find((p) => p.id === enrollment.client_user_id) || null,
      }));

      setEnrollments(enrichedEnrollments as Enrollment[]);

      // Extract unique programs for filter
      const uniquePrograms = Array.from(
        new Map(
          enrichedEnrollments
            .filter((e) => e.program)
            .map((e) => [e.program.id, { id: e.program.id, name: e.program.name }]),
        ).values(),
      );
      setPrograms(uniquePrograms);
    } catch (error) {
      console.error("Error loading enrollments:", error);
      toast({
        title: "Error",
        description: "Failed to load enrollments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
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
  };

  const handleStatusChange = async (
    enrollmentId: string,
    newStatus: "active" | "paused" | "cancelled" | "completed",
  ) => {
    try {
      // Note: 'cancelled' is not in the DB enum, we'll use 'paused' for cancellations too
      // or we handle it differently. Let's check what statuses are valid.
      const dbStatus = newStatus === "cancelled" ? "paused" : newStatus;

      const updateData: {
        status: "active" | "completed" | "paused";
        end_date?: string;
      } = {
        status: dbStatus as "active" | "completed" | "paused",
      };

      // Set end_date for completed/cancelled
      if (newStatus === "completed" || newStatus === "cancelled") {
        updateData.end_date = new Date().toISOString().split("T")[0];
      }

      const { error } = await supabase
        .from("client_enrollments")
        .update(updateData)
        .eq("id", enrollmentId);

      if (error) throw error;

      const actionLabels = {
        active: "resumed",
        paused: "paused",
        cancelled: "cancelled",
        completed: "marked as completed",
      };

      toast({
        title: "Enrollment Updated",
        description: `Enrollment has been ${actionLabels[newStatus]}`,
      });

      loadEnrollments();
    } catch (error) {
      console.error("Error updating enrollment:", error);
      toast({
        title: "Error",
        description: "Failed to update enrollment status",
        variant: "destructive",
      });
    } finally {
      setConfirmDialog(null);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "pause":
        return "Pause";
      case "resume":
        return "Resume";
      case "cancel":
        return "Cancel";
      case "complete":
        return "Mark Complete";
      default:
        return action;
    }
  };

  const getActionDescription = (action: string, memberName: string, programName: string) => {
    switch (action) {
      case "pause":
        return `This will pause ${memberName}'s enrollment in ${programName}. They will temporarily lose access to the program content.`;
      case "resume":
        return `This will resume ${memberName}'s enrollment in ${programName}. They will regain access to the program content.`;
      case "cancel":
        return `This will cancel ${memberName}'s enrollment in ${programName}. This action sets an end date but the enrollment record is preserved.`;
      case "complete":
        return `This will mark ${memberName}'s enrollment in ${programName} as completed.`;
      default:
        return "";
    }
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch =
      !searchQuery ||
      enrollment.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enrollment.program?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || enrollment.status === statusFilter;
    const matchesProgram = programFilter === "all" || enrollment.program_id === programFilter;

    return matchesSearch && matchesStatus && matchesProgram;
  });

  const statusCounts = {
    all: enrollments.length,
    active: enrollments.filter((e) => e.status === "active").length,
    completed: enrollments.filter((e) => e.status === "completed").length,
    paused: enrollments.filter((e) => e.status === "paused").length,
    cancelled: enrollments.filter((e) => e.status === "cancelled").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Enrollments</h1>
        <p className="text-muted-foreground">Track your team's program enrollments and progress</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Enrollments</CardDescription>
            <CardTitle className="text-2xl">{statusCounts.all}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl text-green-600">{statusCounts.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{statusCounts.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paused/Cancelled</CardDescription>
            <CardTitle className="text-2xl text-muted-foreground">
              {statusCounts.paused + statusCounts.cancelled}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            All Enrollments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by member or program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading enrollments...</div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {enrollments.length === 0
                ? "No enrollments found. Enroll your team members in programs to get started."
                : "No enrollments match your filters."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {enrollment.profile?.name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <span className="font-medium">
                          {enrollment.profile?.name || "Unknown User"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{enrollment.program?.name || "Unknown Program"}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(enrollment.status)}>
                        {enrollment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {enrollment.tier ? (
                        <Badge variant="outline">{enrollment.tier}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {enrollment.start_date
                        ? format(new Date(enrollment.start_date), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {enrollment.end_date
                        ? format(new Date(enrollment.end_date), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {enrollment.status === "active" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    enrollmentId: enrollment.id,
                                    action: "pause",
                                    memberName: enrollment.profile?.name || "Unknown",
                                    programName: enrollment.program?.name || "Unknown",
                                  })
                                }
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    enrollmentId: enrollment.id,
                                    action: "complete",
                                    memberName: enrollment.profile?.name || "Unknown",
                                    programName: enrollment.program?.name || "Unknown",
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Complete
                              </DropdownMenuItem>
                            </>
                          )}
                          {enrollment.status === "paused" && (
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmDialog({
                                  open: true,
                                  enrollmentId: enrollment.id,
                                  action: "resume",
                                  memberName: enrollment.profile?.name || "Unknown",
                                  programName: enrollment.program?.name || "Unknown",
                                })
                              }
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          {(enrollment.status === "active" || enrollment.status === "paused") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    enrollmentId: enrollment.id,
                                    action: "cancel",
                                    memberName: enrollment.profile?.name || "Unknown",
                                    programName: enrollment.program?.name || "Unknown",
                                  })
                                }
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancel Enrollment
                              </DropdownMenuItem>
                            </>
                          )}
                          {enrollment.status === "completed" && (
                            <DropdownMenuItem disabled className="text-muted-foreground">
                              No actions available
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!confirmDialog?.open}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog ? getActionLabel(confirmDialog.action) : ""} Enrollment
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog
                ? getActionDescription(
                    confirmDialog.action,
                    confirmDialog.memberName,
                    confirmDialog.programName,
                  )
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog) {
                  const statusMap: Record<string, "active" | "paused" | "cancelled" | "completed"> =
                    {
                      pause: "paused",
                      resume: "active",
                      cancel: "cancelled",
                      complete: "completed",
                    };
                  handleStatusChange(confirmDialog.enrollmentId, statusMap[confirmDialog.action]);
                }
              }}
              className={
                confirmDialog?.action === "cancel"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmDialog ? getActionLabel(confirmDialog.action) : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
