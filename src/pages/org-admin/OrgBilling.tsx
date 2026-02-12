import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOrgCredits, formatCredits, formatPrice, calculateBonus } from "@/hooks/useOrgCredits";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Coins,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Crown,
  Users,
} from "lucide-react";
import { format } from "date-fns";

export default function OrgBilling() {
  const { organizationMembership } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<"annual" | "monthly">(
    "annual",
  );

  // Sponsored seat usage state
  const [seatUsage, setSeatUsage] = useState<{ used: number; max: number | null }>({
    used: 0,
    max: null,
  });
  const [seatLoading, setSeatLoading] = useState(true);

  const {
    summary,
    packages,
    tiers,
    transactions,
    isLoading,
    transactionsLoading,
    purchaseCredits,
    isPurchasing,
    subscribePlatform,
    isSubscribing,
    confirmPurchase,
    isConfirming,
    refetch,
  } = useOrgCredits(organizationMembership?.organization_id);

  // Load seat usage
  useEffect(() => {
    const loadSeatUsage = async () => {
      if (!organizationMembership?.organization_id) return;

      setSeatLoading(true);
      try {
        const { data: usedData } = await supabase.rpc("get_org_sponsored_seat_count", {
          p_organization_id: organizationMembership.organization_id,
        });

        const { data: maxData } = await supabase.rpc("get_org_max_sponsored_seats", {
          p_organization_id: organizationMembership.organization_id,
        });

        setSeatUsage({
          used: usedData || 0,
          max: maxData === null ? null : maxData || 0,
        });
      } catch (error) {
        console.error("Error loading seat usage:", error);
      } finally {
        setSeatLoading(false);
      }
    };

    loadSeatUsage();
  }, [organizationMembership?.organization_id]);

  // Handle return from Stripe
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    const subscription = searchParams.get("subscription");

    if (success === "true" && sessionId) {
      confirmPurchase(sessionId);
      // Clear params after processing
      setSearchParams({});
    } else if (subscription === "success") {
      toast({
        title: "Subscription Activated!",
        description: "Your organization subscription is now active.",
      });
      refetch();
      setSearchParams({});
    } else if (searchParams.get("canceled") === "true" || subscription === "canceled") {
      toast({
        title: "Purchase Cancelled",
        description: "Your purchase was cancelled.",
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, confirmPurchase, refetch, setSearchParams, toast]);

  if (!organizationMembership) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  // Only org_admin can manage billing
  const canManageBilling = organizationMembership.role === "org_admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing & Credits</h1>
        <p className="text-muted-foreground">Manage your organization's subscription and credits</p>
      </div>

      {/* Current Balance */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-primary">
                {formatCredits(summary?.available_credits ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Ready to use for enrollments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Subscription Status</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : summary?.has_platform_subscription ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-success/15 text-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            ) : (
              <Badge variant="secondary">No Subscription</Badge>
            )}
            {summary?.subscription_ends && (
              <p className="text-xs text-muted-foreground mt-1">
                Renews {format(new Date(summary.subscription_ends), "MMM d, yyyy")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sponsored Seats</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {seatLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {seatUsage.used}
                  <span className="text-base font-normal text-muted-foreground">
                    {" / "}
                    {seatUsage.max === null ? "∞" : seatUsage.max}
                  </span>
                </div>
                {seatUsage.max !== null && seatUsage.max > 0 && (
                  <Progress value={(seatUsage.used / seatUsage.max) * 100} className="h-1.5 mt-2" />
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground mt-1">Members with org-sponsored access</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCredits(summary?.expiring_soon ?? 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Credits expiring within 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Warning for seat limits */}
      {!seatLoading && seatUsage.max !== null && seatUsage.max > 0 && (
        <>
          {seatUsage.used >= seatUsage.max && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Sponsored Seat Limit Reached</AlertTitle>
              <AlertDescription>
                You've used all {seatUsage.max} sponsored seats included in your plan. Upgrade your
                plan to add more members with org-sponsored access.
              </AlertDescription>
            </Alert>
          )}
          {seatUsage.used >= seatUsage.max * 0.8 && seatUsage.used < seatUsage.max && (
            <Alert variant="default" className="border-warning/50 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">Approaching Seat Limit</AlertTitle>
              <AlertDescription>
                You're using {seatUsage.used} of {seatUsage.max} sponsored seats (
                {Math.round((seatUsage.used / seatUsage.max) * 100)}%). Consider upgrading your plan
                to add more members.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Warning for expiring credits */}
      {summary && summary.expiring_soon > 0 && (
        <Alert variant="default" className="border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Credits Expiring Soon</AlertTitle>
          <AlertDescription>
            You have {formatCredits(summary.expiring_soon)} credits that will expire within 30 days.
            Use them before they expire!
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="credits">
        <TabsList>
          <TabsTrigger value="credits">Credit Packages</TabsTrigger>
          <TabsTrigger value="subscription">Subscription Plans</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        {/* Credit Packages */}
        <TabsContent value="credits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Purchase Credits
              </CardTitle>
              <CardDescription>Top up your organization's credit balance</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48" />
                  ))}
                </div>
              ) : packages && packages.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {packages.map((pkg) => {
                    const bonus = calculateBonus(pkg.price_cents, pkg.credit_value);
                    return (
                      <Card key={pkg.id} className="relative">
                        {bonus > 0 && (
                          <Badge className="absolute -top-2 -right-2 bg-success text-success-foreground">
                            <Sparkles className="h-3 w-3 mr-1" />+{bonus}% bonus
                          </Badge>
                        )}
                        <CardHeader>
                          <CardTitle>{pkg.name}</CardTitle>
                          <CardDescription>{pkg.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-primary">
                            {formatCredits(pkg.credit_value)}
                          </div>
                          <p className="text-sm text-muted-foreground">credits</p>
                          <div className="mt-2 text-lg font-semibold">
                            {formatPrice(pkg.price_cents, pkg.currency)}
                          </div>
                          {pkg.validity_months && (
                            <p className="text-xs text-muted-foreground">
                              Valid for {pkg.validity_months} months
                            </p>
                          )}
                        </CardContent>
                        <CardFooter>
                          <Button
                            className="w-full"
                            onClick={() => purchaseCredits(pkg.id)}
                            disabled={isPurchasing || !canManageBilling}
                          >
                            {isPurchasing ? "Processing..." : "Purchase"}
                            <ArrowUpRight className="h-4 w-4 ml-2" />
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No credit packages available at this time.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Plans */}
        <TabsContent value="subscription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Platform Subscription
              </CardTitle>
              <CardDescription>Unlock premium features with a subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Billing period toggle */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <Button
                  variant={selectedBillingPeriod === "monthly" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedBillingPeriod("monthly")}
                >
                  Monthly
                </Button>
                <Button
                  variant={selectedBillingPeriod === "annual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedBillingPeriod("annual")}
                >
                  Annual
                  <Badge variant="secondary" className="ml-2">
                    Save 20%
                  </Badge>
                </Button>
              </div>

              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-64" />
                  ))}
                </div>
              ) : tiers && tiers.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {tiers.map((tier) => {
                    const price =
                      selectedBillingPeriod === "annual"
                        ? tier.annual_fee_cents
                        : (tier.monthly_fee_cents ?? tier.annual_fee_cents / 12);
                    const isCurrentTier = summary?.subscription_status === tier.slug;

                    // Check if downgrade would exceed seat limit
                    const tierMaxSeats = tier.max_sponsored_seats;
                    const wouldExceedSeats = tierMaxSeats !== null && seatUsage.used > tierMaxSeats;
                    const isDowngrade = wouldExceedSeats && !isCurrentTier;

                    return (
                      <Card key={tier.id} className={isCurrentTier ? "border-primary" : ""}>
                        {isCurrentTier && (
                          <Badge className="absolute -top-2 -right-2">Current Plan</Badge>
                        )}
                        <CardHeader>
                          <CardTitle>{tier.name}</CardTitle>
                          <CardDescription>{tier.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">
                            {formatPrice(price, tier.currency)}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{selectedBillingPeriod === "annual" ? "year" : "month"}
                            </span>
                          </div>
                          <ul className="mt-4 space-y-2">
                            {tier.features.map((feature, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                {feature}
                              </li>
                            ))}
                            {tier.max_members && (
                              <li className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                Up to {tier.max_members} members
                              </li>
                            )}
                            <li className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4 text-success" />
                              {tier.max_sponsored_seats === null
                                ? "Unlimited sponsored seats"
                                : `${tier.max_sponsored_seats} sponsored seats`}
                            </li>
                            {tier.includes_analytics && (
                              <li className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                Advanced analytics
                              </li>
                            )}
                          </ul>
                          {isDowngrade && (
                            <Alert variant="destructive" className="mt-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                You have {seatUsage.used} sponsored seats, but this plan only allows{" "}
                                {tierMaxSeats}. Remove {seatUsage.used - tierMaxSeats!} sponsored
                                seats before switching.
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                        <CardFooter>
                          <Button
                            className="w-full"
                            variant={isCurrentTier ? "outline" : "default"}
                            onClick={() => {
                              if (isDowngrade) {
                                toast({
                                  title: "Cannot Downgrade",
                                  description: `You have ${seatUsage.used} sponsored seats but this plan only allows ${tierMaxSeats}. Remove sponsored seats from members before switching.`,
                                  variant: "destructive",
                                });
                                return;
                              }
                              subscribePlatform({
                                tierId: tier.id,
                                billingPeriod: selectedBillingPeriod,
                              });
                            }}
                            disabled={isSubscribing || isCurrentTier || !canManageBilling}
                          >
                            {isCurrentTier
                              ? "Current Plan"
                              : isSubscribing
                                ? "Processing..."
                                : isDowngrade
                                  ? "Exceeds Seat Limit"
                                  : "Subscribe"}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No subscription plans available at this time.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Transaction History
              </CardTitle>
              <CardDescription>Recent credit transactions for your organization</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : transactions && transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(tx.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.amount > 0 ? "default" : "secondary"}>
                            {tx.transaction_type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{tx.description || "-"}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${tx.amount > 0 ? "text-success" : "text-destructive"}`}
                        >
                          {tx.amount > 0 ? "+" : ""}
                          {formatCredits(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCredits(tx.balance_after)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">No transactions yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!canManageBilling && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Limited Access</AlertTitle>
          <AlertDescription>
            Only organization admins can purchase credits or manage subscriptions.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
