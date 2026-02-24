import { Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCreditBatches, formatCredits } from "@/hooks/useCreditBatches";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface CreditExpiryAlertProps {
  /** Custom class name */
  className?: string;
  /** Variant: inline (small) or banner (prominent) */
  variant?: "inline" | "banner";
}

export function CreditExpiryAlert({
  className,
  variant = "banner",
}: CreditExpiryAlertProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { expiringCredits, summary, isLoading } = useCreditBatches();

  if (!user || isLoading) return null;

  const count = expiringCredits ?? 0;
  if (count <= 0) return null;

  const earliestExpiry = summary?.earliest_expiry
    ? new Date(summary.earliest_expiry)
    : null;

  const expiryLabel = earliestExpiry
    ? formatDistanceToNow(earliestExpiry, { addSuffix: true })
    : "soon";

  if (variant === "inline") {
    return (
      <div
        className={`flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 ${className ?? ""}`}
      >
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          {formatCredits(count)} credit{count !== 1 ? "s" : ""} expiring{" "}
          {expiryLabel}
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-primary"
          onClick={() => navigate("/credits")}
        >
          View
        </Button>
      </div>
    );
  }

  return (
    <Alert
      variant="default"
      className={`border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 ${className ?? ""}`}
    >
      <Clock className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-400">
        Credits Expiring Soon
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4 text-amber-700 dark:text-amber-300">
        <span>
          You have {formatCredits(count)} credit{count !== 1 ? "s" : ""}{" "}
          expiring {expiryLabel}. Use them before they expire.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/credits")}
          className="shrink-0 border-amber-600 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          <Clock className="h-4 w-4 mr-1" />
          View Credits
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
