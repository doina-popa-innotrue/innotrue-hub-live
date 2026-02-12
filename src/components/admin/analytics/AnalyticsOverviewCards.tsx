import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MousePointerClick, Activity, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  total_events: number;
  unique_sessions: number;
  unique_users: number;
  events_by_day: Array<{ date: string; events: number; sessions: number; users: number }>;
  events_by_category: Array<{ event_category: string; count: number }>;
}

interface AnalyticsOverviewCardsProps {
  analytics: AnalyticsData | null | undefined;
  isLoading: boolean;
}

export function AnalyticsOverviewCards({ analytics, isLoading }: AnalyticsOverviewCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No analytics data available for this period</p>
        </CardContent>
      </Card>
    );
  }

  const eventsPerSession =
    analytics.unique_sessions > 0
      ? (analytics.total_events / analytics.unique_sessions).toFixed(1)
      : "0";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_events.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">User interactions tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.unique_sessions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Browsing sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.unique_users.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Authenticated users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Events/Session</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventsPerSession}</div>
            <p className="text-xs text-muted-foreground">Engagement depth</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.events_by_day && analytics.events_by_day.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.events_by_day}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="events"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Events"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="Sessions"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  name="Users"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No activity data for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Events by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.events_by_category && analytics.events_by_category.length > 0 ? (
            <div className="space-y-3">
              {analytics.events_by_category.map((category) => (
                <div key={category.event_category} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {category.event_category || "Uncategorized"}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${Math.min((category.count / analytics.total_events) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-16 text-right">
                      {category.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No category data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
