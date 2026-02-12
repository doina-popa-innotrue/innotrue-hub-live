import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_SUPPORT_EMAIL = "hubadmin@innotrue.com";

export function useSupportEmail() {
  const { data: supportEmail, isLoading } = useQuery({
    queryKey: ["system-settings", "support_email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "support_email")
        .maybeSingle();

      if (error || !data) {
        return DEFAULT_SUPPORT_EMAIL;
      }

      return data.value;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    supportEmail: supportEmail || DEFAULT_SUPPORT_EMAIL,
    isLoading,
  };
}
