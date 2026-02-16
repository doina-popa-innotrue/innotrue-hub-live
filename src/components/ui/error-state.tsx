import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Detailed description of what went wrong */
  description?: string;
  /** Retry callback — shows "Try Again" button when provided */
  onRetry?: () => void;
  /**
   * Layout variant:
   * - "card" — error inside a Card (default, for page/section errors)
   * - "inline" — compact inline error (for within-card errors)
   */
  variant?: "card" | "inline";
}

/**
 * Standardized error state for pages and sections.
 * Use this instead of inline error text or toast-only error handling.
 *
 * @example
 * // Full page error with retry
 * if (error) return <ErrorState description="Failed to load goals." onRetry={refetch} />;
 *
 * // Inline error in a section
 * if (error) return <ErrorState variant="inline" description="Could not load data." />;
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  variant = "card",
}: ErrorStateProps) {
  const content = (
    <div className="flex flex-col items-center text-center gap-3">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );

  if (variant === "inline") {
    return <div className="py-8">{content}</div>;
  }

  return (
    <Card>
      <CardContent className="py-12">{content}</CardContent>
    </Card>
  );
}
