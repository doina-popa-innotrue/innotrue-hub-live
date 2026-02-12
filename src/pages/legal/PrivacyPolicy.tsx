import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Shield, Globe, Server, Lock, BarChart2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
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
              <Shield className="h-6 w-6" />
              Privacy Policy
            </CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[70vh] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
                <section>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    1. Data Controller
                  </h2>
                  <p>
                    InnoTrue GmbH
                    <br />
                    Radlerweg 10
                    <br />
                    83257 Gstadt
                    <br />
                    Germany
                    <br />
                    Email: legal@innotrue.com
                  </p>
                  <p>
                    We are the data controller responsible for your personal data in accordance with
                    the EU General Data Protection Regulation (GDPR) and the German Federal Data
                    Protection Act (BDSG).
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">2. Data We Collect</h2>
                  <p>We collect and process the following categories of personal data:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Account Data:</strong> Name, email address, password (encrypted)
                    </li>
                    <li>
                      <strong>Profile Data:</strong> Bio, avatar, professional information you
                      choose to share
                    </li>
                    <li>
                      <strong>Usage Data:</strong> Platform interactions, progress, assessment
                      responses
                    </li>
                    <li>
                      <strong>Technical Data:</strong> IP address, browser type, device information
                    </li>
                    <li>
                      <strong>Payment Data:</strong> Billing address, VAT number (payment processing
                      via Stripe)
                    </li>
                    <li>
                      <strong>Analytics Data:</strong> Anonymized page views, feature usage
                      patterns, and session data for platform improvement (opt-out available)
                    </li>
                  </ul>
                </section>

                <section className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h2 className="text-xl font-semibold flex items-center gap-2 text-blue-800 dark:text-blue-200">
                    <BarChart2 className="h-5 w-5" />
                    2a. Analytics for Platform Improvement
                  </h2>
                  <p className="text-blue-900 dark:text-blue-100 mt-2">
                    We collect anonymized usage analytics to improve our platform and user
                    experience. This includes:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 mt-2 text-blue-800 dark:text-blue-200">
                    <li>Page views and navigation patterns</li>
                    <li>Feature usage and engagement metrics</li>
                    <li>Session duration and frequency</li>
                    <li>Error occurrence patterns (to fix bugs)</li>
                  </ul>
                  <p className="mt-3 text-blue-800 dark:text-blue-200">
                    <strong>Your Control:</strong> You can opt out of analytics tracking at any time
                    via{" "}
                    <Link
                      to="/account"
                      className="underline hover:text-blue-600 dark:hover:text-blue-300"
                    >
                      Account Settings → Analytics Preferences
                    </Link>
                    . Opting out does not affect platform functionality.
                  </p>
                  <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    Analytics data is never sold or shared with third parties and is used solely for
                    internal platform improvement purposes.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">3. Legal Basis for Processing</h2>
                  <p>We process your data based on:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Contract Performance (Art. 6(1)(b) GDPR):</strong> To provide our
                      services
                    </li>
                    <li>
                      <strong>Legitimate Interest (Art. 6(1)(f) GDPR):</strong> Platform security,
                      fraud prevention
                    </li>
                    <li>
                      <strong>Consent (Art. 6(1)(a) GDPR):</strong> Analytics, marketing
                      communications
                    </li>
                    <li>
                      <strong>Legal Obligation (Art. 6(1)(c) GDPR):</strong> Tax records, legal
                      compliance
                    </li>
                  </ul>
                </section>

                <section className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <Server className="h-5 w-5" />
                    4. International Data Transfers
                  </h2>
                  <p className="text-amber-900 dark:text-amber-100">
                    <strong>Important Notice for EU/German Users:</strong>
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    Our platform infrastructure is hosted by Supabase, Inc. (USA) and Cloudflare,
                    Inc. (USA). This means your personal data may be transferred to and processed in
                    the United States.
                  </p>
                  <p className="mt-3 text-amber-800 dark:text-amber-200">
                    <strong>Legal Safeguards for US Transfers:</strong>
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-amber-800 dark:text-amber-200">
                    <li>We rely on the EU-US Data Privacy Framework (DPF) where applicable</li>
                    <li>
                      Standard Contractual Clauses (SCCs) as approved by the European Commission
                    </li>
                    <li>
                      Additional technical measures including encryption at rest and in transit
                    </li>
                  </ul>
                  <p className="mt-3 text-amber-800 dark:text-amber-200">
                    <strong>Data Locations:</strong>
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-amber-800 dark:text-amber-200">
                    <li>Database: Amazon Web Services (USA)</li>
                    <li>Edge Functions: Deno Deploy (globally distributed)</li>
                    <li>File Storage: Amazon S3 (USA)</li>
                    <li>Payment Processing: Stripe, Inc. (USA/EU)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">5. Third-Party Processors</h2>
                  <p>We use the following service providers:</p>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Provider</th>
                        <th className="text-left p-2">Purpose</th>
                        <th className="text-left p-2">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2">Supabase, Inc.</td>
                        <td className="p-2">Database, Authentication</td>
                        <td className="p-2">USA</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2">Cloudflare, Inc.</td>
                        <td className="p-2">Platform Hosting (Cloudflare Pages)</td>
                        <td className="p-2">USA/Global</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2">Stripe, Inc.</td>
                        <td className="p-2">Payment Processing</td>
                        <td className="p-2">USA/Ireland</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2">Cloudflare, Inc.</td>
                        <td className="p-2">CDN, Security</td>
                        <td className="p-2">USA (global edge)</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">6. Data Retention</h2>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Account Data:</strong> Until account deletion + 30 days
                    </li>
                    <li>
                      <strong>Usage Analytics:</strong> 2 years (anonymized after)
                    </li>
                    <li>
                      <strong>Terms Acceptance Records:</strong> 7 years (legal requirement)
                    </li>
                    <li>
                      <strong>Payment Records:</strong> 10 years (German tax law - AO §147)
                    </li>
                    <li>
                      <strong>Cookie Consent:</strong> 7 years (accountability requirement)
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    7. Your Rights (GDPR Articles 15-22)
                  </h2>
                  <p>You have the following rights regarding your personal data:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Right of Access (Art. 15):</strong> Request a copy of your data
                    </li>
                    <li>
                      <strong>Right to Rectification (Art. 16):</strong> Correct inaccurate data
                    </li>
                    <li>
                      <strong>Right to Erasure (Art. 17):</strong> Request deletion of your data
                    </li>
                    <li>
                      <strong>Right to Restrict Processing (Art. 18):</strong> Limit how we use your
                      data
                    </li>
                    <li>
                      <strong>Right to Data Portability (Art. 20):</strong> Receive your data in a
                      portable format
                    </li>
                    <li>
                      <strong>Right to Object (Art. 21):</strong> Object to processing based on
                      legitimate interest
                    </li>
                    <li>
                      <strong>Right to Withdraw Consent (Art. 7):</strong> Withdraw consent at any
                      time
                    </li>
                  </ul>
                  <p className="mt-3">
                    <strong>How to Exercise Your Rights:</strong>
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      Data Export:{" "}
                      <Link to="/account" className="text-primary hover:underline">
                        Account Settings → Data Export
                      </Link>
                    </li>
                    <li>
                      Account Deletion:{" "}
                      <Link to="/account" className="text-primary hover:underline">
                        Account Settings → Delete Account
                      </Link>
                    </li>
                    <li>Email: legal@innotrue.com</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">8. Supervisory Authority</h2>
                  <p>
                    You have the right to lodge a complaint with a supervisory authority, in
                    particular in the EU Member State of your habitual residence, place of work, or
                    place of the alleged infringement.
                  </p>
                  <p className="mt-2">
                    <strong>German Federal Commissioner for Data Protection:</strong>
                    <br />
                    Der Bundesbeauftragte für den Datenschutz und die Informationsfreiheit
                    <br />
                    Graurheindorfer Str. 153
                    <br />
                    53117 Bonn, Germany
                    <br />
                    <a
                      href="https://www.bfdi.bund.de"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      www.bfdi.bund.de <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">9. Security Measures</h2>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>TLS 1.3 encryption for all data in transit</li>
                    <li>AES-256 encryption for data at rest</li>
                    <li>Row-Level Security (RLS) for data isolation</li>
                    <li>Automatic session timeout after 30 minutes of inactivity</li>
                    <li>Rate limiting on all API endpoints</li>
                    <li>SHA-256 hashing for verification tokens</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">10. Updates to This Policy</h2>
                  <p>
                    We may update this Privacy Policy from time to time. We will notify you of
                    significant changes via email or a prominent notice on our platform. Continued
                    use after changes constitutes acceptance of the updated policy.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold">11. Contact</h2>
                  <p>
                    For privacy-related inquiries:
                    <br />
                    Email: legal@innotrue.com
                    <br />
                    Subject: "Privacy Inquiry - InnoTrue Hub"
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
