import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { toast } from "sonner";
import {
  ExternalLink,
  Award,
  Timer,
  RefreshCw,
  UserPlus,
  X,
  FolderOpen,
  Save,
  Coins,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { AdminTrackAssignment } from "@/components/admin/AdminTrackAssignment";
import { Input } from "@/components/ui/input";
import { useTalentLmsProgress } from "@/hooks/useTalentLmsProgress";
import { Progress } from "@/components/ui/progress";
import { ManualCompletionControls } from "@/components/admin/ManualCompletionControls";
import ClientGoalsSection from "@/components/admin/ClientGoalsSection";
import ClientStaffNotes from "@/components/admin/ClientStaffNotes";
import { ClientCreditAudit } from "@/components/admin/ClientCreditAudit";
import { EnrollmentModuleStaffManager } from "@/components/admin";
import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function ClientDetail() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { user: adminUser } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [instructors, setInstructors] = useState<{ id: string; name: string }[]>([]);
  const [availableCoaches, setAvailableCoaches] = useState<{ id: string; name: string }[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [availablePlans, setAvailablePlans] = useState<{ id: string; name: string; key: string }[]>(
    [],
  );
  const [programPlans, setProgramPlans] = useState<
    { id: string; name: string; tier_level: number }[]
  >([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [instructorDialogOpen, setInstructorDialogOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedTier, setSelectedTier] = useState("essentials");
  const [selectedProgramPlan, setSelectedProgramPlan] = useState("");
  const [adminDiscountPercent, setAdminDiscountPercent] = useState<string>("");
  const [tierCreditCost, setTierCreditCost] = useState<number | null>(null);
  const [selectedCohort, setSelectedCohort] = useState("");
  const [availableCohorts, setAvailableCohorts] = useState<
    { id: string; name: string; status: string; capacity: number | null; enrolled_count: number }[]
  >([]);
  const [isActive, setIsActive] = useState(true);
  const [expandedEnrollment, setExpandedEnrollment] = useState<string | null>(null);
  const [enrollmentModules, setEnrollmentModules] = useState<Record<string, any[]>>({});
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState("");
  const [googleDriveFolderName, setGoogleDriveFolderName] = useState("");
  const [googleDriveRecordId, setGoogleDriveRecordId] = useState<string | null>(null);
  const [savingGoogleDrive, setSavingGoogleDrive] = useState(false);
  const [statusMarker, setStatusMarker] = useState<string | null>(null);
  const [statusMarkers, setStatusMarkers] = useState<{ id: string; name: string }[]>([]);
  const [enrollmentProgress, setEnrollmentProgress] = useState<
    Record<string, { completed: number; inProgress: number; total: number }>
  >({});
  const { progress: talentLmsProgress, syncing, syncProgress, refetch } = useTalentLmsProgress(id);

  useEffect(() => {
    async function fetchData() {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, plans(id, name, key)")
        .eq("id", id)
        .single();
      const { data: clientProfile } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();
      const { data: enrollmentData } = await supabase
        .from("client_enrollments")
        .select("*, programs(*), program_plans(id, name, tier_level)")
        .eq("client_user_id", id);
      const { data: allPrograms } = await supabase
        .from("programs")
        .select("*, program_plans(id, name, tier_level)")
        .eq("is_active", true);
      const { data: plans } = await supabase
        .from("plans")
        .select("id, name, key")
        .eq("is_active", true);
      const { data: programPlansData } = await supabase
        .from("program_plans")
        .select("id, name, tier_level")
        .eq("is_active", true)
        .order("tier_level");
      setProgramPlans(programPlansData || []);

      // Fetch status markers
      const { data: markers } = await supabase
        .from("status_markers")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      setStatusMarkers(markers || []);

      // Fetch assigned coaches
      const { data: coachRelations } = await supabase
        .from("client_coaches")
        .select("coach_id")
        .eq("client_id", id);

      let coachList: { id: string; name: string }[] = [];
      if (coachRelations && coachRelations.length > 0) {
        const coachIds = coachRelations.map((c) => c.coach_id);
        const { data: coachProfiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", coachIds);
        coachList = coachProfiles || [];
      }

      // Fetch all users with coach role for available coaches
      const { data: coachRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach");

      if (coachRoles && coachRoles.length > 0) {
        const coachUserIds = coachRoles.map((c) => c.user_id);
        const { data: allCoachProfiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", coachUserIds);
        setAvailableCoaches(allCoachProfiles || []);
      }

      // Fetch assigned instructors
      const { data: instructorRelations } = await supabase
        .from("client_instructors")
        .select("instructor_id")
        .eq("client_id", id);

      let instructorList: { id: string; name: string }[] = [];
      if (instructorRelations && instructorRelations.length > 0) {
        const instructorIds = instructorRelations.map((i) => i.instructor_id);
        const { data: instructorProfiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", instructorIds);
        instructorList = instructorProfiles || [];
      }

      // Fetch all users with instructor role for available instructors
      const { data: instructorRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "instructor");

      if (instructorRoles && instructorRoles.length > 0) {
        const instructorUserIds = instructorRoles.map((i) => i.user_id);
        const { data: allInstructorProfiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", instructorUserIds);
        setAvailableInstructors(allInstructorProfiles || []);
      }

      // Use username from profiles (synced with email per project architecture)
      setUserEmail(profile?.username || null);

      // Fetch Google Drive folder for this client
      const { data: googleDriveData } = await supabase
        .from("google_drive_users")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();

      if (googleDriveData) {
        setGoogleDriveFolderUrl(googleDriveData.folder_url || "");
        setGoogleDriveFolderName(googleDriveData.folder_name || "");
        setGoogleDriveRecordId(googleDriveData.id);
      }

      setClient({ ...profile, ...clientProfile, status: clientProfile?.status || "active" });
      setEnrollments(enrollmentData || []);
      setPrograms(allPrograms || []);
      setCoaches(coachList);
      setInstructors(instructorList);
      setAvailablePlans(plans || []);
      setIsActive(clientProfile?.status === "active" || clientProfile === null);
      setStatusMarker(clientProfile?.status_marker || null);
    }
    fetchData();
  }, [id]);

  // Fetch tier credit cost when program or tier changes
  useEffect(() => {
    async function fetchTierCost() {
      if (!selectedProgram || !selectedTier) {
        setTierCreditCost(null);
        return;
      }
      const { data } = await supabase
        .from("program_tier_plans")
        .select("credit_cost")
        .eq("program_id", selectedProgram)
        // DB values are Title Case (e.g., "Premium"), while UI stores lowercase (e.g., "premium")
        // Use case-insensitive match to reliably fetch cost.
        .ilike("tier_name", selectedTier)
        .maybeSingle();
      setTierCreditCost(data?.credit_cost ?? null);
    }
    fetchTierCost();
  }, [selectedProgram, selectedTier]);

  // Fetch available cohorts when program changes
  useEffect(() => {
    async function fetchCohorts() {
      if (!selectedProgram) {
        setAvailableCohorts([]);
        setSelectedCohort("");
        return;
      }
      // Fetch cohorts for this program
      const { data: cohorts } = await supabase
        .from("program_cohorts")
        .select("id, name, status, capacity")
        .eq("program_id", selectedProgram)
        .in("status", ["upcoming", "active"])
        .order("start_date");

      if (!cohorts || cohorts.length === 0) {
        setAvailableCohorts([]);
        setSelectedCohort("");
        return;
      }

      // Count enrollments per cohort
      const { data: enrollmentData } = await supabase
        .from("client_enrollments")
        .select("cohort_id")
        .eq("program_id", selectedProgram)
        .not("cohort_id", "is", null);

      const countMap: Record<string, number> = {};
      enrollmentData?.forEach((e) => {
        if (e.cohort_id) {
          countMap[e.cohort_id] = (countMap[e.cohort_id] || 0) + 1;
        }
      });

      setAvailableCohorts(
        cohorts.map((c) => ({
          ...c,
          enrolled_count: countMap[c.id] || 0,
        })),
      );
      setSelectedCohort("");
    }
    fetchCohorts();
  }, [selectedProgram]);

  // Batch-fetch module progress for all enrollments (at-a-glance progress bars)
  useEffect(() => {
    async function fetchEnrollmentProgress() {
      if (enrollments.length === 0) {
        setEnrollmentProgress({});
        return;
      }

      const enrollmentIds = enrollments.map((e) => e.id);
      const programIds = [...new Set(enrollments.map((e) => e.program_id || e.programs?.id))].filter(Boolean);

      const [progressResult, modulesResult] = await Promise.all([
        supabase
          .from("module_progress")
          .select("enrollment_id, status")
          .in("enrollment_id", enrollmentIds),
        supabase
          .from("program_modules")
          .select("program_id, id")
          .in("program_id", programIds),
      ]);

      // Count modules per program
      const modulesPerProgram: Record<string, number> = {};
      (modulesResult.data || []).forEach((m) => {
        modulesPerProgram[m.program_id] = (modulesPerProgram[m.program_id] || 0) + 1;
      });

      // Aggregate progress per enrollment
      const progressMap: Record<string, { completed: number; inProgress: number }> = {};
      (progressResult.data || []).forEach((p) => {
        if (!progressMap[p.enrollment_id]) {
          progressMap[p.enrollment_id] = { completed: 0, inProgress: 0 };
        }
        if (p.status === "completed") progressMap[p.enrollment_id].completed++;
        else if (p.status === "in_progress") progressMap[p.enrollment_id].inProgress++;
      });

      // Build final map with totals
      const result: Record<string, { completed: number; inProgress: number; total: number }> = {};
      enrollments.forEach((e) => {
        const progId = e.program_id || e.programs?.id;
        const total = modulesPerProgram[progId] || 0;
        const prog = progressMap[e.id] || { completed: 0, inProgress: 0 };
        result[e.id] = { ...prog, total };
      });

      setEnrollmentProgress(result);
    }
    fetchEnrollmentProgress();
  }, [enrollments]);

  async function assignCoach() {
    if (!selectedCoach) return;

    const { error } = await supabase.from("client_coaches").insert({
      client_id: id,
      coach_id: selectedCoach,
    });

    if (error) {
      toast.error("Failed to assign coach");
    } else {
      toast.success("Coach assigned!");
      setCoachDialogOpen(false);
      setSelectedCoach("");
      // Refresh coaches list
      const { data: coachRelations } = await supabase
        .from("client_coaches")
        .select("coach_id")
        .eq("client_id", id);
      if (coachRelations && coachRelations.length > 0) {
        const coachIds = coachRelations.map((c) => c.coach_id);
        const { data: coachProfiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", coachIds);
        setCoaches(coachProfiles || []);
      }
    }
  }

  async function removeCoach(coachId: string) {
    const { error } = await supabase
      .from("client_coaches")
      .delete()
      .eq("client_id", id)
      .eq("coach_id", coachId);

    if (error) {
      toast.error("Failed to remove coach");
    } else {
      toast.success("Coach removed");
      setCoaches(coaches.filter((c) => c.id !== coachId));
    }
  }

  async function assignInstructor() {
    if (!selectedInstructor) return;

    const { error } = await supabase.from("client_instructors").insert({
      client_id: id,
      instructor_id: selectedInstructor,
    });

    if (error) {
      toast.error("Failed to assign instructor");
    } else {
      toast.success("Instructor assigned!");
      setInstructorDialogOpen(false);
      setSelectedInstructor("");
      // Refresh instructors list
      const { data: instructorRelations } = await supabase
        .from("client_instructors")
        .select("instructor_id")
        .eq("client_id", id);
      if (instructorRelations && instructorRelations.length > 0) {
        const instructorIds = instructorRelations.map((i) => i.instructor_id);
        const { data: instructorProfiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", instructorIds);
        setInstructors(instructorProfiles || []);
      }
    }
  }

  async function removeInstructor(instructorId: string) {
    const { error } = await supabase
      .from("client_instructors")
      .delete()
      .eq("client_id", id)
      .eq("instructor_id", instructorId);

    if (error) {
      toast.error("Failed to remove instructor");
    } else {
      toast.success("Instructor removed");
      setInstructors(instructors.filter((i) => i.id !== instructorId));
    }
  }

  async function updateClientPlan(planId: string | null) {
    const { error } = await supabase.from("profiles").update({ plan_id: planId }).eq("id", id);

    if (error) {
      toast.error("Failed to update plan");
    } else {
      toast.success("Plan updated!");
      // Refresh client data
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, plans(id, name, key)")
        .eq("id", id)
        .single();
      if (profile) {
        setClient((prev: any) => ({ ...prev, ...profile }));
      }
    }
  }

  async function assignProgram() {
    if (!selectedProgram || !id) return;

    // Get the program's default program plan if none selected
    const program = programs.find((p) => p.id === selectedProgram);
    const programPlanId = selectedProgramPlan || program?.default_program_plan_id || null;

    // Parse admin discount
    const discountPercent = adminDiscountPercent ? parseFloat(adminDiscountPercent) : null;
    const validDiscount =
      discountPercent && discountPercent > 0 && discountPercent <= 100 ? discountPercent : null;

    // Fetch tier credit cost with case-insensitive match
    const { data: tierPlanData, error: tierError } = await supabase
      .from("program_tier_plans")
      .select("credit_cost, program_plan_id")
      .eq("program_id", selectedProgram)
      // Case-insensitive to match DB values like "Premium" / "Essentials"
      .ilike("tier_name", selectedTier)
      .maybeSingle();

    if (tierError) {
      console.error("Error fetching tier plan data:", tierError);
    }

    // Use tier plan's program_plan_id first, then fallback to selected or default
    const finalProgramPlanId = tierPlanData?.program_plan_id || programPlanId;

    const originalCreditCost = tierPlanData?.credit_cost ?? null;
    let finalCreditCost = originalCreditCost;

    // Apply admin discount if present
    if (validDiscount && originalCreditCost !== null && originalCreditCost > 0) {
      finalCreditCost = Math.round(originalCreditCost * (1 - validDiscount / 100));
    }

    // Atomic enrollment + credit consumption (C3 fix: both succeed or both fail)
    const { data: enrollResult, error: enrollError } = await supabase.rpc(
      "enroll_with_credits",
      {
        p_client_user_id: id,
        p_program_id: selectedProgram,
        p_tier: selectedTier,
        p_program_plan_id: finalProgramPlanId,
        p_discount_percent: validDiscount,
        p_original_credit_cost: originalCreditCost,
        p_final_credit_cost: finalCreditCost,
        p_description: `Enrolled in ${program?.name} (${selectedTier}) by admin`,
        p_cohort_id: selectedCohort || null,
        p_force: true,
        p_enrollment_source: "admin",
        p_referred_by: adminUser?.id || null,
        p_referral_note: "Enrolled by admin",
      },
    );

    if (enrollError) {
      console.error("Enrollment error:", enrollError);
      toast.error(`Failed to enroll: ${enrollError.message}`);
      return;
    }

    const result = enrollResult as {
      success: boolean;
      error?: string;
      enrollment_id?: string;
      credit_details?: Record<string, unknown>;
    } | null;

    if (!result?.success) {
      toast.error(result?.error || "Failed to enroll client");
      return;
    }

    const creditMsg = finalCreditCost ? ` (${finalCreditCost} credits consumed)` : "";
    toast.success(`Program assigned!${creditMsg}`);
    setOpen(false);
    setAdminDiscountPercent("");
    setSelectedCohort("");
    window.location.reload();
  }

  async function toggleUserStatus(active: boolean) {
    const newStatus = active ? "active" : "inactive";
    const { error } = await supabase
      .from("client_profiles")
      .update({ status: newStatus })
      .eq("user_id", id);

    if (error) {
      toast.error("Failed to update user status");
      setIsActive(!active);
    } else {
      toast.success(`User ${active ? "activated" : "deactivated"}`);
      setIsActive(active);
      setClient({ ...client, status: newStatus });
    }
  }

  async function loadEnrollmentModules(
    enrollmentId: string,
    programId: string,
    forceRefresh: boolean = false,
  ) {
    if (enrollmentModules[enrollmentId] && !forceRefresh) {
      setExpandedEnrollment(expandedEnrollment === enrollmentId ? null : enrollmentId);
      return;
    }

    const { data: modules } = await supabase
      .from("program_modules")
      .select("*, links")
      .eq("program_id", programId)
      .order("order_index");

    if (modules) {
      // Single query for all module progress (replaces N+1 per-module queries)
      const { data: allProgress } = await supabase
        .from("module_progress")
        .select("*")
        .eq("enrollment_id", enrollmentId)
        .in(
          "module_id",
          modules.map((m) => m.id),
        );

      const progressByModule = new Map(
        (allProgress || []).map((p) => [p.module_id, p]),
      );

      const modulesWithProgress = modules.map((module) => ({
        ...module,
        progress: progressByModule.get(module.id) || null,
      }));

      setEnrollmentModules((prev) => ({ ...prev, [enrollmentId]: modulesWithProgress }));
      setExpandedEnrollment(enrollmentId);
    }
  }

  const getTalentLmsCourseId = (module: any): string | null => {
    const links = (module.links as any[]) || [];
    const talentLmsLink = links.find((link: any) => link.type === "talentlms");
    if (!talentLmsLink) return null;

    const match = talentLmsLink.url.match(/id:(\d+)/);
    return match ? match[1] : null;
  };

  const getModuleTalentLmsProgress = (module: any) => {
    const courseId = getTalentLmsCourseId(module);
    if (!courseId) return null;

    return talentLmsProgress.find((p) => p.talentlms_course_id === courseId);
  };

  async function handleSyncProgress() {
    await refetch(id);
    toast.success("TalentLMS progress refreshed");
  }

  async function updateEnrollmentTier(
    enrollmentId: string,
    newTier: string,
    oldTier: string,
    programId: string,
    programName: string,
  ) {
    // Get modules that will be newly unlocked with this tier
    const { data: modulesData } = await supabase
      .from("program_modules")
      .select("title, tier_required")
      .eq("program_id", programId)
      .eq("tier_required", newTier);

    const unlockedModules = modulesData?.map((m) => m.title) || [];

    const { error } = await supabase
      .from("client_enrollments")
      .update({ tier: newTier })
      .eq("id", enrollmentId);

    if (error) {
      toast.error("Failed to update tier");
      return;
    }

    toast.success(`Tier updated to ${newTier}`);

    // Check notification preferences and disabled status before sending email
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("program_assignments")
      .eq("user_id", id)
      .single();

    const shouldNotify = prefs?.program_assignments !== false;

    // Send tier change notification email if enabled and user is not disabled
    if (shouldNotify && client?.email && isActive) {
      try {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            email: client.email,
            name: client.name,
            type: "tier_change",
            timestamp: new Date().toISOString(),
            programName,
            oldTier,
            newTier,
            unlockedModules,
          },
        });
      } catch (emailError) {
        console.error("Failed to send tier change email:", emailError);
      }
    }

    // Refresh enrollments
    const { data: enrollmentData } = await supabase
      .from("client_enrollments")
      .select("*, programs(*), program_plans(id, name, tier_level)")
      .eq("client_user_id", id);
    setEnrollments(enrollmentData || []);
  }

  async function toggleEnrollmentStatus(
    enrollmentId: string,
    currentStatus: string,
    programName: string,
  ) {
    const newStatus = currentStatus === "active" ? "paused" : "active";

    const { error } = await supabase
      .from("client_enrollments")
      .update({ status: newStatus })
      .eq("id", enrollmentId);

    if (error) {
      toast.error("Failed to update enrollment status");
      return;
    }

    toast.success(`${programName} enrollment ${newStatus === "paused" ? "paused" : "resumed"}`);

    // Refresh enrollments
    const { data: enrollmentData } = await supabase
      .from("client_enrollments")
      .select("*, programs(*), program_plans(id, name, tier_level)")
      .eq("client_user_id", id);
    setEnrollments(enrollmentData || []);
  }

  if (!client) return <PageLoadingState />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{client.name}</h1>
        {userEmail && <p className="text-muted-foreground mt-1">{userEmail}</p>}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Client Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="user-status">Account Status</Label>
                <p className="text-sm text-muted-foreground">
                  {isActive ? "User can access the platform" : "User access is disabled"}
                </p>
              </div>
              <Switch id="user-status" checked={isActive} onCheckedChange={toggleUserStatus} />
            </div>
            <div className="pt-2 border-t space-y-4">
              <p>
                <strong>Current Status:</strong>{" "}
                <Badge variant={isActive ? "default" : "secondary"}>
                  {client.status || "active"}
                </Badge>
              </p>

              {/* Status Marker */}
              <div className="flex items-center gap-4">
                <Label className="font-semibold min-w-20">Status Marker:</Label>
                <Select
                  value={statusMarker || "none"}
                  onValueChange={async (value) => {
                    const newValue = value === "none" ? null : value;
                    const { error } = await supabase
                      .from("client_profiles")
                      .update({ status_marker: newValue })
                      .eq("user_id", id);

                    if (error) {
                      toast.error("Failed to update status marker");
                    } else {
                      setStatusMarker(newValue);
                      toast.success("Status marker updated!");
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select status marker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {statusMarkers.map((marker) => (
                      <SelectItem key={marker.id} value={marker.name}>
                        {marker.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusMarker && <Badge variant="secondary">{statusMarker}</Badge>}
              </div>

              {/* Subscription Plan Selection */}
              <div className="flex items-center gap-4">
                <Label className="font-semibold min-w-20">Subscription Plan:</Label>
                <Select
                  value={client.plan_id || "none"}
                  onValueChange={(value) => updateClientPlan(value === "none" ? null : value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="No plan assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No plan</SelectItem>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {client.plans && <Badge variant="secondary">{client.plans.key}</Badge>}
              </div>

              {/* Program Plans Info */}
              <div className="flex items-center gap-4">
                <Label className="font-semibold min-w-20">Program Plans:</Label>
                <span className="text-sm text-muted-foreground">
                  Set per enrollment (see Enrollments tab)
                </span>
              </div>

              {/* Coach Assignment */}
              <div className="flex items-center gap-4">
                <Label className="font-semibold min-w-20">Coach(es):</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {coaches.length > 0 ? (
                    coaches.map((coach) => (
                      <Badge key={coach.id} variant="outline" className="flex items-center gap-1">
                        {coach.name}
                        <button
                          onClick={() => removeCoach(coach.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">None assigned</span>
                  )}
                  <Dialog open={coachDialogOpen} onOpenChange={setCoachDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <UserPlus className="h-4 w-4 mr-1" />
                        Assign Coach
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign Coach</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Select Coach</Label>
                          <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a coach" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCoaches
                                .filter((c) => !coaches.find((assigned) => assigned.id === c.id))
                                .map((coach) => (
                                  <SelectItem key={coach.id} value={coach.id}>
                                    {coach.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={assignCoach} disabled={!selectedCoach}>
                          Assign
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Instructor Assignment */}
              <div className="flex items-center gap-4">
                <Label className="font-semibold min-w-20">Instructor(s):</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {instructors.length > 0 ? (
                    instructors.map((instructor) => (
                      <Badge
                        key={instructor.id}
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        {instructor.name}
                        <button
                          onClick={() => removeInstructor(instructor.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">None assigned</span>
                  )}
                  <Dialog open={instructorDialogOpen} onOpenChange={setInstructorDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <UserPlus className="h-4 w-4 mr-1" />
                        Assign Instructor
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign Instructor</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Select Instructor</Label>
                          <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an instructor" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableInstructors
                                .filter(
                                  (i) => !instructors.find((assigned) => assigned.id === i.id),
                                )
                                .map((instructor) => (
                                  <SelectItem key={instructor.id} value={instructor.id}>
                                    {instructor.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={assignInstructor} disabled={!selectedInstructor}>
                          Assign
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Track Assignment */}
              {id && <AdminTrackAssignment userId={id} />}

              {/* Google Drive Folder Assignment */}
              <div className="flex items-start gap-4 pt-2 border-t">
                <Label className="font-semibold min-w-20 pt-2">Google Drive:</Label>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Folder URL (e.g., https://drive.google.com/drive/folders/...)"
                      value={googleDriveFolderUrl}
                      onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                      className="flex-1"
                    />
                    {googleDriveFolderUrl && (
                      <Button variant="outline" size="icon" asChild>
                        <a href={googleDriveFolderUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Folder name (optional, for display)"
                      value={googleDriveFolderName}
                      onChange={(e) => setGoogleDriveFolderName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="default"
                      size="sm"
                      disabled={savingGoogleDrive || !googleDriveFolderUrl}
                      onClick={async () => {
                        setSavingGoogleDrive(true);
                        try {
                          if (googleDriveRecordId) {
                            // Update existing
                            const { error } = await supabase
                              .from("google_drive_users")
                              .update({
                                folder_url: googleDriveFolderUrl,
                                folder_name: googleDriveFolderName || null,
                              })
                              .eq("id", googleDriveRecordId);
                            if (error) throw error;
                          } else {
                            // Insert new
                            const { data, error } = await supabase
                              .from("google_drive_users")
                              .insert({
                                user_id: id,
                                folder_url: googleDriveFolderUrl,
                                folder_name: googleDriveFolderName || null,
                              })
                              .select()
                              .single();
                            if (error) throw error;
                            setGoogleDriveRecordId(data.id);
                          }
                          toast.success("Google Drive folder saved");
                        } catch (err) {
                          toast.error("Failed to save Google Drive folder");
                        } finally {
                          setSavingGoogleDrive(false);
                        }
                      }}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              <p>
                <strong>Notes:</strong> {client.notes || "No notes"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
        <h2 className="text-2xl font-bold">Programs</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={handleSyncProgress}
            variant="outline"
            size="sm"
            disabled={syncing}
            className="w-full sm:w-auto"
          >
            {syncing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Sync Academy
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">Assign Program</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Program</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Program</Label>
                  <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subscription Tier</Label>
                  <Select value={selectedTier} onValueChange={setSelectedTier}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        (programs.find((p) => p.id === selectedProgram)?.tiers as string[]) || [
                          "Essentials",
                          "Premium",
                        ]
                      ).map((tier) => (
                        <SelectItem key={tier} value={tier.toLowerCase()}>
                          {tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the subscription tier for this client's enrollment.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Program Plan (Feature Access)</Label>
                  <Select
                    value={selectedProgramPlan || "default"}
                    onValueChange={(val) => setSelectedProgramPlan(val === "default" ? "" : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Use program default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Use program default</SelectItem>
                      {programPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} (Tier {plan.tier_level})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Determines which features are available based on this enrollment.
                  </p>
                </div>

                {/* Cohort Assignment (only shown when program has cohorts) */}
                {availableCohorts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Cohort (optional)</Label>
                    <Select
                      value={selectedCohort || "none"}
                      onValueChange={(v) => setSelectedCohort(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No cohort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No cohort</SelectItem>
                        {availableCohorts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.status})
                            {c.capacity ? ` — ${c.enrolled_count}/${c.capacity}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Assign this client to a specific cohort for scheduled live sessions.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Admin Discount (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={adminDiscountPercent}
                    onChange={(e) => setAdminDiscountPercent(e.target.value)}
                    placeholder="e.g., 10 for 10% off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional discount to apply to this enrollment (0-100%).
                  </p>
                </div>

                {/* Credit Cost Preview */}
                {tierCreditCost !== null && tierCreditCost > 0 && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Coins className="h-4 w-4 text-primary" />
                      Credit Cost Preview
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base cost:</span>
                        <span>{tierCreditCost.toLocaleString()} credits</span>
                      </div>
                      {adminDiscountPercent && parseFloat(adminDiscountPercent) > 0 && (
                        <>
                          <div className="flex justify-between text-success">
                            <span>Discount ({adminDiscountPercent}%):</span>
                            <span>
                              -
                              {Math.round(
                                (tierCreditCost * parseFloat(adminDiscountPercent)) / 100,
                              ).toLocaleString()}{" "}
                              credits
                            </span>
                          </div>
                          <div className="flex justify-between font-medium border-t pt-1">
                            <span>Final cost:</span>
                            <span className="text-primary">
                              {Math.round(
                                tierCreditCost * (1 - parseFloat(adminDiscountPercent) / 100),
                              ).toLocaleString()}{" "}
                              credits
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3" />
                      Credits will be deducted from client's balance
                    </div>
                  </div>
                )}

                {tierCreditCost === null && selectedProgram && (
                  <p className="text-xs text-muted-foreground italic">
                    No credit cost configured for this tier — enrollment will be free.
                  </p>
                )}

                <Button onClick={assignProgram}>Assign</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {enrollments.length > 0 ? (
        <div className="grid gap-4">
          {enrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="break-words">{enrollment.programs?.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Status:{" "}
                      <Badge variant={enrollment.status === "active" ? "default" : "secondary"}>
                        {enrollment.status}
                      </Badge>
                    </CardDescription>
                    {enrollmentProgress[enrollment.id] && enrollmentProgress[enrollment.id].total > 0 && (
                      <div className="mt-2 flex items-center gap-3">
                        <Progress
                          value={Math.round(
                            (enrollmentProgress[enrollment.id].completed /
                              enrollmentProgress[enrollment.id].total) *
                              100,
                          )}
                          className="h-2 flex-1 max-w-[200px]"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {enrollmentProgress[enrollment.id].completed} of{" "}
                          {enrollmentProgress[enrollment.id].total} modules completed
                        </span>
                        {enrollmentProgress[enrollment.id].inProgress > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {enrollmentProgress[enrollment.id].inProgress} in progress
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">
                        Tier:
                      </Label>
                      <Select
                        value={enrollment.tier}
                        onValueChange={(value) =>
                          updateEnrollmentTier(
                            enrollment.id,
                            value,
                            enrollment.tier || "essentials",
                            enrollment.programs?.id || "",
                            enrollment.programs?.name || "",
                          )
                        }
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            (enrollment.programs?.tiers as string[]) || ["Essentials", "Premium"]
                          ).map((tier) => (
                            <SelectItem key={tier} value={tier.toLowerCase()}>
                              {tier}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {enrollment.status !== "completed" && (
                      <ManualCompletionControls
                        enrollmentId={enrollment.id}
                        type="enrollment"
                        onSuccess={() => window.location.reload()}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4 space-y-1">
                  <p>Started: {new Date(enrollment.start_date).toLocaleDateString()}</p>
                  {enrollment.status === "completed" && enrollment.completed_at && (
                    <p>
                      Completed: {new Date(enrollment.completed_at).toLocaleDateString()}
                      {" · "}
                      <span className="text-xs">
                        Alumni access expires:{" "}
                        {new Date(
                          new Date(enrollment.completed_at).getTime() + 90 * 24 * 60 * 60 * 1000,
                        ).toLocaleDateString()}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => loadEnrollmentModules(enrollment.id, enrollment.programs.id)}
                    variant="outline"
                    size="sm"
                  >
                    {expandedEnrollment === enrollment.id ? "Hide Modules" : "View Modules"}
                  </Button>

                  {enrollment.status !== "completed" && (
                    <Button
                      onClick={() =>
                        toggleEnrollmentStatus(
                          enrollment.id,
                          enrollment.status,
                          enrollment.programs?.name || "Program",
                        )
                      }
                      variant={enrollment.status === "active" ? "outline" : "default"}
                      size="sm"
                      className={
                        enrollment.status === "paused" ? "bg-green-600 hover:bg-green-700" : ""
                      }
                    >
                      {enrollment.status === "active" ? (
                        <>
                          <PauseCircle className="h-4 w-4 mr-1" />
                          Pause Access
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Resume Access
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {expandedEnrollment === enrollment.id && enrollmentModules[enrollment.id] && (
                  <div className="mt-4 space-y-4">
                    {/* Per-enrollment staff assignments for personalized modules */}
                    <EnrollmentModuleStaffManager
                      enrollmentId={enrollment.id}
                      programId={enrollment.programs?.id || enrollment.program_id}
                      clientName={client?.name || "Client"}
                    />

                    {enrollmentModules[enrollment.id].map((module: any) => {
                      const tlmsProgress = getModuleTalentLmsProgress(module);
                      const hasTalentLms = getTalentLmsCourseId(module) !== null;

                      return (
                        <div key={module.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{module.title}</h4>
                                <Badge variant="outline">{module.module_type}</Badge>
                                {module.tier_required === "premium" && (
                                  <Badge variant="secondary">Premium Only</Badge>
                                )}
                              </div>
                              <RichTextDisplay
                                content={module.description ?? ""}
                                className="text-sm text-muted-foreground mt-1"
                              />
                              {module.progress?.status === "completed" && (
                                <Badge variant="default" className="mt-2">
                                  Completed
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  module.progress?.status === "completed"
                                    ? "default"
                                    : module.progress?.status === "in_progress"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {module.progress?.status || "not_started"}
                              </Badge>
                              <ManualCompletionControls
                                moduleProgressId={module.progress?.id}
                                enrollmentId={enrollment.id}
                                moduleId={module.id}
                                type="module"
                                isCompleted={module.progress?.status === "completed"}
                                onSuccess={() => {
                                  loadEnrollmentModules(
                                    enrollment.id,
                                    enrollment.programs.id,
                                    true,
                                  );
                                }}
                              />
                            </div>
                          </div>

                          {hasTalentLms && tlmsProgress && (
                            <div className="mt-3 rounded-lg border bg-muted/50 p-3 space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <ExternalLink className="h-4 w-4" />
                                TalentLMS Progress
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Completion:</span>
                                  <div className="font-medium">
                                    {tlmsProgress.completion_status.replace("_", " ")}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Progress:</span>
                                  <div className="font-medium">
                                    {tlmsProgress.progress_percentage}%
                                  </div>
                                </div>
                                {tlmsProgress.time_spent_minutes > 0 && (
                                  <div>
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <Timer className="h-3 w-3" />
                                      Time:
                                    </span>
                                    <div className="font-medium">
                                      {Math.floor(tlmsProgress.time_spent_minutes / 60)}h{" "}
                                      {tlmsProgress.time_spent_minutes % 60}m
                                    </div>
                                  </div>
                                )}
                                {tlmsProgress.test_score !== null && (
                                  <div>
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <Award className="h-3 w-3" />
                                      Score:
                                    </span>
                                    <div className="font-medium">{tlmsProgress.test_score}%</div>
                                  </div>
                                )}
                              </div>
                              {tlmsProgress.completed_at && (
                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                  Completed:{" "}
                                  {new Date(tlmsProgress.completed_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No programs assigned yet
          </CardContent>
        </Card>
      )}

      <ClientCreditAudit userId={id} />

      <ClientGoalsSection clientId={id} />

      <div className="mt-6">
        <ClientStaffNotes clientUserId={id} isAdmin={true} />
      </div>
    </div>
  );
}
