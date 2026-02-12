import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Trash2, AlertTriangle, Loader2, Webhook, Clock, FileText } from "lucide-react";

interface WebhookLogsCleanupProps {
  onCleanupComplete?: () => void;
}

export function WebhookLogsCleanup({ onCleanupComplete }: WebhookLogsCleanupProps) {
  const [retentionDays, setRetentionDays] = useState(30);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Fetch preview of logs to be deleted
  const {
    data: preview,
    isLoading: isLoadingPreview,
    refetch,
  } = useQuery({
    queryKey: ["webhook-logs-cleanup-preview", retentionDays],
    queryFn: async () => {
      const cutoffDate = subDays(new Date(), retentionDays).toISOString();

      // Get count of logs to be deleted
      const { count: toDeleteCount, error: deleteCountError } = await supabase
        .from("calcom_webhook_logs")
        .select("*", { count: "exact", head: true })
        .lt("created_at", cutoffDate);

      if (deleteCountError) throw deleteCountError;

      // Get total logs count
      const { count: totalCount, error: totalCountError } = await supabase
        .from("calcom_webhook_logs")
        .select("*", { count: "exact", head: true });

      if (totalCountError) throw totalCountError;

      // Get event type breakdown for logs to be deleted
      const { data: eventData, error: eventError } = await supabase
        .from("calcom_webhook_logs")
        .select("event_type")
        .lt("created_at", cutoffDate);

      if (eventError) throw eventError;

      const eventMap = new Map<string, number>();
      eventData?.forEach((e) => {
        const type = e.event_type || "unknown";
        eventMap.set(type, (eventMap.get(type) || 0) + 1);
      });

      const eventBreakdown = Array.from(eventMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Get oldest log date
      const { data: oldestLog } = await supabase
        .from("calcom_webhook_logs")
        .select("created_at")
        .order("created_at", { ascending: true })
        .limit(1);

      return {
        toDeleteCount: toDeleteCount || 0,
        totalCount: totalCount || 0,
        eventBreakdown,
        oldestLogDate: oldestLog?.[0]?.created_at || null,
        cutoffDate,
      };
    },
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (days: number) => {
      const { data, error } = await supabase.rpc("cleanup_old_webhook_logs", {
        retention_days: days,
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: (deletedCount) => {
      toast.success(`Successfully deleted ${deletedCount.toLocaleString()} webhook logs`);
      setIsConfirmOpen(false);
      refetch();
      onCleanupComplete?.();
    },
    onError: (error) => {
      toast.error(
        "Failed to delete logs: " + (error instanceof Error ? error.message : "Unknown error"),
      );
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate(retentionDays);
  };

  const presetDays = [7, 14, 30, 60, 90];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <CardTitle>Webhook Logs Cleanup</CardTitle>
        </div>
        <CardDescription>
          Manage Cal.com webhook logs. Auto-cleanup runs daily (30-day retention).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            <strong>Auto-cleanup enabled:</strong> Logs older than 30 days are automatically deleted
            daily at 3 AM UTC.
          </AlertDescription>
        </Alert>

        {/* Retention days input */}
        <div className="space-y-3">
          <Label>Delete logs older than:</Label>
          <div className="flex flex-wrap gap-2">
            {presetDays.map((days) => (
              <Button
                key={days}
                variant={retentionDays === days ? "default" : "outline"}
                size="sm"
                onClick={() => setRetentionDays(days)}
              >
                {days} days
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Logs to be Deleted
          </h4>

          {isLoadingPreview ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : preview ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded-md p-3 border">
                  <div className="text-muted-foreground text-xs mb-1">To Delete</div>
                  <p className="text-2xl font-bold text-destructive">
                    {preview.toDeleteCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-background rounded-md p-3 border">
                  <div className="text-muted-foreground text-xs mb-1">Total Logs</div>
                  <p className="text-2xl font-bold text-foreground">
                    {preview.totalCount.toLocaleString()}
                  </p>
                </div>
              </div>

              {preview.eventBreakdown.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Event Types:</span>
                  <div className="flex flex-wrap gap-2">
                    {preview.eventBreakdown.map(({ type, count }) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}: {count.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {preview.oldestLogDate && (
                <p className="text-xs text-muted-foreground">
                  Oldest log: {format(new Date(preview.oldestLogDate), "MMM d, yyyy h:mm a")}
                </p>
              )}

              {preview.toDeleteCount === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No logs older than {retentionDays} days
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
              disabled={!preview || preview.toDeleteCount === 0}
            >
              <Trash2 className="h-4 w-4" />
              Delete Old Logs
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Log Deletion
              </DialogTitle>
              <DialogDescription asChild>
                <div className="pt-2 space-y-4">
                  <p>
                    You are about to permanently delete all webhook logs older than{" "}
                    <strong>{retentionDays} days</strong>.
                  </p>

                  {preview && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                      <p className="font-semibold text-destructive">
                        This will delete {preview.toDeleteCount.toLocaleString()} logs
                      </p>
                    </div>
                  )}

                  <p className="text-destructive font-medium">
                    This action <strong>cannot be undone</strong>.
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
                    Delete {preview?.toDeleteCount.toLocaleString()} Logs
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
