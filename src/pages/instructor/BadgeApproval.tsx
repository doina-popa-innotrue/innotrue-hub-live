import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Award, Check, Loader2, User, ExternalLink, AlertTriangle, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useBulkScenarioCertificationCheck } from "@/hooks/useScenarioCertification";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageLoadingState } from "@/components/ui/page-loading-state";

interface PendingBadge {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  enrollment_id: string;
  program_badge_id: string;
  profiles: {
    id: string;
    name: string;
  };
  client_enrollments: {
    id: string;
    program_id: string;
    programs: {
      id: string;
      name: string;
    };
  };
  program_badges: {
    id: string;
    name: string;
    description: string | null;
    image_path: string | null;
    renewal_period_months: number | null;
    program_badge_credentials: Array<{
      id: string;
      service_name: string;
      service_display_name: string | null;
      credential_template_url: string | null;
    }>;
  };
}

export default function BadgeApproval() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBadges, setSelectedBadges] = useState<Set<string>>(new Set());
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [credentialUrls, setCredentialUrls] = useState<Record<string, Record<string, string>>>({});

  const { data: pendingBadges, isLoading } = useQuery({
    queryKey: ["pending-badge-approvals", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get programs where user is primary instructor
      const { data: instructorPrograms } = await supabase
        .from("program_instructors")
        .select("program_id")
        .eq("instructor_id", user.id)
        .eq("is_primary", true);

      if (!instructorPrograms || instructorPrograms.length === 0) return [];

      const programIds = instructorPrograms.map((p) => p.program_id);

      // Get pending badges for those programs
      const { data, error } = await supabase
        .from("client_badges")
        .select(
          `
          *,
          profiles!client_badges_user_id_fkey (
            id,
            name
          ),
          client_enrollments!client_badges_enrollment_id_fkey (
            id,
            program_id,
            programs (
              id,
              name
            )
          ),
          program_badges (
            id,
            name,
            description,
            image_path,
            program_badge_credentials (*)
          )
        `,
        )
        .eq("status", "pending_approval")
        .in("program_badges.program_id", programIds);

      if (error) throw error;

      // Filter to only include badges where program_badges is not null
      return (data || []).filter(
        (badge) => badge.program_badges !== null,
      ) as unknown as PendingBadge[];
    },
    enabled: !!user,
  });

  // Check certification requirements for all pending badges
  const enrollmentIds = useMemo(
    () => pendingBadges?.map((b) => b.enrollment_id).filter(Boolean) ?? [],
    [pendingBadges],
  );
  const { data: certificationChecks } = useBulkScenarioCertificationCheck(enrollmentIds);

  const approveBadgesMutation = useMutation({
    mutationFn: async (badgeIds: string[]) => {
      const now = new Date();
      const nowIso = now.toISOString();

      // Update badges to approved/issued status, calculating expires_at per badge
      for (const badgeId of badgeIds) {
        const badge = pendingBadges?.find((b) => b.id === badgeId);
        const renewalMonths = badge?.program_badges?.renewal_period_months;
        let expiresAt: string | null = null;
        if (renewalMonths) {
          const expiry = new Date(now);
          expiry.setMonth(expiry.getMonth() + renewalMonths);
          expiresAt = expiry.toISOString();
        }

        const { error: updateError } = await supabase
          .from("client_badges")
          .update({
            status: "issued",
            issued_at: nowIso,
            issued_by: user?.id,
            expires_at: expiresAt,
          })
          .eq("id", badgeId);

        if (updateError) throw updateError;
      }

      // Create client badge credentials with acceptance URLs
      const credentialsToInsert: Array<{
        client_badge_id: string;
        program_badge_credential_id: string;
        acceptance_url: string | null;
      }> = [];

      for (const badgeId of badgeIds) {
        const badgeCredentialUrls = credentialUrls[badgeId] || {};
        const badge = pendingBadges?.find((b) => b.id === badgeId);

        if (badge?.program_badges?.program_badge_credentials) {
          for (const cred of badge.program_badges.program_badge_credentials) {
            credentialsToInsert.push({
              client_badge_id: badgeId,
              program_badge_credential_id: cred.id,
              acceptance_url: badgeCredentialUrls[cred.id] || null,
            });
          }
        }
      }

      if (credentialsToInsert.length > 0) {
        const { error: credError } = await supabase
          .from("client_badge_credentials")
          .insert(credentialsToInsert);

        if (credError) throw credError;
      }

      // Send notification emails to each user
      for (const badgeId of badgeIds) {
        const badge = pendingBadges?.find((b) => b.id === badgeId);
        if (badge) {
          try {
            await supabase.functions.invoke("send-notification-email", {
              body: {
                userId: badge.user_id,
                name: badge.profiles.name,
                type: "badge_issued",
                timestamp: nowIso,
                programName: badge.client_enrollments.programs.name,
                badgeName: badge.program_badges.name,
                badgeDescription: badge.program_badges.description,
              },
            });
          } catch (emailError) {
            console.error("Failed to send badge notification email:", emailError);
          }
        }
      }

      return badgeIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["pending-badge-approvals"] });
      toast.success(`${count} badge(s) issued successfully`);
      setSelectedBadges(new Set());
      setApprovalDialogOpen(false);
      setCredentialUrls({});
    },
    onError: (error: any) => {
      toast.error(`Failed to approve badges: ${error.message}`);
    },
  });

  const handleSelectBadge = (badgeId: string, enrollmentId: string, checked: boolean) => {
    // Check if this badge can be selected (all scenarios must be evaluated)
    const certCheck = certificationChecks?.get(enrollmentId);
    if (checked && certCheck && !certCheck.all_requirements_met) {
      toast.error("Cannot select: Required scenarios are not yet evaluated");
      return;
    }

    const newSelected = new Set(selectedBadges);
    if (checked) {
      newSelected.add(badgeId);
    } else {
      newSelected.delete(badgeId);
    }
    setSelectedBadges(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedBadges.size === pendingBadges?.length) {
      setSelectedBadges(new Set());
    } else {
      // Only select badges that have all requirements met
      const eligibleBadges =
        pendingBadges?.filter((b) => {
          const certCheck = certificationChecks?.get(b.enrollment_id);
          return !certCheck || certCheck.all_requirements_met;
        }) || [];
      setSelectedBadges(new Set(eligibleBadges.map((b) => b.id)));
    }
  };

  const openApprovalDialog = () => {
    // Initialize credential URLs for selected badges
    const urls: Record<string, Record<string, string>> = {};
    for (const badgeId of selectedBadges) {
      urls[badgeId] = {};
    }
    setCredentialUrls(urls);
    setApprovalDialogOpen(true);
  };

  const updateCredentialUrl = (badgeId: string, credentialId: string, url: string) => {
    setCredentialUrls((prev) => ({
      ...prev,
      [badgeId]: {
        ...prev[badgeId],
        [credentialId]: url,
      },
    }));
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("program-logos").getPublicUrl(path);
    return data.publicUrl;
  };

  if (isLoading) {
    return <PageLoadingState />;
  }

  const selectedBadgesData = pendingBadges?.filter((b) => selectedBadges.has(b.id)) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Award className="h-8 w-8" />
          Badge Approval
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and approve completion badges for program participants
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>
                {pendingBadges?.length || 0} badge(s) awaiting your approval
              </CardDescription>
            </div>
            {selectedBadges.size > 0 && (
              <Button onClick={openApprovalDialog}>
                <Check className="h-4 w-4 mr-2" />
                Approve Selected ({selectedBadges.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!pendingBadges || pendingBadges.length === 0 ? (
            <div className="text-center py-12">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No badges pending approval</p>
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedBadges.size === pendingBadges.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Badge</TableHead>
                    <TableHead>Scenarios</TableHead>
                    <TableHead>Credentials</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingBadges.map((badge) => {
                    const certCheck = certificationChecks?.get(badge.enrollment_id);
                    const hasBlockingScenarios = certCheck && !certCheck.all_requirements_met;

                    return (
                      <TableRow key={badge.id} className={hasBlockingScenarios ? "opacity-70" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedBadges.has(badge.id)}
                            disabled={hasBlockingScenarios}
                            onCheckedChange={(checked) =>
                              handleSelectBadge(badge.id, badge.enrollment_id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {badge.profiles?.name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>{badge.client_enrollments?.programs?.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {badge.program_badges?.image_path ? (
                              <img
                                src={getPublicUrl(badge.program_badges.image_path)}
                                alt=""
                                className="w-8 h-8 object-contain"
                              />
                            ) : (
                              <Award className="h-8 w-8 text-primary" />
                            )}
                            {badge.program_badges?.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {certCheck ? (
                            hasBlockingScenarios ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="destructive" className="gap-1 cursor-help">
                                    <AlertTriangle className="h-3 w-3" />
                                    {certCheck.completed_count}/{certCheck.total_required}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-medium mb-1">Missing Required Scenarios:</p>
                                  <ul className="text-xs space-y-1">
                                    {certCheck.missing_scenarios.map((ms, i) => (
                                      <li key={i} className="flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        {ms.scenario_title} ({ms.module_title})
                                      </li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            ) : certCheck.total_required > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <Check className="h-3 w-3" />
                                {certCheck.completed_count}/{certCheck.total_required}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {badge.program_badges?.program_badge_credentials?.map((cred) => (
                              <Badge key={cred.id} variant="outline" className="text-xs">
                                {cred.service_display_name || cred.service_name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(badge.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue Badges</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <p className="text-muted-foreground">
              You are about to issue {selectedBadges.size} badge(s). Please provide the external
              credential URLs for each participant if applicable.
            </p>

            {selectedBadgesData.map((badge) => (
              <Card key={badge.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{badge.profiles?.name}</CardTitle>
                      <CardDescription>
                        {badge.client_enrollments?.programs?.name} - {badge.program_badges?.name}
                        {badge.program_badges?.renewal_period_months && (
                          <span className="block text-xs mt-1">
                            Badge will expire in {badge.program_badges.renewal_period_months} month{badge.program_badges.renewal_period_months !== 1 ? "s" : ""} from issuance
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                {badge.program_badges?.program_badge_credentials &&
                  badge.program_badges.program_badge_credentials.length > 0 && (
                    <CardContent className="space-y-3">
                      {badge.program_badges.program_badge_credentials.map((cred) => (
                        <div key={cred.id} className="space-y-1">
                          <Label
                            htmlFor={`url-${badge.id}-${cred.id}`}
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {cred.service_display_name || cred.service_name} URL
                          </Label>
                          <Input
                            id={`url-${badge.id}-${cred.id}`}
                            placeholder="https://..."
                            value={credentialUrls[badge.id]?.[cred.id] || ""}
                            onChange={(e) => updateCredentialUrl(badge.id, cred.id, e.target.value)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  )}
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => approveBadgesMutation.mutate(Array.from(selectedBadges))}
              disabled={approveBadgesMutation.isPending}
            >
              {approveBadgesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Issue {selectedBadges.size} Badge(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
