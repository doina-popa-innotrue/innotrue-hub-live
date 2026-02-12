import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Program {
  id: string;
  name: string;
}

interface ModuleProgramTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: {
    id: string;
    title: string;
    description: string | null;
    module_type: string;
    estimated_minutes: number;
    links: any;
    tier_required: string | null;
    is_active: boolean;
    program_id: string;
  } | null;
  mode: "copy" | "move";
  currentProgramId: string;
  onComplete: () => void;
}

export function ModuleProgramTransferDialog({
  open,
  onOpenChange,
  module,
  mode,
  currentProgramId,
  onComplete,
}: ModuleProgramTransferDialogProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (open) {
      fetchPrograms();
      setSelectedProgramId("");
    }
  }, [open]);

  async function fetchPrograms() {
    setFetching(true);
    const { data, error } = await supabase
      .from("programs")
      .select("id, name")
      .neq("id", currentProgramId)
      .order("name");

    if (error) {
      toast.error("Failed to load programs");
      setPrograms([]);
    } else {
      setPrograms(data || []);
    }
    setFetching(false);
  }

  async function handleTransfer() {
    if (!module || !selectedProgramId) return;

    setLoading(true);
    try {
      // Get the max order_index in the target program
      const { data: existingModules } = await supabase
        .from("program_modules")
        .select("order_index")
        .eq("program_id", selectedProgramId)
        .order("order_index", { ascending: false })
        .limit(1);

      const nextOrderIndex =
        existingModules && existingModules.length > 0 ? existingModules[0].order_index + 1 : 1;

      if (mode === "copy") {
        // Create a copy in the target program
        const { error } = await supabase.from("program_modules").insert({
          program_id: selectedProgramId,
          title: module.title,
          description: module.description,
          module_type: module.module_type as "session" | "assignment" | "reflection" | "resource",
          order_index: nextOrderIndex,
          estimated_minutes: module.estimated_minutes,
          links: module.links,
          tier_required: null, // Reset tier since target program may have different tiers
          is_active: module.is_active,
        });

        if (error) throw error;
        toast.success("Module copied to program!");
      } else {
        // Move the module to the target program
        const { error } = await supabase
          .from("program_modules")
          .update({
            program_id: selectedProgramId,
            order_index: nextOrderIndex,
            tier_required: null, // Reset tier since target program may have different tiers
          })
          .eq("id", module.id);

        if (error) throw error;

        // Reorder remaining modules in source program
        const { data: sourceModules } = await supabase
          .from("program_modules")
          .select("id, order_index")
          .eq("program_id", currentProgramId)
          .order("order_index");

        if (sourceModules) {
          const updates = sourceModules.map((m, index) =>
            supabase
              .from("program_modules")
              .update({ order_index: index + 1 })
              .eq("id", m.id),
          );
          await Promise.all(updates);
        }

        toast.success("Module moved to program!");
      }

      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      toast.error(`Failed to ${mode} module: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const targetProgram = programs.find((p) => p.id === selectedProgramId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "copy" ? "Copy" : "Move"} Module to Program</DialogTitle>
          <DialogDescription>
            {mode === "copy"
              ? `Create a copy of "${module?.title}" in another program.`
              : `Move "${module?.title}" to another program. It will be removed from the current program.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="target-program">Target Program</Label>
            {fetching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading programs...
              </div>
            ) : programs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other programs available.</p>
            ) : (
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger id="target-program">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedProgramId && (
            <p className="text-sm text-muted-foreground">
              The module's tier requirement will be cleared since the target program may have
              different tiers. You can reassign the tier after{" "}
              {mode === "copy" ? "copying" : "moving"}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedProgramId || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "copy" ? "Copy" : "Move"} to {targetProgram?.name || "Program"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
