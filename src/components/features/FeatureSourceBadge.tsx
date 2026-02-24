import { Badge } from "@/components/ui/badge";
import { useEntitlements, type AccessSource } from "@/hooks/useEntitlements";

interface FeatureSourceBadgeProps {
  featureKey: string;
  className?: string;
}

const SOURCE_LABELS: Record<AccessSource, string> = {
  subscription: "Via Plan",
  program_plan: "Via Program",
  add_on: "Via Add-on",
  track: "Via Track",
  org_sponsored: "Via Org",
};

const SOURCE_VARIANTS: Record<AccessSource, string> = {
  subscription: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  program_plan: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  add_on: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  track: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  org_sponsored: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

/**
 * Small badge component showing where a feature comes from.
 *
 * Renders a subtle, color-coded Badge like "Via Plan", "Via Program", etc.
 * Returns null if the feature is not enabled or source can't be determined.
 *
 * @example
 * ```tsx
 * <FeatureSourceBadge featureKey="ai_insights" />
 * // renders: <Badge>Via Plan</Badge>
 * ```
 */
export function FeatureSourceBadge({ featureKey, className }: FeatureSourceBadgeProps) {
  const { getAccessSource } = useEntitlements();

  const source = getAccessSource(featureKey);
  if (!source) return null;

  const label = SOURCE_LABELS[source] ?? source;
  const colorClass = SOURCE_VARIANTS[source] ?? "";

  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-normal border-0 ${colorClass} ${className ?? ""}`}
    >
      {label}
    </Badge>
  );
}
