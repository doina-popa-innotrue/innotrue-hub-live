import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export function AdminRefreshControl() {
  const [isLoading, setIsLoading] = useState(false);
  const [refreshType, setRefreshType] = useState<"full" | "cache">("full");

  const triggerRefresh = async () => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();

      // Update the platform settings with the new refresh timestamp
      const { error: updateError } = await supabase
        .from("platform_settings")
        .update({
          last_force_refresh: now,
          updated_at: now,
        })
        .eq("id", "default");

      if (updateError) throw updateError;

      // Also broadcast to currently connected clients for immediate effect
      const channel = supabase.channel("admin-refresh-signal");

      await channel.send({
        type: "broadcast",
        event: "force-refresh",
        payload: {
          type: refreshType,
          message:
            refreshType === "full"
              ? "An administrator has pushed updates. Your page will refresh shortly."
              : "Data is being refreshed with the latest updates.",
          timestamp: now,
        },
      });

      toast({
        title: "Refresh Signal Sent",
        description:
          refreshType === "full"
            ? "All clients (connected now and future) will reload their pages."
            : "All clients (connected now and future) will refresh their cached data.",
      });

      // Cleanup the channel
      await supabase.removeChannel(channel);
    } catch (error) {
      console.error("Error sending refresh signal:", error);
      toast({
        title: "Error",
        description: "Failed to send refresh signal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Force Client Refresh
        </CardTitle>
        <CardDescription>
          Broadcast a refresh signal to all connected clients. Use this after making significant
          configuration changes to ensure all users see the latest updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={refreshType}
          onValueChange={(v) => setRefreshType(v as "full" | "cache")}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="full" id="full" />
            <Label htmlFor="full" className="cursor-pointer">
              <span className="font-medium">Full Page Reload</span>
              <span className="text-muted-foreground text-sm ml-2">
                — Forces all clients to reload their browser page
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="cache" id="cache" />
            <Label htmlFor="cache" className="cursor-pointer">
              <span className="font-medium">Cache Refresh Only</span>
              <span className="text-muted-foreground text-sm ml-2">
                — Refreshes data without page reload (less disruptive)
              </span>
            </Label>
          </div>
        </RadioGroup>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Send Refresh Signal
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {refreshType === "full" ? "Force Page Reload?" : "Refresh Client Caches?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {refreshType === "full"
                  ? "This will force all connected users to reload their browser pages. Any unsaved work may be lost. Use this sparingly."
                  : "This will refresh all cached data for connected users without reloading their pages. This is less disruptive but may not clear all stale state."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={triggerRefresh}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
