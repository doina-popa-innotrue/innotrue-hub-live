import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ANALYTICS_SESSION_KEY = 'innotrue_analytics_session';
const COOKIE_CONSENT_KEY = 'innotrue_cookie_consent';
const EXCLUSION_CHECK_KEY = 'innotrue_analytics_excluded';

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

interface TrackEventParams {
  /** Event name (e.g., 'button_click', 'page_view') */
  name: string;
  /** Event category for grouping (e.g., 'navigation', 'engagement') */
  category?: string;
  /** Additional event properties */
  properties?: EventProperties;
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(ANALYTICS_SESSION_KEY, sessionId);
  }
  return sessionId;
}

function hasAnalyticsConsent(): boolean {
  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) return false;
    const parsed = JSON.parse(consent);
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

// Check if user is on the exclusion list (cached in sessionStorage)
function getCachedExclusionStatus(): boolean | null {
  try {
    const cached = sessionStorage.getItem(EXCLUSION_CHECK_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Cache expires after 5 minutes
    if (Date.now() - parsed.timestamp > 5 * 60 * 1000) {
      sessionStorage.removeItem(EXCLUSION_CHECK_KEY);
      return null;
    }
    return parsed.excluded;
  } catch {
    return null;
  }
}

function setCachedExclusionStatus(excluded: boolean): void {
  sessionStorage.setItem(EXCLUSION_CHECK_KEY, JSON.stringify({
    excluded,
    timestamp: Date.now(),
  }));
}

/**
 * Analytics hook for tracking user interactions and page views.
 * Respects cookie consent preferences - only tracks if analytics consent is given.
 * Uses edge function with rate limiting and validation for security.
 * 
 * @example
 * ```tsx
 * const { trackEvent, trackPageView } = useAnalytics();
 * 
 * // Track a button click
 * trackEvent({ name: 'submit_form', category: 'engagement', properties: { form_type: 'contact' } });
 * 
 * // Track page view (automatically done on mount if trackOnMount is true)
 * trackPageView('/dashboard');
 * ```
 */
export function useAnalytics(options: { trackOnMount?: boolean } = {}) {
  const { trackOnMount = false } = options;
  const { user } = useAuth();
  const hasTrackedPageView = useRef(false);
  const [isExcluded, setIsExcluded] = useState<boolean | null>(getCachedExclusionStatus());
  const exclusionCheckDone = useRef(false);

  // Check exclusion list when user changes
  useEffect(() => {
    const checkExclusion = async () => {
      if (!user?.id || exclusionCheckDone.current) return;
      
      // Check cache first
      const cached = getCachedExclusionStatus();
      if (cached !== null) {
        setIsExcluded(cached);
        exclusionCheckDone.current = true;
        return;
      }

      try {
        const { data, error } = await supabase
          .from('analytics_excluded_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        const excluded = !error && !!data;
        setCachedExclusionStatus(excluded);
        setIsExcluded(excluded);
        exclusionCheckDone.current = true;
      } catch {
        // If check fails, allow tracking (fail open for analytics)
        setIsExcluded(false);
        exclusionCheckDone.current = true;
      }
    };

    checkExclusion();
  }, [user?.id]);

  const trackEvent = useCallback(async ({ name, category, properties }: TrackEventParams) => {
    // Check consent before tracking
    if (!hasAnalyticsConsent()) {
      return;
    }

    // Check if user is on exclusion list
    if (isExcluded) {
      return;
    }

    try {
      // Use edge function for rate-limited, validated analytics
      await supabase.functions.invoke('track-analytics', {
        body: {
          type: 'analytics_event',
          payload: {
            user_id: user?.id || null,
            session_id: getSessionId(),
            event_name: name,
            event_category: category || null,
            event_properties: properties || {},
            page_url: window.location.href,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent,
          },
        },
      });
    } catch (error) {
      // Silently fail - don't break the app for analytics failures
      console.debug('Analytics event failed:', error);
    }
  }, [user?.id, isExcluded]);

  const trackPageView = useCallback((pagePath?: string) => {
    trackEvent({
      name: 'page_view',
      category: 'navigation',
      properties: {
        path: pagePath || window.location.pathname,
        title: document.title,
      },
    });
  }, [trackEvent]);

  const trackClick = useCallback((elementName: string, properties?: EventProperties) => {
    trackEvent({
      name: 'click',
      category: 'interaction',
      properties: {
        element: elementName,
        ...properties,
      },
    });
  }, [trackEvent]);

  const trackFeatureUsage = useCallback((featureName: string, properties?: EventProperties) => {
    trackEvent({
      name: 'feature_usage',
      category: 'engagement',
      properties: {
        feature: featureName,
        ...properties,
      },
    });
  }, [trackEvent]);

  const trackError = useCallback((errorMessage: string, properties?: EventProperties) => {
    trackEvent({
      name: 'error',
      category: 'errors',
      properties: {
        message: errorMessage,
        ...properties,
      },
    });
  }, [trackEvent]);

  const trackSearch = useCallback((searchTerm: string, resultCount?: number) => {
    trackEvent({
      name: 'search',
      category: 'engagement',
      properties: {
        term: searchTerm,
        result_count: resultCount,
      },
    });
  }, [trackEvent]);

  // Track page view on mount if enabled
  useEffect(() => {
    if (trackOnMount && !hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      trackPageView();
    }
  }, [trackOnMount, trackPageView]);

  return {
    trackEvent,
    trackPageView,
    trackClick,
    trackFeatureUsage,
    trackError,
    trackSearch,
  };
}

/**
 * Simple hook to track page views automatically.
 * Use this on page components for automatic page view tracking.
 * 
 * @example
 * ```tsx
 * function DashboardPage() {
 *   usePageView('Dashboard');
 *   return <div>...</div>;
 * }
 * ```
 */
export function usePageView(pageName?: string) {
  const { trackPageView } = useAnalytics();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackPageView(pageName);
    }
  }, [pageName, trackPageView]);
}
