import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000; // 2 minutes warning

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasWarnedRef = useRef(false);
  // Use refs for functions to avoid dependency issues
  const signOutRef = useRef(signOut);

  // Keep signOut ref updated
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const handleTimeout = useCallback(async () => {
    clearTimers();
    toast.error("Session expired due to inactivity");
    await signOutRef.current();
  }, [clearTimers]);

  const showWarning = useCallback(() => {
    if (!hasWarnedRef.current) {
      hasWarnedRef.current = true;
      toast.warning("Your session will expire in 2 minutes due to inactivity", {
        duration: 10000,
      });
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!user) return;

    hasWarnedRef.current = false;
    clearTimers();

    // Set warning timer
    warningRef.current = setTimeout(() => {
      showWarning();
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleTimeout();
    }, INACTIVITY_TIMEOUT);
  }, [user, clearTimers, showWarning, handleTimeout]);

  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];

    // Throttle the reset to avoid excessive timer resets
    let lastResetTime = 0;
    const THROTTLE_MS = 1000; // Only reset once per second max

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastResetTime > THROTTLE_MS) {
        lastResetTime = now;
        resetTimer();
      }
    };

    // Initial timer setup
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearTimers();
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, resetTimer, clearTimers]);

  return { resetTimer };
}
