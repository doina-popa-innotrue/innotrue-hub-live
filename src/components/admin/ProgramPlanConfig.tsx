import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Shield, Package, Gem, AlertTriangle, Coins, RotateCcw, CreditCard, Timer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreditRatio, formatRatioText } from "@/hooks/useCreditRatio";

interface Plan {
  id: string;
  name: string;
  tier_level: number;
}

interface ProgramPlan {
  id: string;
  name: string;
  tier_level: number;
  description: string | null;
}

interface TierPlanMapping {
  tier_name: string;
  program_plan_id: string | null;
  credit_cost: number | null;
}

interface ProgramPlanConfigProps {
  programId: string;
  programTiers: string[];
  currentPlanId: string | null;
  currentMinTier: number;
  currentRequiresSeparatePurchase?: boolean;
  currentAllowRepeatEnrollment?: boolean;
  onUpdate?: () => void;
}

export function ProgramPlanConfig({
  programId,
  programTiers,
  currentPlanId,
  currentMinTier,
  currentRequiresSeparatePurchase = false,
  currentAllowRepeatEnrollment = false,
  onUpdate,
}: ProgramPlanConfigProps) {
  const { creditRatio } = useCreditRatio();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [programPlans, setProgramPlans] = useState<ProgramPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanId || "none");
  const [minTier, setMinTier] = useState(currentMinTier);
  const [selectedProgramPlanId, setSelectedProgramPlanId] = useState<string>("none");
  const [tierPlanMappings, setTierPlanMappings] = useState<TierPlanMapping[]>([]);
  const [requiresSeparatePurchase, setRequiresSeparatePurchase] = useState(
    currentRequiresSeparatePurchase,
  );
  const [allowRepeatEnrollment, setAllowRepeatEnrollment] = useState(currentAllowRepeatEnrollment);
  const [installmentMonths, setInstallmentMonths] = useState<number[]>([]);
  const [upfrontDiscountPercent, setUpfrontDiscountPercent] = useState(0);
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [defaultDurationDays, setDefaultDurationDays] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const AVAILABLE_INSTALLMENT_OPTIONS = [3, 6, 12];

  useEffect(() => {
    async function fetchData() {
      // Fetch subscription plans
      const { data: plansData } = await supabase
        .from("plans")
        .select("id, name, tier_level")
        .eq("is_active", true)
        .order("tier_level");

      // Fetch program plans
      const { data: programPlansData } = await supabase
        .from("program_plans")
        .select("id, name, tier_level, description")
        .eq("is_active", true)
        .order("tier_level");

      // Fetch current program's default program plan and separate purchase flag
      const { data: programData } = await supabase
        .from("programs")
        .select("default_program_plan_id, requires_separate_purchase, allow_repeat_enrollment, installment_options, upfront_discount_percent, default_duration_days")
        .eq("id", programId)
        .single();

      // Fetch existing tier-to-plan mappings
      const { data: tierPlansData } = await supabase
        .from("program_tier_plans")
        .select("tier_name, program_plan_id, credit_cost")
        .eq("program_id", programId);

      setPlans(plansData || []);
      setProgramPlans(programPlansData || []);
      setSelectedProgramPlanId(programData?.default_program_plan_id || "none");
      setRequiresSeparatePurchase(programData?.requires_separate_purchase || false);
      setAllowRepeatEnrollment(programData?.allow_repeat_enrollment || false);
      // Parse installment options: stored as JSON array of {months: N} objects
      const instOpts = programData?.installment_options;
      if (Array.isArray(instOpts)) {
        setInstallmentMonths(instOpts.map((o: { months: number }) => o.months).filter(Boolean));
      }
      setUpfrontDiscountPercent(programData?.upfront_discount_percent ?? 0);
      setDefaultDurationDays(programData?.default_duration_days ?? null);
      setDurationEnabled(programData?.default_duration_days != null);

      // Initialize tier plan mappings
      const mappings: TierPlanMapping[] = programTiers.map((tier) => {
        const existing = tierPlansData?.find((tp) => tp.tier_name === tier);
        return {
          tier_name: tier,
          program_plan_id: existing?.program_plan_id || null,
          credit_cost: existing?.credit_cost ?? null,
        };
      });
      setTierPlanMappings(mappings);

      setIsLoading(false);
    }
    fetchData();
  }, [programId, programTiers]);

  useEffect(() => {
    setSelectedPlanId(currentPlanId || "none");
    setMinTier(currentMinTier);
    setRequiresSeparatePurchase(currentRequiresSeparatePurchase);
    setAllowRepeatEnrollment(currentAllowRepeatEnrollment);
  }, [
    currentPlanId,
    currentMinTier,
    currentRequiresSeparatePurchase,
    currentAllowRepeatEnrollment,
  ]);

  // Update mappings when program tiers change
  useEffect(() => {
    setTierPlanMappings((prev) => {
      const newMappings: TierPlanMapping[] = programTiers.map((tier) => {
        const existing = prev.find((m) => m.tier_name === tier);
        return existing || { tier_name: tier, program_plan_id: null, credit_cost: null };
      });
      return newMappings;
    });
  }, [programTiers]);

  const maxTier = plans.length > 0 ? Math.max(...plans.map((p) => p.tier_level)) : 5;

  const handleTierPlanChange = (tierName: string, planId: string) => {
    setTierPlanMappings((prev) =>
      prev.map((m) =>
        m.tier_name === tierName ? { ...m, program_plan_id: planId === "none" ? null : planId } : m,
      ),
    );
  };

  const handleTierCreditCostChange = (tierName: string, cost: string) => {
    const numericCost = cost === "" ? null : parseInt(cost, 10);
    setTierPlanMappings((prev) =>
      prev.map((m) =>
        m.tier_name === tierName
          ? { ...m, credit_cost: isNaN(numericCost as number) ? null : numericCost }
          : m,
      ),
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build installment options JSON
      const installmentOptionsJson = installmentMonths.length > 0
        ? installmentMonths.sort((a, b) => a - b).map((m) => ({ months: m, label: `${m} monthly payments` }))
        : null;

      // Update program settings
      const { error: programError } = await supabase
        .from("programs")
        .update({
          plan_id: selectedPlanId === "none" ? null : selectedPlanId,
          min_plan_tier: requiresSeparatePurchase ? 0 : minTier,
          default_program_plan_id: selectedProgramPlanId === "none" ? null : selectedProgramPlanId,
          requires_separate_purchase: requiresSeparatePurchase,
          allow_repeat_enrollment: allowRepeatEnrollment,
          installment_options: installmentOptionsJson,
          upfront_discount_percent: upfrontDiscountPercent,
          default_duration_days: durationEnabled ? defaultDurationDays : null,
        })
        .eq("id", programId);

      if (programError) throw programError;

      // Delete existing tier plan mappings for this program
      const { error: deleteError } = await supabase
        .from("program_tier_plans")
        .delete()
        .eq("program_id", programId);

      if (deleteError) throw deleteError;

      // Insert new tier plan mappings (only for tiers that have a plan or credit_cost assigned)
      const mappingsToInsert = tierPlanMappings
        .filter((m) => m.program_plan_id || m.credit_cost !== null)
        .map((m) => ({
          program_id: programId,
          tier_name: m.tier_name,
          program_plan_id: m.program_plan_id!,
          credit_cost: m.credit_cost,
        }));

      if (mappingsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("program_tier_plans")
          .insert(mappingsToInsert);

        if (insertError) throw insertError;
      }

      toast.success("Plan access settings updated");
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const getTierLabel = (tier: number) => {
    if (tier === 0) return "No restriction";
    const plan = plans.find((p) => p.tier_level === tier);
    return plan ? `${plan.name} (Tier ${tier})` : `Tier ${tier}`;
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
    <div className="space-y-6">
      {/* Premium/Exceptional Program */}
      <Card
        className={
          requiresSeparatePurchase ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : ""
        }
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gem className="h-4 w-4 text-amber-600" />
            Premium Program (Separate Purchase)
          </CardTitle>
          <CardDescription>
            Mark this program as requiring a separate purchase, regardless of subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requires-separate-purchase">Requires Separate Purchase</Label>
              <p className="text-xs text-muted-foreground">
                Users cannot access this program through any subscription plan. They must be
                manually enrolled after payment.
              </p>
            </div>
            <Switch
              id="requires-separate-purchase"
              checked={requiresSeparatePurchase}
              onCheckedChange={setRequiresSeparatePurchase}
            />
          </div>

          {requiresSeparatePurchase && (
            <Alert className="bg-amber-100 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                This program will be visible in the catalogue but locked for all users. Access is
                granted only through manual enrollment by an admin.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Enrollment Duration */}
      <Card className={durationEnabled ? "border-indigo-500/50 bg-indigo-50/30 dark:bg-indigo-950/20" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-indigo-600" />
            Enrollment Duration
          </CardTitle>
          <CardDescription>
            Set a default duration for enrollments. When enabled, new enrollments get an automatic deadline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="duration-enabled">Enable Enrollment Deadline</Label>
              <p className="text-xs text-muted-foreground">
                When disabled, enrollments are self-paced with no expiry date.
              </p>
            </div>
            <Switch
              id="duration-enabled"
              checked={durationEnabled}
              onCheckedChange={setDurationEnabled}
            />
          </div>

          {durationEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="duration-days">Duration (days)</Label>
                <Input
                  id="duration-days"
                  type="number"
                  min="1"
                  max="1095"
                  placeholder="e.g. 90, 180, 365"
                  value={defaultDurationDays ?? ""}
                  onChange={(e) =>
                    setDefaultDurationDays(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  className="w-40"
                />
                <p className="text-xs text-muted-foreground">
                  New enrollments will have end_date = start_date + this many days.
                  Clients receive warnings at 30 days and 7 days before expiry.
                </p>
              </div>

              <Alert className="bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-700">
                <Timer className="h-4 w-4 text-indigo-600" />
                <AlertDescription className="text-indigo-800 dark:text-indigo-200 text-sm">
                  Existing enrollments are not affected. Only new enrollments after saving will receive a
                  deadline. Admins can extend individual deadlines from the client detail page.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Allow Repeat Enrollment */}
      <Card className={allowRepeatEnrollment ? "border-primary/50 bg-primary/5" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Repeat Enrollment
          </CardTitle>
          <CardDescription>
            Allow clients to enroll in this program multiple times (e.g., for mock review boards,
            practice programs)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-repeat-enrollment">Allow Multiple Enrollments</Label>
              <p className="text-xs text-muted-foreground">
                Clients can enroll again after completing or while still active. Each enrollment has
                separate progress and assignments.
              </p>
            </div>
            <Switch
              id="allow-repeat-enrollment"
              checked={allowRepeatEnrollment}
              onCheckedChange={setAllowRepeatEnrollment}
            />
          </div>

          {allowRepeatEnrollment && (
            <Alert className="bg-primary/10 border-primary/20">
              <RotateCcw className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                Clients will see an "Enroll Again" option on the Explore page after their first
                enrollment. Each attempt is tracked with an enrollment number.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Installment Payment Options */}
      <Card className={installmentMonths.length > 0 ? "border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue-600" />
            Installment Payment Options
          </CardTitle>
          <CardDescription>
            Allow clients to pay for this program in monthly installments. Credits are granted upfront;
            access is locked if a payment is missed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Available Payment Plans</Label>
            <div className="flex flex-col gap-2">
              {AVAILABLE_INSTALLMENT_OPTIONS.map((months) => (
                <div key={months} className="flex items-center gap-2">
                  <Checkbox
                    id={`installment-${months}`}
                    checked={installmentMonths.includes(months)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setInstallmentMonths((prev) => [...prev, months]);
                      } else {
                        setInstallmentMonths((prev) => prev.filter((m) => m !== months));
                      }
                    }}
                  />
                  <Label htmlFor={`installment-${months}`} className="cursor-pointer text-sm">
                    {months} monthly payments
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select which installment options are available. Leave all unchecked to disable installments.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="upfront-discount">Upfront Payment Discount (%)</Label>
            <Input
              id="upfront-discount"
              type="number"
              min="0"
              max="100"
              value={upfrontDiscountPercent}
              onChange={(e) => setUpfrontDiscountPercent(Number(e.target.value) || 0)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Discount applied when client pays in full upfront (0 = no discount).
              Displayed as incentive alongside installment options.
            </p>
          </div>

          {installmentMonths.length > 0 && (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>How it works:</strong> When a client chooses an installment plan, they pay the
                first installment via Stripe Checkout. All credits are granted immediately and the
                enrollment is created. Stripe then charges the remaining installments monthly. If a
                payment fails, the client's program access is paused until payment is recovered.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Subscription Plan Access */}
      <Card className={requiresSeparatePurchase ? "opacity-50" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Subscription Plan Access
          </CardTitle>
          <CardDescription>
            {requiresSeparatePurchase
              ? 'These settings are ignored when "Requires Separate Purchase" is enabled'
              : "Control which subscription plans can access this program"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Specific Subscription Plan Required</Label>
            <Select
              value={selectedPlanId}
              onValueChange={setSelectedPlanId}
              disabled={requiresSeparatePurchase}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific plan required</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              If set, only users on this specific subscription plan (or higher tier) can access
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Minimum Subscription Tier: {getTierLabel(minTier)}</Label>
            </div>
            <Slider
              value={[minTier]}
              onValueChange={([value]) => setMinTier(value)}
              min={0}
              max={maxTier}
              step={1}
              className="py-2"
              disabled={requiresSeparatePurchase}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>No restriction</span>
              <span>Tier {maxTier}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Program Plan (Feature Access) - Per Tier */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Program Plan per Tier (Feature Access)
          </CardTitle>
          <CardDescription>
            Assign different program plans to each tier level within this program
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Default/Fallback Program Plan */}
          <div className="space-y-2">
            <Label>Default Program Plan (Fallback)</Label>
            <Select value={selectedProgramPlanId} onValueChange={setSelectedProgramPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a program plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No program plan</SelectItem>
                {programPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} (Tier {plan.tier_level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used when a tier has no specific program plan assigned
            </p>
          </div>

          {/* Per-Tier Program Plan and Pricing */}
          {programTiers.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                <Label className="text-sm font-medium">Tier Configuration</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Assign program plans and set credit costs (pricing) for each tier. {formatRatioText(creditRatio)}.
              </p>

              <div className="space-y-4">
                {programTiers.map((tier, index) => {
                  const mapping = tierPlanMappings.find((m) => m.tier_name === tier);
                  return (
                    <div key={tier} className="rounded-lg border p-3 space-y-3">
                      <span className="text-sm font-medium">
                        {index + 1}. {tier}
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Program Plan</Label>
                          <Select
                            value={mapping?.program_plan_id || "none"}
                            onValueChange={(value) => handleTierPlanChange(tier, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Use default" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Use default</SelectItem>
                              {programPlans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.name} (Tier {plan.tier_level})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Credit Cost</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="e.g. 3400"
                            value={mapping?.credit_cost ?? ""}
                            onChange={(e) => handleTierCreditCostChange(tier, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {programTiers.length === 0 && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              No tiers configured for this program. Add tiers in the Settings tab to assign
              different program plans per tier.
            </p>
          )}

          {programPlans.length === 0 && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              No program plans configured yet. Create program plans in Admin → Plans & Monetization
              → Program Plans.
            </p>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Access Settings
      </Button>
    </div>
  );
}
