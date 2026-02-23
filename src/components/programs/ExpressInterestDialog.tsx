import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  Crown,
  Sparkles,
  Star,
  CheckCircle,
  Percent,
  Tag,
  Loader2,
  XCircle,
  Mail,
  HelpCircle,
} from "lucide-react";
import { getTierDisplayName } from "@/lib/tierUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSupportEmail } from "@/hooks/useSupportEmail";
import { formatCredits, formatCreditsAsEur } from "@/hooks/useUserCredits";
interface ScheduledDate {
  id: string;
  date: string;
  title: string;
  capacity?: number;
  enrolled_count?: number;
}

interface CrossProgramModule {
  moduleId: string;
  moduleTitle: string;
  completedInProgram: string;
  completedAt: string | null;
  completionSource: "internal" | "talentlms";
}

interface DiscountResult {
  discountId: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  originalCost: number;
  discountedCost: number;
  discountAmount: number;
}

interface ExpressInterestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId?: string;
  programName: string;
  scheduledDates?: ScheduledDate[];
  availableTiers?: string[];
  onSubmit: (
    timeframe: string,
    preferredTier?: string,
    crossCompletions?: CrossProgramModule[],
    suggestedDiscount?: number,
    discountCode?: string,
  ) => void;
  isSubmitting?: boolean;
  onJoinWaitlist?: (scheduleId: string) => void;
  crossCompletions?: {
    totalModules: number;
    completedElsewhere: CrossProgramModule[];
    suggestedDiscountPercent: number;
  };
  // Discount code props
  tierCreditCost?: number | null;
  /** Map of tier name → credit cost for dynamic lookup (preferred over scalar tierCreditCost) */
  tierCreditCosts?: Record<string, number | null>;
  onValidateDiscount?: (
    code: string,
    programId: string,
    tier: string,
    cost: number,
  ) => Promise<DiscountResult | null>;
  isValidatingDiscount?: boolean;
  validatedDiscount?: DiscountResult | null;
  discountValidationError?: string | null;
  onClearDiscount?: () => void;
}

export function ExpressInterestDialog({
  open,
  onOpenChange,
  programId,
  programName,
  scheduledDates = [],
  availableTiers = [],
  onSubmit,
  isSubmitting = false,
  crossCompletions,
  tierCreditCost,
  tierCreditCosts,
  onValidateDiscount,
  isValidatingDiscount,
  validatedDiscount,
  discountValidationError,
  onClearDiscount,
}: ExpressInterestDialogProps) {
  const hasScheduledDates = scheduledDates.length > 0;
  const hasTiers = availableTiers.length > 0;
  const [selection, setSelection] = useState<string>(
    hasScheduledDates ? scheduledDates[0].id : "asap",
  );
  const [selectedTier, setSelectedTier] = useState<string>(hasTiers ? availableTiers[0] : "");
  const [discountCode, setDiscountCode] = useState("");
  const [hasAttemptedValidation, setHasAttemptedValidation] = useState(false);
  const { supportEmail } = useSupportEmail();
  // Reset discount when tier changes
  useEffect(() => {
    if (onClearDiscount) {
      onClearDiscount();
      setHasAttemptedValidation(false);
    }
  }, [selectedTier, onClearDiscount]);

  // Resolve credit cost for the currently selected tier
  const resolvedTierCost =
    tierCreditCosts && selectedTier
      ? (tierCreditCosts[selectedTier] ?? tierCreditCost)
      : tierCreditCost;

  const handleValidateDiscount = async () => {
    if (!onValidateDiscount || !programId || !resolvedTierCost || resolvedTierCost <= 0) return;
    setHasAttemptedValidation(true);
    await onValidateDiscount(discountCode, programId, selectedTier, resolvedTierCost);
  };

  const handleSubmit = () => {
    onSubmit(
      selection,
      hasTiers ? selectedTier : undefined,
      crossCompletions?.completedElsewhere,
      crossCompletions?.suggestedDiscountPercent,
      validatedDiscount ? discountCode : undefined,
    );
  };

  const getTierIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "premium":
      case "enterprise":
        return <Crown className="h-4 w-4 text-amber-500" />;
      case "professional":
        return <Sparkles className="h-4 w-4 text-blue-500" />;
      default:
        return <Star className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTierDescription = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "essentials":
        return "Core program content and group sessions";
      case "professional":
        return "Additional modules and personalized coaching";
      case "premium":
        return "Full access, 1-on-1 coaching, and priority support";
      case "enterprise":
        return "Custom features, dedicated support, and team access";
      default:
        return "Program access at this tier level";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Express Interest in {programName}</DialogTitle>
          <DialogDescription>
            Let us know when you'd like to start this program. An administrator will contact you to
            discuss enrollment options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cross-Completion Notice */}
          {crossCompletions && crossCompletions.completedElsewhere.length > 0 && (
            <Alert className="border-green-500/30 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-600 dark:text-green-300">
                <p className="font-medium mb-1">
                  {crossCompletions.completedElsewhere.length} of {crossCompletions.totalModules}{" "}
                  modules already completed
                </p>
                {crossCompletions.suggestedDiscountPercent > 0 && (
                  <p className="text-sm flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    Eligible for up to {crossCompletions.suggestedDiscountPercent}% discount
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Tier Selection */}
          {hasTiers && (
            <div className="space-y-3">
              <Label>Select your preferred tier:</Label>
              <RadioGroup value={selectedTier} onValueChange={setSelectedTier}>
                {availableTiers.map((tier) => (
                  <div
                    key={tier}
                    className="flex items-center space-x-3 rounded-lg border p-3 hover:border-primary/50 transition-colors"
                  >
                    <RadioGroupItem value={tier} id={`tier-${tier}`} />
                    <Label htmlFor={`tier-${tier}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getTierIcon(tier)}
                          <div>
                            <div className="font-medium">
                              {getTierDisplayName(availableTiers, tier)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getTierDescription(tier)}
                            </div>
                          </div>
                        </div>
                        {tierCreditCosts?.[tier] != null && tierCreditCosts[tier]! > 0 && (
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold">
                              {formatCredits(tierCreditCosts[tier]!)} credits
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCreditsAsEur(tierCreditCosts[tier]!)}
                            </div>
                          </div>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Discount Code Input */}
          {resolvedTierCost && resolvedTierCost > 0 && onValidateDiscount && (
            <div className="space-y-3">
              <Label>Have a discount code?</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="pl-9"
                    disabled={isValidatingDiscount}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidateDiscount}
                  disabled={!discountCode.trim() || isValidatingDiscount}
                >
                  {isValidatingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>

              {/* Discount validation result */}
              {hasAttemptedValidation && !isValidatingDiscount && (
                <>
                  {validatedDiscount && (
                    <Alert className="border-green-500/30 bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-green-600 dark:text-green-300">
                        <p className="font-medium">
                          {validatedDiscount.discountType === "percentage"
                            ? `${validatedDiscount.discountValue}% off`
                            : `${validatedDiscount.discountAmount} credits off`}
                        </p>
                        <p className="text-sm">
                          <span className="line-through text-muted-foreground">
                            {validatedDiscount.originalCost} credits
                          </span>
                          {" → "}
                          <span className="font-bold">
                            {validatedDiscount.discountedCost} credits
                          </span>
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}
                  {discountValidationError && (
                    <Alert
                      variant="destructive"
                      className="border-destructive/30 bg-destructive/10"
                    >
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{discountValidationError}</AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}
          <div className="space-y-3">
            <Label>
              {hasScheduledDates
                ? "Select a scheduled class date:"
                : "When would you like to enroll?"}
            </Label>
            <RadioGroup value={selection} onValueChange={setSelection}>
              {hasScheduledDates ? (
                scheduledDates.map((schedule) => {
                  const isFull = !!(
                    schedule.capacity &&
                    schedule.enrolled_count !== undefined &&
                    schedule.enrolled_count >= schedule.capacity
                  );
                  const hasCapacity = schedule.capacity && schedule.capacity > 0;

                  return (
                    <div
                      key={schedule.id}
                      className={`flex items-center space-x-3 rounded-lg border p-3 transition-colors ${
                        isFull ? "opacity-60 cursor-not-allowed" : "hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value={schedule.id} id={schedule.id} disabled={isFull} />
                      <Label
                        htmlFor={schedule.id}
                        className={`flex-1 ${isFull ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {schedule.title || "Scheduled Class"}
                                {isFull && (
                                  <Badge variant="destructive" className="text-xs">
                                    Full
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(schedule.date).toLocaleDateString("en-US", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </div>
                            </div>
                          </div>
                          {hasCapacity && (
                            <div className="text-xs text-muted-foreground">
                              {schedule.enrolled_count || 0} / {schedule.capacity} enrolled
                            </div>
                          )}
                        </div>
                      </Label>
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="flex items-center space-x-3 rounded-lg border p-3 hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="asap" id="asap" />
                    <Label htmlFor="asap" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">As Soon As Possible</div>
                          <div className="text-xs text-muted-foreground">
                            I'm ready to start right away
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 rounded-lg border p-3 hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="1-3_months" id="1-3_months" />
                    <Label htmlFor="1-3_months" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">1-3 Months</div>
                          <div className="text-xs text-muted-foreground">
                            I'd like to start in the near future
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </>
              )}
            </RadioGroup>
          </div>
        </div>

        {/* Contact Us Notice */}
        <Alert className="border-muted bg-muted/30">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-muted-foreground">
            <p className="text-sm">
              Need a payment plan or have questions?{" "}
              <a
                href={`mailto:${supportEmail}?subject=Program Inquiry: ${programName}`}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <Mail className="h-3 w-3" />
                Contact us
              </a>
            </p>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Interest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
