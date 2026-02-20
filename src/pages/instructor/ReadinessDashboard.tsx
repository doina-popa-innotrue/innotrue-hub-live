import { useReadinessDashboard } from "@/hooks/useReadinessDashboard";
import type { AlertLevel } from "@/hooks/useReadinessDashboard";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gauge,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pause,
} from "lucide-react";

function getAlertBadge(level: AlertLevel) {
  switch (level) {
    case "green":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          On Track
        </Badge>
      );
    case "amber":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          Needs Attention
        </Badge>
      );
    case "red":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Behind
        </Badge>
      );
    case "stalled":
      return (
        <Badge className="bg-gray-100 text-gray-700 border-gray-200">
          <Pause className="h-3 w-3 mr-1" />
          Stalled
        </Badge>
      );
  }
}

function getReadinessColor(percent: number) {
  if (percent >= 80) return "text-green-600";
  if (percent >= 50) return "text-amber-600";
  return "text-red-600";
}

export default function ReadinessDashboard() {
  const { data: clients = [], isLoading } = useReadinessDashboard();

  const totalClients = clients.length;
  const avgReadiness =
    totalClients > 0
      ? Math.round(
          clients.reduce((sum, c) => sum + c.readinessPercent, 0) /
            totalClients,
        )
      : 0;
  const needAttention = clients.filter(
    (c) => c.alertLevel === "red" || c.alertLevel === "stalled",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Readiness Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor your clients&apos; progress and gate readiness across guided
            paths.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalClients}</p>
                <p className="text-sm text-muted-foreground">
                  Clients on Paths
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Gauge className="h-8 w-8 text-primary" />
              <div>
                <p
                  className={`text-2xl font-bold ${getReadinessColor(avgReadiness)}`}
                >
                  {avgReadiness}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Average Readiness
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className={`h-8 w-8 ${needAttention > 0 ? "text-red-500" : "text-muted-foreground"}`}
              />
              <div>
                <p className="text-2xl font-bold">{needAttention}</p>
                <p className="text-sm text-muted-foreground">
                  Need Attention
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No clients are currently on guided paths.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Client Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clients.map((client) => (
                <Link
                  key={`${client.enrollmentId}-${client.instantiationId}`}
                  to={`/teaching/students/${client.enrollmentId}/development-profile`}
                  className="block p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {client.userName}
                        </span>
                        {getAlertBadge(client.alertLevel)}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>{client.pathName}</span>
                        <span>&middot;</span>
                        <span>{client.programName}</span>
                      </div>
                      {client.currentMilestoneTitle && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Current: {client.currentMilestoneTitle}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-lg font-bold ${getReadinessColor(client.readinessPercent)}`}
                      >
                        {client.readinessPercent}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {client.metGates}/{client.totalGates} gates
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={client.readinessPercent}
                      className="h-2"
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {client.estimatedCompletionDate && (
                      <span>
                        Est. completion:{" "}
                        {new Date(
                          client.estimatedCompletionDate,
                        ).toLocaleDateString()}
                      </span>
                    )}
                    {client.daysSinceLastProgress < 999 && (
                      <span>
                        Last progress: {client.daysSinceLastProgress}d ago
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
