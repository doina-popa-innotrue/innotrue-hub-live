import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CalendarIcon, 
  UserMinus,
  RefreshCw,
  BarChart3,
  Activity,
  Target,
  Sparkles,
  Trash2
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin";
import { ExcludedUsersManager } from "@/components/admin/analytics/ExcludedUsersManager";
import { AnalyticsOverviewCards } from "@/components/admin/analytics/AnalyticsOverviewCards";
import { EngagementCharts } from "@/components/admin/analytics/EngagementCharts";
import { DropOffAnalysis } from "@/components/admin/analytics/DropOffAnalysis";
import { AIInsightsPanel } from "@/components/admin/analytics/AIInsightsPanel";
import { DataCleanupManager } from "@/components/admin/analytics/DataCleanupManager";
import { WebhookLogsCleanup } from "@/components/admin/analytics/WebhookLogsCleanup";

interface DateRange {
  from: Date;
  to: Date;
}

export default function UserBehaviorAnalytics() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ["user-behavior-analytics", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_aggregated_analytics", {
        start_date: dateRange.from.toISOString(),
        end_date: dateRange.to.toISOString(),
      });

      if (error) throw error;
      return data as {
        total_events: number;
        unique_sessions: number;
        unique_users: number;
        events_by_category: Array<{ event_category: string; count: number }>;
        top_pages: Array<{ page_path: string; views: number; unique_sessions: number }>;
        feature_usage: Array<{ feature: string; usage_count: number; unique_sessions: number }>;
        events_by_day: Array<{ date: string; events: number; sessions: number; users: number }>;
        drop_off_analysis: Array<{ page: string; exit_count: number }>;
        error_summary: Array<{ error_message: string; occurrences: number }>;
      };
    },
  });

  const handleDatePreset = (days: number) => {
    setDateRange({
      from: subDays(new Date(), days),
      to: new Date(),
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="User Behavior Analytics"
        description="Understand how users interact with your platform (anonymized)"
      />

      {/* Date Range Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">Quick Select:</span>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDatePreset(7)}>
                  7 days
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDatePreset(30)}>
                  30 days
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDatePreset(90)}>
                  90 days
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 pb-2">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="overview" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Overview</span>
              <span className="xs:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="engagement" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm">
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Engagement</span>
              <span className="sm:hidden">Engage</span>
            </TabsTrigger>
            <TabsTrigger value="dropoff" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Drop-offs</span>
              <span className="sm:hidden">Drops</span>
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">AI Insights</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="exclusions" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm">
              <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Exclusions</span>
              <span className="sm:hidden">Excl.</span>
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm">
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Cleanup</span>
              <span className="sm:hidden">Clean</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <AnalyticsOverviewCards analytics={analytics} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="engagement">
          <EngagementCharts analytics={analytics} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="dropoff">
          <DropOffAnalysis analytics={analytics} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="ai-insights">
          <AIInsightsPanel analytics={analytics} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="exclusions">
          <ExcludedUsersManager />
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-6">
          <DataCleanupManager 
            onCleanupComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["user-behavior-analytics"] });
            }}
          />
          <WebhookLogsCleanup />
        </TabsContent>
      </Tabs>
    </div>
  );
}
