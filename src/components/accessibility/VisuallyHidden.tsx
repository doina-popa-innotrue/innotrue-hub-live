import { cn } from "@/lib/utils";

interface VisuallyHiddenProps {
  /** Content to hide visually but keep accessible to screen readers */
  children: React.ReactNode;
  /** Render as a different element (default: span) */
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Additional class names */
  className?: string;
}

/**
 * Visually hidden component for screen reader only content.
 * Content is hidden visually but remains accessible to assistive technologies.
 *
 * @example
 * ```tsx
 * <button>
 *   <Icon />
 *   <VisuallyHidden>Close menu</VisuallyHidden>
 * </button>
 * ```
 */
export function VisuallyHidden({
  children,
  as: Component = "span",
  className,
}: VisuallyHiddenProps) {
  return <Component className={cn("sr-only", className)}>{children}</Component>;
}
