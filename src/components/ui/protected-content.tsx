import { type ReactNode, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ProtectedContentProps {
  children: ReactNode;
  className?: string;
  /** When false, renders children without protection (useful for admin views) */
  enabled?: boolean;
}

/**
 * Wraps content with copy-protection to prevent IP theft.
 * - Disables text selection (CSS user-select: none)
 * - Blocks copy events (Ctrl+C / Cmd+C)
 * - Blocks right-click context menu
 * - Blocks drag events (prevents drag-to-copy)
 *
 * Use this around scenario paragraph text, capability assessment questions,
 * and other proprietary content. Do NOT wrap user input areas or admin views.
 */
export function ProtectedContent({
  children,
  className,
  enabled = true,
}: ProtectedContentProps) {
  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn("select-none", className)}
      onCopy={handleCopy}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
    >
      {children}
    </div>
  );
}
