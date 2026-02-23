import { Lock, Crown, AlertCircle, Gem, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useSupportEmail } from "@/hooks/useSupportEmail";

interface PlanLockOverlayProps {
  reason:
    | "plan_required"
    | "payment_outstanding"
    | "separate_purchase_required"
    | "enrollment_paused";
  requiredPlanName: string;
  userPlanName?: string;
  className?: string;
}

export function PlanLockOverlay({
  reason,
  requiredPlanName,
  userPlanName,
  className = "",
}: PlanLockOverlayProps) {
  const navigate = useNavigate();
  const supportEmail = useSupportEmail();

  if (reason === "separate_purchase_required") {
    return (
      <Card
        className={`border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 ${className}`}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-4 mb-4">
            <Gem className="h-10 w-10 text-amber-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Premium Program</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            This is a premium program that requires a separate purchase. Contact us to learn more
            about pricing and enrollment options.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <a href={`mailto:${supportEmail}?subject=Premium Program Inquiry`}>
                <Mail className="mr-2 h-4 w-4" />
                Contact Us
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-amber-500/30 bg-amber-500/5 ${className}`}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {reason === "enrollment_paused" ? (
          <>
            <div className="rounded-full bg-orange-500/10 p-4 mb-4">
              <AlertCircle className="h-10 w-10 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Access Paused</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Your access to this program has been temporarily paused by an administrator. Please
              contact support if you have questions.
            </p>
            <Button asChild variant="outline">
              <a href={`mailto:${supportEmail}?subject=Program Access Paused`}>
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </a>
            </Button>
          </>
        ) : reason === "payment_outstanding" ? (
          <>
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Payment Required</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Your access is paused due to an outstanding payment. Please update your payment method
              or contact support to restore access.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/subscription")}>Manage Billing</Button>
              <Button variant="outline" asChild>
                <a href={`mailto:${supportEmail}?subject=Payment Issue - Program Access`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Support
                </a>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-full bg-amber-500/10 p-4 mb-4">
              <Crown className="h-10 w-10 text-amber-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{requiredPlanName} Plan Required</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {userPlanName
                ? `You're currently on the ${userPlanName} plan. Upgrade to ${requiredPlanName} to unlock this content.`
                : `Upgrade to the ${requiredPlanName} plan to unlock this content.`}
            </p>
            <Button onClick={() => navigate("/subscription")}>
              <Crown className="mr-2 h-4 w-4" />
              View Plans
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
