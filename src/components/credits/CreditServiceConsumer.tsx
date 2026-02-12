import { useState } from "react";
import { Coins, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreditService, useCreditServiceByEntity } from "@/hooks/useCreditService";
import { useCreditBatches } from "@/hooks/useCreditBatches";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CreditServiceConsumerProps {
  /**
   * Direct service ID - use when you know the exact credit_services.id
   */
  serviceId?: string;
  /**
   * Entity type for lookup - use with entityId when linking via entity
   */
  entityType?: string;
  /**
   * Entity ID for lookup - use with entityType when linking via entity
   */
  entityId?: string;
  /**
   * Button text for the consume action
   */
  buttonText?: string;
  /**
   * Callback after successful consumption
   */
  onSuccess?: (result: { credits_consumed: number; balance_after: number }) => void;
  /**
   * Callback on error
   */
  onError?: (error: string) => void;
  /**
   * Optional notes to attach to the transaction
   */
  notes?: string;
  /**
   * Optional reference ID (e.g., session ID, booking ID)
   */
  actionReferenceId?: string;
  /**
   * Whether to show a confirmation dialog
   */
  requireConfirmation?: boolean;
  /**
   * Custom button variant
   */
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  /**
   * Button size
   */
  size?: "default" | "sm" | "lg" | "icon";
  /**
   * Additional class name
   */
  className?: string;
  /**
   * Whether the button is disabled
   */
  disabled?: boolean;
  /**
   * Children to render as button content (overrides buttonText)
   */
  children?: React.ReactNode;
}

export function CreditServiceConsumer({
  serviceId,
  entityType,
  entityId,
  buttonText = "Consume Credits",
  onSuccess,
  onError,
  notes,
  actionReferenceId,
  requireConfirmation = true,
  variant = "default",
  size = "default",
  className,
  disabled,
  children,
}: CreditServiceConsumerProps) {
  const { user } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const { consume, isConsuming, getServiceCost } = useCreditService();
  const { summary } = useCreditBatches();

  // If using entity lookup, get the service ID
  const { data: entityService } = useCreditServiceByEntity(entityType || "", entityId || "");

  const resolvedServiceId = serviceId || entityService?.id;
  const { data: serviceCost, isLoading: costLoading } = getServiceCost(resolvedServiceId || "");

  const balance = summary?.total_available ?? 0;
  const cost = serviceCost?.effective_cost ?? 0;
  const canAfford = balance >= cost;
  const serviceName = serviceCost?.service_name || "this service";

  const handleConsume = async () => {
    if (!resolvedServiceId) {
      toast.error("Service not found");
      return;
    }

    try {
      const result = await consume(resolvedServiceId, notes, actionReferenceId);

      if (result?.success) {
        setShowConfirm(false);
        toast.success(`${result.credits_consumed} credits consumed`, {
          description: `Remaining balance: ${result.balance_after} credits`,
        });
        onSuccess?.({
          credits_consumed: result.credits_consumed!,
          balance_after: result.balance_after!,
        });
      } else if (result?.error) {
        onError?.(result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to consume credits";
      onError?.(message);
    }
  };

  const handleClick = () => {
    if (requireConfirmation) {
      setShowConfirm(true);
    } else {
      handleConsume();
    }
  };

  if (!user) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        Sign in required
      </Button>
    );
  }

  const isLoading = costLoading || isConsuming;
  const isDisabled = disabled || isLoading || !resolvedServiceId || !canAfford;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isDisabled}
        className={className}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Coins className="h-4 w-4 mr-2" />
        )}
        {children || buttonText}
        {!costLoading && serviceCost?.found && (
          <Badge variant="secondary" className="ml-2">
            {cost}
          </Badge>
        )}
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Confirm Credit Usage
            </DialogTitle>
            <DialogDescription>You are about to use credits for {serviceName}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span>Service Cost</span>
              <Badge variant="default" className="font-mono">
                {cost} credits
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span>Your Balance</span>
              <Badge variant={canAfford ? "secondary" : "destructive"} className="font-mono">
                {balance} credits
              </Badge>
            </div>
            {canAfford ? (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>After this, you'll have {balance - cost} credits remaining.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>You don't have enough credits. You need {cost - balance} more.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleConsume} disabled={!canAfford || isConsuming}>
              {isConsuming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
