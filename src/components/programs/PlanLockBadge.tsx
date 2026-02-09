import { Lock, Crown, PauseCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PlanLockBadgeProps {
  requiredPlanName: string;
  reason?: 'plan_required' | 'payment_outstanding' | 'separate_purchase_required' | 'enrollment_paused' | null;
  showTooltip?: boolean;
}

export function PlanLockBadge({ requiredPlanName, reason, showTooltip = true }: PlanLockBadgeProps) {
  const getBadgeContent = () => {
    if (reason === 'enrollment_paused') {
      return (
        <>
          <PauseCircle className="h-3 w-3" />
          Access Paused
        </>
      );
    }
    if (reason === 'payment_outstanding') {
      return (
        <>
          <Lock className="h-3 w-3" />
          Payment Required
        </>
      );
    }
    if (reason === 'separate_purchase_required') {
      return (
        <>
          <Crown className="h-3 w-3" />
          Premium Program
        </>
      );
    }
    return (
      <>
        <Crown className="h-3 w-3" />
        {requiredPlanName}
      </>
    );
  };

  const getTooltipText = () => {
    if (reason === 'enrollment_paused') {
      return 'Your access has been paused by an administrator';
    }
    if (reason === 'payment_outstanding') {
      return 'Complete outstanding payments to regain access';
    }
    if (reason === 'separate_purchase_required') {
      return 'This premium program requires a separate purchase. Contact us to enroll.';
    }
    return `Upgrade to ${requiredPlanName} plan to unlock`;
  };

  const badge = (
    <Badge 
      variant="secondary" 
      className={`gap-1 ${
        reason === 'enrollment_paused'
          ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
          : reason === 'separate_purchase_required' 
          ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 border-amber-500/30' 
          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      }`}
    >
      {getBadgeContent()}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          {getTooltipText()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
