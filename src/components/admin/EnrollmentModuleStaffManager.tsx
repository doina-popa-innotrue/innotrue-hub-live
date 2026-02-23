import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Users, BookOpen } from "lucide-react";

interface EnrollmentModuleStaff {
  id: string;
  enrollment_id: string;
  module_id: string;
  staff_user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  enrollmentId: string;
  programId: string;
  clientName: string;
}

interface Module {
  id: string;
  title: string;
  module_type: string | null;
  is_individualized: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  avatar_url: string | null;
}

export function EnrollmentModuleStaffManager({ enrollmentId, programId, clientName }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    module_id: "",
    staff_user_id: "",
    role: "" as "instructor" | "coach" | "",
  });

  // Fetch existing assignments for this enrollment
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["enrollment-module-staff", enrollmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollment_module_staff")
        .select("*")
        .eq("enrollment_id", enrollmentId);

      if (error) throw error;
      return data as EnrollmentModuleStaff[];
    },
  });

  // Fetch all active modules for this program (any module can have per-client staff)
  const { data: modules = [] } = useQuery({
    queryKey: ["modules-for-enrollment-staff", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules")
        .select("id, title, module_type, is_individualized")
        .eq("program_id", programId)
        .eq("is_active", true)
        .order("order_index");
      if (error) throw error;
      return data as Module[];
    },
  });

  // Fetch instructors
  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors-for-enrollment-staff"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "instructor");

      if (!roles || roles.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in(
          "id",
          roles.map((r) => r.user_id),
        )
        .order("name");

      return (profiles || []) as StaffMember[];
    },
  });

  // Fetch coaches
  const { data: coaches = [] } = useQuery({
    queryKey: ["coaches-for-enrollment-staff"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach");

      if (!roles || roles.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in(
          "id",
          roles.map((r) => r.user_id),
        )
        .order("name");

      return (profiles || []) as StaffMember[];
    },
  });

  // Fetch profiles for display
  const { data: profileMap = new Map() } = useQuery({
    queryKey: ["profiles-for-enrollment-staff", assignments],
    queryFn: async () => {
      const ids = assignments.map((a) => a.staff_user_id);
      if (ids.length === 0) return new Map();

      const { data } = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);

      return new Map((data || []).map((p) => [p.id, p]));
    },
    enabled: assignments.length > 0,
  });

  // Fetch module details for display
  const { data: moduleMap = new Map() } = useQuery({
    queryKey: ["modules-for-enrollment-staff-display", assignments],
    queryFn: async () => {
      const ids = assignments.map((a) => a.module_id);
      if (ids.length === 0) return new Map();

      const { data } = await supabase
        .from("program_modules")
        .select("id, title, module_type")
        .in("id", ids);

      return new Map((data || []).map((m) => [m.id, m]));
    },
    enabled: assignments.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("enrollment_module_staff").insert({
        enrollment_id: enrollmentId,
        module_id: data.module_id,
        staff_user_id: data.staff_user_id,
        role: data.role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-module-staff", enrollmentId] });
      toast.success("Staff assignment created");
      setDialogOpen(false);
      setFormData({ module_id: "", staff_user_id: "", role: "" });
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("This staff member is already assigned to this module");
      } else {
        toast.error("Failed to create assignment");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enrollment_module_staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-module-staff", enrollmentId] });
      toast.success("Staff assignment removed");
    },
    onError: () => {
      toast.error("Failed to remove assignment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.module_id) {
      toast.error("Please select a module");
      return;
    }
    if (!formData.staff_user_id) {
      toast.error("Please select a staff member");
      return;
    }
    if (!formData.role) {
      toast.error("Please select a role");
      return;
    }
    createMutation.mutate(formData);
  };

  // Get available staff based on selected role
  const availableStaff = formData.role === "coach" ? coaches : formData.role === "instructor" ? instructors : [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Staff Assignments for {clientName}
          </CardTitle>
          <CardDescription>
            Assign specific instructors/coaches per module for this client (overrides program and module defaults)
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Assign Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Staff to Module</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Module *</Label>
                <Select
                  value={formData.module_id}
                  onValueChange={(value) => setFormData({ ...formData, module_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          {module.title}
                          {module.module_type && (
                            <Badge variant="outline" className="text-xs ml-1">
                              {module.module_type}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Role *</Label>
                <Select
                  value={formData.role || "__none__"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      role: value === "__none__" ? "" : (value as "instructor" | "coach"),
                      staff_user_id: "", // Reset staff when role changes
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select role...</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Staff Member *</Label>
                <Select
                  value={formData.staff_user_id || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, staff_user_id: value === "__none__" ? "" : value })
                  }
                  disabled={!formData.role}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.role ? "Select staff member" : "Select a role first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select staff member...</SelectItem>
                    {availableStaff.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={staff.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {staff.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          {staff.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                You can assign multiple staff members per module. These assignments override
                module and program-level defaults for this client.
              </p>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Assigning..." : "Assign Staff"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>No per-client staff assignments</p>
            <p className="text-xs mt-1">Module and program-level defaults will be used for scheduling and grading</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Staff Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => {
                const module = moduleMap.get(assignment.module_id);
                const staff = profileMap.get(assignment.staff_user_id);

                return (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="font-medium">{module?.title || "Unknown Module"}</div>
                      {module?.module_type && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {module.module_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {staff ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={staff.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {staff.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{staff.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.role === "instructor" ? "default" : "secondary"}>
                        {assignment.role === "instructor" ? "Instructor" : "Coach"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove this staff assignment? The system will fall back to module or
                              program-level defaults.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(assignment.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
