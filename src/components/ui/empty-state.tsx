import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** CTA button label */
  actionLabel?: string;
  /** Navigate to this path when CTA is clicked */
  actionHref?: string;
  /** Or provide a custom onClick handler */
  onAction?: () => void;
  /**
   * Layout variant:
   * - "card" — wrapped in a Card (default, for standalone sections)
   * - "inline" — bare div (for use inside existing Cards)
   */
  variant?: "card" | "inline";
}

/**
 * Standardized empty state for any page/section.
 * Shows an icon, title, optional description, and optional CTA.
 *
 * @example
 * // Standalone section
 * <EmptyState
 *   icon={BookOpen}
 *   title="No active programs yet"
 *   description="Browse available programs to get started"
 *   actionLabel="Explore Programs"
 *   actionHref="/programs/explore"
 * />
 *
 * // Inside an existing Card
 * <EmptyState
 *   variant="inline"
 *   icon={Calendar}
 *   title="No upcoming sessions"
 * />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  variant = "card",
}: EmptyStateProps) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionHref) {
      navigate(actionHref);
    }
  };

  const content = (
    <div className="flex flex-col items-center justify-center text-center py-8">
      <Icon className="h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      )}
      {actionLabel && (actionHref || onAction) && (
        <Button variant="outline" size="sm" className="mt-3" onClick={handleAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );

  if (variant === "inline") {
    return content;
  }

  return (
    <Card>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}
