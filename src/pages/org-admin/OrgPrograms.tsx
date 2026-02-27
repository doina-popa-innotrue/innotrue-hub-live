import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Users, UserPlus, GraduationCap, Coins, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOrgCreditBatches, formatCredits } from "@/hooks/useCreditBatches";

interface Program {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  is_active: boolean;
  enrolledCount: number;
  maxEnrollments?: number | null;
  credit_cost?: number | null;
}

interface OrgMember {
  id: string;
  user_id: string;
  name: string | null;
  isEnrolled: boolean;
}

export default function OrgPrograms() {
  const { organizationMembership, user } = useAuth();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const { summary: creditSummary, refetch: refetchCredits } = useOrgCreditBatches(
    organizationMembership?.organization_id,
  );

  useEffect(() => {
    if (organizationMembership?.organization_id) {
      loadPrograms();
    }
  }, [organizationMembership?.organization_id]);

  const loadPrograms = async () => {
    if (!organizationMembership?.organization_id) return;

    try {
      setLoading(true);

      // Get organization member user IDs
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationMembership.organization_id)
        .eq("is_active", true);

      const memberUserIds = members?.map((m) => m.user_id) || [];

      // Fetch licensed programs for this organization
      const { data: licensedPrograms, error: licenseError } = await supabase
        .from("organization_programs")
        .select(
          `
          id,
          program_id,
          max_enrollments,
          expires_at,
          programs!inner (
            id,
            name,
            slug,
            description,
            category,
            is_active,
            is_published,
            credit_cost
          )
        `,
        )
        .eq("organization_id", organizationMembership.organization_id)
        .eq("is_active", true);

      if (licenseError) throw licenseError;

      // Filter out expired licenses and inactive programs
      const now = new Date();
      const validLicenses = (licensedPrograms || []).filter((lp) => {
        const program = lp.programs as any;
        const isExpired = lp.expires_at && new Date(lp.expires_at) < now;
        return program?.is_active && program?.is_published && !isExpired;
      });

      // For each program, count enrolled org members
      const programsWithCounts = await Promise.all(
        validLicenses.map(async (license) => {
          const program = license.programs as any;

          let enrolledCount = 0;
          if (memberUserIds.length > 0) {
            const { count } = await supabase
              .from("client_enrollments")
              .select("*", { count: "exact", head: true })
              .eq("program_id", program.id)
              .in("client_user_id", memberUserIds)
              .in("status", ["active", "completed"]);
            enrolledCount = count || 0;
          }

          return {
            ...program,
            enrolledCount,
            maxEnrollments: license.max_enrollments,
            credit_cost: program.credit_cost,
          };
        }),
      );

      setPrograms(programsWithCounts);
    } catch (error) {
      console.error("Error loading programs:", error);
      toast({
        title: "Error",
        description: "Failed to load programs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMembersForEnrollment = async (programId: string) => {
    if (!organizationMembership?.organization_id) return;

    setLoadingMembers(true);
    try {
      // Get org members with their profile names
      const { data: members } = await supabase
        .from("organization_members")
        .select("id, user_id")
        .eq("organization_id", organizationMembership.organization_id)
        .eq("is_active", true);

      if (!members || members.length === 0) {
        setOrgMembers([]);
        return;
      }

      const memberUserIds = members.map((m) => m.user_id);

      // Get profiles for these members
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", memberUserIds);

      // Check existing enrollments for this program
      const { data: enrollments } = await supabase
        .from("client_enrollments")
        .select("client_user_id")
        .eq("program_id", programId)
        .in("client_user_id", memberUserIds)
        .in("status", ["active", "completed"]);

      const enrolledUserIds = new Set(enrollments?.map((e) => e.client_user_id) || []);

      const membersWithEnrollment = members.map((member) => ({
        id: member.id,
        user_id: member.user_id,
        name: profiles?.find((p) => p.id === member.user_id)?.name || null,
        isEnrolled: enrolledUserIds.has(member.user_id),
      }));

      setOrgMembers(membersWithEnrollment);
      // Pre-select unenrolled members
      setSelectedMembers(membersWithEnrollment.filter((m) => !m.isEnrolled).map((m) => m.user_id));
    } catch (error) {
      console.error("Error loading members:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleOpenEnrollDialog = async (program: Program) => {
    setSelectedProgram(program);
    setEnrollDialogOpen(true);
    await loadMembersForEnrollment(program.id);
  };

  const handleBulkEnroll = async () => {
    if (
      !selectedProgram ||
      selectedMembers.length === 0 ||
      !organizationMembership?.organization_id ||
      !user
    )
      return;

    setEnrolling(true);
    try {
      // Use the credit consumption RPC for enrollment
      const { data, error } = await supabase.rpc("consume_enrollment_credits", {
        p_organization_id: organizationMembership.organization_id,
        p_program_id: selectedProgram.id,
        p_user_ids: selectedMembers,
        p_enrolled_by: user.id,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        credits_consumed?: number;
        enrolled_count?: number;
        free_enrollment?: boolean;
        required?: number;
        available?: number;
      };

      if (!result.success) {
        if (result.error === "insufficient_credits") {
          toast({
            title: "Insufficient Credits",
            description: `This enrollment requires ${result.required} credits, but you only have ${result.available} available.`,
            variant: "destructive",
          });
        } else {
          throw new Error(result.error || "Enrollment failed");
        }
        return;
      }

      const message = result.free_enrollment
        ? `Successfully enrolled ${result.enrolled_count} member(s) in ${selectedProgram.name}`
        : `Enrolled ${result.enrolled_count} member(s) using ${result.credits_consumed} credits`;

      toast({
        title: "Members Enrolled",
        description: message,
      });

      setEnrollDialogOpen(false);
      setSelectedProgram(null);
      setSelectedMembers([]);
      loadPrograms();
      refetchCredits();
    } catch (error) {
      console.error("Error enrolling members:", error);
      toast({
        title: "Error",
        description: "Failed to enroll members",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const toggleMemberSelection = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const selectAllUnenrolled = () => {
    setSelectedMembers(orgMembers.filter((m) => !m.isEnrolled).map((m) => m.user_id));
  };

  const deselectAll = () => {
    setSelectedMembers([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Programs</h1>
        <p className="text-muted-foreground">
          View available programs and enroll your team members
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading programs...</div>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-2">No programs available</p>
            <p className="text-sm">
              Your organization doesn't have access to any programs yet. Contact your platform
              administrator to get programs licensed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {program.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{program.enrolledCount}</span>
                  </div>
                </div>
                {program.description && (
                  <CardDescription className="line-clamp-2">{program.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOpenEnrollDialog(program)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Enroll Members
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Enroll Members in {selectedProgram?.name}
            </DialogTitle>
            <DialogDescription>Select team members to enroll in this program</DialogDescription>
          </DialogHeader>

          {/* Credit Cost Info */}
          {selectedProgram?.credit_cost && selectedProgram.credit_cost > 0 && (
            <Alert>
              <Coins className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Cost: <strong>{selectedProgram.credit_cost} credits</strong> per member
                </span>
                <span className="text-muted-foreground">
                  Available: {formatCredits(creditSummary?.total_available ?? 0)}
                </span>
              </AlertDescription>
            </Alert>
          )}

          {selectedProgram?.credit_cost && selectedMembers.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Total cost:{" "}
              <strong>
                {formatCredits(selectedProgram.credit_cost * selectedMembers.length)} credits
              </strong>
              {(creditSummary?.total_available ?? 0) <
                selectedProgram.credit_cost * selectedMembers.length && (
                <span className="text-destructive ml-2">(Insufficient credits)</span>
              )}
            </div>
          )}

          {loadingMembers ? (
            <div className="py-8 text-center text-muted-foreground">Loading members...</div>
          ) : orgMembers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No members in your organization yet.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-muted-foreground">
                  {selectedMembers.length} selected
                </Label>
                <div className="space-x-2">
                  <Button variant="ghost" size="sm" onClick={selectAllUnenrolled}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    Clear
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-1">
                  {orgMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-2 rounded-md ${
                        member.isEnrolled ? "bg-muted/50" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedMembers.includes(member.user_id)}
                          onCheckedChange={() => toggleMemberSelection(member.user_id)}
                          disabled={member.isEnrolled}
                        />
                        <span className={member.isEnrolled ? "text-muted-foreground" : ""}>
                          {member.name || "Unknown User"}
                        </span>
                      </div>
                      {member.isEnrolled && (
                        <Badge variant="outline" className="text-xs">
                          Already Enrolled
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEnroll} disabled={enrolling || selectedMembers.length === 0}>
              {enrolling ? "Enrolling..." : `Enroll ${selectedMembers.length} Member(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
