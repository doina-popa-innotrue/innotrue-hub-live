import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Shield, TrendingUp } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  tier_level: number;
}

interface PlanLimit {
  plan_id: string;
  monthly_limit: number | null;
}

interface ResourcePlanConfigProps {
  resourceId: string;
  currentPlanId: string | null;
  currentMinTier: number;
  isConsumable: boolean;
  onUpdate?: () => void;
}

export function ResourcePlanConfig({
  resourceId,
  currentPlanId,
  currentMinTier,
  isConsumable: initialIsConsumable,
  onUpdate,
}: ResourcePlanConfigProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planLimits, setPlanLimits] = useState<PlanLimit[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanId || "none");
  const [minTier, setMinTier] = useState(currentMinTier);
  const [isConsumable, setIsConsumable] = useState(initialIsConsumable);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // Fetch plans
      const { data: plansData } = await supabase
        .from("plans")
        .select("id, name, tier_level")
        .eq("is_active", true)
        .order("tier_level");

      // Fetch existing limits for this resource
      const { data: limitsData } = await supabase
        .from("plan_resource_limits")
        .select("plan_id, monthly_limit")
        .eq("resource_id", resourceId);

      setPlans(plansData || []);
      setPlanLimits(limitsData || []);
      setIsLoading(false);
    }
    fetchData();
  }, [resourceId]);

  useEffect(() => {
    setSelectedPlanId(currentPlanId || "none");
    setMinTier(currentMinTier);
    setIsConsumable(initialIsConsumable);
  }, [currentPlanId, currentMinTier, initialIsConsumable]);

  const handleLimitChange = (planId: string, limit: string) => {
    const numLimit = limit === "" ? null : parseInt(limit, 10);
    setPlanLimits((prev) => {
      const existing = prev.find((l) => l.plan_id === planId);
      if (existing) {
        return prev.map((l) => (l.plan_id === planId ? { ...l, monthly_limit: numLimit } : l));
      }
      return [...prev, { plan_id: planId, monthly_limit: numLimit }];
    });
  };

  const getLimitForPlan = (planId: string): string => {
    const limit = planLimits.find((l) => l.plan_id === planId);
    return limit?.monthly_limit?.toString() || "";
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update resource settings
      const { error: resourceError } = await supabase
        .from("resource_library")
        .update({
          plan_id: selectedPlanId === "none" ? null : selectedPlanId,
          min_plan_tier: minTier,
          is_consumable: isConsumable,
        })
        .eq("id", resourceId);

      if (resourceError) throw resourceError;

      // Update plan limits if consumable
      if (isConsumable) {
        // Delete existing limits
        await supabase.from("plan_resource_limits").delete().eq("resource_id", resourceId);

        // Insert new limits
        const limitsToInsert = planLimits
          .filter((l) => l.monthly_limit !== null && l.monthly_limit > 0)
          .map((l) => ({
            resource_id: resourceId,
            plan_id: l.plan_id,
            monthly_limit: l.monthly_limit,
          }));

        if (limitsToInsert.length > 0) {
          const { error: limitsError } = await supabase
            .from("plan_resource_limits")
            .insert(limitsToInsert);

          if (limitsError) throw limitsError;
        }
      }

      toast.success("Plan settings updated");
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading plans...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Plan Access & Limits
        </CardTitle>
        <CardDescription>
          Control which plans can access this resource and set usage limits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Minimum Plan Tier</Label>
          <Select value={minTier.toString()} onValueChange={(v) => setMinTier(parseInt(v, 10))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No restriction (all plans)</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.tier_level.toString()}>
                  Tier {plan.tier_level}: {plan.name}+
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 py-2">
          <Switch checked={isConsumable} onCheckedChange={setIsConsumable} id="consumable" />
          <Label htmlFor="consumable" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Track usage with monthly limits
          </Label>
        </div>

        {isConsumable && (
          <div className="space-y-2">
            <Label>Monthly Limits per Plan</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-muted-foreground ml-2">(Tier {plan.tier_level})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Unlimited"
                        value={getLimitForPlan(plan.id)}
                        onChange={(e) => handleLimitChange(plan.id, e.target.value)}
                        className="w-28"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Leave empty for unlimited access. E.g., "1" means 1 use per month.
            </p>
          </div>
        )}

        <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
