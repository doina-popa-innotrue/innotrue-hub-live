import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const LAST_REFRESH_KEY = "platform_last_refresh_check";

/**
 * Hook that listens for admin-triggered refresh signals via Supabase Realtime.
 * Also checks on mount if a refresh occurred while the user was offline.
 *
 * @param isAuthenticated - Whether the user is currently authenticated
 */
export function useAdminRefreshSignal(isAuthenticated: boolean = true) {
  const queryClient = useQueryClient();
  const hasCheckedRef = useRef(false);

  // Check for missed refresh signals on mount
  useEffect(() => {
    if (!isAuthenticated || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkForMissedRefresh = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("last_force_refresh")
          .eq("id", "default")
          .single();

        if (error || !data?.last_force_refresh) return;

        const serverTimestamp = new Date(data.last_force_refresh).getTime();
        const lastChecked = localStorage.getItem(LAST_REFRESH_KEY);
        const lastCheckedTime = lastChecked ? parseInt(lastChecked, 10) : 0;

        // Update the local timestamp
        localStorage.setItem(LAST_REFRESH_KEY, Date.now().toString());

        // If server timestamp is newer than our last check, trigger refresh
        if (serverTimestamp > lastCheckedTime && lastCheckedTime > 0) {
          console.log("Detected missed refresh signal, reloading...");
          toast.info("Updating application...", {
            description: "Loading the latest platform updates.",
            duration: 2000,
          });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err) {
        console.error("Error checking for missed refresh:", err);
      }
    };

    checkForMissedRefresh();
  }, [isAuthenticated]);

  // Listen for real-time refresh signals
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log("Setting up admin refresh signal listener...");

    const channel = supabase
      .channel("admin-refresh-signal")
      .on("broadcast", { event: "force-refresh" }, (payload) => {
        console.log("Received admin refresh signal:", payload);

        // Update local timestamp so we don't trigger again on next mount
        localStorage.setItem(LAST_REFRESH_KEY, Date.now().toString());

        const refreshType = payload.payload?.type || "full";
        const message =
          payload.payload?.message || "The application is being refreshed with the latest updates.";

        if (refreshType === "cache") {
          // Invalidate all queries to force refetch
          queryClient.invalidateQueries();
          toast.info("Data refreshed", {
            description: "All data has been updated with the latest changes.",
          });
        } else {
          // Full page reload
          toast.info("Refreshing application...", {
            description: message,
            duration: 2000,
          });

          // Small delay to show the toast before reload
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      })
      .subscribe((status) => {
        console.log("Admin refresh channel status:", status);
      });

    return () => {
      console.log("Cleaning up admin refresh signal listener...");
      supabase.removeChannel(channel);
    };
  }, [queryClient, isAuthenticated]);
}
