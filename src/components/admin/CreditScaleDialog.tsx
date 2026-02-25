import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle, Scale } from "lucide-react";

interface CreditScaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRatio: number;
}

interface ScaleResult {
  success: boolean;
  error?: string;
  batches_affected?: number;
  total_old_credits?: number;
  total_new_credits?: number;
  scale_factor?: number;
}

export function CreditScaleDialog({
  open,
  onOpenChange,
  currentRatio,
}: CreditScaleDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"configure" | "confirm" | "result">("configure");
  const [newRatio, setNewRatio] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isScaling, setIsScaling] = useState(false);
  const [result, setResult] = useState<ScaleResult | null>(null);

  const parsedNewRatio = parseFloat(newRatio);
  const isValidRatio = !isNaN(parsedNewRatio) && parsedNewRatio > 0 && parsedNewRatio !== currentRatio;
  const scaleFactor = isValidRatio ? parsedNewRatio / currentRatio : 1;

  const handleReset = () => {
    setStep("configure");
    setNewRatio("");
    setConfirmText("");
    setResult(null);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleProceedToConfirm = () => {
    if (!isValidRatio) return;
    setStep("confirm");
  };

  const handleScale = async () => {
    if (!user || confirmText !== "SCALE") return;

    setIsScaling(true);
    try {
      const { data, error } = await supabase.rpc("scale_credit_batches", {
        p_old_ratio: currentRatio,
        p_new_ratio: parsedNewRatio,
        p_admin_user_id: user.id,
      });

      if (error) throw error;

      const scaleResult = data as unknown as ScaleResult;
      setResult(scaleResult);

      if (scaleResult.success) {
        // Invalidate all credit-related queries
        queryClient.invalidateQueries({ queryKey: ["system-settings"] });
        queryClient.invalidateQueries({ queryKey: ["system-settings", "credit_to_eur_ratio"] });
        queryClient.invalidateQueries({ queryKey: ["user-credit-summary"] });
        queryClient.invalidateQueries({ queryKey: ["credit-batches"] });
        queryClient.invalidateQueries({ queryKey: ["credit-topup-packages"] });
        queryClient.invalidateQueries({ queryKey: ["admin-credit-topup-packages"] });
        toast.success("Credit balances scaled successfully");
      } else {
        toast.error(scaleResult.error || "Scale operation failed");
      }

      setStep("result");
    } catch (error: any) {
      toast.error(error.message || "Failed to scale credit balances");
      setResult({ success: false, error: error.message });
      setStep("result");
    } finally {
      setIsScaling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Scale Credit Balances
          </DialogTitle>
          <DialogDescription>
            {step === "configure" &&
              "Proportionally scale all credit balances when changing the credit-to-EUR ratio."}
            {step === "confirm" &&
              "Review the scaling operation carefully. This action cannot be undone."}
            {step === "result" && "Scaling operation complete."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Configure */}
        {step === "configure" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Ratio</Label>
                <Input value={`${currentRatio} credits = EUR 1`} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-ratio">New Ratio</Label>
                <Input
                  id="new-ratio"
                  type="number"
                  min="0.01"
                  step="0.5"
                  placeholder="e.g. 3"
                  value={newRatio}
                  onChange={(e) => setNewRatio(e.target.value)}
                />
              </div>
            </div>

            {isValidRatio && (
              <div className="space-y-3">
                <Alert className="border-blue-500/30 bg-blue-500/10">
                  <AlertDescription className="text-blue-600 dark:text-blue-300 space-y-2">
                    <p className="font-medium">Preview:</p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      <li>
                        Scale factor: ×{scaleFactor.toFixed(4)}
                      </li>
                      <li>
                        100 credits → {Math.ceil(100 * scaleFactor)} credits
                      </li>
                      <li>
                        1,000 credits → {Math.ceil(1000 * scaleFactor).toLocaleString()} credits
                      </li>
                    </ul>
                    <p className="text-xs mt-2">
                      All active credit batches, topup packages, plan allowances, and tier costs
                      will be scaled. Uses CEIL rounding (fair to users).
                    </p>
                  </AlertDescription>
                </Alert>

                {scaleFactor < 1 && (
                  <Alert className="border-amber-500/30 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-amber-600 dark:text-amber-300 text-sm">
                      This will <strong>reduce</strong> credit balances. Users will have fewer
                      credits, but their EUR-equivalent value is preserved.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4 py-2">
            <Alert className="border-destructive/30 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive space-y-2">
                <p className="font-medium">This action is irreversible!</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>
                    Ratio: {currentRatio} → {parsedNewRatio} credits per EUR
                  </li>
                  <li>Scale factor: ×{scaleFactor.toFixed(4)}</li>
                  <li>All active credit batches will be scaled</li>
                  <li>All package credit values will be updated</li>
                  <li>All plan allowances and tier costs will be scaled</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirm-text">
                Type <strong>SCALE</strong> to confirm:
              </Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="SCALE"
              />
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && result && (
          <div className="space-y-4 py-2">
            {result.success ? (
              <Alert className="border-green-500/30 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-600 dark:text-green-300 space-y-2">
                  <p className="font-medium">Scaling completed successfully!</p>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Batches affected: {result.batches_affected?.toLocaleString()}</li>
                    <li>
                      Total credits: {result.total_old_credits?.toLocaleString()} →{" "}
                      {result.total_new_credits?.toLocaleString()}
                    </li>
                    <li>Scale factor: ×{result.scale_factor?.toFixed(4)}</li>
                  </ul>
                  <p className="text-xs mt-1">
                    An audit log entry has been recorded. The ratio setting has been
                    updated automatically.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-destructive/30 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <p className="font-medium">Scaling failed</p>
                  <p className="text-sm">{result.error || "Unknown error"}</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "configure" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleProceedToConfirm} disabled={!isValidRatio}>
                Next
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => setStep("configure")}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleScale}
                disabled={confirmText !== "SCALE" || isScaling}
              >
                {isScaling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scaling...
                  </>
                ) : (
                  "Scale All Balances"
                )}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
