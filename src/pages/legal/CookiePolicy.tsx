import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cookie, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export default function CookiePolicy() {
  const resetCookieConsent = () => {
    localStorage.removeItem("innotrue_cookie_consent");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Cookie className="h-6 w-6" />
              Cookie Policy
            </CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[70vh] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
                <section>
                  <h2 className="text-xl font-semibold">1. What Are Cookies?</h2>
                  <p>
                    Cookies are small text files stored on your device when you visit a website.
                    They help the website remember your preferences and understand how you use the
                    site.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">2. How We Use Cookies</h2>
                  <p>
                    InnoTrue Hub uses cookies and similar technologies (localStorage,
                    sessionStorage) to provide, secure, and improve our platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">3. Types of Cookies We Use</h2>

                  <div className="mt-4 space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold text-primary">
                        ✓ Strictly Necessary (Always Active)
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Required for the platform to function. Cannot be disabled.
                      </p>
                      <table className="w-full text-sm mt-3">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Purpose</th>
                            <th className="text-left p-2">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 font-mono text-xs">sb-*-auth-token</td>
                            <td className="p-2">Authentication session</td>
                            <td className="p-2">Session / 7 days</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono text-xs">innotrue_cookie_consent</td>
                            <td className="p-2">Your cookie preferences</td>
                            <td className="p-2">1 year</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono text-xs">innotrue_session_id</td>
                            <td className="p-2">Anonymous session tracking</td>
                            <td className="p-2">Session</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold text-primary">📊 Analytics (Optional)</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Help us understand how you use the platform to improve it.
                      </p>
                      <table className="w-full text-sm mt-3">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Purpose</th>
                            <th className="text-left p-2">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 font-mono text-xs">analytics_events</td>
                            <td className="p-2">Page views, feature usage</td>
                            <td className="p-2">2 years (server-side)</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Note:</strong> Analytics data is stored on our servers (USA) and is
                        not shared with third-party analytics providers like Google Analytics.
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold text-primary">🎯 Marketing (Optional)</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Used for personalized recommendations within the platform.
                      </p>
                      <table className="w-full text-sm mt-3">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Purpose</th>
                            <th className="text-left p-2">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 font-mono text-xs">recommendation_prefs</td>
                            <td className="p-2">Course recommendations</td>
                            <td className="p-2">1 year</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Note:</strong> We do not use third-party advertising cookies.
                        Marketing cookies are only used for internal personalization.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h2 className="text-xl font-semibold text-amber-800 dark:text-amber-200">
                    4. Data Storage Location
                  </h2>
                  <p className="text-amber-800 dark:text-amber-200">
                    Cookie consent records and analytics data are stored on servers located in the
                    <strong> United States</strong> (Amazon Web Services via Supabase).
                  </p>
                  <p className="mt-2 text-amber-800 dark:text-amber-200">
                    This transfer is protected by:
                  </p>
                  <ul className="list-disc pl-6 text-amber-800 dark:text-amber-200">
                    <li>EU-US Data Privacy Framework (where applicable)</li>
                    <li>Standard Contractual Clauses (SCCs)</li>
                    <li>Encryption in transit and at rest</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">5. Managing Your Preferences</h2>
                  <p>You can manage your cookie preferences at any time:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Click "Customize" on the cookie consent banner</li>
                    <li>Reset your preferences using the button below</li>
                    <li>Use your browser's cookie settings</li>
                  </ul>

                  <div className="mt-4">
                    <Button onClick={resetCookieConsent} variant="outline">
                      <Settings className="h-4 w-4 mr-2" />
                      Reset Cookie Preferences
                    </Button>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">6. Browser Settings</h2>
                  <p>Most browsers allow you to control cookies through their settings:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Chrome:</strong> Settings → Privacy and Security → Cookies
                    </li>
                    <li>
                      <strong>Firefox:</strong> Settings → Privacy & Security → Cookies
                    </li>
                    <li>
                      <strong>Safari:</strong> Preferences → Privacy → Cookies
                    </li>
                    <li>
                      <strong>Edge:</strong> Settings → Privacy → Cookies
                    </li>
                  </ul>
                  <p className="mt-2 text-muted-foreground text-sm">
                    Note: Blocking all cookies may prevent the platform from functioning correctly.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">7. Consent Records</h2>
                  <p>
                    In accordance with GDPR accountability requirements (Art. 5(2)), we maintain
                    records of your cookie consent including:
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Timestamp of consent</li>
                    <li>Categories accepted/rejected</li>
                    <li>Anonymous session identifier</li>
                  </ul>
                  <p className="mt-2">
                    These records are retained for <strong>7 years</strong> for legal compliance
                    purposes.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">8. Updates to This Policy</h2>
                  <p>
                    We may update this Cookie Policy when we change our cookie usage. The "Last
                    updated" date at the top indicates the most recent revision.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">9. Contact</h2>
                  <p>
                    For questions about our use of cookies:
                    <br />
                    Email: privacy@innotrue.com
                    <br />
                    Subject: "Cookie Policy Inquiry"
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
