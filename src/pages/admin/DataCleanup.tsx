import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { ClientFilterCombobox } from "@/components/instructor/ClientFilterCombobox";
import { DataCleanupEntityCard } from "@/components/admin/DataCleanupEntityCard";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarIcon,
  FileText,
  ClipboardList,
  BarChart3,
  X,
  Layers,
} from "lucide-react";

const SCENARIO_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "evaluated", label: "Evaluated" },
  { value: "revision_requested", label: "Revision Requested" },
];

const SNAPSHOT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const MODULE_ASSIGNMENT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "reviewed", label: "Reviewed" },
];

const MODULE_PROGRESS_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export default function DataCleanup() {
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [selectedProgramId, setSelectedProgramId] = useState("all");
  const [createdBefore, setCreatedBefore] = useState<Date | undefined>(undefined);

  // Fetch clients for the filter combobox
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["admin-cleanup-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  // Fetch programs for the filter select
  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ["admin-cleanup-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const filters = {
    userId: selectedUserId,
    programId: selectedProgramId,
    createdBefore: createdBefore ? createdBefore.toISOString() : "",
  };

  const hasActiveFilters =
    selectedUserId !== "all" || selectedProgramId !== "all" || !!createdBefore;

  const handleClearFilters = () => {
    setSelectedUserId("all");
    setSelectedProgramId("all");
    setCreatedBefore(undefined);
  };

  if (clientsLoading || programsLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Data Cleanup"
          description="Remove test data and records across entity types"
          showCreateButton={false}
        />
        <AdminLoadingState message="Loading filters..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Data Cleanup"
        description="Preview and permanently delete test data across entity types"
        showCreateButton={false}
      />

      {/* Warning alert */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Warning:</strong> Deletions are permanent and cannot be undone. Always
          preview before deleting. Use filters to target specific clients, programs, or
          date ranges.
        </AlertDescription>
      </Alert>

      {/* Shared filters card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription className="text-xs">
                Shared across all entity cards below. Narrow down which records to target.
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Client filter */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Client</label>
              <ClientFilterCombobox
                clients={clients || []}
                value={selectedUserId}
                onChange={setSelectedUserId}
              />
            </div>

            {/* Program filter */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Program</label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs?.map((prog) => (
                    <SelectItem key={prog.id} value={prog.id}>
                      {prog.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Created before date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Created before</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {createdBefore
                      ? format(createdBefore, "MMM d, yyyy")
                      : "No date filter"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={createdBefore}
                    onSelect={setCreatedBefore}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataCleanupEntityCard
          entityType="scenario_assignments"
          title="Scenario Assignments"
          description="Scenario-based assessments with paragraph responses, evaluations, and question scores"
          icon={<FileText className="h-5 w-5 text-blue-500" />}
          filters={filters}
          statusOptions={SCENARIO_STATUS_OPTIONS}
        />

        <DataCleanupEntityCard
          entityType="capability_snapshots"
          title="Capability Snapshots"
          description="Self-assessments and evaluator snapshots with ratings, notes, and linked development items"
          icon={<BarChart3 className="h-5 w-5 text-purple-500" />}
          filters={filters}
          statusOptions={SNAPSHOT_STATUS_OPTIONS}
        />

        <DataCleanupEntityCard
          entityType="module_assignments"
          title="Module Assignments"
          description="Module assignments with attachments and scoring snapshots"
          icon={<ClipboardList className="h-5 w-5 text-emerald-500" />}
          filters={filters}
          statusOptions={MODULE_ASSIGNMENT_STATUS_OPTIONS}
        />

        <DataCleanupEntityCard
          entityType="module_progress"
          title="Module Progress"
          description="Module progress records with assignments, reflections, feedback, notes, and development links"
          icon={<Layers className="h-5 w-5 text-amber-500" />}
          filters={filters}
          statusOptions={MODULE_PROGRESS_STATUS_OPTIONS}
        />
      </div>
    </div>
  );
}
