import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Plus, Pencil, Trash2, Calendar, Users, ChevronDown, ChevronUp, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CohortSessionsManager } from "./CohortSessionsManager";
import { CohortWaitlistManager } from "./CohortWaitlistManager";

interface ProgramCohortsManagerProps {
  programId: string;
}

interface Cohort {
  id: string;
  program_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  status: "upcoming" | "active" | "completed" | "cancelled";
  lead_instructor_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CohortFormData {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  capacity: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  lead_instructor_id: string;
}

const defaultFormData: CohortFormData = {
  name: "",
  description: "",
  start_date: "",
  end_date: "",
  capacity: "",
  status: "upcoming",
  lead_instructor_id: "",
};

export function ProgramCohortsManager({ programId }: ProgramCohortsManagerProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [formData, setFormData] = useState<CohortFormData>(defaultFormData);
  const [expandedCohorts, setExpandedCohorts] = useState<Set<string>>(new Set());

  const { data: cohorts, isLoading } = useQuery({
    queryKey: ["program-cohorts", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_cohorts")
        .select("*")
        .eq("program_id", programId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data as Cohort[];
    },
  });

  // Fetch instructors assigned to this program
  const { data: programInstructors } = useQuery({
    queryKey: ["program-instructors-list", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_instructors")
        .select("instructor_id, profiles:instructor_id(id, name)")
        .eq("program_id", programId);

      if (error) throw error;
      return (
        data
          ?.map((d) => {
            const profile = d.profiles as unknown as { id: string; name: string } | null;
            return profile ? { id: profile.id, name: profile.name || "Unknown" } : null;
          })
          .filter(Boolean) as { id: string; name: string }[]
      ) || [];
    },
  });

  const { data: enrollmentCounts } = useQuery({
    queryKey: ["cohort-enrollment-counts", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_enrollments")
        .select("cohort_id")
        .eq("program_id", programId)
        .not("cohort_id", "is", null);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((enrollment) => {
        const cohortId = enrollment.cohort_id as string;
        counts[cohortId] = (counts[cohortId] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: waitlistCounts } = useQuery({
    queryKey: ["cohort-waitlist-counts", programId],
    queryFn: async () => {
      const cohortIds = (cohorts || []).map((c) => c.id);
      if (cohortIds.length === 0) return {};

      const { data, error } = await supabase
        .from("cohort_waitlist")
        .select("cohort_id")
        .in("cohort_id", cohortIds);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((entry) => {
        counts[entry.cohort_id] = (counts[entry.cohort_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!cohorts?.length,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CohortFormData) => {
      const payload = {
        program_id: programId,
        name: data.name,
        description: data.description || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        capacity: data.capacity ? parseInt(data.capacity) : null,
        status: data.status,
        lead_instructor_id: data.lead_instructor_id || null,
      };

      if (editingCohort) {
        const { error } = await supabase
          .from("program_cohorts")
          .update(payload)
          .eq("id", editingCohort.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("program_cohorts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-cohorts", programId] });
      toast.success(editingCohort ? "Cohort updated" : "Cohort created");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Failed to save cohort");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (cohortId: string) => {
      const { error } = await supabase.from("program_cohorts").delete().eq("id", cohortId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-cohorts", programId] });
      toast.success("Cohort deleted");
    },
    onError: () => {
      toast.error("Failed to delete cohort");
    },
  });

  const handleOpenDialog = (cohort?: Cohort) => {
    if (cohort) {
      setEditingCohort(cohort);
      setFormData({
        name: cohort.name,
        description: cohort.description || "",
        start_date: cohort.start_date || "",
        end_date: cohort.end_date || "",
        capacity: cohort.capacity?.toString() || "",
        status: cohort.status,
        lead_instructor_id: cohort.lead_instructor_id || "",
      });
    } else {
      setEditingCohort(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCohort(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Cohort name is required");
      return;
    }
    saveMutation.mutate(formData);
  };

  const toggleExpanded = (cohortId: string) => {
    const newExpanded = new Set(expandedCohorts);
    if (newExpanded.has(cohortId)) {
      newExpanded.delete(cohortId);
    } else {
      newExpanded.add(cohortId);
    }
    setExpandedCohorts(newExpanded);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "upcoming":
        return "secondary";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading cohorts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Program Cohorts</h3>
          <p className="text-sm text-muted-foreground">
            Manage cohorts (specific runs) of this program with their own schedules
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Cohort
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCohort ? "Edit Cohort" : "Create Cohort"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Cohort Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., January 2026 Cohort"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description for this cohort"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="0"
                    placeholder="Max participants"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as CohortFormData["status"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lead Instructor */}
              {programInstructors && programInstructors.length > 0 && (
                <div className="space-y-2">
                  <Label>Lead Instructor</Label>
                  <Select
                    value={formData.lead_instructor_id || "none"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, lead_instructor_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No lead instructor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No lead instructor</SelectItem>
                      {programInstructors.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The instructor who leads this cohort. Sessions inherit this by default.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingCohort ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {cohorts?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No cohorts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first cohort to schedule live sessions
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cohorts?.map((cohort) => {
            const enrolledCount = enrollmentCounts?.[cohort.id] || 0;
            const waitlistCount = waitlistCounts?.[cohort.id] || 0;
            const isExpanded = expandedCohorts.has(cohort.id);

            return (
              <Collapsible
                key={cohort.id}
                open={isExpanded}
                onOpenChange={() => toggleExpanded(cohort.id)}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{cohort.name}</CardTitle>
                          <Badge variant={getStatusVariant(cohort.status)}>{cohort.status}</Badge>
                        </div>
                        {cohort.description && (
                          <CardDescription className="mt-1">{cohort.description}</CardDescription>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {cohort.start_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(cohort.start_date), "MMM d, yyyy")}
                              {cohort.end_date &&
                                ` - ${format(new Date(cohort.end_date), "MMM d, yyyy")}`}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {enrolledCount}
                            {cohort.capacity ? ` / ${cohort.capacity}` : ""} enrolled
                          </span>
                          {waitlistCount > 0 && (
                            <Badge variant="outline" className="text-amber-600 text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {waitlistCount} waiting
                            </Badge>
                          )}
                          {cohort.lead_instructor_id && (
                            <span className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              {programInstructors?.find(
                                (i) => i.id === cohort.lead_instructor_id,
                              )?.name || "Instructor"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(cohort)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this cohort?")) {
                              deleteMutation.mutate(cohort.id);
                            }
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="border-t pt-4">
                      <CohortSessionsManager
                        cohortId={cohort.id}
                        programId={programId}
                        cohortInstructorId={cohort.lead_instructor_id}
                        programInstructors={programInstructors || []}
                      />
                      <CohortWaitlistManager
                        cohortId={cohort.id}
                        cohortName={cohort.name}
                        programId={programId}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
