import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  Gift
} from "lucide-react";
import { useUserCredits, formatCredits, formatPriceFromCents, calculatePackageBonus } from "@/hooks/useUserCredits";
import { format } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function Credits() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // Handle return from Stripe checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const success = searchParams.get('success');
    
    if (sessionId && success === 'true') {
      confirmTopup(sessionId);
      // Clean up URL
      navigate('/credits', { replace: true });
    }
  }, [searchParams, confirmTopup, navigate]);

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

  const availableCredits = summary?.available_credits ?? 0;
  const totalAllowance = summary?.total_allowance ?? 0;
  const planCredits = summary?.plan_credit_allowance ?? 0;
  const programCredits = summary?.program_credit_allowance ?? 0;
  const expiringSoon = summary?.expiring_soon ?? 0;

  return (
    <FeatureGate featureKey="credits">
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
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/subscription")}>
          <Sparkles className="h-4 w-4 mr-2" />
          Manage Plan
        </Button>
      </div>

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
            {totalAllowance > 0 && (
              <div className="mt-2">
                <Progress 
                  value={Math.min(100, (availableCredits / totalAllowance) * 100)} 
                  className="h-2" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCredits(availableCredits)} of {formatCredits(totalAllowance)} monthly allowance
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
                <p className="text-xs text-muted-foreground mt-1">
                  No credits expiring soon
                </p>
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
            Add more credits to your account for enrollments and premium features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {packages && packages.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {packages.map((pkg) => {
                const bonus = calculatePackageBonus(pkg.price_cents, pkg.credit_value);
                return (
                  <Card 
                    key={pkg.id} 
                    className={`relative overflow-hidden ${pkg.is_featured ? 'border-primary shadow-lg' : ''}`}
                  >
                    {pkg.is_featured && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-bl">
                        Popular
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      {pkg.description && (
                        <CardDescription>{pkg.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold">
                          {formatCredits(pkg.credit_value)}
                        </div>
                        <div className="text-sm text-muted-foreground">credits</div>
                        {bonus > 0 && (
                          <Badge variant="secondary" className="mt-1">
                            <Gift className="h-3 w-3 mr-1" />
                            +{bonus}% bonus
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
                      <Button 
                        className="w-full" 
                        variant={pkg.is_featured ? "default" : "outline"}
                        onClick={() => purchaseTopup(pkg.id)}
                        disabled={isPurchasing || isConfirming}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Purchase
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
          <CardDescription>
            Your recent credit transactions
          </CardDescription>
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
                    <div className={`p-2 rounded-full ${tx.amount >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {tx.amount >= 0 ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium capitalize">
                        {tx.transaction_type.replace('_', ' ')}
                      </div>
                      {tx.description && (
                        <div className="text-sm text-muted-foreground">
                          {tx.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${tx.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatCredits(tx.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), 'MMM d, yyyy')}
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
            Credits are used to enroll in programs, book sessions, and access premium features. 
            You receive credits from your subscription plan, program enrollments, 
            or by purchasing top-up packages.
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
    </FeatureGate>
  );
}