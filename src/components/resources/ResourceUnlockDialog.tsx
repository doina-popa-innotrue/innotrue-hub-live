import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface ResourceUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceTitle: string;
  creditCost: number;
  availableCredits: number;
  canAfford: boolean;
  onUnlock: () => Promise<void>;
  isPending: boolean;
}

export function ResourceUnlockDialog({
  open,
  onOpenChange,
  resourceTitle,
  creditCost,
  availableCredits,
  canAfford,
  onUnlock,
  isPending,
}: ResourceUnlockDialogProps) {
  const remaining = availableCredits - creditCost;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Unlock Resource
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <strong className="text-foreground">{resourceTitle}</strong> costs credits to access.
              </p>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Credit cost</span>
                  <Badge variant="secondary">{creditCost} credits</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Your balance</span>
                  <span className="font-medium">{availableCredits} credits</span>
                </div>
                {canAfford && (
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span>After unlock</span>
                    <span className="font-medium">{remaining} credits</span>
                  </div>
                )}
              </div>
              {!canAfford && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Insufficient credits</p>
                    <p className="text-muted-foreground mt-1">
                      You need {creditCost - availableCredits} more credits.{" "}
                      <Link to="/credits" className="text-primary hover:underline">
                        Get more credits
                      </Link>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onUnlock} disabled={!canAfford || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Unlock for {creditCost} credits
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
