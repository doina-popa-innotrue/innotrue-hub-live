import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  CheckCircle,
  XCircle,
  ExternalLink,
  Linkedin,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { generateLinkedInShareUrl, generateBadgeVerificationUrl } from "@/lib/linkedinUtils";

interface BadgeData {
  verification_valid: boolean;
  badge_id?: string;
  badge_name?: string;
  badge_description?: string;
  badge_image_url?: string;
  user_name?: string;
  program_name?: string;
  organization_name?: string;
  issued_at?: string;
  expires_at?: string;
  is_expired?: boolean;
  credentials?: Array<{
    service_name: string;
    service_display_name: string | null;
    acceptance_url: string | null;
  }>;
  message?: string;
}

export default function BadgeVerification() {
  const { badgeId } = useParams<{ badgeId: string }>();
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBadge() {
      if (!badgeId) {
        setError("No badge ID provided");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke("verify-badge", {
          body: { badgeId },
        });

        if (fnError) throw fnError;
        setBadgeData(data);
      } catch (err) {
        console.error("Failed to verify badge:", err);
        setError("Failed to verify badge. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchBadge();
  }, [badgeId]);

  // Update page title
  useEffect(() => {
    if (badgeData?.badge_name && badgeData?.user_name) {
      document.title = `${badgeData.badge_name} — ${badgeData.user_name} | InnoTrue`;
    } else {
      document.title = "Badge Verification | InnoTrue";
    }
    return () => {
      document.title = "InnoTrue Hub";
    };
  }, [badgeData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verification Error</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!badgeData || !badgeData.verification_valid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <Award className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Badge Not Available</h2>
            <p className="text-muted-foreground">
              {badgeData?.message || "This badge is either private, not yet issued, or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const issuedDate = badgeData.issued_at
    ? new Date(badgeData.issued_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const expiryDate = badgeData.expires_at
    ? new Date(badgeData.expires_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const shareUrl = generateLinkedInShareUrl({
    url: generateBadgeVerificationUrl(badgeData.badge_id!),
    title: `${badgeData.user_name} earned ${badgeData.badge_name} from ${badgeData.organization_name}`,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-500" />
            <span className="font-semibold text-lg text-slate-800">InnoTrue</span>
          </div>
          <Badge variant="outline" className="text-xs">
            Badge Verification
          </Badge>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card className="overflow-hidden shadow-lg">
          {/* Top accent */}
          <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />

          <CardContent className="p-8 sm:p-12 text-center space-y-8">
            {/* Verified indicator */}
            <div className="flex items-center justify-center gap-2">
              {badgeData.is_expired ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-amber-600 font-medium text-sm">
                    Expired Certificate
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium text-sm">
                    Verified Certificate
                  </span>
                </>
              )}
            </div>

            {/* Badge image */}
            {badgeData.badge_image_url ? (
              <img
                src={badgeData.badge_image_url}
                alt={badgeData.badge_name}
                className="w-32 h-32 mx-auto object-contain"
              />
            ) : (
              <Award className="w-32 h-32 mx-auto text-indigo-500" />
            )}

            {/* Badge name */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                {badgeData.badge_name}
              </h1>
              {badgeData.badge_description && (
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  {badgeData.badge_description}
                </p>
              )}
            </div>

            {/* Recipient */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Awarded to</p>
              <p className="text-xl font-semibold text-slate-800">{badgeData.user_name}</p>
            </div>

            {/* Program */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">For completing</p>
              <p className="text-lg font-medium text-indigo-600">{badgeData.program_name}</p>
            </div>

            {/* Dates */}
            <div className="flex items-center justify-center gap-8 text-sm">
              {issuedDate && (
                <div>
                  <p className="text-muted-foreground">Issued</p>
                  <p className="font-medium text-slate-700">{issuedDate}</p>
                </div>
              )}
              {expiryDate && (
                <div>
                  <p className="text-muted-foreground">
                    {badgeData.is_expired ? "Expired" : "Valid Until"}
                  </p>
                  <p className={`font-medium ${badgeData.is_expired ? "text-red-600" : "text-slate-700"}`}>
                    {expiryDate}
                  </p>
                </div>
              )}
            </div>

            {/* Organization */}
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                Issued by <span className="font-medium text-slate-600">{badgeData.organization_name}</span>
              </p>
            </div>

            {/* External credentials */}
            {badgeData.credentials && badgeData.credentials.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">External Credentials</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {badgeData.credentials.map((cred, idx) =>
                    cred.acceptance_url ? (
                      <Button key={idx} size="sm" variant="outline" asChild>
                        <a href={cred.acceptance_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {cred.service_display_name || cred.service_name}
                        </a>
                      </Button>
                    ) : null,
                  )}
                </div>
              </div>
            )}

            {/* Share */}
            <div className="pt-4 border-t">
              <Button variant="outline" size="sm" asChild>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4 mr-2" />
                  Share on LinkedIn
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>
            This certificate was issued through the{" "}
            <a href="https://app.innotrue.com" className="text-indigo-500 hover:underline">
              InnoTrue Hub
            </a>{" "}
            platform.
          </p>
        </div>
      </div>
    </div>
  );
}
