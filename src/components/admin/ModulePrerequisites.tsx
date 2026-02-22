import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X, Link2, Clock, Save } from "lucide-react";

interface ModulePrerequisitesProps {
  moduleId: string;
  programId: string;
  currentModuleOrderIndex: number;
}

interface Module {
  id: string;
  title: string;
  order_index: number;
}

interface Prerequisite {
  id: string;
  prerequisite_module_id: string;
  prerequisite_module?: Module;
}

export function ModulePrerequisites({
  moduleId,
  programId,
  currentModuleOrderIndex,
}: ModulePrerequisitesProps) {
  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([]);
  const [availableModules, setAvailableModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Time-gating state
  const [availableFromDate, setAvailableFromDate] = useState<string>("");
  const [unlockAfterDays, setUnlockAfterDays] = useState<string>("");
  const [timeGateLoading, setTimeGateLoading] = useState(false);
  const [timeGateDirty, setTimeGateDirty] = useState(false);

  useEffect(() => {
    fetchData();
  }, [moduleId, programId]);

  async function fetchData() {
    setLoading(true);

    // Fetch all modules in the program (except the current one)
    const { data: modulesData } = await supabase
      .from("program_modules")
      .select("id, title, order_index")
      .eq("program_id", programId)
      .neq("id", moduleId)
      .order("order_index");

    // Fetch existing prerequisites for this module
    const { data: prereqsData } = await supabase
      .from("module_prerequisites")
      .select("id, prerequisite_module_id")
      .eq("module_id", moduleId);

    // Fetch time-gating data
    const { data: moduleData } = await supabase
      .from("program_modules")
      .select("available_from_date, unlock_after_days")
      .eq("id", moduleId)
      .single();

    if (moduleData) {
      setAvailableFromDate(moduleData.available_from_date || "");
      setUnlockAfterDays(
        moduleData.unlock_after_days != null ? String(moduleData.unlock_after_days) : "",
      );
      setTimeGateDirty(false);
    }

    if (modulesData) {
      setAvailableModules(modulesData);
    }

    if (prereqsData && modulesData) {
      // Enrich prerequisites with module data
      const enrichedPrereqs = prereqsData.map((prereq) => ({
        ...prereq,
        prerequisite_module: modulesData.find((m) => m.id === prereq.prerequisite_module_id),
      }));
      setPrerequisites(enrichedPrereqs);
    } else {
      setPrerequisites([]);
    }

    setLoading(false);
  }

  async function addPrerequisite() {
    if (!selectedModuleId) return;

    const { data, error } = await supabase
      .from("module_prerequisites")
      .insert({
        module_id: moduleId,
        prerequisite_module_id: selectedModuleId,
      })
      .select();

    if (error) {
      if (error.code === "23505") {
        toast.error("This prerequisite already exists");
      } else {
        toast.error("Failed to add prerequisite");
        console.error("Prerequisite insert error:", error);
      }
    } else if (!data || data.length === 0) {
      toast.error("Failed to add prerequisite - you may not have permission");
    } else {
      toast.success("Prerequisite added");
      setSelectedModuleId("");
      fetchData();
    }
  }

  async function removePrerequisite(prereqId: string) {
    const { error } = await supabase.from("module_prerequisites").delete().eq("id", prereqId);

    if (error) {
      toast.error("Failed to remove prerequisite");
    } else {
      toast.success("Prerequisite removed");
      fetchData();
    }
  }

  async function saveTimeGating() {
    setTimeGateLoading(true);

    const updateData: { available_from_date: string | null; unlock_after_days: number | null } = {
      available_from_date: availableFromDate || null,
      unlock_after_days: unlockAfterDays ? parseInt(unlockAfterDays, 10) : null,
    };

    // Validate unlock_after_days
    if (updateData.unlock_after_days !== null && (isNaN(updateData.unlock_after_days) || updateData.unlock_after_days < 0)) {
      toast.error("Days must be a non-negative number");
      setTimeGateLoading(false);
      return;
    }

    const { error } = await supabase
      .from("program_modules")
      .update(updateData)
      .eq("id", moduleId);

    if (error) {
      toast.error("Failed to save time-gating settings");
      console.error("Time-gating update error:", error);
    } else {
      toast.success("Time-gating settings saved");
      setTimeGateDirty(false);
    }

    setTimeGateLoading(false);
  }

  function clearTimeGating() {
    setAvailableFromDate("");
    setUnlockAfterDays("");
    setTimeGateDirty(true);
  }

  // Filter out modules that are already prerequisites
  const prereqModuleIds = new Set(prerequisites.map((p) => p.prerequisite_module_id));
  const selectableModules = availableModules.filter((m) => !prereqModuleIds.has(m.id));

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading prerequisites...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Prerequisites Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Prerequisites</span>
        </div>

        {prerequisites.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {prerequisites.map((prereq) => (
              <Badge key={prereq.id} variant="secondary" className="gap-1 pr-1">
                Module {prereq.prerequisite_module?.order_index}: {prereq.prerequisite_module?.title}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-destructive/20"
                  onClick={() => removePrerequisite(prereq.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No prerequisites set. This module is available immediately.
          </p>
        )}

        {selectableModules.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Add prerequisite..." />
              </SelectTrigger>
              <SelectContent>
                {selectableModules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    Module {module.order_index}: {module.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addPrerequisite} disabled={!selectedModuleId}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Time-Gating Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Time-Gating</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Control when this module becomes available. Both conditions must be met (the later date
          wins).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="available-from" className="text-xs">
              Available from date
            </Label>
            <Input
              id="available-from"
              type="date"
              value={availableFromDate}
              onChange={(e) => {
                setAvailableFromDate(e.target.value);
                setTimeGateDirty(true);
              }}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Module is hidden until this date
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unlock-after" className="text-xs">
              Unlock after days (from enrollment)
            </Label>
            <Input
              id="unlock-after"
              type="number"
              min="0"
              placeholder="e.g. 7"
              value={unlockAfterDays}
              onChange={(e) => {
                setUnlockAfterDays(e.target.value);
                setTimeGateDirty(true);
              }}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Days after client enrolls before module unlocks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={saveTimeGating}
            disabled={!timeGateDirty || timeGateLoading}
          >
            <Save className="h-4 w-4 mr-1" />
            {timeGateLoading ? "Saving..." : "Save"}
          </Button>
          {(availableFromDate || unlockAfterDays) && (
            <Button size="sm" variant="outline" onClick={clearTimeGating}>
              Clear
            </Button>
          )}
          {!availableFromDate && !unlockAfterDays && !timeGateDirty && (
            <span className="text-xs text-muted-foreground">
              No time-gating set. Module is available immediately.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
