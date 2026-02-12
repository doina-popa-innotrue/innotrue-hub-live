import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function useGoogleDriveSSO() {
  const [isLoading, setIsLoading] = useState(false);
  const [driveUser, setDriveUser] = useState<{
    folder_url: string;
    folder_name: string | null;
  } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchDriveUser();
    }
  }, [user]);

  const fetchDriveUser = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("google_drive_users")
      .select("folder_url, folder_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setDriveUser(data);
    }
  };

  const openGoogleDrive = async () => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please log in to access Google Drive");
        return;
      }

      if (!driveUser?.folder_url) {
        toast.error("No Google Drive folder has been assigned to your account");
        return;
      }

      window.open(driveUser.folder_url, "_blank");
      toast.success("Opening Google Drive...");
    } catch (error) {
      console.error("Google Drive error:", error);
      toast.error("Failed to open Google Drive");
    } finally {
      setIsLoading(false);
    }
  };

  return { openGoogleDrive, isLoading, driveUser, refetch: fetchDriveUser };
}
