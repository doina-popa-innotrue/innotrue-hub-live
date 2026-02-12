import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminBreadcrumb,
  AdminTable,
} from "@/components/admin";
import type { AdminTableColumn } from "@/components/admin";

interface DecisionCapabilitySetting {
  id: string;
  capability: string;
  feature_key: string;
  created_at: string;
  updated_at: string;
}

const CAPABILITY_LABELS: Record<string, string> = {
  core_decisions: "Core Decision Management",
  options_pros_cons: "Options with Pros/Cons",
  basic_reflections: "Basic Reflections",
  task_management: "Task Management",
  advanced_frameworks: "Advanced Frameworks",
  values_alignment: "Values Alignment Analysis",
  analytics_dashboard: "Analytics Dashboard",
  reminders_followups: "Reminders & Follow-ups",
  outcome_tracking: "Outcome Tracking",
  decision_templates: "Decision Templates",
  decision_journaling: "Decision Journaling",
  coach_sharing: "Coach Sharing",
};

const FEATURE_OPTIONS = [
  { value: "decision_toolkit_basic", label: "Basic Tier" },
  { value: "decision_toolkit_advanced", label: "Advanced Tier" },
];

export default function DecisionCapabilitiesManagement() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["decision-capability-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_capability_settings")
        .select("*")
        .order("capability");
      if (error) throw error;
      return data as DecisionCapabilitySetting[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ capability, featureKey }: { capability: string; featureKey: string }) => {
      const { error } = await supabase
        .from("decision_capability_settings")
        .update({ feature_key: featureKey })
        .eq("capability", capability);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-capability-settings"] });
      toast.success("Capability assignment updated");
    },
    onError: (error) => {
      toast.error("Failed to update capability assignment");
      console.error(error);
    },
  });

  const handleChange = (capability: string, featureKey: string) => {
    updateMutation.mutate({ capability, featureKey });
  };

  const basicCapabilities =
    settings?.filter((s) => s.feature_key === "decision_toolkit_basic") || [];
  const advancedCapabilities =
    settings?.filter((s) => s.feature_key === "decision_toolkit_advanced") || [];

  const columns: AdminTableColumn<DecisionCapabilitySetting>[] = [
    {
      key: "capability",
      header: "Capability",
      accessor: (item) => (
        <div>
          <p className="font-medium">{CAPABILITY_LABELS[item.capability] || item.capability}</p>
          <p className="text-sm text-muted-foreground">{item.capability}</p>
        </div>
      ),
      sortable: true,
      sortFn: (a, b) => {
        const labelA = CAPABILITY_LABELS[a.capability] || a.capability;
        const labelB = CAPABILITY_LABELS[b.capability] || b.capability;
        return labelA.localeCompare(labelB);
      },
    },
    {
      key: "feature_key",
      header: "Tier",
      accessor: (item) => (
        <Select
          value={item.feature_key}
          onValueChange={(value) => handleChange(item.capability, value)}
          disabled={updateMutation.isPending}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEATURE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Decision Capabilities" }]} />

      <AdminPageHeader
        title="Decision Toolkit Capabilities"
        description="Configure which capabilities are included in each decision toolkit tier"
      />

      {isLoading ? (
        <AdminLoadingState message="Loading capability settings..." />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Basic Tier
                  <Badge variant="secondary">{basicCapabilities.length} capabilities</Badge>
                </CardTitle>
                <CardDescription>Included in decision_toolkit_basic feature</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {basicCapabilities.map((cap) => (
                    <li key={cap.id} className="text-muted-foreground">
                      • {CAPABILITY_LABELS[cap.capability] || cap.capability}
                    </li>
                  ))}
                  {basicCapabilities.length === 0 && (
                    <li className="text-muted-foreground italic">No capabilities assigned</li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Advanced Tier
                  <Badge variant="secondary">{advancedCapabilities.length} capabilities</Badge>
                </CardTitle>
                <CardDescription>Included in decision_toolkit_advanced feature</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {advancedCapabilities.map((cap) => (
                    <li key={cap.id} className="text-muted-foreground">
                      • {CAPABILITY_LABELS[cap.capability] || cap.capability}
                    </li>
                  ))}
                  {advancedCapabilities.length === 0 && (
                    <li className="text-muted-foreground italic">No capabilities assigned</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>

          <AdminTable
            title="Manage Capability Assignments"
            description="Change which tier each capability belongs to"
            data={settings}
            columns={columns}
            showActions={false}
            emptyState={{
              icon: Settings2,
              title: "No capability settings found",
              description: "Capability settings will appear here once configured.",
            }}
          />
        </>
      )}
    </div>
  );
}
