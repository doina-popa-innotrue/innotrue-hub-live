import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AnalyticsData {
  top_pages: Array<{ page_path: string; views: number; unique_sessions: number }>;
  feature_usage: Array<{ feature: string; usage_count: number; unique_sessions: number }>;
}

interface EngagementChartsProps {
  analytics: AnalyticsData | null | undefined;
  isLoading: boolean;
}

export function EngagementCharts({ analytics, isLoading }: EngagementChartsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[350px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No engagement data available for this period</p>
        </CardContent>
      </Card>
    );
  }

  // Format page paths for display
  const pageData = (analytics.top_pages || [])
    .filter(p => p.page_path)
    .slice(0, 10)
    .map(page => ({
      ...page,
      displayPath: page.page_path.length > 30 
        ? page.page_path.substring(0, 30) + "..." 
        : page.page_path,
    }));

  const featureData = (analytics.feature_usage || [])
    .filter(f => f.feature)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Top Pages */}
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
          <CardDescription>Most visited pages by your users</CardDescription>
        </CardHeader>
        <CardContent>
          {pageData.length > 0 ? (
            <div className="space-y-4">
              {pageData.map((page, index) => (
                <div key={page.page_path} className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={page.page_path}>
                      {page.page_path || "/"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {page.unique_sessions} unique visitors
                    </p>
                  </div>
                  <Badge variant="secondary">{page.views} views</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No page view data available</p>
          )}
        </CardContent>
      </Card>

      {/* Feature Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Usage</CardTitle>
          <CardDescription>Which features are being used most</CardDescription>
        </CardHeader>
        <CardContent>
          {featureData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={featureData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis 
                  type="category" 
                  dataKey="feature" 
                  width={150}
                  className="text-xs"
                  tickFormatter={(value) => value.length > 20 ? value.substring(0, 20) + "..." : value}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                  }}
                />
                <Bar 
                  dataKey="usage_count" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  name="Usage Count"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>No feature usage data available</p>
              <p className="text-sm mt-2">
                Features are tracked when you call <code className="bg-muted px-1 rounded">trackFeatureUsage()</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
