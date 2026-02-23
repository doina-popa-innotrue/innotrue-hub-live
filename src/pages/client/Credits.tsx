import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Coins,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  History,
  Gift,
  CheckCircle,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  useUserCredits,
  formatCredits,
  formatPriceFromCents,
  calculatePackageBonus,
  formatCreditsAsEur,
} from "@/hooks/useUserCredits";
import { useProgramEnrollment } from "@/hooks/useProgramEnrollment";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";

interface PendingEnrollmentData {
  programId: string;
  tierName: string;
  creditCost: number;
  discountCode?: string;
  partnerCode?: string;
  returnUrl?: string;
}

/** Threshold in cents above which packages are "large" and hidden by default */
const LARGE_PACKAGE_THRESHOLD_CENTS = 150000; // EUR 1,500

interface InstallmentOption {
  months: number;
  label: string;
}

export default function Credits() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    summary,
    packages,
    transactions,
    isLoading,
    transactionsLoading,
    purchaseTopup,
    isPurchasing,
    confirmTopup,
    isConfirming,
  } = useUserCredits();

  const { resumePendingEnrollment, isEnrolling, checkPendingEnrollment } =
    useProgramEnrollment();

  const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollmentData | null>(null);
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [autoEnrolling, setAutoEnrolling] = useState(false);
  const [installmentOptions, setInstallmentOptions] = useState<InstallmentOption[]>([]);
  const [upfrontDiscountPercent, setUpfrontDiscountPercent] = useState(0);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>("full"); // "full" or "installment-3" etc.
  const [isCreatingInstallment, setIsCreatingInstallment] = useState(false);

  // Fetch installment options for the pending enrollment's program
  useEffect(() => {
    async function fetchInstallmentOptions() {
      if (!pendingEnrollment?.programId) return;
      const { data } = await supabase
        .from("programs")
        .select("installment_options, upfront_discount_percent")
        .eq("id", pendingEnrollment.programId)
        .single();
      if (data?.installment_options && Array.isArray(data.installment_options)) {
        setInstallmentOptions(data.installment_options as InstallmentOption[]);
      }
      setUpfrontDiscountPercent(data?.upfront_discount_percent ?? 0);
    }
    fetchInstallmentOptions();
  }, [pendingEnrollment?.programId]);

  // Purchase with installment plan
  const purchaseWithInstallments = useCallback(
    async (packageId: string, months: number) => {
      if (!user) return;
      setIsCreatingInstallment(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "create-installment-checkout",
          { body: { packageId, installmentMonths: months } },
        );
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        if (data.url) {
          window.open(data.url, "_blank");
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to create installment checkout";
        toast.error(msg);
      } finally {
        setIsCreatingInstallment(false);
      }
    },
    [user],
  );

  // Read pending enrollment from sessionStorage
  useEffect(() => {
    try {
      const pendingStr = sessionStorage.getItem("pendingEnrollment");
      if (pendingStr) {
        const data = JSON.parse(pendingStr) as PendingEnrollmentData;
        setPendingEnrollment(data);
        // If there's a pending enrollment needing large packages, auto-show them
        if (data.creditCost > 0) {
          const availableCredits = summary?.available_credits ?? 0;
          const shortfall = Math.max(0, data.creditCost - availableCredits);
          // Show all packages if shortfall requires a large package
          if (shortfall > 0) {
            const needsLargePackage = !packages?.some(
              (pkg) =>
                pkg.credit_value >= shortfall &&
                pkg.price_cents < LARGE_PACKAGE_THRESHOLD_CENTS,
            );
            if (needsLargePackage) {
              setShowAllPackages(true);
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [summary?.available_credits, packages]);

  // Handle return from Stripe checkout — confirm purchase then auto-enroll
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const success = searchParams.get("success");

    if (sessionId && success === "true") {
      confirmTopup(sessionId);
      // Clean up URL params but keep state
      navigate("/credits", { replace: true });
    }
  }, [searchParams, confirmTopup, navigate]);

  // After credit confirmation succeeds, attempt auto-enrollment
  const handleAutoEnroll = useCallback(async () => {
    if (autoEnrolling || isEnrolling) return;

    const pending = await checkPendingEnrollment();
    if (!pending.hasPending) return;

    setAutoEnrolling(true);
    try {
      const result = await resumePendingEnrollment();
      if (result.success) {
        setPendingEnrollment(null);
        toast.success("Enrolled successfully!", {
          description: `${formatCredits(result.creditsConsumed ?? 0)} credits used.`,
        });
        // Navigate to the program
        const returnUrl = pendingEnrollment?.returnUrl || "/my-programs";
        navigate(returnUrl, { replace: true });
      } else if (result.insufficientCredits) {
        toast.info("You still need more credits to enroll.", {
          description: `${formatCredits(result.requiredCredits ?? 0)} credits required, ${formatCredits(result.availableCredits ?? 0)} available.`,
        });
      }
    } catch (error) {
      console.error("Auto-enrollment failed:", error);
    } finally {
      setAutoEnrolling(false);
    }
  }, [
    autoEnrolling,
    isEnrolling,
    checkPendingEnrollment,
    resumePendingEnrollment,
    pendingEnrollment,
    navigate,
  ]);

  // Compute shortfall & recommended package
  const availableCredits = summary?.available_credits ?? 0;
  const shortfall = pendingEnrollment
    ? Math.max(0, pendingEnrollment.creditCost - availableCredits)
    : 0;

  const { visiblePackages, recommendedPackageId } = useMemo(() => {
    if (!packages || packages.length === 0)
      return { visiblePackages: [], recommendedPackageId: null };

    // Sort by display_order (already sorted by DB query, but ensure)
    const sorted = [...packages].sort((a, b) => a.display_order - b.display_order);

    // Find recommended: smallest package that covers the shortfall
    let recId: string | null = null;
    if (shortfall > 0) {
      const adequate = sorted.filter((pkg) => pkg.credit_value >= shortfall);
      if (adequate.length > 0) {
        recId = adequate[0].id;
      }
    }

    // Contextual display: hide large packages unless:
    // 1. User explicitly expanded them
    // 2. A pending enrollment needs them (auto-expanded in useEffect)
    // 3. The recommended package is a large one
    const visible = showAllPackages
      ? sorted
      : sorted.filter(
          (pkg) =>
            pkg.price_cents < LARGE_PACKAGE_THRESHOLD_CENTS || pkg.id === recId,
        );

    return { visiblePackages: visible, recommendedPackageId: recId };
  }, [packages, shortfall, showAllPackages]);

  // Count hidden large packages
  const hiddenCount = useMemo(() => {
    if (!packages) return 0;
    const totalCount = packages.length;
    return totalCount - visiblePackages.length;
  }, [packages, visiblePackages]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalAllowance = summary?.total_allowance ?? 0;
  const planCredits = summary?.plan_credit_allowance ?? 0;
  const programCredits = summary?.program_credit_allowance ?? 0;
  const expiringSoon = summary?.expiring_soon ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-8 w-8 text-primary" />
            My Credits
          </h1>
          <p className="text-muted-foreground">
            Manage your credits and purchase top-ups
            <span className="ml-2 text-xs">(2 credits = EUR 1)</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/subscription")}>
          <Sparkles className="h-4 w-4 mr-2" />
          Manage Plan
        </Button>
      </div>

      {/* Pending Enrollment Banner */}
      {pendingEnrollment && shortfall > 0 && (
        <Alert className="border-primary/50 bg-primary/5">
          <ShoppingCart className="h-4 w-4" />
          <AlertTitle className="font-semibold">
            Top up to complete your enrollment
          </AlertTitle>
          <AlertDescription className="mt-1">
            <p>
              You need{" "}
              <strong>{formatCredits(pendingEnrollment.creditCost)} credits</strong>{" "}
              ({formatCreditsAsEur(pendingEnrollment.creditCost)}) to enroll.
              You currently have{" "}
              <strong>{formatCredits(availableCredits)}</strong> — you need{" "}
              <strong>{formatCredits(shortfall)} more credits</strong>{" "}
              ({formatCreditsAsEur(shortfall)}).
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              After purchasing, your enrollment will complete automatically.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Auto-enroll: if user has enough credits now and has a pending enrollment */}
      {pendingEnrollment && shortfall <= 0 && (
        <Alert className="border-success/50 bg-success/5">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertTitle className="font-semibold text-success">
            You have enough credits!
          </AlertTitle>
          <AlertDescription className="mt-1 flex items-center justify-between">
            <p>
              You have {formatCredits(availableCredits)} credits available —
              enough for the {formatCredits(pendingEnrollment.creditCost)} credit
              enrollment.
            </p>
            <Button
              size="sm"
              onClick={handleAutoEnroll}
              disabled={autoEnrolling || isEnrolling}
            >
              {autoEnrolling || isEnrolling ? "Enrolling..." : "Complete Enrollment"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Credit Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Available Credits */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Available Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {formatCredits(availableCredits)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatCreditsAsEur(availableCredits)} equivalent
            </div>
            {totalAllowance > 0 && (
              <div className="mt-2">
                <Progress
                  value={Math.min(100, (availableCredits / totalAllowance) * 100)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCredits(availableCredits)} of {formatCredits(totalAllowance)} monthly
                  allowance
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Credit Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary?.has_credit_plan && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Plan ({summary.plan_name})</span>
                <Badge variant="outline">{formatCredits(planCredits)}</Badge>
              </div>
            )}
            {programCredits > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Program Enrollments</span>
                <Badge variant="outline">{formatCredits(programCredits)}</Badge>
              </div>
            )}
            {(summary?.total_received ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Purchased Credits</span>
                <Badge variant="secondary">{formatCredits(summary?.total_received ?? 0)}</Badge>
              </div>
            )}
            {!summary?.has_credit_plan && programCredits === 0 && (
              <p className="text-sm text-muted-foreground">
                Upgrade your plan to get monthly credits
              </p>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card className={expiringSoon > 0 ? "border-warning/50 bg-warning/5" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringSoon > 0 ? (
              <>
                <div className="text-2xl font-bold text-warning flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {formatCredits(expiringSoon)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Credits expiring in the next 30 days
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">None</div>
                <p className="text-xs text-muted-foreground mt-1">No credits expiring soon</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top-up Packages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Purchase Credit Top-ups
          </CardTitle>
          <CardDescription>
            Add more credits to your account for enrollments and premium features.
            All packages use a{" "}
            <span className="font-medium">2 credits = EUR 1</span> ratio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {visiblePackages.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visiblePackages.map((pkg) => {
                  const bonus = calculatePackageBonus(pkg.price_cents, pkg.credit_value);
                  const isRecommended = pkg.id === recommendedPackageId;
                  const coversEnrollment =
                    pendingEnrollment && pkg.credit_value + availableCredits >= pendingEnrollment.creditCost;

                  return (
                    <Card
                      key={pkg.id}
                      className={`relative overflow-hidden transition-all ${
                        isRecommended
                          ? "border-primary shadow-lg ring-2 ring-primary/20"
                          : pkg.is_featured
                            ? "border-primary/50 shadow-md"
                            : ""
                      }`}
                    >
                      {isRecommended && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl font-medium">
                          Recommended
                        </div>
                      )}
                      {!isRecommended && pkg.is_featured && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-bl">
                          Popular
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                        {pkg.description && <CardDescription>{pkg.description}</CardDescription>}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold">
                            {formatCredits(pkg.credit_value)}
                          </div>
                          <div className="text-sm text-muted-foreground">credits</div>
                          {bonus > 0 && (
                            <Badge variant="secondary" className="mt-1">
                              <Gift className="h-3 w-3 mr-1" />+{bonus}% bonus
                            </Badge>
                          )}
                        </div>
                        <Separator />
                        <div className="text-center">
                          <div className="text-2xl font-semibold">
                            {formatPriceFromCents(pkg.price_cents, pkg.currency)}
                          </div>
                          {pkg.validity_months && (
                            <div className="text-xs text-muted-foreground">
                              Valid for {pkg.validity_months} months
                            </div>
                          )}
                        </div>
                        {coversEnrollment && (
                          <p className="text-xs text-center text-success font-medium">
                            <CheckCircle className="h-3 w-3 inline mr-1" />
                            Covers your enrollment
                          </p>
                        )}
                        {/* Payment options: show installments for large packages with enrollment context */}
                        {coversEnrollment && installmentOptions.length > 0 && pkg.price_cents >= LARGE_PACKAGE_THRESHOLD_CENTS ? (
                          <div className="space-y-3">
                            <RadioGroup
                              value={selectedPaymentMode}
                              onValueChange={setSelectedPaymentMode}
                              className="space-y-1"
                            >
                              <div className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50">
                                <RadioGroupItem value="full" id={`full-${pkg.id}`} />
                                <Label htmlFor={`full-${pkg.id}`} className="flex-1 cursor-pointer text-sm">
                                  Pay in full: {formatPriceFromCents(pkg.price_cents, pkg.currency)}
                                  {upfrontDiscountPercent > 0 && (
                                    <Badge variant="secondary" className="ml-2 text-xs">
                                      {upfrontDiscountPercent}% off
                                    </Badge>
                                  )}
                                </Label>
                              </div>
                              {installmentOptions.map((opt) => {
                                const perInstallment = Math.ceil(pkg.price_cents / opt.months);
                                return (
                                  <div key={opt.months} className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50">
                                    <RadioGroupItem
                                      value={`installment-${opt.months}`}
                                      id={`inst-${opt.months}-${pkg.id}`}
                                    />
                                    <Label htmlFor={`inst-${opt.months}-${pkg.id}`} className="flex-1 cursor-pointer text-sm">
                                      {opt.months}x {formatPriceFromCents(perInstallment, pkg.currency)}/mo
                                    </Label>
                                  </div>
                                );
                              })}
                            </RadioGroup>
                            <Button
                              className="w-full"
                              variant="default"
                              onClick={() => {
                                if (selectedPaymentMode === "full") {
                                  purchaseTopup(pkg.id);
                                } else {
                                  const months = parseInt(selectedPaymentMode.replace("installment-", ""), 10);
                                  purchaseWithInstallments(pkg.id, months);
                                }
                              }}
                              disabled={isPurchasing || isConfirming || isCreatingInstallment}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              {selectedPaymentMode === "full" ? "Pay & Enroll" : "Start Payment Plan"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            className="w-full"
                            variant={isRecommended ? "default" : pkg.is_featured ? "default" : "outline"}
                            onClick={() => purchaseTopup(pkg.id)}
                            disabled={isPurchasing || isConfirming}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {pendingEnrollment && coversEnrollment
                              ? "Top Up & Enroll"
                              : "Purchase"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Show/hide large packages toggle */}
              {hiddenCount > 0 && (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPackages(true)}
                    className="text-muted-foreground"
                  >
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show {hiddenCount} larger package{hiddenCount > 1 ? "s" : ""} (up to EUR
                    8,500)
                  </Button>
                </div>
              )}
              {showAllPackages && hiddenCount === 0 && packages && packages.length > visiblePackages.length && (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPackages(false)}
                    className="text-muted-foreground"
                  >
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Show fewer packages
                  </Button>
                </div>
              )}
              {showAllPackages && !pendingEnrollment && (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPackages(false)}
                    className="text-muted-foreground"
                  >
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Show fewer packages
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No top-up packages available at the moment.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>Your recent credit transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${tx.amount >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                    >
                      {tx.amount >= 0 ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium capitalize">
                        {tx.transaction_type.replace("_", " ")}
                      </div>
                      {tx.description && (
                        <div className="text-sm text-muted-foreground">{tx.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold ${tx.amount >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {formatCredits(tx.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No transactions yet. Purchase credits to get started!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            About Credits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Credits are the platform currency for enrollments, sessions, and premium features.
            <strong> 2 credits = EUR 1</strong> — easy to convert mentally.
            You receive credits from your subscription plan, program enrollments, or by purchasing
            top-up packages.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-foreground mb-2">How to get credits:</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Subscribe to a plan with credit allowance</li>
                <li>Enroll in programs with credit bonuses</li>
                <li>Purchase top-up packages above</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">How credits are used:</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Enrolling in programs with credit costs</li>
                <li>Booking coaching sessions and workshops</li>
                <li>Review board mocks and assessments</li>
                <li>AI-powered insights and recommendations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
