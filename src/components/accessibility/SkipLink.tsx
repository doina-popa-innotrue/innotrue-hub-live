import { cn } from "@/lib/utils";

interface SkipLinkProps {
  /** Target element ID to skip to */
  targetId: string;
  /** Link text */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Skip link for keyboard navigation accessibility.
 * Allows users to skip to main content or other sections.
 *
 * @example
 * ```tsx
 * // In your layout:
 * <SkipLink targetId="main-content">Skip to main content</SkipLink>
 * <header>...</header>
 * <main id="main-content">...</main>
 * ```
 */
export function SkipLink({
  targetId,
  children = "Skip to main content",
  className,
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100]",
        "bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "transition-opacity",
        className,
      )}
    >
      {children}
    </a>
  );
}
