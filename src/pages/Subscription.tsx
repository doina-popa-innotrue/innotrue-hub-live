import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Zap,
  Crown,
  Rocket,
  TrendingUp,
  Plus,
  CreditCard,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrackSelector } from "@/components/tracks/TrackSelector";
import { FeatureSourceBadge } from "@/components/features/FeatureSourceBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PlanPrice {
  id: string;
  billing_interval: string;
  price_cents: number;
  stripe_price_id: string | null;
  is_default: boolean;
}

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_free: boolean;
  tier_level: number;
  plan_prices: PlanPrice[];
}

interface PlanFeature {
  feature_id: string;
  enabled: boolean;
  limit_value: number | null;
  features: {
    key: string;
    name: string;
    description: string | null;
  };
}

interface UsageData {
  feature_key: string;
  used_count: number;
  limit: number | null;
  feature_name: string;
}

interface AddOn {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
}

interface UserAddOn {
  add_on_id: string;
  expires_at: string | null;
}

export default function Subscription() {
  const { user, userRoles } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [openingPortal, setOpeningPortal] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [selectedDowngradePlan, setSelectedDowngradePlan] = useState<Plan | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("plan_id, name")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: plans } = useQuery({
    queryKey: ["plans-with-features"],
    queryFn: async () => {
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("*, plan_prices(*)")
        .eq("is_active", true)
        .order("tier_level", { ascending: true });

      if (plansError) throw plansError;

      const plansWithFeatures = await Promise.all(
        plansData.map(async (plan) => {
          const { data: featuresData } = await supabase
            .from("plan_features")
            .select(
              `
              feature_id,
              enabled,
              limit_value,
              features!inner (
                key,
                name,
                description
              )
            `,
            )
            .eq("plan_id", plan.id)
            .eq("enabled", true);

          return {
            ...plan,
            features: featuresData || [],
          };
        }),
      );

      return plansWithFeatures as (Plan & { features: PlanFeature[]; is_purchasable?: boolean })[];
    },
  });

  // Separate purchasable and non-purchasable plans
  const purchasablePlans = plans?.filter((p) => p.is_purchasable !== false) || [];
  const allSpecialPlans = plans?.filter((p) => p.is_purchasable === false) || [];

  // Only show special plans to admins, or if the user is currently on a special plan
  const isAdmin = userRoles.includes("admin");
  const visibleSpecialPlans = useMemo(() => {
    if (isAdmin) return allSpecialPlans;
    // Non-admins only see the special plan they're currently on
    if (!profile?.plan_id) return [];
    return allSpecialPlans.filter((p) => p.id === profile.plan_id);
  }, [isAdmin, allSpecialPlans, profile?.plan_id]);

  const { data: usageData } = useQuery({
    queryKey: ["usage-tracking", user?.id],
    queryFn: async () => {
      if (!profile?.plan_id) return [];

      const { data: planFeatures } = await supabase
        .from("plan_features")
        .select(
          `
          features!inner (
            key,
            name
          ),
          limit_value
        `,
        )
        .eq("plan_id", profile.plan_id)
        .eq("enabled", true)
        .not("limit_value", "is", null);

      if (!planFeatures) return [];

      const usagePromises = planFeatures.map(async (pf) => {
        const { data } = await supabase.rpc("get_current_usage", {
          _user_id: user?.id ?? "",
          _feature_key: (pf.features as any).key,
        });

        return {
          feature_key: (pf.features as any).key,
          feature_name: (pf.features as any).name,
          used_count: data || 0,
          limit: pf.limit_value,
        };
      });

      return (await Promise.all(usagePromises)) as UsageData[];
    },
    enabled: !!user && !!profile?.plan_id,
  });

  const { data: addOns } = useQuery({
    queryKey: ["available-add-ons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("add_ons")
        .select("id, name, description, price_cents")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as AddOn[];
    },
  });

  const { data: userAddOns } = useQuery({
    queryKey: ["user-add-ons", user?.id],
    queryFn: async (): Promise<UserAddOn[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_add_ons")
        .select("add_on_id, expires_at")
        .match({ user_id: user.id, is_active: true });

      if (error) throw error;
      return (data || []) as UserAddOn[];
    },
    enabled: !!user,
  });

  const handlePlanClick = (plan: Plan) => {
    // Check if this is a downgrade
    if (currentPlan && plan.tier_level < currentPlan.tier_level) {
      setSelectedDowngradePlan(plan);
      setDowngradeDialogOpen(true);
      return;
    }

    // Otherwise proceed with checkout
    handleCheckout(plan);
  };

  const handleCheckout = async (plan: Plan) => {
    // Find the plan_prices row for the selected billing interval
    const price = plan.plan_prices.find(
      (p) => p.billing_interval === billingInterval,
    );

    if (!price) {
      toast({
        title: "Plan not available",
        description: "No pricing found for this plan and billing interval. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          planPriceId: price.id,
          mode: "subscription",
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const handleAddOnRequest = async (addOn: AddOn) => {
    setSubmitting(addOn.id);
    try {
      const { error } = await supabase.functions.invoke("send-notification-email", {
        body: {
          email: "admin@innotrue.com",
          name: "Admin",
          type: "subscription_addon_request",
          timestamp: new Date().toISOString(),
          userName: profile?.name || "Unknown",
          userEmail: user?.email,
          userId: user?.id,
          addOnName: addOn.name,
          addOnId: addOn.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Request submitted",
        description: `Your request for the ${addOn.name} add-on has been sent. We'll contact you shortly.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null || cents === 0) return "Free";
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getPlanIcon = (planKey: string) => {
    switch (planKey) {
      case "free":
        return <Zap className="h-6 w-6" />;
      case "pro":
        return <Rocket className="h-6 w-6" />;
      case "enterprise":
        return <Crown className="h-6 w-6" />;
      default:
        return <TrendingUp className="h-6 w-6" />;
    }
  };

  const getPriceForInterval = (plan: Plan, interval: string) => {
    return plan.plan_prices.find((p) => p.billing_interval === interval);
  };

  const getDefaultPrice = (plan: Plan) => {
    return plan.plan_prices.find((p) => p.is_default) || plan.plan_prices[0];
  };

  const getDisplayPrice = (plan: Plan) => {
    if (plan.is_free) return { price_cents: 0, billing_interval: null as string | null };
    const price = getPriceForInterval(plan, billingInterval) || getDefaultPrice(plan);
    return price || { price_cents: 0, billing_interval: null as string | null };
  };

  const calculateYearlySavings = (plan: Plan) => {
    const monthlyPrice = getPriceForInterval(plan, "month");
    const yearlyPrice = getPriceForInterval(plan, "year");

    if (!monthlyPrice || !yearlyPrice) return null;

    const yearlyIfMonthly = monthlyPrice.price_cents * 12;
    const savings = yearlyIfMonthly - yearlyPrice.price_cents;

    if (savings <= 0) return null;

    return Math.round((savings / yearlyIfMonthly) * 100);
  };

  const currentPlan = plans?.find((p) => p.id === profile?.plan_id);

  // Check if any plan has both monthly and yearly pricing
  const hasMultipleBillingOptions = plans?.some(
    (p) =>
      p.plan_prices.some((pr) => pr.billing_interval === "month") &&
      p.plan_prices.some((pr) => pr.billing_interval === "year"),
  );

  const handleManageBilling = async () => {
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      // Check for error in the response body (edge function returned error)
      if (data?.error) {
        const errorMessage = data.error;
        const isNoCustomer =
          errorMessage?.includes("No Stripe customer found") ||
          errorMessage?.includes("complete a purchase first");
        toast({
          title: isNoCustomer ? "No billing history yet" : "Unable to open billing portal",
          description: isNoCustomer
            ? "The billing portal will be available after your first purchase."
            : errorMessage || "Please try again later.",
          variant: isNoCustomer ? "default" : "destructive",
        });
        return;
      }

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      const isNoCustomer =
        errorMessage?.includes("No Stripe customer found") ||
        errorMessage?.includes("complete a purchase first");
      toast({
        title: isNoCustomer ? "No billing history yet" : "Unable to open billing portal",
        description: isNoCustomer
          ? "The billing portal will be available after your first purchase."
          : errorMessage || "Please try again later.",
        variant: isNoCustomer ? "default" : "destructive",
      });
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 pt-0 -mt-0">
        <h1 className="text-3xl font-bold">Subscription Plans</h1>
        <p className="text-muted-foreground">Choose the plan that best fits your needs</p>
      </div>

      {currentPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>You are currently on the {currentPlan.name} plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {getPlanIcon(currentPlan.key)}
                </div>
                <div>
                  <h3 className="font-semibold">{currentPlan.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan.is_free
                      ? "Free"
                      : formatPrice(getDefaultPrice(currentPlan)?.price_cents || 0)}
                    {!currentPlan.is_free &&
                      getDefaultPrice(currentPlan)?.billing_interval &&
                      ` / ${getDefaultPrice(currentPlan)?.billing_interval}`}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={openingPortal}
                className="w-full sm:w-auto"
              >
                {openingPortal ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                <span className="sm:inline">Manage Billing</span>
              </Button>
            </div>

            {usageData && usageData.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Usage This Month</h4>
                {usageData.map((usage) => (
                  <div key={usage.feature_key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{usage.feature_name}</span>
                      <span className="text-muted-foreground">
                        {usage.used_count} / {usage.limit}
                      </span>
                    </div>
                    <Progress
                      value={usage.limit ? (usage.used_count / usage.limit) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {userAddOns && userAddOns.length > 0 && addOns && (
        <Card>
          <CardHeader>
            <CardTitle>My Active Add-Ons</CardTitle>
            <CardDescription>Additional features you have access to</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userAddOns.map((userAddOn) => {
                const addOnDetails = addOns.find((a) => a.id === userAddOn.add_on_id);
                if (!addOnDetails) return null;

                return (
                  <div
                    key={userAddOn.add_on_id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Plus className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">{addOnDetails.name}</h4>
                        {addOnDetails.description && (
                          <p className="text-sm text-muted-foreground">
                            {addOnDetails.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="default">Active</Badge>
                      {userAddOn.expires_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Expires: {new Date(userAddOn.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {hasMultipleBillingOptions && (
        <div className="flex justify-center">
          <Tabs
            value={billingInterval}
            onValueChange={(v) => setBillingInterval(v as "month" | "year")}
          >
            <TabsList>
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year" className="relative">
                Yearly
                <Badge variant="secondary" className="ml-2 text-xs">
                  Save up to 20%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {purchasablePlans.map((plan) => {
          const isCurrent = plan.id === profile?.plan_id;
          const isUpgrade =
            profile?.plan_id &&
            purchasablePlans.findIndex((p) => p.id === profile.plan_id) <
              purchasablePlans.findIndex((p) => p.id === plan.id);

          const displayPrice = getDisplayPrice(plan);
          const yearlySavings = billingInterval === "year" ? calculateYearlySavings(plan) : null;

          return (
            <Card key={plan.id} className={isCurrent ? "border-primary shadow-lg" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {getPlanIcon(plan.key)}
                  </div>
                  {isCurrent && <Badge variant="default">Current Plan</Badge>}
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-4">
                  <span className="text-3xl font-bold">
                    {formatPrice(displayPrice?.price_cents || 0)}
                  </span>
                  {displayPrice?.billing_interval && (
                    <span className="text-muted-foreground">
                      {" "}
                      / {displayPrice.billing_interval}
                    </span>
                  )}
                  {yearlySavings && (
                    <Badge variant="secondary" className="ml-2">
                      Save {yearlySavings}%
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <TooltipProvider>
                    {plan.features.map((feature) => (
                      <li key={feature.feature_id} className="flex items-start gap-2">
                        <Check className="h-5 w-5 shrink-0 text-primary" />
                        <div className="flex-1 flex items-center gap-1">
                          <span className="text-sm">{feature.features.name}</span>
                          {feature.limit_value && (
                            <span className="text-xs text-muted-foreground">
                              (up to {feature.limit_value})
                            </span>
                          )}
                          <FeatureSourceBadge featureKey={feature.features.key} />
                          {feature.features.description && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs" side="right">
                                <RichTextDisplay content={feature.features.description} />
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </li>
                    ))}
                  </TooltipProvider>
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || submitting === plan.id || plan.is_free}
                  onClick={() => handlePlanClick(plan)}
                >
                  {isCurrent
                    ? "Current Plan"
                    : plan.is_free
                      ? "Free Plan"
                      : submitting === plan.id
                        ? "Processing..."
                        : isUpgrade
                          ? "Upgrade Now"
                          : "Subscribe"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Special Plans (Non-purchasable - visible to admins or users on a special plan) */}
      {visibleSpecialPlans.length > 0 && (
        <>
          <Separator className="my-8" />
          <div>
            <h2 className="text-xl font-semibold">Special Plans</h2>
            <p className="text-sm text-muted-foreground">
              These plans are assigned by administrators and cannot be purchased directly.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleSpecialPlans.map((plan) => {
              const isCurrent = plan.id === profile?.plan_id;

              return (
                <Card key={plan.id} className={`opacity-75 ${isCurrent ? "border-primary" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="flex gap-2">
                        {isCurrent && <Badge variant="default">Current</Badge>}
                        <Badge variant="outline">Admin-assigned</Badge>
                      </div>
                    </div>
                    <CardDescription className="text-sm">{plan.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {addOns && addOns.length > 0 && (
        <>
          <Separator className="my-8" />
          <div>
            <h2 className="text-2xl font-bold">Add-Ons</h2>
            <p className="text-muted-foreground">
              Enhance your experience with additional features
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {addOns.map((addOn) => {
              const isOwned = userAddOns?.some((ua) => ua.add_on_id === addOn.id);

              return (
                <Card key={addOn.id} className={isOwned ? "border-primary" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{addOn.name}</CardTitle>
                      {isOwned && <Badge variant="default">Active</Badge>}
                    </div>
                    <CardDescription>{addOn.description}</CardDescription>
                    {addOn.price_cents && (
                      <div className="pt-2">
                        <span className="text-2xl font-bold">{formatPrice(addOn.price_cents)}</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant={isOwned ? "outline" : "default"}
                      disabled={isOwned || submitting === addOn.id}
                      onClick={() => handleAddOnRequest(addOn)}
                    >
                      {isOwned ? (
                        "Already Active"
                      ) : submitting === addOn.id ? (
                        "Submitting..."
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Request Add-On
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Track Selection */}
      <Separator className="my-8" />
      <div>
        <h2 className="text-2xl font-bold mb-4">Experience Customization</h2>
        <TrackSelector />
      </div>

      {/* Downgrade Warning Dialog */}
      <AlertDialog open={downgradeDialogOpen} onOpenChange={setDowngradeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Downgrade Plan?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You're about to switch from <strong>{currentPlan?.name}</strong> to{" "}
                <strong>{selectedDowngradePlan?.name}</strong>.
              </p>
              <p>
                If you have an active subscription, changes will take effect at the end of your
                current billing period. You'll continue to have access to your current plan's
                features until then.
              </p>
              <p className="text-muted-foreground">
                To manage your existing subscription (cancel, change plan, or update payment), use
                the <strong>Manage Billing & Invoices</strong> button instead.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setDowngradeDialogOpen(false);
                handleManageBilling();
              }}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
