import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart3, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function AnalyticsOptOut() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOptedOut, setIsOptedOut] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      checkOptOutStatus();
    }
  }, [user?.id]);

  const checkOptOutStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("analytics_excluded_users")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      setIsOptedOut(!!data);
    } catch (error) {
      console.error("Error checking analytics opt-out status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (optOut: boolean) => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      if (optOut) {
        // Add user to exclusion list
        const { error } = await supabase.from("analytics_excluded_users").insert({
          user_id: user.id,
          reason: "User opted out via account settings",
        });

        if (error) throw error;

        toast({
          title: "Analytics disabled",
          description: "Your activity will no longer be tracked for analytics purposes.",
        });
      } else {
        // Remove user from exclusion list
        const { error } = await supabase
          .from("analytics_excluded_users")
          .delete()
          .eq("user_id", user.id);

        if (error) throw error;

        toast({
          title: "Analytics enabled",
          description: "Your activity will be tracked anonymously to help improve our platform.",
        });
      }

      setIsOptedOut(optOut);
    } catch (error) {
      console.error("Error updating analytics preference:", error);
      toast({
        title: "Error",
        description: "Failed to update your analytics preference. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-8 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics Preferences
        </CardTitle>
        <CardDescription>
          Control how your activity data is used to improve the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="analytics-opt-out" className="text-base">
              Opt out of analytics tracking
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, your activity will not be collected for platform improvement analytics
            </p>
          </div>
          <Switch
            id="analytics-opt-out"
            checked={isOptedOut}
            onCheckedChange={handleToggle}
            disabled={isSaving}
          />
        </div>

        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            We collect anonymized usage data (page views, feature usage) to understand how the
            platform is used and identify areas for improvement. This data is never sold or shared
            with third parties. Your choice here does not affect essential platform functionality.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
