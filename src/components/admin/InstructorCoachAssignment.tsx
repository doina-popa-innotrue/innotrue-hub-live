import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  qualifications: string[];
}

interface InstructorCoachAssignmentProps {
  entityType: "program" | "module";
  entityId: string;
  moduleTypeName?: string;
  onUpdate?: () => void;
  readOnly?: boolean;
}

export function InstructorCoachAssignment({
  entityType,
  entityId,
  moduleTypeName,
  onUpdate,
  readOnly = false,
}: InstructorCoachAssignmentProps) {
  const [instructors, setInstructors] = useState<User[]>([]);
  const [coaches, setCoaches] = useState<User[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<User[]>([]);
  const [availableCoaches, setAvailableCoaches] = useState<User[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [selectedCoach, setSelectedCoach] = useState("");
  const [openInstructor, setOpenInstructor] = useState(false);
  const [openCoach, setOpenCoach] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchAvailableUsers();
  }, [entityId, moduleTypeName]);

  async function fetchAssignments() {
    // Fetch instructors
    let instructorData;
    if (entityType === "program") {
      const result = await supabase
        .from("program_instructors")
        .select("instructor_id")
        .eq("program_id", entityId);
      instructorData = result.data;
    } else {
      const result = await supabase
        .from("module_instructors")
        .select("instructor_id")
        .eq("module_id", entityId);
      instructorData = result.data;
    }

    if (instructorData) {
      const instructorUsers = await Promise.all(
        instructorData.map(async (item) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, username")
            .eq("id", item.instructor_id)
            .single();

          return {
            id: item.instructor_id,
            name: profile?.name || "Unknown",
            email: profile?.username || "N/A",
            qualifications: [] as string[],
          };
        }),
      );
      setInstructors(instructorUsers);
    }

    // Fetch coaches
    let coachData;
    if (entityType === "program") {
      const result = await supabase
        .from("program_coaches")
        .select("coach_id")
        .eq("program_id", entityId);
      coachData = result.data;
    } else {
      const result = await supabase
        .from("module_coaches")
        .select("coach_id")
        .eq("module_id", entityId);
      coachData = result.data;
    }

    if (coachData) {
      const coachUsers = await Promise.all(
        coachData.map(async (item) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, username")
            .eq("id", item.coach_id)
            .single();

          return {
            id: item.coach_id,
            name: profile?.name || "Unknown",
            email: profile?.username || "N/A",
            qualifications: [] as string[],
          };
        }),
      );
      setCoaches(coachUsers);
    }
  }

  async function fetchAvailableUsers() {
    // Fetch users with instructor role
    const { data: instructorRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "instructor");

    if (instructorRoles) {
      const instructorUsers = await Promise.all(
        instructorRoles.map(async (role) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, username")
            .eq("id", role.user_id)
            .single();

          // Fetch qualifications
          const { data: qualifications } = await supabase
            .from("user_qualifications")
            .select("module_type_id, module_types(name)")
            .eq("user_id", role.user_id);

          const qualNames =
            qualifications?.map((q) => (q.module_types as any)?.name).filter(Boolean) || [];

          return {
            id: role.user_id,
            name: profile?.name || "Unknown",
            email: profile?.username || "N/A",
            qualifications: qualNames,
          };
        }),
      );

      // Filter by qualifications if module type is specified
      if (moduleTypeName && entityType === "module") {
        const filtered = instructorUsers.filter(
          (u) => u.qualifications.length === 0 || u.qualifications.includes(moduleTypeName),
        );
        setAvailableInstructors(filtered);
      } else {
        setAvailableInstructors(instructorUsers);
      }
    }

    // Fetch users with coach role
    const { data: coachRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "coach");

    if (coachRoles) {
      const coachUsers = await Promise.all(
        coachRoles.map(async (role) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, username")
            .eq("id", role.user_id)
            .single();

          // Fetch qualifications
          const { data: qualifications } = await supabase
            .from("user_qualifications")
            .select("module_type_id, module_types(name)")
            .eq("user_id", role.user_id);

          const qualNames =
            qualifications?.map((q) => (q.module_types as any)?.name).filter(Boolean) || [];

          return {
            id: role.user_id,
            name: profile?.name || "Unknown",
            email: profile?.username || "N/A",
            qualifications: qualNames,
          };
        }),
      );

      // Filter by qualifications if module type is specified
      if (moduleTypeName && entityType === "module") {
        const filtered = coachUsers.filter(
          (u) => u.qualifications.length === 0 || u.qualifications.includes(moduleTypeName),
        );
        setAvailableCoaches(filtered);
      } else {
        setAvailableCoaches(coachUsers);
      }
    }
  }

  async function addInstructor() {
    if (!selectedInstructor) return;

    try {
      let error;
      if (entityType === "program") {
        const result = await supabase.from("program_instructors").insert({
          program_id: entityId,
          instructor_id: selectedInstructor,
        });
        error = result.error;
      } else {
        const result = await supabase.from("module_instructors").insert({
          module_id: entityId,
          instructor_id: selectedInstructor,
        });
        error = result.error;
      }

      if (error) throw error;

      toast.success("Instructor assigned successfully");
      setOpenInstructor(false);
      setSelectedInstructor("");
      fetchAssignments();
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function addCoach() {
    if (!selectedCoach) return;

    try {
      let error;
      if (entityType === "program") {
        const result = await supabase.from("program_coaches").insert({
          program_id: entityId,
          coach_id: selectedCoach,
        });
        error = result.error;
      } else {
        const result = await supabase.from("module_coaches").insert({
          module_id: entityId,
          coach_id: selectedCoach,
        });
        error = result.error;
      }

      if (error) throw error;

      toast.success("Coach assigned successfully");
      setOpenCoach(false);
      setSelectedCoach("");
      fetchAssignments();
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function removeInstructor(instructorId: string) {
    try {
      let error;
      if (entityType === "program") {
        const result = await supabase
          .from("program_instructors")
          .delete()
          .eq("program_id", entityId)
          .eq("instructor_id", instructorId);
        error = result.error;
      } else {
        const result = await supabase
          .from("module_instructors")
          .delete()
          .eq("module_id", entityId)
          .eq("instructor_id", instructorId);
        error = result.error;
      }

      if (error) throw error;

      toast.success("Instructor removed");
      fetchAssignments();
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function removeCoach(coachId: string) {
    try {
      let error;
      if (entityType === "program") {
        const result = await supabase
          .from("program_coaches")
          .delete()
          .eq("program_id", entityId)
          .eq("coach_id", coachId);
        error = result.error;
      } else {
        const result = await supabase
          .from("module_coaches")
          .delete()
          .eq("module_id", entityId)
          .eq("coach_id", coachId);
        error = result.error;
      }

      if (error) throw error;

      toast.success("Coach removed");
      fetchAssignments();
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between mb-2">
          <h4 className="font-medium">Instructors</h4>
          {!readOnly && (
            <Dialog open={openInstructor} onOpenChange={setOpenInstructor}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="w-fit">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Instructor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Instructor</DialogTitle>
                  <DialogDescription>
                    Select an instructor to assign to this {entityType}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select instructor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInstructors
                        .filter((u) => !instructors.find((i) => i.id === u.id))
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addInstructor} disabled={!selectedInstructor} className="w-full">
                    Assign
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {instructors.length > 0 ? (
            instructors.map((instructor) => (
              <Badge key={instructor.id} variant="default" className="flex items-center gap-1">
                {instructor.name}
                {!readOnly && (
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeInstructor(instructor.id)}
                  />
                )}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No instructors assigned</span>
          )}
        </div>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between mb-2">
          <h4 className="font-medium">Coaches</h4>
          {!readOnly && (
            <Dialog open={openCoach} onOpenChange={setOpenCoach}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="w-fit">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Coach
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Coach</DialogTitle>
                  <DialogDescription>
                    Select a coach to assign to this {entityType}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select coach..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCoaches
                        .filter((u) => !coaches.find((c) => c.id === u.id))
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addCoach} disabled={!selectedCoach} className="w-full">
                    Assign
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {coaches.length > 0 ? (
            coaches.map((coach) => (
              <Badge key={coach.id} variant="secondary" className="flex items-center gap-1">
                {coach.name}
                {!readOnly && (
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeCoach(coach.id)} />
                )}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No coaches assigned</span>
          )}
        </div>
      </div>
    </div>
  );
}
