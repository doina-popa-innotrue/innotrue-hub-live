import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, Crown, Sparkles } from 'lucide-react';
import { getTierDisplayName } from '@/lib/tierUtils';

interface TierUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: string;
  availableTiers: string[];
  onSubmit: (selectedTier: string, reason: string) => void;
  isSubmitting?: boolean;
}

export function TierUpgradeDialog({
  open,
  onOpenChange,
  currentTier,
  availableTiers,
  onSubmit,
  isSubmitting = false,
}: TierUpgradeDialogProps) {
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [reason, setReason] = useState('');

  // Filter to only show tiers higher than current
  const upgradeTiers = availableTiers.filter(tier => {
    const tierOrder = ['essentials', 'professional', 'premium', 'enterprise'];
    const currentIndex = tierOrder.indexOf(currentTier.toLowerCase());
    const tierIndex = tierOrder.indexOf(tier.toLowerCase());
    return tierIndex > currentIndex;
  });

  const handleSubmit = () => {
    if (selectedTier) {
      onSubmit(selectedTier, reason);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'premium':
      case 'enterprise':
        return <Crown className="h-4 w-4" />;
      case 'professional':
        return <Sparkles className="h-4 w-4" />;
      default:
        return <ArrowUp className="h-4 w-4" />;
    }
  };

  const getTierDescription = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'professional':
        return 'Access to additional modules and personalized coaching sessions';
      case 'premium':
        return 'Full access to all modules, 1-on-1 coaching, and priority support';
      case 'enterprise':
        return 'Custom enterprise features, dedicated support, and team access';
      default:
        return 'Enhanced access and features';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Tier Upgrade</DialogTitle>
          <DialogDescription>
            Select the tier you'd like to upgrade to. An administrator will review your request and contact you about upgrade options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Current tier:</span>
            <Badge variant="outline">{getTierDisplayName(availableTiers, currentTier)}</Badge>
          </div>

          {upgradeTiers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              You're already on the highest available tier for this program.
            </div>
          ) : (
            <>
              <Label>Select upgrade tier:</Label>
              <RadioGroup value={selectedTier} onValueChange={setSelectedTier}>
                {upgradeTiers.map((tier) => (
                  <div 
                    key={tier} 
                    className="flex items-center space-x-3 rounded-lg border p-4 hover:border-primary/50 transition-colors"
                  >
                    <RadioGroupItem value={tier} id={tier} />
                    <Label htmlFor={tier} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        {getTierIcon(tier)}
                        <div>
                          <div className="font-medium">{getTierDisplayName(availableTiers, tier)}</div>
                          <div className="text-sm text-muted-foreground">
                            {getTierDescription(tier)}
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for upgrade (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Tell us why you'd like to upgrade..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedTier || upgradeTiers.length === 0}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
