import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AIPreferences {
  ai_insights_enabled: boolean;
  ai_recommendations_enabled: boolean;
  consent_given_at: string | null;
}

export function useAIPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<AIPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPreferences = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("ai_preferences")
        .select("ai_insights_enabled, ai_recommendations_enabled, consent_given_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data);
      } else {
        // Create default preferences if none exist
        const { data: newData, error: insertError } = await supabase
          .from("ai_preferences")
          .insert({ user_id: user.id })
          .select("ai_insights_enabled, ai_recommendations_enabled, consent_given_at")
          .single();

        if (insertError) throw insertError;
        setPreferences(newData);
      }
    } catch (error) {
      console.error("Error fetching AI preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [user]);

  const updatePreference = async (
    key: "ai_insights_enabled" | "ai_recommendations_enabled",
    value: boolean,
  ) => {
    if (!user) return;

    try {
      const updates: Partial<AIPreferences> = { [key]: value };

      // If enabling a feature and consent not yet given, record consent timestamp
      if (value && !preferences?.consent_given_at) {
        updates.consent_given_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("ai_preferences")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      setPreferences((prev) => (prev ? { ...prev, ...updates } : null));

      toast({
        title: "Preferences updated",
        description: `AI ${key === "ai_insights_enabled" ? "Insights" : "Recommendations"} ${value ? "enabled" : "disabled"}.`,
      });
    } catch (error) {
      console.error("Error updating AI preference:", error);
      toast({
        title: "Error",
        description: "Failed to update preference.",
        variant: "destructive",
      });
    }
  };

  const giveConsent = async (feature: "insights" | "recommendations") => {
    if (!user) return;

    const key = feature === "insights" ? "ai_insights_enabled" : "ai_recommendations_enabled";

    try {
      const { error } = await supabase
        .from("ai_preferences")
        .update({
          [key]: true,
          consent_given_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setPreferences((prev) =>
        prev
          ? {
              ...prev,
              [key]: true,
              consent_given_at: new Date().toISOString(),
            }
          : null,
      );

      toast({
        title: "AI feature enabled",
        description: "You can manage AI preferences in Account Settings.",
      });
    } catch (error) {
      console.error("Error giving consent:", error);
      toast({
        title: "Error",
        description: "Failed to enable AI feature.",
        variant: "destructive",
      });
    }
  };

  return {
    preferences,
    isLoading,
    updatePreference,
    giveConsent,
    refetch: fetchPreferences,
  };
}
