import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LiveRegionProps {
  /** Message to announce */
  message: string;
  /** Politeness level - 'polite' waits for idle, 'assertive' interrupts immediately */
  politeness?: "polite" | "assertive";
  /** Whether the region is currently active */
  active?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Live region for announcing dynamic content changes to screen readers.
 * Use for status updates, form errors, or other dynamic content.
 *
 * @example
 * ```tsx
 * const [message, setMessage] = useState('');
 *
 * // After form submission:
 * setMessage('Form submitted successfully');
 *
 * <LiveRegion message={message} />
 * ```
 */
export function LiveRegion({
  message,
  politeness = "polite",
  active = true,
  className,
}: LiveRegionProps) {
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    if (active && message) {
      // Clear first, then set - this ensures the message is announced even if unchanged
      setAnnounced("");
      const timer = setTimeout(() => setAnnounced(message), 100);
      return () => clearTimeout(timer);
    }
  }, [message, active]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={cn("sr-only", className)}
    >
      {announced}
    </div>
  );
}

/**
 * Hook for managing live region announcements.
 *
 * @example
 * ```tsx
 * const { announce, LiveRegionComponent } = useLiveAnnouncer();
 *
 * const handleSave = () => {
 *   // ... save logic
 *   announce('Changes saved successfully');
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleSave}>Save</button>
 *     <LiveRegionComponent />
 *   </>
 * );
 * ```
 */
export function useLiveAnnouncer(defaultPoliteness: "polite" | "assertive" = "polite") {
  const [message, setMessage] = useState("");

  const announce = (newMessage: string) => {
    setMessage(newMessage);
  };

  const clear = () => {
    setMessage("");
  };

  const LiveRegionComponent = () => <LiveRegion message={message} politeness={defaultPoliteness} />;

  return {
    announce,
    clear,
    LiveRegionComponent,
  };
}
