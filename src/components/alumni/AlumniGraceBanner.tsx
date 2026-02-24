import { Clock, ArrowRight, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAlumniAccess } from "@/hooks/useAlumniAccess";
import { useFeatureLossPreview } from "@/hooks/useFeatureLossPreview";

interface AlumniGraceBannerProps {
  programId: string;
  programName: string;
  className?: string;
}

/**
 * Shows a banner when the user is in alumni grace period for a program.
 *
 * - Amber when daysRemaining > 7
 * - Red/destructive when daysRemaining <= 7 (urgent)
 * - Shows features that will be lost after grace period ends
 * - CTA to explore subscription plans
 */
export function AlumniGraceBanner({
  programId,
  programName,
  className,
}: AlumniGraceBannerProps) {
  const navigate = useNavigate();
  const { alumniAccess, isLoading } = useAlumniAccess(programId);
  const { featuresToLose } = useFeatureLossPreview("program_plan");

  if (isLoading || !alumniAccess) return null;
  if (!alumniAccess.inGracePeriod) return null;

  const isUrgent = alumniAccess.daysRemaining <= 7;
  const daysText =
    alumniAccess.daysRemaining <= 0
      ? "today"
      : `${alumniAccess.daysRemaining} day${alumniAccess.daysRemaining !== 1 ? "s" : ""}`;

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
        {isUrgent ? "Grace Period Ending Soon" : "Program Enrollment Ended"}
      </AlertTitle>
      <AlertDescription
        className={`space-y-2 ${isUrgent ? "" : "text-amber-700 dark:text-amber-300"}`}
      >
        <p>
          Your <strong>{programName}</strong> enrollment has ended. You have
          read-only access for {daysText}
          {alumniAccess.daysRemaining > 0 ? " more" : ""}.
        </p>

        {featuresToLose.length > 0 && (
          <div className="text-xs">
            <span className="font-medium">Features you may lose:</span>{" "}
            {featuresToLose
              .slice(0, 5)
              .map((f) => f.replace(/_/g, " "))
              .join(", ")}
            {featuresToLose.length > 5 && ` and ${featuresToLose.length - 5} more`}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            variant={isUrgent ? "default" : "outline"}
            size="sm"
            onClick={() => navigate("/subscription")}
            className={
              isUrgent
                ? ""
                : "border-amber-600 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950"
            }
          >
            Explore Plans
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
