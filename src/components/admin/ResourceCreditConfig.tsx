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
import { toast } from "sonner";
import { Loader2, Shield, Coins } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  tier_level: number;
}

interface ResourceCreditConfigProps {
  resourceId: string;
  currentPlanId: string | null;
  currentMinTier: number;
  isConsumable: boolean;
  creditCost: number | null;
  onUpdate?: () => void;
}

/**
 * Admin component for configuring resource access and credit costs.
 * Replaces the old ResourcePlanConfig that used quota-based tracking.
 */
export function ResourceCreditConfig({
  resourceId,
  currentPlanId,
  currentMinTier,
  isConsumable: initialIsConsumable,
  creditCost: initialCreditCost,
  onUpdate,
}: ResourceCreditConfigProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanId || "none");
  const [minTier, setMinTier] = useState(currentMinTier);
  const [isConsumable, setIsConsumable] = useState(initialIsConsumable);
  const [creditCost, setCreditCost] = useState<string>(initialCreditCost?.toString() || "1");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchPlans() {
      const { data: plansData } = await supabase
        .from("plans")
        .select("id, name, tier_level")
        .eq("is_active", true)
        .order("tier_level");

      setPlans(plansData || []);
      setIsLoading(false);
    }
    fetchPlans();
  }, []);

  useEffect(() => {
    setSelectedPlanId(currentPlanId || "none");
    setMinTier(currentMinTier);
    setIsConsumable(initialIsConsumable);
    setCreditCost(initialCreditCost?.toString() || "1");
  }, [currentPlanId, currentMinTier, initialIsConsumable, initialCreditCost]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const parsedCost = creditCost === "" || creditCost === "0" ? 0 : parseInt(creditCost, 10);

      const { error } = await supabase
        .from("resource_library")
        .update({
          plan_id: selectedPlanId === "none" ? null : selectedPlanId,
          min_plan_tier: minTier,
          is_consumable: isConsumable,
          credit_cost: isConsumable ? parsedCost : null,
        })
        .eq("id", resourceId);

      if (error) throw error;

      toast.success("Resource settings updated");
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
          Access & Credits
        </CardTitle>
        <CardDescription>Control plan access and credit cost for this resource</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Minimum Plan Tier */}
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

        {/* Consumable Toggle */}
        <div className="flex items-center gap-2 py-2">
          <Switch checked={isConsumable} onCheckedChange={setIsConsumable} id="consumable" />
          <Label htmlFor="consumable" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Requires credits to access
          </Label>
        </div>

        {/* Credit Cost */}
        {isConsumable && (
          <div className="space-y-2">
            <Label htmlFor="credit-cost">Credit Cost</Label>
            <div className="flex items-center gap-2">
              <Input
                id="credit-cost"
                type="number"
                min="0"
                value={creditCost}
                onChange={(e) => setCreditCost(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">credits per access</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Set to 0 for free access. Higher costs can be used for premium resources.
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
