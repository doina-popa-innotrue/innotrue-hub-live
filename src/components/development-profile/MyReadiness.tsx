import { useUserReadiness } from "@/hooks/useReadinessDashboard";
import type { AlertLevel } from "@/hooks/useReadinessDashboard";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gauge,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pause,
  MapPin,
  Calendar,
} from "lucide-react";

interface Props {
  userId: string;
}

function getAlertIcon(level: AlertLevel) {
  switch (level) {
    case "green":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "amber":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "red":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "stalled":
      return <Pause className="h-4 w-4 text-gray-500" />;
  }
}

function getAlertLabel(level: AlertLevel) {
  switch (level) {
    case "green":
      return "On Track";
    case "amber":
      return "Needs Attention";
    case "red":
      return "Behind Schedule";
    case "stalled":
      return "Stalled";
  }
}

function getReadinessColor(percent: number) {
  if (percent >= 80) return "text-green-600";
  if (percent >= 50) return "text-amber-600";
  return "text-red-600";
}

export function MyReadiness({ userId }: Props) {
  const { data: paths = [], isLoading } = useUserReadiness(userId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            My Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (paths.length === 0) {
    return null; // Don't show the card if user has no active paths
  }

  // Overall readiness across all paths
  const totalGates = paths.reduce((sum, p) => sum + p.totalGates, 0);
  const metGates = paths.reduce((sum, p) => sum + p.metGates, 0);
  const overallReadiness =
    totalGates > 0 ? Math.round((metGates / totalGates) * 100) : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          My Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall readiness hero */}
        {paths.length > 1 && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <div className="text-center">
              <p
                className={`text-3xl font-bold ${getReadinessColor(overallReadiness)}`}
              >
                {overallReadiness}%
              </p>
              <p className="text-xs text-muted-foreground">Overall</p>
            </div>
            <div className="flex-1">
              <Progress value={overallReadiness} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">
                {metGates} of {totalGates} gates met across {paths.length}{" "}
                paths
              </p>
            </div>
          </div>
        )}

        {/* Per-path readiness */}
        {paths.map((path) => (
          <div
            key={path.instantiationId}
            className="p-3 rounded-lg border space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getAlertIcon(path.alertLevel)}
                <span className="font-medium text-sm truncate">
                  {path.pathName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">
                  {getAlertLabel(path.alertLevel)}
                </Badge>
                <span
                  className={`text-lg font-bold ${getReadinessColor(path.readinessPercent)}`}
                >
                  {path.readinessPercent}%
                </span>
              </div>
            </div>

            <Progress value={path.readinessPercent} className="h-2" />

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                {path.metGates}/{path.totalGates} gates met
              </span>
              {path.currentMilestoneTitle && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {path.currentMilestoneTitle}
                </span>
              )}
              {path.estimatedCompletionDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(path.estimatedCompletionDate).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* What to work on hint */}
            {path.readinessPercent < 100 && path.totalGates > 0 && (
              <p className="text-xs text-muted-foreground italic">
                {path.totalGates - path.metGates} gate
                {path.totalGates - path.metGates !== 1 ? "s" : ""} remaining
                &mdash; complete relevant assessments to improve readiness
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
