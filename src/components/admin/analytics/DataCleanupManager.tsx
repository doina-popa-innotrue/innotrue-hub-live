import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, subDays, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CalendarIcon,
  Trash2,
  AlertTriangle,
  Loader2,
  Database,
  FileText,
  Users,
  Clock,
} from "lucide-react";

interface DateRange {
  from: Date;
  to: Date;
}

interface DataCleanupManagerProps {
  onCleanupComplete?: () => void;
}

interface CleanupPreview {
  totalEvents: number;
  uniqueSessions: number;
  eventCategories: { category: string; count: number }[];
  oldestEvent: string | null;
  newestEvent: string | null;
}

export function DataCleanupManager({ onCleanupComplete }: DataCleanupManagerProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 90),
    to: subDays(new Date(), 30),
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [debouncedRange, setDebouncedRange] = useState(dateRange);

  // Debounce date range changes to avoid excessive queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRange(dateRange);
    }, 500);
    return () => clearTimeout(timer);
  }, [dateRange]);

  // Fetch preview of data to be deleted
  const {
    data: preview,
    isLoading: isLoadingPreview,
    isFetching,
  } = useQuery({
    queryKey: [
      "cleanup-preview",
      debouncedRange.from.toISOString(),
      debouncedRange.to.toISOString(),
    ],
    queryFn: async (): Promise<CleanupPreview> => {
      const startDate = debouncedRange.from.toISOString();
      const endDate = debouncedRange.to.toISOString();

      // Get total events count and unique sessions
      const { count: totalEvents, error: countError } = await supabase
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (countError) throw countError;

      // Get unique sessions count
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("analytics_events")
        .select("session_id")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (sessionsError) throw sessionsError;

      const uniqueSessions = new Set(sessionsData?.map((e) => e.session_id) || []).size;

      // Get event categories breakdown
      const { data: categoryData, error: categoryError } = await supabase
        .from("analytics_events")
        .select("event_category")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (categoryError) throw categoryError;

      const categoryMap = new Map<string, number>();
      categoryData?.forEach((e) => {
        const cat = e.event_category || "uncategorized";
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      });

      const eventCategories = Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 categories

      // Get date range of actual events
      const { data: rangeData, error: rangeError } = await supabase
        .from("analytics_events")
        .select("created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: true })
        .limit(1);

      const { data: newestData } = await supabase
        .from("analytics_events")
        .select("created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false })
        .limit(1);

      return {
        totalEvents: totalEvents || 0,
        uniqueSessions,
        eventCategories,
        oldestEvent: rangeData?.[0]?.created_at || null,
        newestEvent: newestData?.[0]?.created_at || null,
      };
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: Date; endDate: Date }) => {
      const { data, error } = await supabase.rpc("delete_analytics_events", {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: (deletedCount) => {
      toast.success(`Successfully deleted ${deletedCount.toLocaleString()} analytics events`);
      setIsConfirmOpen(false);
      onCleanupComplete?.();
    },
    onError: (error) => {
      toast.error(
        "Failed to delete data: " + (error instanceof Error ? error.message : "Unknown error"),
      );
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({
      startDate: dateRange.from,
      endDate: dateRange.to,
    });
  };

  const handleDatePreset = (daysAgo: number, rangeLength: number) => {
    setDateRange({
      from: subDays(new Date(), daysAgo + rangeLength),
      to: subDays(new Date(), daysAgo),
    });
  };

  const daysDiff = differenceInDays(dateRange.to, dateRange.from);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <CardTitle>Data Cleanup</CardTitle>
        </div>
        <CardDescription>
          Permanently delete analytics data within a specified time range to free up storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> Deleting analytics data is permanent and cannot be undone.
            This will remove all tracked events within the selected date range.
          </AlertDescription>
        </Alert>

        {/* Quick presets */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Quick Select:</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(90, 60)}>
              Data older than 90 days
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(180, 90)}>
              Data older than 6 months
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDatePreset(365, 180)}>
              Data older than 1 year
            </Button>
          </div>
        </div>

        {/* Custom date range */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Custom Date Range:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                <Badge variant="secondary" className="ml-auto">
                  {daysDiff} days
                </Badge>
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
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Data Preview Summary */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Data to be Deleted
            </h4>
            {isFetching && (
              <Badge variant="outline" className="text-xs">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Updating...
              </Badge>
            )}
          </div>

          {isLoadingPreview ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : preview ? (
            <>
              {/* Main stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-background rounded-md p-3 border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <FileText className="h-3 w-3" />
                    Total Events
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {preview.totalEvents.toLocaleString()}
                  </p>
                </div>
                <div className="bg-background rounded-md p-3 border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Users className="h-3 w-3" />
                    Unique Sessions
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {preview.uniqueSessions.toLocaleString()}
                  </p>
                </div>
                <div className="bg-background rounded-md p-3 border col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Clock className="h-3 w-3" />
                    Date Range Span
                  </div>
                  <p className="text-2xl font-bold text-foreground">{daysDiff} days</p>
                </div>
              </div>

              {/* Event categories breakdown */}
              {preview.eventCategories.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Event Categories:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {preview.eventCategories.map(({ category, count }) => (
                      <Badge key={category} variant="outline" className="text-xs">
                        {category}: {count.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actual date range of events */}
              {preview.oldestEvent && preview.newestEvent && (
                <p className="text-xs text-muted-foreground">
                  Events span from{" "}
                  <span className="font-medium text-foreground">
                    {format(new Date(preview.oldestEvent), "MMM d, yyyy h:mm a")}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-foreground">
                    {format(new Date(preview.newestEvent), "MMM d, yyyy h:mm a")}
                  </span>
                </p>
              )}

              {preview.totalEvents === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No events found in the selected date range
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Delete action */}
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={!preview || preview.totalEvents === 0}
            >
              <Trash2 className="h-4 w-4" />
              Delete Data in Range
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Data Deletion
              </DialogTitle>
              <DialogDescription asChild>
                <div className="pt-2 space-y-4">
                  <p>
                    You are about to permanently delete all analytics events from{" "}
                    <strong>{format(dateRange.from, "MMMM d, yyyy")}</strong> to{" "}
                    <strong>{format(dateRange.to, "MMMM d, yyyy")}</strong>.
                  </p>

                  {preview && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2">
                      <p className="font-semibold text-destructive">This will delete:</p>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        <li>
                          <strong>{preview.totalEvents.toLocaleString()}</strong> analytics events
                        </li>
                        <li>
                          Data from <strong>{preview.uniqueSessions.toLocaleString()}</strong>{" "}
                          unique sessions
                        </li>
                        <li>
                          Spanning <strong>{daysDiff} days</strong> of tracking data
                        </li>
                      </ul>
                    </div>
                  )}

                  <p className="text-destructive font-medium">
                    This action <strong>cannot be undone</strong>. Are you sure you want to proceed?
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="gap-2"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {preview?.totalEvents.toLocaleString()} Events
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
