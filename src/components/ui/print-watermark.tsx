import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PrintWatermarkProps {
  /** Override the user label (for public/unauthenticated pages) */
  userLabel?: string;
}

/**
 * Renders a full-page diagonal watermark that is invisible on screen
 * but appears on every printed page. Shows "© InnoTrue · [User Name/Email] · [Date]"
 * in a repeating pattern to deter IP theft and make leaked printouts traceable.
 *
 * Uses `position: fixed` so the watermark repeats on every printed page.
 * The watermark is semi-transparent so content remains readable.
 */
export function PrintWatermark({ userLabel }: PrintWatermarkProps) {
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    if (userLabel || !user?.id) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setProfileName(data?.name || "");
      });
  }, [user?.id, userLabel]);

  const label = userLabel || profileName || user?.email || "Unknown User";
  const dateStr = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const watermarkText = `\u00A9 InnoTrue \u00B7 ${label} \u00B7 ${dateStr}`;

  // Generate a grid of watermark lines to cover the full page
  const rows = 12;

  return (
    <div
      aria-hidden="true"
      className="print-watermark"
      style={{
        display: "none",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 99999,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-25%",
          left: "-25%",
          width: "150%",
          height: "150%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-around",
          transform: "rotate(-35deg)",
          transformOrigin: "center center",
        }}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              whiteSpace: "nowrap",
              fontSize: "14px",
              fontFamily: "Arial, sans-serif",
              fontWeight: 600,
              color: "rgba(0, 0, 64, 0.08)",
              letterSpacing: "2px",
              lineHeight: "1",
              padding: "20px 0",
            }}
          >
            {/* Repeat text enough times to fill wide pages */}
            {watermarkText}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            {watermarkText}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            {watermarkText}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            {watermarkText}
          </div>
        ))}
      </div>
    </div>
  );
}
