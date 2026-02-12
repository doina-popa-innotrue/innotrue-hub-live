import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, UserCheck, Users } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";

interface SnapshotRating {
  id: string;
  question_id: string;
  rating: number;
}

interface Snapshot {
  id: string;
  title: string | null;
  completed_at: string;
  is_self_assessment: boolean;
  evaluator_name?: string | null;
  evaluation_relationship?: string | null;
  capability_snapshot_ratings: SnapshotRating[];
}

interface Domain {
  id: string;
  name: string;
  capability_domain_questions: {
    id: string;
    question_text: string;
  }[];
}

interface Assessment {
  id: string;
  name: string;
  rating_scale: number;
  capability_domains: Domain[];
}

export type SnapshotSourceFilter = "all" | "self" | "peer" | "instructor";

interface CapabilityEvolutionChartProps {
  snapshots: Snapshot[];
  selfSnapshots: Snapshot[];
  peerSnapshots: Snapshot[];
  instructorSnapshots: Snapshot[];
  assessment: Assessment;
}

export function CapabilityEvolutionChart({
  snapshots,
  selfSnapshots,
  peerSnapshots,
  instructorSnapshots,
  assessment,
}: CapabilityEvolutionChartProps) {
  const [compareMode, setCompareMode] = useState<"latest-vs-first" | "custom">("latest-vs-first");
  const [viewMode, setViewMode] = useState<"radar" | "line">("radar");
  const [sourceFilter, setSourceFilter] = useState<SnapshotSourceFilter>("all");

  // Separate source filters for each comparison snapshot
  const [sourceFilter1, setSourceFilter1] = useState<SnapshotSourceFilter>("all");
  const [sourceFilter2, setSourceFilter2] = useState<SnapshotSourceFilter>("all");

  // Custom selection states
  const [selectedSnapshot1, setSelectedSnapshot1] = useState<string>(snapshots[0]?.id || "");
  const [selectedSnapshot2, setSelectedSnapshot2] = useState<string>(
    snapshots[snapshots.length - 1]?.id || "",
  );

  // Helper to get snapshots by filter
  const getSnapshotsByFilter = (filter: SnapshotSourceFilter) => {
    if (filter === "self") return selfSnapshots;
    if (filter === "peer") return peerSnapshots;
    if (filter === "instructor") return instructorSnapshots;
    return snapshots;
  };

  // Get filtered snapshots based on source filter (for line chart)
  const filteredSnapshots = useMemo(() => {
    return getSnapshotsByFilter(sourceFilter);
  }, [sourceFilter, selfSnapshots, peerSnapshots, instructorSnapshots, snapshots]);

  // Get filtered snapshots for each comparison slot
  const filteredSnapshots1 = useMemo(() => {
    return getSnapshotsByFilter(sourceFilter1);
  }, [sourceFilter1, selfSnapshots, peerSnapshots, instructorSnapshots, snapshots]);

  const filteredSnapshots2 = useMemo(() => {
    return getSnapshotsByFilter(sourceFilter2);
  }, [sourceFilter2, selfSnapshots, peerSnapshots, instructorSnapshots, snapshots]);

  // Generate snapshot label with type indicator
  const getSnapshotLabel = (s: Snapshot, includeDate = true) => {
    const typePrefix = s.is_self_assessment
      ? "Self"
      : s.evaluator_name
        ? `By ${s.evaluator_name}`
        : "Evaluator";
    const dateStr = includeDate ? format(new Date(s.completed_at), "MMM d, yyyy") : "";
    if (s.title) {
      return `${s.title} (${typePrefix})`;
    }
    return `${dateStr} (${typePrefix})`;
  };

  const getDomainAverageForSnapshot = (snapshot: Snapshot, domain: Domain) => {
    const ratings = domain.capability_domain_questions.map((q) => {
      const rating = snapshot.capability_snapshot_ratings.find((r) => r.question_id === q.id);
      return rating?.rating || 0;
    });
    if (ratings.length === 0) return 0;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  };

  const getComparisonSnapshots = () => {
    if (compareMode === "latest-vs-first") {
      // Use separate filtered lists for latest-vs-first
      return {
        snapshot1: filteredSnapshots1[0],
        snapshot2: filteredSnapshots2[filteredSnapshots2.length - 1],
      };
    }
    return {
      snapshot1: snapshots.find((s) => s.id === selectedSnapshot1),
      snapshot2: snapshots.find((s) => s.id === selectedSnapshot2),
    };
  };

  const { snapshot1, snapshot2 } = getComparisonSnapshots();

  const getRadarData = () => {
    return assessment.capability_domains.map((domain) => ({
      domain: domain.name,
      current: snapshot1 ? getDomainAverageForSnapshot(snapshot1, domain) : 0,
      previous: snapshot2 ? getDomainAverageForSnapshot(snapshot2, domain) : 0,
      fullMark: assessment.rating_scale,
    }));
  };

  const getLineData = () => {
    return filteredSnapshots
      .slice()
      .reverse()
      .map((snapshot) => {
        const data: Record<string, any> = {
          date: format(new Date(snapshot.completed_at), "MMM d"),
          fullDate: snapshot.completed_at,
          type: snapshot.is_self_assessment ? "Self" : "Evaluator",
        };
        assessment.capability_domains.forEach((domain) => {
          data[domain.name] = getDomainAverageForSnapshot(snapshot, domain);
        });
        return data;
      });
  };

  const getOverallChange = () => {
    if (!snapshot1 || !snapshot2) return 0;

    const current =
      assessment.capability_domains.reduce(
        (sum, domain) => sum + getDomainAverageForSnapshot(snapshot1, domain),
        0,
      ) / assessment.capability_domains.length;

    const previous =
      assessment.capability_domains.reduce(
        (sum, domain) => sum + getDomainAverageForSnapshot(snapshot2, domain),
        0,
      ) / assessment.capability_domains.length;

    return current - previous;
  };

  const overallChange = getOverallChange();

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Capability Evolution</CardTitle>
              <CardDescription>Track your progress over time</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as "radar" | "line")}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radar">Radar View</SelectItem>
                  <SelectItem value="line">Timeline</SelectItem>
                </SelectContent>
              </Select>
              {overallChange !== 0 && (
                <Badge variant={overallChange > 0 ? "default" : "secondary"}>
                  {overallChange > 0 ? "+" : ""}
                  {overallChange.toFixed(1)} overall
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "radar" ? (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <Select
                  value={compareMode}
                  onValueChange={(v) => setCompareMode(v as "latest-vs-first" | "custom")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest-vs-first">Latest vs First</SelectItem>
                    <SelectItem value="custom">Custom Comparison</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Comparison selectors with individual source filters */}
              <div className="flex flex-col gap-3 mb-4">
                {/* First snapshot selection */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium min-w-[60px]">First:</span>
                  <Select
                    value={sourceFilter1}
                    onValueChange={(v) => setSourceFilter1(v as SnapshotSourceFilter)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">All Types</span>
                      </SelectItem>
                      <SelectItem value="self">
                        <span className="flex items-center gap-2">
                          <User className="h-3 w-3" /> Self
                        </span>
                      </SelectItem>
                      <SelectItem value="peer">
                        <span className="flex items-center gap-2">
                          <Users className="h-3 w-3" /> Peer
                        </span>
                      </SelectItem>
                      <SelectItem value="instructor">
                        <span className="flex items-center gap-2">
                          <UserCheck className="h-3 w-3" /> Instructor/Coach
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {compareMode === "custom" && (
                    <Select value={selectedSnapshot1} onValueChange={setSelectedSnapshot1}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select snapshot" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSnapshots1.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              {s.is_self_assessment ? (
                                <User className="h-3 w-3 shrink-0" />
                              ) : (
                                <UserCheck className="h-3 w-3 shrink-0" />
                              )}
                              {s.title || format(new Date(s.completed_at), "MMM d, yyyy")}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {compareMode === "latest-vs-first" && filteredSnapshots1[0] && (
                    <Badge
                      variant={filteredSnapshots1[0].is_self_assessment ? "outline" : "secondary"}
                      className="flex items-center gap-1"
                    >
                      {filteredSnapshots1[0].is_self_assessment ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <UserCheck className="h-3 w-3" />
                      )}
                      {format(new Date(filteredSnapshots1[0].completed_at), "MMM d, yyyy")}
                    </Badge>
                  )}
                </div>

                {/* Second snapshot selection */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium min-w-[60px]">Second:</span>
                  <Select
                    value={sourceFilter2}
                    onValueChange={(v) => setSourceFilter2(v as SnapshotSourceFilter)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">All Types</span>
                      </SelectItem>
                      <SelectItem value="self">
                        <span className="flex items-center gap-2">
                          <User className="h-3 w-3" /> Self
                        </span>
                      </SelectItem>
                      <SelectItem value="peer">
                        <span className="flex items-center gap-2">
                          <Users className="h-3 w-3" /> Peer
                        </span>
                      </SelectItem>
                      <SelectItem value="instructor">
                        <span className="flex items-center gap-2">
                          <UserCheck className="h-3 w-3" /> Instructor/Coach
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {compareMode === "custom" && (
                    <Select value={selectedSnapshot2} onValueChange={setSelectedSnapshot2}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select snapshot" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSnapshots2.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              {s.is_self_assessment ? (
                                <User className="h-3 w-3 shrink-0" />
                              ) : (
                                <UserCheck className="h-3 w-3 shrink-0" />
                              )}
                              {s.title || format(new Date(s.completed_at), "MMM d, yyyy")}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {compareMode === "latest-vs-first" &&
                    filteredSnapshots2[filteredSnapshots2.length - 1] && (
                      <Badge
                        variant={
                          filteredSnapshots2[filteredSnapshots2.length - 1].is_self_assessment
                            ? "outline"
                            : "secondary"
                        }
                        className="flex items-center gap-1"
                      >
                        {filteredSnapshots2[filteredSnapshots2.length - 1].is_self_assessment ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <UserCheck className="h-3 w-3" />
                        )}
                        {format(
                          new Date(filteredSnapshots2[filteredSnapshots2.length - 1].completed_at),
                          "MMM d, yyyy",
                        )}
                      </Badge>
                    )}
                </div>
              </div>

              {filteredSnapshots.length < 2 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Need at least 2{" "}
                  {sourceFilter === "self"
                    ? "self-evaluation"
                    : sourceFilter === "peer"
                      ? "peer review"
                      : sourceFilter === "instructor"
                        ? "instructor/coach"
                        : ""}{" "}
                  snapshots to compare.
                </div>
              ) : (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={getRadarData()}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="domain" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, assessment.rating_scale]}
                        tick={{ fontSize: 10 }}
                      />
                      <Radar
                        name={getSnapshotLabel(snapshot1!, false)}
                        dataKey="current"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.5}
                      />
                      <Radar
                        name={getSnapshotLabel(snapshot2!, false)}
                        dataKey="previous"
                        stroke="hsl(var(--muted-foreground))"
                        fill="hsl(var(--muted-foreground))"
                        fillOpacity={0.3}
                      />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Source filter for line chart */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Select
                  value={sourceFilter}
                  onValueChange={(v) => setSourceFilter(v as SnapshotSourceFilter)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Snapshots</SelectItem>
                    <SelectItem value="self">
                      <span className="flex items-center gap-2">
                        <User className="h-3 w-3" /> Self Only
                      </span>
                    </SelectItem>
                    <SelectItem value="peer">
                      <span className="flex items-center gap-2">
                        <Users className="h-3 w-3" /> Peer Reviews
                      </span>
                    </SelectItem>
                    <SelectItem value="instructor">
                      <span className="flex items-center gap-2">
                        <UserCheck className="h-3 w-3" /> Instructor/Coach
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getLineData()}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, assessment.rating_scale]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {assessment.capability_domains.map((domain, index) => (
                      <Line
                        key={domain.id}
                        type="monotone"
                        dataKey={domain.name}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Domain Changes Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domain Changes</CardTitle>
          <CardDescription>
            Comparing{" "}
            {snapshot1?.title ||
              (snapshot1 && format(new Date(snapshot1.completed_at), "MMM d, yyyy"))}{" "}
            to{" "}
            {snapshot2?.title ||
              (snapshot2 && format(new Date(snapshot2.completed_at), "MMM d, yyyy"))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assessment.capability_domains.map((domain) => {
              const current = snapshot1 ? getDomainAverageForSnapshot(snapshot1, domain) : 0;
              const previous = snapshot2 ? getDomainAverageForSnapshot(snapshot2, domain) : 0;
              const change = current - previous;

              return (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <span className="font-medium text-sm">{domain.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{current.toFixed(1)}</span>
                    {change !== 0 && (
                      <Badge variant={change > 0 ? "default" : "destructive"} className="text-xs">
                        {change > 0 ? "+" : ""}
                        {change.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
