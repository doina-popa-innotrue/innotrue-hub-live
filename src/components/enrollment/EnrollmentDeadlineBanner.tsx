import { Clock, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EnrollmentDeadlineBannerProps {
  endDate: string;
  programName: string;
  className?: string;
}

/**
 * Shows a warning banner when an active enrollment is approaching its deadline.
 *
 * - Hidden when 30+ days remaining
 * - Amber when 8-30 days remaining
 * - Red/destructive when 1-7 days remaining
 */
export function EnrollmentDeadlineBanner({
  endDate,
  programName,
  className,
}: EnrollmentDeadlineBannerProps) {
  const end = new Date(endDate);
  const daysRemaining = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Don't show if more than 30 days or already expired (cron handles expiry)
  if (daysRemaining > 30 || daysRemaining < 0) return null;

  const isUrgent = daysRemaining <= 7;
  const endFormatted = end.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const daysText =
    daysRemaining === 0
      ? "today"
      : daysRemaining === 1
        ? "1 day"
        : `${daysRemaining} days`;

  return (
    <Alert
      variant={isUrgent ? "destructive" : "default"}
      className={`${isUrgent ? "" : "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"} ${className ?? ""}`}
    >
      {isUrgent ? (
        <ShieldAlert className="h-4 w-4" />
      ) : (
        <Clock className="h-4 w-4 text-amber-600" />
      )}
      <AlertTitle className={isUrgent ? "" : "text-amber-800 dark:text-amber-400"}>
        {isUrgent ? "Enrollment Expiring Soon" : "Enrollment Deadline Approaching"}
      </AlertTitle>
      <AlertDescription
        className={isUrgent ? "" : "text-amber-700 dark:text-amber-300"}
      >
        Your <strong>{programName}</strong> enrollment expires{" "}
        {daysRemaining === 0 ? "today" : <>in {daysText} ({endFormatted})</>}.
        {" "}Complete your modules before the deadline to finish on your own terms.
      </AlertDescription>
    </Alert>
  );
}
