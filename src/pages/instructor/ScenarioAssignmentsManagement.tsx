import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Search, FileText, Eye, CheckCircle, Clock, AlertCircle, 
  User, Loader2, Send, BookOpen, GraduationCap, Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLoadingState } from "@/components/admin";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { 
  useScenarioTemplates,
  useScenarioAssignments, 
  useScenarioAssignmentMutations,
  useModuleScenarios,
} from "@/hooks/useScenarios";
import type { ScenarioAssignment, ScenarioAssignmentStatus } from "@/types/scenarios";
import { format } from "date-fns";

const statusConfig: Record<ScenarioAssignmentStatus, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", icon: Clock, variant: "secondary" },
  submitted: { label: "Submitted", icon: Send, variant: "default" },
  in_review: { label: "In Review", icon: AlertCircle, variant: "outline" },
  evaluated: { label: "Evaluated", icon: CheckCircle, variant: "default" },
};

export default function ScenarioAssignmentsManagement() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Use the hook which now respects RLS - staff only see their assigned clients' assignments
  const { data: assignments, isLoading } = useScenarioAssignments();

  // Filter assignments
  const filteredAssignments = assignments?.filter((assignment) => {
    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
    const matchesSearch = !searchQuery || 
      assignment.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.scenario_templates?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Group by status for tabs
  const pendingReview = assignments?.filter(a => a.status === "submitted" || a.status === "in_review") || [];
  const evaluated = assignments?.filter(a => a.status === "evaluated") || [];

  if (isLoading) {
    return <AdminLoadingState message="Loading scenario assignments..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scenario Assignments</h1>
          <p className="text-muted-foreground">Assign scenarios to clients and evaluate their responses</p>
        </div>
        <AssignScenarioDialog />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{assignments?.filter(a => a.status === "draft").length || 0}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{pendingReview.length}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{evaluated.length}</p>
                <p className="text-sm text-muted-foreground">Evaluated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{assignments?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Review
            {pendingReview.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingReview.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingReview.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-primary mb-4" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-muted-foreground">No scenarios pending review</p>
              </CardContent>
            </Card>
          ) : (
            <AssignmentTable 
              assignments={pendingReview} 
              onViewAssignment={(id) => navigate(`/teaching/scenarios/${id}`)} 
            />
          )}
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by client or template..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="evaluated">Evaluated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {!filteredAssignments || filteredAssignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No assignments found
                </div>
              ) : (
                <AssignmentTable 
                  assignments={filteredAssignments} 
                  onViewAssignment={(id) => navigate(`/teaching/scenarios/${id}`)} 
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Assignment Table Component
// ============================================================================

function AssignmentTable({
  assignments,
  onViewAssignment,
}: {
  assignments: ScenarioAssignment[];
  onViewAssignment: (id: string) => void;
}) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Scenario</TableHead>
            <TableHead>Context</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => {
            const status = statusConfig[assignment.status];
            const StatusIcon = status.icon;
            
            return (
              <TableRow key={assignment.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{assignment.profiles?.name || "Unknown"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{assignment.scenario_templates?.title || "Unknown"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <AssignmentContext assignment={assignment} />
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(assignment.assigned_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {assignment.submitted_at 
                    ? format(new Date(assignment.submitted_at), "MMM d, yyyy")
                    : "-"
                  }
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewAssignment(assignment.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================================
// Assignment Context Display
// ============================================================================

function AssignmentContext({ assignment }: { assignment: ScenarioAssignment }) {
  const programName = assignment.client_enrollments?.programs?.name;
  const moduleTitle = assignment.program_modules?.title;

  if (!programName && !moduleTitle) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {programName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <GraduationCap className="h-3 w-3" />
          <span className="truncate max-w-[120px]">{programName}</span>
        </div>
      )}
      {moduleTitle && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <BookOpen className="h-3 w-3" />
          <span className="truncate max-w-[120px]">{moduleTitle}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Assign Scenario Dialog
// ============================================================================

interface EnrollmentWithDetails {
  id: string;
  program_id: string;
  client_user_id: string;
  tier: string | null;
  status: string;
  programs: { id: string; name: string } | null;
  profiles: { id: string; name: string } | null;
}

function AssignScenarioDialog() {
  const [open, setOpen] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<"single" | "bulk">("single");
  const [formData, setFormData] = useState({
    template_id: "",
    user_id: "",
    enrollment_id: "",
    module_id: "",
  });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { createMutation, bulkCreateMutation } = useScenarioAssignmentMutations();

  // Fetch active templates
  const { data: templates } = useScenarioTemplates();
  const activeTemplates = templates?.filter(t => t.is_active) || [];

  // Fetch enrollments with client info
  const { data: enrollments } = useQuery({
    queryKey: ["enrollments-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_enrollments")
        .select(`
          id,
          program_id,
          client_user_id,
          tier,
          status
        `)
        .in("status", ["active", "paused"]);
      
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch program names
      const programIds = [...new Set(data.map(e => e.program_id).filter((id): id is string => id != null))];
      const { data: programs } = await supabase
        .from("programs")
        .select("id, name")
        .in("id", programIds);
      const programMap = new Map(programs?.map(p => [p.id, p]) || []);

      // Fetch client profiles
      const userIds = [...new Set(data.map(e => e.client_user_id).filter((id): id is string => !!id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(e => ({
        ...e,
        programs: programMap.get(e.program_id ?? '') || null,
        profiles: e.client_user_id ? profileMap.get(e.client_user_id) || null : null,
      })) as EnrollmentWithDetails[];
    },
  });

  // Fetch modules for selected enrollment's program
  const selectedEnrollment = enrollments?.find(e => e.id === formData.enrollment_id);
  const { data: modules } = useQuery({
    queryKey: ["modules-for-program", selectedEnrollment?.program_id],
    queryFn: async () => {
      if (!selectedEnrollment?.program_id) return [];
      const { data, error } = await supabase
        .from("program_modules")
        .select("id, title, order_index")
        .eq("program_id", selectedEnrollment.program_id)
        .eq("is_active", true)
        .order("order_index");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedEnrollment?.program_id,
  });

  // Filter scenarios linked to selected module (if any)
  const { data: linkedScenarios } = useModuleScenarios(formData.module_id || undefined);

  // For bulk mode: group enrollments by program
  const enrollmentsByProgram = useMemo(() => {
    if (!enrollments) return new Map<string, EnrollmentWithDetails[]>();
    const map = new Map<string, EnrollmentWithDetails[]>();
    enrollments.forEach(e => {
      const programId = e.program_id;
      if (!map.has(programId)) map.set(programId, []);
      map.get(programId)!.push(e);
    });
    return map;
  }, [enrollments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (assignmentMode === "single") {
      if (!formData.template_id || !formData.user_id) {
        toast({ title: "Error", description: "Please select template and client", variant: "destructive" });
        return;
      }

      createMutation.mutate({
        template_id: formData.template_id,
        user_id: formData.user_id,
        enrollment_id: formData.enrollment_id || undefined,
        module_id: formData.module_id || undefined,
      }, {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        }
      });
    } else {
      // Bulk mode
      if (!formData.template_id || selectedUserIds.length === 0) {
        toast({ title: "Error", description: "Please select template and at least one client", variant: "destructive" });
        return;
      }

      // Get enrollment IDs for selected users
      const selectedEnrollments = enrollments?.filter(e => 
        e.client_user_id && selectedUserIds.includes(e.client_user_id)
      ) || [];

      bulkCreateMutation.mutate({
        template_id: formData.template_id,
        user_ids: selectedUserIds,
        enrollment_ids: selectedEnrollments.map(e => e.id),
        module_id: formData.module_id || undefined,
      }, {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        }
      });
    }
  };

  const resetForm = () => {
    setFormData({ template_id: "", user_id: "", enrollment_id: "", module_id: "" });
    setSelectedUserIds([]);
    setAssignmentMode("single");
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllInProgram = (programId: string) => {
    const programEnrollments = enrollmentsByProgram.get(programId) || [];
    const userIdsInProgram = programEnrollments.map(e => e.client_user_id).filter((id): id is string => !!id);
    setSelectedUserIds(prev => [...new Set([...prev, ...userIdsInProgram])]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Assign Scenario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Scenario to Client(s)</DialogTitle>
          <DialogDescription>
            Select a scenario template and assign it to one or multiple clients
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={assignmentMode} onValueChange={(v) => setAssignmentMode(v as "single" | "bulk")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="gap-2">
              <User className="h-4 w-4" />
              Single Client
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Users className="h-4 w-4" />
              Bulk Assign
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Template Selection (shared) */}
            <div>
              <Label>Scenario Template *</Label>
              <Select
                value={formData.template_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, template_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a scenario..." />
                </SelectTrigger>
                <SelectContent>
                  {linkedScenarios && linkedScenarios.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Linked to Module</div>
                      {linkedScenarios.map((ls) => (
                        <SelectItem key={ls.template_id} value={ls.template_id}>
                          {ls.scenario_templates?.title}
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t mt-1 pt-1">All Templates</div>
                    </>
                  )}
                  {activeTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="single" className="mt-0 space-y-4">
              {/* Enrollment Selection */}
              <div>
                <Label>Enrollment (optional)</Label>
                <Select
                  value={formData.enrollment_id}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    enrollment_id: value,
                    user_id: enrollments?.find(e => e.id === value)?.client_user_id ?? prev.user_id,
                    module_id: "", // Reset module when enrollment changes
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select enrollment context..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No specific enrollment</SelectItem>
                    {enrollments?.map((enrollment) => (
                      <SelectItem key={enrollment.id} value={enrollment.id}>
                        {enrollment.profiles?.name || "Unknown"} — {enrollment.programs?.name || "Unknown Program"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Module Selection (only if enrollment selected) */}
              {formData.enrollment_id && modules && modules.length > 0 && (
                <div>
                  <Label>Module (optional)</Label>
                  <Select
                    value={formData.module_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, module_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select module..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No specific module</SelectItem>
                      {modules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.order_index + 1}. {module.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Client Selection (if no enrollment, show all clients) */}
              {!formData.enrollment_id && (
                <div>
                  <Label>Client *</Label>
                  <Select
                    value={formData.user_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {enrollments?.map((enrollment) => enrollment.profiles && (
                        <SelectItem key={enrollment.profiles.id} value={enrollment.profiles.id}>
                          {enrollment.profiles.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bulk" className="mt-0 space-y-4">
              <div>
                <Label>Select Clients ({selectedUserIds.length} selected)</Label>
                <ScrollArea className="h-[200px] border rounded-md p-2 mt-1">
                  {Array.from(enrollmentsByProgram.entries()).map(([programId, programEnrollments]) => {
                    const program = programEnrollments[0]?.programs;
                    return (
                      <div key={programId} className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{program?.name || "Unknown Program"}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => selectAllInProgram(programId)}
                          >
                            Select All
                          </Button>
                        </div>
                        <div className="space-y-1 pl-2">
                          {programEnrollments.map((enrollment) => {
                            if (!enrollment.profiles || !enrollment.client_user_id) return null;
                            const isSelected = selectedUserIds.includes(enrollment.client_user_id);
                            return (
                              <div 
                                key={enrollment.id} 
                                className="flex items-center gap-2 py-1"
                              >
                                <Checkbox
                                  id={enrollment.id}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleUserSelection(enrollment.client_user_id!)}
                                />
                                <label 
                                  htmlFor={enrollment.id}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {enrollment.profiles.name}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </ScrollArea>
              </div>
            </TabsContent>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || bulkCreateMutation.isPending}
              >
                {(createMutation.isPending || bulkCreateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {assignmentMode === "bulk" ? `Assign to ${selectedUserIds.length} Clients` : "Assign"}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
