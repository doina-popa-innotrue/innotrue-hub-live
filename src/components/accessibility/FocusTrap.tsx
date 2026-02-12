import { useEffect, useRef, ReactNode } from "react";

interface FocusTrapProps {
  /** Content to trap focus within */
  children: ReactNode;
  /** Whether the trap is active */
  active?: boolean;
  /** Restore focus to previously focused element on deactivation */
  restoreFocus?: boolean;
  /** Element to focus initially (selector or 'first'/'last') */
  initialFocus?: string | "first" | "last";
}

const FOCUSABLE_ELEMENTS = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Focus trap component for modal dialogs and overlays.
 * Traps keyboard focus within the container while active.
 *
 * @example
 * ```tsx
 * <FocusTrap active={isModalOpen} restoreFocus>
 *   <div role="dialog" aria-modal="true">
 *     <button>Close</button>
 *     <input placeholder="Email" />
 *   </div>
 * </FocusTrap>
 * ```
 */
export function FocusTrap({
  children,
  active = true,
  restoreFocus = true,
  initialFocus = "first",
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    // Store previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Get focusable elements
    const getFocusableElements = () => {
      if (!containerRef.current) return [];
      return Array.from(containerRef.current.querySelectorAll(FOCUSABLE_ELEMENTS)) as HTMLElement[];
    };

    // Set initial focus
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      if (initialFocus === "first") {
        focusableElements[0].focus();
      } else if (initialFocus === "last") {
        focusableElements[focusableElements.length - 1].focus();
      } else {
        const target = containerRef.current?.querySelector(initialFocus) as HTMLElement;
        if (target) {
          target.focus();
        } else {
          focusableElements[0].focus();
        }
      }
    }

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      // Restore focus
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, initialFocus, restoreFocus]);

  return <div ref={containerRef}>{children}</div>;
}
