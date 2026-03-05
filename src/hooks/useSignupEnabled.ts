import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks whether public signup is enabled via the get_signup_enabled() RPC.
 * Works for unauthenticated users (Auth page) — the RPC is granted to anon.
 * Defaults to true (fail-open) if the RPC call fails.
 */
export function useSignupEnabled() {
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const { data, error } = await supabase.rpc("get_signup_enabled");
        if (!error && data !== null) {
          setSignupEnabled(data);
        }
        // On error, default to true (fail open — don't break signup for a settings read failure)
      } catch {
        // fail open
      } finally {
        setIsLoading(false);
      }
    };
    fetchSetting();
  }, []);

  return { signupEnabled, isLoading };
}
