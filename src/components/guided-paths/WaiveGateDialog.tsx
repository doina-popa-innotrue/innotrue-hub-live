import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateGateOverride } from "@/hooks/useMilestoneGates";
import type { MilestoneGate } from "@/hooks/useMilestoneGates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gate: MilestoneGate;
  goalMilestoneId: string;
}

export function WaiveGateDialog({
  open,
  onOpenChange,
  gate,
  goalMilestoneId,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createOverride = useCreateGateOverride();
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for waiving this gate.",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    try {
      await createOverride.mutateAsync({
        goal_milestone_id: goalMilestoneId,
        gate_id: gate.id,
        overridden_by: user.id,
        reason: reason.trim(),
      });

      toast({
        title: "Gate waived",
        description: `Gate "${gate.gate_label || "Assessment gate"}" has been waived.`,
      });
      setReason("");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to waive gate",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Waive Assessment Gate</DialogTitle>
          <DialogDescription>
            Override the assessment requirement for this milestone. A reason is
            required for accountability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm font-medium">
              {gate.gate_label || gate.domain_name || gate.dimension_name || "Gate"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Minimum score: {gate.min_score}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for waiving *</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this gate requirement is being waived for this client..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReason("");
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createOverride.isPending || !reason.trim()}
          >
            {createOverride.isPending ? "Waiving..." : "Waive Gate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
