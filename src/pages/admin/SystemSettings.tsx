import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Settings, Save, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminRefreshControl } from "@/components/admin/AdminRefreshControl";
interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("*").order("key");

      if (error) throw error;
      return data as SystemSetting[];
    },
  });

  // Fetch admin users for the ActiveCampaign sync admin dropdown
  const { data: adminUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, name, email)")
        .eq("role", "admin");

      if (error) throw error;
      return (
        data?.map((r) => ({
          id: r.user_id,
          name: (r.profiles as any)?.name || "Unknown",
          email: (r.profiles as any)?.email || "",
        })) || []
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase.from("system_settings").update({ value }).eq("key", key);

      if (error) throw error;
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-settings", key] });
      setEditedValues((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      toast({
        title: "Setting Updated",
        description: "The setting has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update setting. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating setting:", error);
    },
  });

  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    const value = editedValues[key];
    if (value !== undefined) {
      updateMutation.mutate({ key, value });
    }
  };

  const getDisplayLabel = (key: string): string => {
    const labels: Record<string, string> = {
      support_email: "Support Email",
      ai_monthly_credit_limit: "AI Monthly Credit Limit",
      ai_alert_threshold_percent: "AI Alert Threshold (%)",
      ai_alert_email: "AI Alert Email",
      ai_alert_sent_this_month: "AI Alert Sent This Month",
      activecampaign_sync_admin_user_id: "ActiveCampaign Sync Admin User",
      max_recurrence_occurrences: "Max Recurring Session Instances",
      program_terms_retention_years: "Program Terms Retention (Years)",
      org_terms_retention_years: "Organization Terms Retention (Years)",
    };
    return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getInputType = (key: string): string => {
    if (key.includes("email")) return "email";
    if (
      key.includes("limit") ||
      key.includes("percent") ||
      key.includes("years") ||
      key.includes("occurrences")
    )
      return "number";
    return "text";
  };

  const isReadOnly = (key: string): boolean => {
    return key === "ai_alert_sent_this_month";
  };

  const isUserIdSelect = (key: string): boolean => {
    return key === "activecampaign_sync_admin_user_id";
  };

  if (isLoading) {
    return <PageLoadingState />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          System Settings
        </h1>
        <p className="text-muted-foreground mt-2">Configure platform-wide settings.</p>
      </div>

      <div className="space-y-4">
        <AdminRefreshControl />
        {settings?.map((setting) => {
          const currentValue = editedValues[setting.key] ?? setting.value;
          const hasChanges =
            editedValues[setting.key] !== undefined && editedValues[setting.key] !== setting.value;

          return (
            <Card key={setting.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{getDisplayLabel(setting.key)}</CardTitle>
                {setting.description && <CardDescription>{setting.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor={setting.key} className="sr-only">
                      {getDisplayLabel(setting.key)}
                    </Label>
                    {isUserIdSelect(setting.key) ? (
                      <Select
                        value={currentValue || "none"}
                        onValueChange={(value) =>
                          handleValueChange(setting.key, value === "none" ? "" : value)
                        }
                        disabled={isReadOnly(setting.key)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an admin user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Use config creator</SelectItem>
                          {adminUsers?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} {user.email && `(${user.email})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={setting.key}
                        type={getInputType(setting.key)}
                        value={currentValue}
                        onChange={(e) => handleValueChange(setting.key, e.target.value)}
                        placeholder={`Enter ${getDisplayLabel(setting.key).toLowerCase()}`}
                        disabled={isReadOnly(setting.key)}
                      />
                    )}
                  </div>
                  {!isReadOnly(setting.key) && (
                    <Button
                      onClick={() => handleSave(setting.key)}
                      disabled={!hasChanges || updateMutation.isPending}
                      size="sm"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {settings?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No system settings configured.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
