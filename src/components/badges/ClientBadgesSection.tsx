import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Award,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  Linkedin,
  Clock,
  FileDown,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateLinkedInAddToProfileUrl, generateBadgeVerificationUrl } from "@/lib/linkedinUtils";

interface ClientBadge {
  id: string;
  user_id: string;
  status: string;
  image_path: string | null;
  issued_at: string | null;
  expires_at: string | null;
  is_public: boolean;
  program_badges: {
    id: string;
    name: string;
    description: string | null;
    image_path: string | null;
    programs: {
      id: string;
      name: string;
    };
    program_badge_credentials: Array<{
      id: string;
      service_name: string;
      service_display_name: string | null;
      credential_template_url: string | null;
    }>;
  };
  client_badge_credentials: Array<{
    id: string;
    acceptance_url: string | null;
    accepted_at: string | null;
    program_badge_credential_id: string;
  }>;
}

interface PendingBadge {
  id: string;
  program_badges: {
    name: string;
    programs: {
      name: string;
    };
  };
}

interface Props {
  showPublicToggle?: boolean;
  compact?: boolean;
}

export default function ClientBadgesSection({ showPublicToggle = true, compact = false }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBadge, setSelectedBadge] = useState<ClientBadge | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch issued badges
  const { data: badges, isLoading } = useQuery({
    queryKey: ["client-badges", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("client_badges")
        .select(
          `
          *,
          program_badges (
            id,
            name,
            description,
            image_path,
            programs (
              id,
              name
            ),
            program_badge_credentials (*)
          ),
          client_badge_credentials (*)
        `,
        )
        .eq("user_id", user.id)
        .eq("status", "issued")
        .order("issued_at", { ascending: false });

      if (error) throw error;
      return data as ClientBadge[];
    },
    enabled: !!user,
  });

  // Fetch pending badges (separate query)
  const { data: pendingBadges } = useQuery({
    queryKey: ["client-badges-pending", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("client_badges")
        .select(
          `
          id,
          program_badges (
            name,
            programs (name)
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("status", "pending_approval");

      if (error) throw error;
      return data as PendingBadge[];
    },
    enabled: !!user,
  });

  const togglePublicMutation = useMutation({
    mutationFn: async ({ badgeId, isPublic }: { badgeId: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from("client_badges")
        .update({ is_public: isPublic })
        .eq("id", badgeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-badges", user?.id] });
      toast.success("Badge visibility updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update visibility: ${error.message}`);
    },
  });

  const getPublicUrl = (path: string, bucket: string = "program-logos") => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const getBadgeImageUrl = (badge: ClientBadge) => {
    if (badge.image_path) {
      return getPublicUrl(badge.image_path, "client-badges");
    }
    if (badge.program_badges?.image_path) {
      return getPublicUrl(badge.program_badges.image_path, "program-logos");
    }
    return null;
  };

  const getExpiryStatus = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (expiry < now) return "expired";
    if (expiry < thirtyDaysFromNow) return "expiring_soon";
    return "valid";
  };

  async function downloadCertificate(clientBadgeId: string) {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-certificate-pdf", {
        body: { client_badge_id: clientBadgeId },
      });

      if (error) throw error;

      // The response is a PDF blob
      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${clientBadgeId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download certificate:", err);
      toast.error("Failed to download certificate");
    } finally {
      setIsDownloading(false);
    }
  }

  const pendingCount = pendingBadges?.length || 0;
  const hasBadges = (badges && badges.length > 0) || pendingCount > 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasBadges) {
    if (compact) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            My Badges
          </CardTitle>
          <CardDescription>Badges you've earned from completing programs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No badges earned yet</p>
            <p className="text-sm text-muted-foreground mt-1">Complete programs to earn badges</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // In compact mode, only show if there are issued badges
  if (compact && (!badges || badges.length === 0)) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            My Badges
            {badges && badges.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {badges.length}
              </Badge>
            )}
          </CardTitle>
          {!compact && (
            <CardDescription>Badges you've earned from completing programs</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pending badges notice */}
          {pendingCount > 0 && !compact && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {pendingCount} badge{pendingCount !== 1 ? "s" : ""} pending instructor review
              </p>
            </div>
          )}

          {/* Issued badges grid */}
          {badges && badges.length > 0 && (
            <div
              className={`grid gap-4 ${compact ? "grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}
            >
              {badges.map((badge) => {
                const imageUrl = getBadgeImageUrl(badge);
                const expiryStatus = getExpiryStatus(badge.expires_at);

                return (
                  <div
                    key={badge.id}
                    className="relative group cursor-pointer"
                    onClick={() => setSelectedBadge(badge)}
                  >
                    <div className="border rounded-lg p-4 hover:border-primary transition-colors text-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={badge.program_badges.name}
                          className="w-16 h-16 mx-auto object-contain mb-2"
                        />
                      ) : (
                        <Award className="w-16 h-16 mx-auto text-primary mb-2" />
                      )}
                      {!compact && (
                        <>
                          <p className="font-medium text-sm line-clamp-2">
                            {badge.program_badges.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {badge.program_badges.programs.name}
                          </p>
                          {expiryStatus === "expired" && (
                            <Badge variant="destructive" className="mt-1 text-xs">
                              Expired
                            </Badge>
                          )}
                          {expiryStatus === "expiring_soon" && (
                            <Badge variant="outline" className="mt-1 text-xs text-amber-600 border-amber-300">
                              Expiring soon
                            </Badge>
                          )}
                        </>
                      )}
                      {showPublicToggle && (
                        <div className="absolute top-2 right-2">
                          {badge.is_public ? (
                            <Eye className="h-4 w-4 text-primary" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedBadge} onOpenChange={() => setSelectedBadge(null)}>
        {selectedBadge && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedBadge.program_badges.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="text-center">
                {getBadgeImageUrl(selectedBadge) ? (
                  <img
                    src={getBadgeImageUrl(selectedBadge)!}
                    alt={selectedBadge.program_badges.name}
                    className="w-32 h-32 mx-auto object-contain"
                  />
                ) : (
                  <Award className="w-32 h-32 mx-auto text-primary" />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {selectedBadge.program_badges.description}
                </p>
                <p className="text-sm">
                  <strong>Program:</strong> {selectedBadge.program_badges.programs.name}
                </p>
                {selectedBadge.issued_at && (
                  <p className="text-sm">
                    <strong>Issued:</strong>{" "}
                    {new Date(selectedBadge.issued_at).toLocaleDateString()}
                  </p>
                )}
                {selectedBadge.expires_at && (
                  <div className="text-sm">
                    <strong>Expires:</strong>{" "}
                    {new Date(selectedBadge.expires_at).toLocaleDateString()}
                    {getExpiryStatus(selectedBadge.expires_at) === "expired" && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        Expired
                      </Badge>
                    )}
                    {getExpiryStatus(selectedBadge.expires_at) === "expiring_soon" && (
                      <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-300">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Expiring soon
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {selectedBadge.program_badges.program_badge_credentials.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-sm">External Credentials</p>
                  <div className="space-y-2">
                    {selectedBadge.program_badges.program_badge_credentials.map((cred) => {
                      const clientCred = selectedBadge.client_badge_credentials.find(
                        (c) => c.program_badge_credential_id === cred.id,
                      );

                      return (
                        <div
                          key={cred.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded"
                        >
                          <span className="text-sm">
                            {cred.service_display_name || cred.service_name}
                          </span>
                          {clientCred?.acceptance_url ? (
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={clientCred.acceptance_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View
                              </a>
                            </Button>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Download Certificate */}
              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isDownloading}
                  onClick={() => downloadCertificate(selectedBadge.id)}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  Download Certificate (PDF)
                </Button>

                {/* LinkedIn Add to Profile */}
                <Button variant="outline" className="w-full" asChild>
                  <a
                    href={generateLinkedInAddToProfileUrl({
                      name: selectedBadge.program_badges.name,
                      issueYear: selectedBadge.issued_at
                        ? new Date(selectedBadge.issued_at).getFullYear()
                        : undefined,
                      issueMonth: selectedBadge.issued_at
                        ? new Date(selectedBadge.issued_at).getMonth() + 1
                        : undefined,
                      expirationYear: selectedBadge.expires_at
                        ? new Date(selectedBadge.expires_at).getFullYear()
                        : undefined,
                      expirationMonth: selectedBadge.expires_at
                        ? new Date(selectedBadge.expires_at).getMonth() + 1
                        : undefined,
                      certificationUrl: generateBadgeVerificationUrl(selectedBadge.id),
                      certificationId: selectedBadge.id,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Linkedin className="h-4 w-4 mr-2" />
                    Add to LinkedIn Profile
                  </a>
                </Button>
              </div>

              {showPublicToggle && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label htmlFor="public-toggle" className="font-medium">
                      Show on Public Profile
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Make this badge visible on your public profile
                    </p>
                  </div>
                  <Switch
                    id="public-toggle"
                    checked={selectedBadge.is_public}
                    onCheckedChange={(checked) => {
                      togglePublicMutation.mutate({
                        badgeId: selectedBadge.id,
                        isPublic: checked,
                      });
                      setSelectedBadge({ ...selectedBadge, is_public: checked });
                    }}
                  />
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
