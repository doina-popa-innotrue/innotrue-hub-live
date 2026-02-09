import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, LogOut } from "lucide-react";

interface AnalyticsData {
  drop_off_analysis: Array<{ page: string; exit_count: number }>;
  error_summary: Array<{ error_message: string; occurrences: number }>;
}

interface DropOffAnalysisProps {
  analytics: AnalyticsData | null | undefined;
  isLoading: boolean;
}

export function DropOffAnalysis({ analytics, isLoading }: DropOffAnalysisProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
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
          <p className="text-muted-foreground">No drop-off data available for this period</p>
        </CardContent>
      </Card>
    );
  }

  const dropOffData = (analytics.drop_off_analysis || []).filter(d => d.page);
  const errorData = (analytics.error_summary || []).filter(e => e.error_message);

  const totalDropOffs = dropOffData.reduce((acc, d) => acc + d.exit_count, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Drop-off Points */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Exit Pages</CardTitle>
          </div>
          <CardDescription>
            Pages where users end their sessions (potential friction points)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dropOffData.length > 0 ? (
            <div className="space-y-4">
              {dropOffData.map((item, index) => {
                const percentage = totalDropOffs > 0 
                  ? ((item.exit_count / totalDropOffs) * 100).toFixed(1) 
                  : "0";
                
                return (
                  <div key={item.page || index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate max-w-[200px]" title={item.page}>
                        {item.page || "/unknown"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{percentage}%</span>
                        <Badge variant="outline">{item.exit_count} exits</Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-destructive/60 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <LogOut className="h-8 w-8 mb-2" />
              <p>No drop-off data available</p>
              <p className="text-sm mt-1">This requires sufficient page_view events with path data</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle>Errors Encountered</CardTitle>
          </div>
          <CardDescription>
            Errors that users are experiencing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorData.length > 0 ? (
            <div className="space-y-4">
              {errorData.map((error, index) => (
                <div key={index} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive">
                      {error.error_message.length > 100 
                        ? error.error_message.substring(0, 100) + "..." 
                        : error.error_message}
                    </p>
                  </div>
                  <Badge variant="destructive">{error.occurrences}×</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-primary text-xl">✓</span>
              </div>
              <p className="font-medium text-foreground">No errors recorded</p>
              <p className="text-sm mt-1">Users aren't encountering tracked errors</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
