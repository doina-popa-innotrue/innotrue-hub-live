import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TransferAssignment {
  id: string;
  client_name: string;
  assignment_type_name: string;
  module_title: string;
  program_name: string;
  module_id: string;
  enrollment_id: string;
  program_id: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface TransferAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: TransferAssignment[];
  onTransferComplete: () => void;
}

export function TransferAssignmentDialog({
  open,
  onOpenChange,
  assignments,
  onTransferComplete,
}: TransferAssignmentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [targetStaffId, setTargetStaffId] = useState<string>("");
  const [note, setNote] = useState("");
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const isBulk = assignments.length > 1;
  const firstAssignment = assignments[0];

  useEffect(() => {
    if (open && firstAssignment) {
      loadAvailableStaff();
      setTargetStaffId("");
      setNote("");
    }
  }, [open, firstAssignment?.module_id]);

  const loadAvailableStaff = async () => {
    if (!user || !firstAssignment) return;
    setLoadingStaff(true);

    try {
      // Collect all unique module IDs from the assignments
      const moduleIds = [...new Set(assignments.map((a) => a.module_id))];
      const programIds = [...new Set(assignments.map((a) => a.program_id))];

      const staffMap = new Map<string, StaffMember>();

      // Module-level instructors
      const { data: moduleInstructors } = await supabase
        .from("module_instructors")
        .select("instructor_id")
        .in("module_id", moduleIds);

      // Module-level coaches
      const { data: moduleCoaches } = await supabase
        .from("module_coaches")
        .select("coach_id")
        .in("module_id", moduleIds);

      // Program-level instructors
      const { data: programInstructors } = await supabase
        .from("program_instructors")
        .select("instructor_id")
        .in("program_id", programIds);

      // Program-level coaches
      const { data: programCoaches } = await supabase
        .from("program_coaches")
        .select("coach_id")
        .in("program_id", programIds);

      // Enrollment-level staff
      const enrollmentIds = [...new Set(assignments.map((a) => a.enrollment_id))];
      const { data: enrollmentStaff } = await supabase
        .from("enrollment_module_staff")
        .select("staff_user_id, role")
        .in("enrollment_id", enrollmentIds)
        .in("module_id", moduleIds);

      // Collect all unique staff IDs (excluding current user)
      const allStaffIds = new Set<string>();

      moduleInstructors?.forEach((mi) => allStaffIds.add(mi.instructor_id));
      moduleCoaches?.forEach((mc) => allStaffIds.add(mc.coach_id));
      programInstructors?.forEach((pi) => allStaffIds.add(pi.instructor_id));
      programCoaches?.forEach((pc) => allStaffIds.add(pc.coach_id));
      enrollmentStaff?.forEach((es) => allStaffIds.add(es.staff_user_id));

      // Remove current user
      allStaffIds.delete(user.id);

      if (allStaffIds.size === 0) {
        setStaffMembers([]);
        setLoadingStaff(false);
        return;
      }

      // Load names for all staff
      const staffIdsArray = Array.from(allStaffIds);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", staffIdsArray);

      // Determine role for each staff member
      const instructorIds = new Set<string>();
      const coachIds = new Set<string>();
      moduleInstructors?.forEach((mi) => instructorIds.add(mi.instructor_id));
      programInstructors?.forEach((pi) => instructorIds.add(pi.instructor_id));
      moduleCoaches?.forEach((mc) => coachIds.add(mc.coach_id));
      programCoaches?.forEach((pc) => coachIds.add(pc.coach_id));
      enrollmentStaff?.forEach((es) => {
        if (es.role === "instructor") instructorIds.add(es.staff_user_id);
        else coachIds.add(es.staff_user_id);
      });

      profiles?.forEach((p) => {
        const role = instructorIds.has(p.id) ? "Instructor" : coachIds.has(p.id) ? "Coach" : "Staff";
        staffMap.set(p.id, {
          id: p.id,
          name: p.name || "Unnamed",
          role,
        });
      });

      setStaffMembers(Array.from(staffMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error loading staff:", error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleTransfer = async () => {
    if (!targetStaffId || !user) return;
    setLoading(true);

    try {
      // For each assignment, upsert enrollment_module_staff with the new staff member
      for (const assignment of assignments) {
        // Check if an enrollment_module_staff row already exists for this enrollment+module
        const { data: existing } = await supabase
          .from("enrollment_module_staff")
          .select("id")
          .eq("enrollment_id", assignment.enrollment_id)
          .eq("module_id", assignment.module_id)
          .eq("staff_user_id", user.id)
          .maybeSingle();

        if (existing) {
          // Update existing row to new staff member
          await supabase
            .from("enrollment_module_staff")
            .update({ staff_user_id: targetStaffId })
            .eq("id", existing.id);
        } else {
          // Insert new assignment for the target staff
          const targetRole = staffMembers.find((s) => s.id === targetStaffId)?.role.toLowerCase() || "instructor";
          await supabase.from("enrollment_module_staff").insert({
            enrollment_id: assignment.enrollment_id,
            module_id: assignment.module_id,
            staff_user_id: targetStaffId,
            role: targetRole,
          });
        }
      }

      // Send in-app notification to the new assignee
      try {
        const targetName = staffMembers.find((s) => s.id === targetStaffId)?.name || "a colleague";
        await supabase.rpc("create_notification", {
          p_user_id: targetStaffId,
          p_type_key: "assignment_submitted",
          p_title: isBulk
            ? `${assignments.length} assignments transferred to you`
            : `Assignment transferred: ${firstAssignment.assignment_type_name}`,
          p_message: isBulk
            ? `${assignments.length} pending assignments have been transferred to your queue.${note ? ` Note: ${note}` : ""}`
            : `${firstAssignment.client_name}'s ${firstAssignment.assignment_type_name} (${firstAssignment.module_title}) has been transferred to you.${note ? ` Note: ${note}` : ""}`,
          p_link: "/teaching/assignments",
          p_metadata: {
            transfer: true,
            from_user_id: user.id,
            assignment_count: assignments.length,
            note: note || null,
          },
        });
      } catch (notifError) {
        // Notification failure should not block the transfer
        console.error("Error sending transfer notification:", notifError);
      }

      toast({
        title: isBulk ? "Assignments transferred" : "Assignment transferred",
        description: isBulk
          ? `${assignments.length} assignments transferred to ${staffMembers.find((s) => s.id === targetStaffId)?.name}`
          : `Transferred to ${staffMembers.find((s) => s.id === targetStaffId)?.name}`,
      });

      onOpenChange(false);
      onTransferComplete();
    } catch (error: any) {
      toast({
        title: "Transfer failed",
        description: error.message || "Failed to transfer assignment(s)",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {isBulk ? `Transfer ${assignments.length} Assignments` : "Transfer Assignment"}
          </DialogTitle>
          <DialogDescription>
            Reassign {isBulk ? "these assignments" : "this assignment"} to another instructor or
            coach on the same module.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Assignment info */}
          <div className="rounded-lg border p-3 bg-muted/50 space-y-2">
            {isBulk ? (
              <div>
                <p className="text-sm font-medium">{assignments.length} assignments selected</p>
                <p className="text-xs text-muted-foreground">
                  From {[...new Set(assignments.map((a) => a.program_name))].join(", ")}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{firstAssignment.assignment_type_name}</Badge>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{firstAssignment.client_name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {firstAssignment.module_title} ({firstAssignment.program_name})
                  </span>
                </p>
              </>
            )}
          </div>

          {/* Target staff selection */}
          <div className="space-y-2">
            <Label>Transfer to</Label>
            {loadingStaff ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading available staff...
              </div>
            ) : staffMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other instructors or coaches are assigned to this module/program.
              </p>
            ) : (
              <Select value={targetStaffId} onValueChange={setTargetStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select instructor or coach..." />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}{" "}
                      <span className="text-muted-foreground">({staff.role})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Optional note */}
          <div className="space-y-2">
            <Label htmlFor="transfer-note">Note (optional)</Label>
            <Textarea
              id="transfer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for the new reviewer..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!targetStaffId || loading || staffMembers.length === 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer{isBulk ? ` ${assignments.length} Assignments` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
