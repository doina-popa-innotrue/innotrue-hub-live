import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Eye,
  Heart,
  Wallet,
  Users,
  Briefcase,
  GraduationCap,
  Smile,
  Sparkles,
  Home,
  Dumbbell,
} from "lucide-react";
import { WHEEL_OF_LIFE_CATEGORIES, WheelCategory } from "@/lib/wheelOfLifeCategories";

interface WheelShareConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  snapshotDate: string;
}

const categoryIcons: Record<WheelCategory, React.ComponentType<{ className?: string }>> = {
  health_fitness: Dumbbell,
  career_business: Briefcase,
  finances: Wallet,
  relationships: Heart,
  family_friends: Users,
  romance: Heart,
  personal_growth: GraduationCap,
  fun_recreation: Smile,
  physical_environment: Home,
  contribution: Sparkles,
};

export function WheelShareConsentDialog({
  open,
  onOpenChange,
  onConfirm,
  snapshotDate,
}: WheelShareConsentDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConfirm = () => {
    if (acknowledged) {
      onConfirm();
      setAcknowledged(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAcknowledged(false);
    }
    onOpenChange(newOpen);
  };

  const categories = Object.entries(WHEEL_OF_LIFE_CATEGORIES) as [WheelCategory, string][];

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Share Personal Life Assessment
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            You're about to share your Wheel of Life snapshot from <strong>{snapshotDate}</strong>{" "}
            with your assigned coach(es).
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-3 mb-3">
              <Eye className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">What your coach will see:</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your self-assessment ratings across all life domains, including any notes you've
                  added.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {categories.map(([key, label]) => {
                const Icon = categoryIcons[key] || Sparkles;
                return (
                  <div key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Privacy note:</strong> This data is personal and sensitive. Only coaches
              assigned to you can view shared snapshots. You can revoke access at any time.
            </p>
          </div>

          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="acknowledge-sharing"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <Label htmlFor="acknowledge-sharing" className="text-sm leading-relaxed cursor-pointer">
              I understand that sharing this snapshot will allow my assigned coach(es) to view my
              personal life balance assessment, including all ratings and notes.
            </Label>
          </div>
        </div>

        <AlertDialogFooter className="sm:space-x-3">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!acknowledged}
            className="bg-primary"
          >
            Share with Coach
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
