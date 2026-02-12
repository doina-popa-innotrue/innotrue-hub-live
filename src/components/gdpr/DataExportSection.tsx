import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Clock, CheckCircle, AlertCircle, FileDown } from "lucide-react";
import { format } from "date-fns";

interface DataExportRequest {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "ready" | "downloaded" | "expired";
  requested_at: string;
  completed_at: string | null;
  download_url: string | null;
  expires_at: string | null;
  error_message: string | null;
}

export function DataExportSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["data-export-requests", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("data_export_requests" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as unknown as DataExportRequest[];
    },
    enabled: !!user,
  });

  const requestExport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("data_export_requests" as any).insert({
        user_id: user.id,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-export-requests"] });
      toast({
        title: "Export requested",
        description: "We'll prepare your data export. This may take a few minutes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasPendingRequest = requests?.some(
    (r) => r.status === "pending" || r.status === "processing",
  );

  const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-yellow-600", label: "Pending" },
    processing: { icon: Loader2, color: "text-blue-600", label: "Processing" },
    ready: { icon: CheckCircle, color: "text-green-600", label: "Ready" },
    downloaded: { icon: FileDown, color: "text-muted-foreground", label: "Downloaded" },
    expired: { icon: AlertCircle, color: "text-muted-foreground", label: "Expired" },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <CardTitle>Export Your Data</CardTitle>
        </div>
        <CardDescription>
          Download a copy of all your personal data stored on InnoTrue Hub. This includes your
          profile, goals, decisions, assessments, and more.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={() => requestExport.mutate()}
          disabled={hasPendingRequest || requestExport.isPending}
        >
          {requestExport.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Request Data Export
        </Button>

        {hasPendingRequest && (
          <p className="text-sm text-muted-foreground">
            You have a pending export request. Please wait for it to complete.
          </p>
        )}

        {requests && requests.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Requests</p>
            <div className="space-y-2">
              {requests.map((request) => {
                const config = statusConfig[request.status];
                const Icon = config.icon;

                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 ${config.color} ${request.status === "processing" ? "animate-spin" : ""}`}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(request.requested_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                    {request.status === "ready" && request.download_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={request.download_url} download>
                          <FileDown className="h-4 w-4 mr-1" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>
            <strong>Your rights:</strong> Under GDPR, you have the right to access, rectify, and
            delete your personal data.
          </p>
          <p>
            To request data deletion, please visit{" "}
            <a href="/account" className="text-primary hover:underline">
              Account Settings
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
