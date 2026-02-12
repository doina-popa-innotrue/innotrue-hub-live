import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useLucidSSO() {
  const [isLoading, setIsLoading] = useState(false);

  const loginToLucid = async (redirectUrl?: string) => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please log in to access Lucid");
        return;
      }

      // Get user's Lucid mapping
      const { data: mapping, error } = await supabase
        .from("lucid_users")
        .select("lucid_email, lucid_url")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching Lucid mapping:", error);
        toast.error("Failed to fetch Lucid account");
        return;
      }

      if (!mapping) {
        toast.error("Lucid account not linked. Please contact your administrator.");
        return;
      }

      // Open Lucid in a new tab
      const url = redirectUrl || mapping.lucid_url || "https://lucid.app";
      window.open(url, "_blank");
      toast.success("Opening Lucid...");
    } catch (error) {
      console.error("Lucid SSO error:", error);
      toast.error("Failed to connect to Lucid");
    } finally {
      setIsLoading(false);
    }
  };

  return { loginToLucid, isLoading };
}
