import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  UserPlus,
  X,
  ArrowRight,
  Info,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AdminPageHeader } from "@/components/admin";

type AssignmentSource = "direct" | "program" | "module";
type StaffRole = "instructor" | "coach";

interface Assignment {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  staffAvatar: string | null;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientAvatar: string | null;
  role: StaffRole;
  source: AssignmentSource;
  sourceId: string;
  sourceName: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: StaffRole;
}

interface Client {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export default function StaffAssignments() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"by-client" | "by-staff">("by-client");

  // For new assignment dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRole, setSelectedRole] = useState<StaffRole>("instructor");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAssignments();
    loadAvailableStaffAndClients();
  }, []);

  async function loadAssignments() {
    setLoading(true);
    try {
      const allAssignments: Assignment[] = [];

      // Fetch all 6 assignment sources in parallel (instead of sequential + N+1)
      const [
        { data: directInstructors },
        { data: directCoaches },
        { data: programInstructors },
        { data: programCoaches },
        { data: moduleInstructors },
        { data: moduleCoaches },
      ] = await Promise.all([
        supabase.from("client_instructors").select(`
          id, instructor_id, client_id,
          instructor:profiles!client_instructors_instructor_id_fkey(id, name, email, avatar_url),
          client:profiles!client_instructors_client_id_fkey(id, name, email, avatar_url)
        `),
        supabase.from("client_coaches").select(`
          id, coach_id, client_id,
          coach:profiles!client_coaches_coach_id_fkey(id, name, email, avatar_url),
          client:profiles!client_coaches_client_id_fkey(id, name, email, avatar_url)
        `),
        supabase.from("program_instructors").select(`
          id, instructor_id, program_id,
          instructor:profiles!program_instructors_instructor_id_fkey(id, name, email, avatar_url),
          program:programs!program_instructors_program_id_fkey(id, name, slug)
        `),
        supabase.from("program_coaches").select(`
          id, coach_id, program_id,
          coach:profiles!program_coaches_coach_id_fkey(id, name, email, avatar_url),
          program:programs!program_coaches_program_id_fkey(id, name, slug)
        `),
        supabase.from("module_instructors").select(`
          id, instructor_id, module_id,
          instructor:profiles!module_instructors_instructor_id_fkey(id, name, email, avatar_url),
          module:program_modules!module_instructors_module_id_fkey(id, title, program_id)
        `),
        supabase.from("module_coaches").select(`
          id, coach_id, module_id,
          coach:profiles!module_coaches_coach_id_fkey(id, name, email, avatar_url),
          module:program_modules!module_coaches_module_id_fkey(id, title, program_id)
        `),
      ]);

      // Collect all program IDs that need enrollment lookups
      const programIds = new Set<string>();
      programInstructors?.forEach((pi) => programIds.add(pi.program_id));
      programCoaches?.forEach((pc) => programIds.add(pc.program_id));
      moduleInstructors?.forEach((mi) => {
        if (mi.module) programIds.add((mi.module as any).program_id);
      });
      moduleCoaches?.forEach((mc) => {
        if (mc.module) programIds.add((mc.module as any).program_id);
      });

      // Batch-fetch ALL enrollments for these programs in ONE query (replaces N+1 loops)
      let enrollmentsByProgram = new Map<
        string,
        { client_user_id: string | null; client: any }[]
      >();
      if (programIds.size > 0) {
        const { data: allEnrollments } = await supabase
          .from("client_enrollments")
          .select(
            `client_user_id, program_id,
            client:profiles!client_enrollments_client_user_id_fkey(id, name, email, avatar_url)`,
          )
          .in("program_id", Array.from(programIds))
          .not("client_user_id", "is", null);

        if (allEnrollments) {
          for (const e of allEnrollments) {
            const list = enrollmentsByProgram.get(e.program_id) || [];
            list.push(e);
            enrollmentsByProgram.set(e.program_id, list);
          }
        }
      }

      // 1. Direct client-instructor assignments
      if (directInstructors) {
        for (const di of directInstructors) {
          if (di.instructor && di.client) {
            allAssignments.push({
              id: `direct-inst-${di.id}`,
              staffId: di.instructor_id,
              staffName: (di.instructor as any).name || "Unknown",
              staffEmail: (di.instructor as any).email || "",
              staffAvatar: (di.instructor as any).avatar_url,
              clientId: di.client_id,
              clientName: (di.client as any).name || "Unknown",
              clientEmail: (di.client as any).email || "",
              clientAvatar: (di.client as any).avatar_url,
              role: "instructor",
              source: "direct",
              sourceId: di.id,
              sourceName: "Direct Assignment",
            });
          }
        }
      }

      // 2. Direct client-coach assignments
      if (directCoaches) {
        for (const dc of directCoaches) {
          if (dc.coach && dc.client) {
            allAssignments.push({
              id: `direct-coach-${dc.id}`,
              staffId: dc.coach_id,
              staffName: (dc.coach as any).name || "Unknown",
              staffEmail: (dc.coach as any).email || "",
              staffAvatar: (dc.coach as any).avatar_url,
              clientId: dc.client_id,
              clientName: (dc.client as any).name || "Unknown",
              clientEmail: (dc.client as any).email || "",
              clientAvatar: (dc.client as any).avatar_url,
              role: "coach",
              source: "direct",
              sourceId: dc.id,
              sourceName: "Direct Assignment",
            });
          }
        }
      }

      // 3. Program-level instructor assignments (using batch enrollment map)
      if (programInstructors) {
        for (const pi of programInstructors) {
          if (!pi.instructor) continue;
          const enrollments = enrollmentsByProgram.get(pi.program_id) || [];
          for (const enroll of enrollments) {
            if (enroll.client) {
              allAssignments.push({
                id: `prog-inst-${pi.id}-${enroll.client_user_id}`,
                staffId: pi.instructor_id,
                staffName: (pi.instructor as any).name || "Unknown",
                staffEmail: (pi.instructor as any).email || "",
                staffAvatar: (pi.instructor as any).avatar_url,
                clientId: enroll.client_user_id!,
                clientName: (enroll.client as any).name || "Unknown",
                clientEmail: (enroll.client as any).email || "",
                clientAvatar: (enroll.client as any).avatar_url,
                role: "instructor",
                source: "program",
                sourceId: pi.program_id,
                sourceName: (pi.program as any)?.name || "Unknown Program",
              });
            }
          }
        }
      }

      // 4. Program-level coach assignments (using batch enrollment map)
      if (programCoaches) {
        for (const pc of programCoaches) {
          if (!pc.coach) continue;
          const enrollments = enrollmentsByProgram.get(pc.program_id) || [];
          for (const enroll of enrollments) {
            if (enroll.client) {
              allAssignments.push({
                id: `prog-coach-${pc.id}-${enroll.client_user_id}`,
                staffId: pc.coach_id,
                staffName: (pc.coach as any).name || "Unknown",
                staffEmail: (pc.coach as any).email || "",
                staffAvatar: (pc.coach as any).avatar_url,
                clientId: enroll.client_user_id!,
                clientName: (enroll.client as any).name || "Unknown",
                clientEmail: (enroll.client as any).email || "",
                clientAvatar: (enroll.client as any).avatar_url,
                role: "coach",
                source: "program",
                sourceId: pc.program_id,
                sourceName: (pc.program as any)?.name || "Unknown Program",
              });
            }
          }
        }
      }

      // 5. Module-level instructor assignments (using batch enrollment map)
      if (moduleInstructors) {
        for (const mi of moduleInstructors) {
          if (!mi.module || !mi.instructor) continue;
          const programId = (mi.module as any).program_id;
          const enrollments = enrollmentsByProgram.get(programId) || [];
          for (const enroll of enrollments) {
            if (enroll.client) {
              allAssignments.push({
                id: `mod-inst-${mi.id}-${enroll.client_user_id}`,
                staffId: mi.instructor_id,
                staffName: (mi.instructor as any).name || "Unknown",
                staffEmail: (mi.instructor as any).email || "",
                staffAvatar: (mi.instructor as any).avatar_url,
                clientId: enroll.client_user_id!,
                clientName: (enroll.client as any).name || "Unknown",
                clientEmail: (enroll.client as any).email || "",
                clientAvatar: (enroll.client as any).avatar_url,
                role: "instructor",
                source: "module",
                sourceId: mi.module_id,
                sourceName: (mi.module as any)?.title || "Unknown Module",
              });
            }
          }
        }
      }

      // 6. Module-level coach assignments (using batch enrollment map)
      if (moduleCoaches) {
        for (const mc of moduleCoaches) {
          if (!mc.module || !mc.coach) continue;
          const programId = (mc.module as any).program_id;
          const enrollments = enrollmentsByProgram.get(programId) || [];
          for (const enroll of enrollments) {
            if (enroll.client) {
              allAssignments.push({
                id: `mod-coach-${mc.id}-${enroll.client_user_id}`,
                staffId: mc.coach_id,
                staffName: (mc.coach as any).name || "Unknown",
                staffEmail: (mc.coach as any).email || "",
                staffAvatar: (mc.coach as any).avatar_url,
                clientId: enroll.client_user_id!,
                clientName: (enroll.client as any).name || "Unknown",
                clientEmail: (enroll.client as any).email || "",
                clientAvatar: (enroll.client as any).avatar_url,
                role: "coach",
                source: "module",
                sourceId: mc.module_id,
                sourceName: (mc.module as any)?.title || "Unknown Module",
              });
            }
          }
        }
      }

      setAssignments(allAssignments);
    } catch (error) {
      console.error("Error loading assignments:", error);
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableStaffAndClients() {
    // Load staff (instructors and coaches)
    const { data: instructorRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "instructor");

    const { data: coachRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "coach");

    const staffIds = new Set<string>();
    const staffRoleMap: Record<string, StaffRole[]> = {};

    instructorRoles?.forEach((r) => {
      staffIds.add(r.user_id);
      staffRoleMap[r.user_id] = [...(staffRoleMap[r.user_id] || []), "instructor"];
    });
    coachRoles?.forEach((r) => {
      staffIds.add(r.user_id);
      staffRoleMap[r.user_id] = [...(staffRoleMap[r.user_id] || []), "coach"];
    });

    if (staffIds.size > 0) {
      const { data: staffProfiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", Array.from(staffIds));

      if (staffProfiles) {
        const staff: StaffMember[] = [];
        staffProfiles.forEach((p) => {
          const roles = staffRoleMap[p.id] || [];
          roles.forEach((role) => {
            staff.push({
              id: p.id,
              name: p.name || "Unknown",
              email: "",
              avatar_url: p.avatar_url,
              role,
            });
          });
        });
        setAvailableStaff(staff);
      }
    }

    // Load clients
    const { data: clientRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");

    if (clientRoles && clientRoles.length > 0) {
      const { data: clientProfiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in(
          "id",
          clientRoles.map((r) => r.user_id),
        );

      if (clientProfiles) {
        setAvailableClients(
          clientProfiles.map((p) => ({
            id: p.id,
            name: p.name || "Unknown",
            email: "",
            avatar_url: p.avatar_url,
          })),
        );
      }
    }
  }

  async function createDirectAssignment() {
    if (!selectedStaff || !selectedClient) return;

    setSubmitting(true);
    try {
      let error;
      if (selectedRole === "instructor") {
        const result = await supabase.from("client_instructors").insert({
          client_id: selectedClient,
          instructor_id: selectedStaff,
        });
        error = result.error;
      } else {
        const result = await supabase.from("client_coaches").insert({
          client_id: selectedClient,
          coach_id: selectedStaff,
        });
        error = result.error;
      }

      if (error) throw error;

      toast.success("Assignment created successfully");
      setDialogOpen(false);
      setSelectedStaff("");
      setSelectedClient("");
      loadAssignments();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("This assignment already exists");
      } else {
        toast.error("Failed to create assignment");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function removeDirectAssignment(assignment: Assignment) {
    if (assignment.source !== "direct") {
      toast.error("Only direct assignments can be removed from here");
      return;
    }

    try {
      const table = assignment.role === "instructor" ? "client_instructors" : "client_coaches";
      const { error } = await supabase.from(table).delete().eq("id", assignment.sourceId);

      if (error) throw error;

      toast.success("Assignment removed");
      loadAssignments();
    } catch (error) {
      toast.error("Failed to remove assignment");
    }
  }

  async function promoteToDirectAssignment(assignment: Assignment) {
    // Check if direct assignment already exists
    let existing;
    if (assignment.role === "instructor") {
      const { data } = await supabase
        .from("client_instructors")
        .select("id")
        .eq("client_id", assignment.clientId)
        .eq("instructor_id", assignment.staffId)
        .maybeSingle();
      existing = data;
    } else {
      const { data } = await supabase
        .from("client_coaches")
        .select("id")
        .eq("client_id", assignment.clientId)
        .eq("coach_id", assignment.staffId)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      toast.info("Direct assignment already exists");
      return;
    }

    try {
      let error;
      if (assignment.role === "instructor") {
        const result = await supabase.from("client_instructors").insert({
          client_id: assignment.clientId,
          instructor_id: assignment.staffId,
        });
        error = result.error;
      } else {
        const result = await supabase.from("client_coaches").insert({
          client_id: assignment.clientId,
          coach_id: assignment.staffId,
        });
        error = result.error;
      }

      if (error) throw error;

      toast.success("Promoted to direct assignment");
      loadAssignments();
    } catch (error) {
      toast.error("Failed to promote assignment");
    }
  }

  // Filter assignments
  const filteredAssignments = assignments.filter((a) => {
    const matchesSearch =
      a.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.sourceName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || a.role === roleFilter;
    const matchesSource = sourceFilter === "all" || a.source === sourceFilter;
    return matchesSearch && matchesRole && matchesSource;
  });

  // Group by client or staff based on active tab
  const groupedData =
    activeTab === "by-client"
      ? groupByClient(filteredAssignments)
      : groupByStaff(filteredAssignments);

  function groupByClient(items: Assignment[]) {
    const groups: Record<
      string,
      {
        client: { id: string; name: string; email: string; avatar: string | null };
        assignments: Assignment[];
      }
    > = {};
    items.forEach((a) => {
      if (!groups[a.clientId]) {
        groups[a.clientId] = {
          client: {
            id: a.clientId,
            name: a.clientName,
            email: a.clientEmail,
            avatar: a.clientAvatar,
          },
          assignments: [],
        };
      }
      groups[a.clientId].assignments.push(a);
    });
    return Object.values(groups).sort((a, b) => a.client.name.localeCompare(b.client.name));
  }

  function groupByStaff(items: Assignment[]) {
    const groups: Record<
      string,
      {
        staff: { id: string; name: string; email: string; avatar: string | null; role: StaffRole };
        assignments: Assignment[];
      }
    > = {};
    items.forEach((a) => {
      const key = `${a.staffId}-${a.role}`;
      if (!groups[key]) {
        groups[key] = {
          staff: {
            id: a.staffId,
            name: a.staffName,
            email: a.staffEmail,
            avatar: a.staffAvatar,
            role: a.role,
          },
          assignments: [],
        };
      }
      groups[key].assignments.push(a);
    });
    return Object.values(groups).sort((a, b) => a.staff.name.localeCompare(b.staff.name));
  }

  const getSourceBadge = (source: AssignmentSource) => {
    switch (source) {
      case "direct":
        return (
          <Badge variant="default" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            Direct
          </Badge>
        );
      case "program":
        return (
          <Badge variant="secondary" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            Program
          </Badge>
        );
      case "module":
        return (
          <Badge variant="outline" className="text-xs">
            <Layers className="h-3 w-3 mr-1" />
            Module
          </Badge>
        );
    }
  };

  const getRoleBadge = (role: StaffRole) => {
    return role === "instructor" ? (
      <Badge variant="default" className="text-xs">
        <GraduationCap className="h-3 w-3 mr-1" />
        Instructor
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-xs">
        <Users className="h-3 w-3 mr-1" />
        Coach
      </Badge>
    );
  };

  // Stats
  const stats = {
    total: assignments.length,
    direct: assignments.filter((a) => a.source === "direct").length,
    program: assignments.filter((a) => a.source === "program").length,
    module: assignments.filter((a) => a.source === "module").length,
    instructors: new Set(assignments.filter((a) => a.role === "instructor").map((a) => a.staffId))
      .size,
    coaches: new Set(assignments.filter((a) => a.role === "coach").map((a) => a.staffId)).size,
    clients: new Set(assignments.map((a) => a.clientId)).size,
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Staff Assignments"
        description="View and manage all instructor and coach assignments across the platform"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Assignments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.direct}</div>
            <p className="text-xs text-muted-foreground">Direct</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.program}</div>
            <p className="text-xs text-muted-foreground">Via Program</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.module}</div>
            <p className="text-xs text-muted-foreground">Via Module</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.instructors}</div>
            <p className="text-xs text-muted-foreground">Instructors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.coaches}</div>
            <p className="text-xs text-muted-foreground">Coaches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.clients}</div>
            <p className="text-xs text-muted-foreground">Clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>All Assignments</CardTitle>
              <CardDescription>
                View all staff-client relationships and their sources
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Direct Assignment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Direct Assignment</DialogTitle>
                  <DialogDescription>
                    Directly assign an instructor or coach to a client
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Select
                      value={selectedRole}
                      onValueChange={(v) => setSelectedRole(v as StaffRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instructor">Instructor</SelectItem>
                        <SelectItem value="coach">Coach</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Staff Member</label>
                    <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStaff
                          .filter((s) => s.role === selectedRole)
                          .map((staff) => (
                            <SelectItem key={`${staff.id}-${staff.role}`} value={staff.id}>
                              {staff.name} ({staff.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Client</label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name} ({client.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={createDirectAssignment}
                    disabled={!selectedStaff || !selectedClient || submitting}
                    className="w-full"
                  >
                    {submitting ? "Creating..." : "Create Assignment"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="instructor">Instructors</SelectItem>
                <SelectItem value="coach">Coaches</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="program">Program</SelectItem>
                <SelectItem value="module">Module</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "by-client" | "by-staff")}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="by-client">By Client</TabsTrigger>
              <TabsTrigger value="by-staff">By Staff</TabsTrigger>
            </TabsList>

            <TabsContent value="by-client">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : groupedData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No assignments found</div>
              ) : (
                <div className="space-y-4">
                  {(groupedData as ReturnType<typeof groupByClient>).map((group) => (
                    <Card key={group.client.id}>
                      <CardHeader className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={group.client.avatar || undefined} />
                            <AvatarFallback>
                              {group.client.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <Link
                              to={`/admin/clients/${group.client.id}`}
                              className="font-medium hover:underline"
                            >
                              {group.client.name}
                            </Link>
                            <p className="text-sm text-muted-foreground">{group.client.email}</p>
                          </div>
                          <Badge variant="outline">{group.assignments.length} assignment(s)</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Staff Member</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.assignments.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={a.staffAvatar || undefined} />
                                      <AvatarFallback>
                                        {a.staffName.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{a.staffName}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{getRoleBadge(a.role)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getSourceBadge(a.source)}
                                    <span className="text-sm text-muted-foreground">
                                      {a.sourceName}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {a.source !== "direct" && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => promoteToDirectAssignment(a)}
                                          >
                                            <ArrowRight className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Promote to direct assignment
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {a.source === "direct" && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm">
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will remove the direct assignment between{" "}
                                              {a.staffName} and {a.clientName}.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => removeDirectAssignment(a)}
                                            >
                                              Remove
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="by-staff">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : groupedData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No assignments found</div>
              ) : (
                <div className="space-y-4">
                  {(groupedData as ReturnType<typeof groupByStaff>).map((group) => (
                    <Card key={`${group.staff.id}-${group.staff.role}`}>
                      <CardHeader className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={group.staff.avatar || undefined} />
                            <AvatarFallback>
                              {group.staff.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{group.staff.name}</span>
                              {getRoleBadge(group.staff.role)}
                            </div>
                            <p className="text-sm text-muted-foreground">{group.staff.email}</p>
                          </div>
                          <Badge variant="outline">{group.assignments.length} client(s)</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Client</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.assignments.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={a.clientAvatar || undefined} />
                                      <AvatarFallback>
                                        {a.clientName.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <Link
                                      to={`/admin/clients/${a.clientId}`}
                                      className="hover:underline"
                                    >
                                      {a.clientName}
                                    </Link>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getSourceBadge(a.source)}
                                    <span className="text-sm text-muted-foreground">
                                      {a.sourceName}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {a.source !== "direct" && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => promoteToDirectAssignment(a)}
                                          >
                                            <ArrowRight className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Promote to direct assignment
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {a.source === "direct" && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm">
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will remove the direct assignment between{" "}
                                              {a.staffName} and {a.clientName}.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => removeDirectAssignment(a)}
                                            >
                                              Remove
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How Assignments Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <h4 className="font-medium">Direct Assignments</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Explicitly assigned to a specific client. These are persistent and don't change when
                program/module assignments change.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h4 className="font-medium">Program Assignments</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Assigned to a program. Automatically grants access to all clients enrolled in that
                program, including future enrollees.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-5 w-5 text-primary" />
                <h4 className="font-medium">Module Assignments</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Assigned to a specific module. Grants access to all clients enrolled in the program
                containing that module.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
