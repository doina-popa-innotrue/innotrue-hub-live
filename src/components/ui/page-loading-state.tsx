import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PageLoadingStateProps {
  /** Optional loading message */
  message?: string;
  /**
   * Layout variant:
   * - "centered" — spinner centered in viewport (for full-page loads)
   * - "card" — spinner inside a card (for section loads, matches AdminLoadingState)
   * - "skeleton" — skeleton grid placeholder (for list/card pages)
   * - "inline" — small spinner inline (for button/section reloads)
   */
  variant?: "centered" | "card" | "skeleton" | "inline";
  /** Number of skeleton cards to show (only for variant="skeleton") */
  skeletonCount?: number;
}

/**
 * Standardized loading state for all pages. Use this instead of plain "Loading..." text.
 *
 * @example
 * // Full page load
 * if (isLoading) return <PageLoadingState message="Loading goals..." />;
 *
 * // Card-based section
 * if (isLoading) return <PageLoadingState variant="card" message="Loading data..." />;
 *
 * // Skeleton grid
 * if (isLoading) return <PageLoadingState variant="skeleton" skeletonCount={6} />;
 */
export function PageLoadingState({
  message,
  variant = "centered",
  skeletonCount = 3,
}: PageLoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {message && <span className="text-sm">{message}</span>}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          {message && <p className="text-muted-foreground mt-4">{message}</p>}
        </CardContent>
      </Card>
    );
  }

  // variant === "centered"
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {message && (
          <p className="text-muted-foreground text-sm">{message}</p>
        )}
      </div>
    </div>
  );
}
