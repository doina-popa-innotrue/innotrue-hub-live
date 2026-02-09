import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, Settings, X } from "lucide-react";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = "innotrue_cookie_consent";
const COOKIE_SESSION_KEY = "innotrue_session_id";

function getSessionId(): string {
  let sessionId = localStorage.getItem(COOKIE_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(COOKIE_SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function CookieConsentBanner() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!savedConsent) {
      // Small delay to not show immediately on page load
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    } else {
      try {
        const parsed = JSON.parse(savedConsent);
        setPreferences(parsed);
      } catch {
        setShowBanner(true);
      }
    }
  }, []);

  const saveConsent = async (prefs: CookiePreferences) => {
    // Save to localStorage
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);

    // Save to database via edge function with rate limiting and validation
    try {
      await supabase.functions.invoke('track-analytics', {
        body: {
          type: 'cookie_consent',
          payload: {
            user_id: user?.id || null,
            session_id: getSessionId(),
            necessary: prefs.necessary,
            analytics: prefs.analytics,
            marketing: prefs.marketing,
            user_agent: navigator.userAgent,
          },
        },
      });
    } catch (error) {
      console.error("Failed to save cookie consent:", error);
    }

    // GDPR compliance: For logged-in users who decline analytics, add them to the
    // server-side exclusion list to ensure tracking is blocked even on other devices
    if (user?.id && !prefs.analytics) {
      try {
        // Insert into exclusion list (ignore conflict if already exists)
        await supabase
          .from('analytics_excluded_users')
          .upsert(
            {
              user_id: user.id,
              reason: 'User declined analytics via cookie banner',
            },
            { onConflict: 'user_id', ignoreDuplicates: true }
          );
        // Clear cached exclusion status so it's re-fetched
        sessionStorage.removeItem('innotrue_analytics_excluded');
      } catch (error) {
        console.error("Failed to add user to exclusion list:", error);
      }
    }

    // If logged-in user accepts analytics, remove them from exclusion list if present
    if (user?.id && prefs.analytics) {
      try {
        await supabase
          .from('analytics_excluded_users')
          .delete()
          .eq('user_id', user.id);
        // Clear cached exclusion status
        sessionStorage.removeItem('innotrue_analytics_excluded');
      } catch (error) {
        console.error("Failed to remove user from exclusion list:", error);
      }
    }
  };

  const acceptAll = () => {
    saveConsent({ necessary: true, analytics: true, marketing: true });
  };

  const acceptNecessary = () => {
    saveConsent({ necessary: true, analytics: false, marketing: false });
  };

  const savePreferences = () => {
    saveConsent(preferences);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg">
      <div className="max-w-4xl mx-auto">
        {showSettings ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Cookie Preferences
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Manage your cookie preferences. Necessary cookies are always enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Necessary</Label>
                  <p className="text-sm text-muted-foreground">
                    Required for the website to function properly
                  </p>
                </div>
                <Switch checked disabled />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Analytics</Label>
                  <p className="text-sm text-muted-foreground">
                    Help us understand how you use the platform
                  </p>
                </div>
                <Switch 
                  checked={preferences.analytics} 
                  onCheckedChange={(checked) => setPreferences(p => ({ ...p, analytics: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Marketing</Label>
                  <p className="text-sm text-muted-foreground">
                    Personalized content and relevant recommendations
                  </p>
                </div>
                <Switch 
                  checked={preferences.marketing} 
                  onCheckedChange={(checked) => setPreferences(p => ({ ...p, marketing: checked }))}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={savePreferences} className="flex-1">
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">We value your privacy</p>
                <p className="text-sm text-muted-foreground">
                  We use cookies to enhance your experience. By continuing, you agree to our{" "}
                  <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a>
                  {" "}and{" "}
                  <a href="/cookie-policy" className="text-primary hover:underline">Cookie Policy</a>.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                Customize
              </Button>
              <Button variant="outline" size="sm" onClick={acceptNecessary}>
                Necessary Only
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Accept All
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook to check cookie preferences
export function useCookieConsent(): CookiePreferences {
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (savedConsent) {
      try {
        setPreferences(JSON.parse(savedConsent));
      } catch {
        // Use defaults
      }
    }
  }, []);

  return preferences;
}
