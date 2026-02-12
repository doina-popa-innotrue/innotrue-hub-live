import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

interface ContinuationBannerProps {
  className?: string;
}

export function ContinuationBanner({ className }: ContinuationBannerProps) {
  const navigate = useNavigate();

  return (
    <Alert className={className}>
      <Sparkles className="h-4 w-4" />
      <AlertTitle>Ready to continue growing?</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm">
          You've completed your program! Upgrade to <strong>Pro</strong> for unlimited access to all
          programs, community features, and personalized development tools.
        </span>
        <Button size="sm" onClick={() => navigate("/subscription")} className="shrink-0">
          Explore Pro
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
