import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, User, Users, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "instructor" | "coach";
  is_primary?: boolean;
}

interface ModuleTeam {
  moduleId: string;
  moduleTitle: string;
  instructors: TeamMember[];
  coaches: TeamMember[];
}

interface ProgramTeamContactProps {
  programId: string;
  modules?: { id: string; title: string }[];
  showModuleTeams?: boolean;
}

export function ProgramTeamContact({
  programId,
  modules = [],
  showModuleTeams = false,
}: ProgramTeamContactProps) {
  const [loading, setLoading] = useState(true);
  const [programInstructors, setProgramInstructors] = useState<TeamMember[]>([]);
  const [programCoaches, setProgramCoaches] = useState<TeamMember[]>([]);
  const [moduleTeams, setModuleTeams] = useState<ModuleTeam[]>([]);
  const [adminContact, setAdminContact] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    async function fetchTeamData() {
      setLoading(true);

      // Fetch program instructors (IDs only)
      const { data: instructorsData } = await supabase
        .from("program_instructors")
        .select("instructor_id, is_primary")
        .eq("program_id", programId);

      // Fetch program coaches (IDs only)
      const { data: coachesData } = await supabase
        .from("program_coaches")
        .select("coach_id")
        .eq("program_id", programId);

      const instructorIds = instructorsData?.map((i) => i.instructor_id) || [];
      const coachIds = coachesData?.map((c) => c.coach_id) || [];

      // Collect all IDs for profile lookup
      let allStaffIds = [...new Set([...instructorIds, ...coachIds])];

      // Fetch module-specific teams if requested
      let moduleInstructorsData: any[] = [];
      let moduleCoachesData: any[] = [];

      if (showModuleTeams && modules.length > 0) {
        const moduleIds = modules.map((m) => m.id);

        const [miResult, mcResult] = await Promise.all([
          supabase
            .from("module_instructors")
            .select("module_id, instructor_id")
            .in("module_id", moduleIds),
          supabase.from("module_coaches").select("module_id, coach_id").in("module_id", moduleIds),
        ]);

        moduleInstructorsData = miResult.data || [];
        moduleCoachesData = mcResult.data || [];

        // Add module staff IDs
        allStaffIds = [
          ...new Set([
            ...allStaffIds,
            ...moduleInstructorsData.map((mi) => mi.instructor_id),
            ...moduleCoachesData.map((mc) => mc.coach_id),
          ]),
        ];
      }

      // Fetch admin for fallback contact
      const { data: adminData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .single();

      if (adminData) {
        allStaffIds = [...new Set([...allStaffIds, adminData.user_id])];
      }

      // Fetch all profiles at once
      let profilesMap: Record<string, { name: string; avatar_url: string | null }> = {};

      if (allStaffIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .in("id", allStaffIds);

        profilesMap = (profiles || []).reduce(
          (acc, p) => {
            acc[p.id] = { name: p.name || "Unknown", avatar_url: p.avatar_url };
            return acc;
          },
          {} as Record<string, { name: string; avatar_url: string | null }>,
        );
      }

      // Map instructors
      const instructors: TeamMember[] = (instructorsData || []).map((i) => ({
        id: i.instructor_id,
        name: profilesMap[i.instructor_id]?.name || "Instructor",
        email: "",
        avatar_url: profilesMap[i.instructor_id]?.avatar_url || null,
        role: "instructor" as const,
        is_primary: i.is_primary,
      }));

      // Map coaches
      const coaches: TeamMember[] = (coachesData || []).map((c) => ({
        id: c.coach_id,
        name: profilesMap[c.coach_id]?.name || "Coach",
        email: "",
        avatar_url: profilesMap[c.coach_id]?.avatar_url || null,
        role: "coach" as const,
      }));

      setProgramInstructors(instructors);
      setProgramCoaches(coaches);

      // Process module teams
      if (showModuleTeams && modules.length > 0) {
        const teamsMap = new Map<string, ModuleTeam>();

        modules.forEach((m) => {
          const moduleInstructors = moduleInstructorsData
            .filter((mi) => mi.module_id === m.id)
            .map((mi) => ({
              id: mi.instructor_id,
              name: profilesMap[mi.instructor_id]?.name || "Instructor",
              email: "",
              avatar_url: profilesMap[mi.instructor_id]?.avatar_url || null,
              role: "instructor" as const,
            }));

          const moduleCoachesForModule = moduleCoachesData
            .filter((mc) => mc.module_id === m.id)
            .map((mc) => ({
              id: mc.coach_id,
              name: profilesMap[mc.coach_id]?.name || "Coach",
              email: "",
              avatar_url: profilesMap[mc.coach_id]?.avatar_url || null,
              role: "coach" as const,
            }));

          if (moduleInstructors.length > 0 || moduleCoachesForModule.length > 0) {
            teamsMap.set(m.id, {
              moduleId: m.id,
              moduleTitle: m.title,
              instructors: moduleInstructors,
              coaches: moduleCoachesForModule,
            });
          }
        });

        setModuleTeams(Array.from(teamsMap.values()));
      }

      // Set admin contact
      if (adminData) {
        setAdminContact({
          name: profilesMap[adminData.user_id]?.name || "Admin",
          email: "support@innotrue.com",
        });
      }

      setLoading(false);
    }

    fetchTeamData();
  }, [programId, modules, showModuleTeams]);

  const handleContact = async (userId: string, name: string, role: string) => {
    // Call edge function to get email and open mailto
    try {
      const { data, error } = await supabase.functions.invoke("get-user-email", {
        body: { userId },
      });

      if (error || !data?.email) {
        // Fallback to support email
        window.location.href = `mailto:support@innotrue.com?subject=Question for ${name} (${role})`;
        return;
      }

      window.location.href = `mailto:${data.email}?subject=Question about the program`;
    } catch {
      window.location.href = `mailto:support@innotrue.com?subject=Question for ${name} (${role})`;
    }
  };

  const handleContactAdmin = () => {
    window.location.href = `mailto:support@innotrue.com?subject=Support Request`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasTeam = programInstructors.length > 0 || programCoaches.length > 0;

  if (!hasTeam && !adminContact) {
    return null;
  }

  const TeamMemberRow = ({ member, roleLabel }: { member: TeamMember; roleLabel: string }) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={member.avatar_url || undefined} />
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium truncate">{member.name}</p>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {roleLabel}
            </Badge>
            {member.is_primary && (
              <Badge variant="secondary" className="text-xs">
                Primary
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleContact(member.id, member.name, roleLabel)}
        className="shrink-0"
      >
        <Mail className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Contact</span>
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Your Program Team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Program-level team */}
        {hasTeam && (
          <div className="space-y-2">
            {programInstructors.map((instructor) => (
              <TeamMemberRow key={instructor.id} member={instructor} roleLabel="Instructor" />
            ))}
            {programCoaches.map((coach) => (
              <TeamMemberRow key={coach.id} member={coach} roleLabel="Coach" />
            ))}
          </div>
        )}

        {/* Module-specific teams */}
        {showModuleTeams && moduleTeams.length > 0 && (
          <div className="border-t pt-4 space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Module-Specific Contacts</p>
            {moduleTeams.map((team) => (
              <div key={team.moduleId} className="space-y-2">
                <p className="text-sm font-medium">{team.moduleTitle}</p>
                {team.instructors.map((instructor) => (
                  <TeamMemberRow
                    key={instructor.id}
                    member={instructor}
                    roleLabel="Module Instructor"
                  />
                ))}
                {team.coaches.map((coach) => (
                  <TeamMemberRow key={coach.id} member={coach} roleLabel="Module Coach" />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Admin/Support contact */}
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleContactAdmin}
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Need help? Contact Support
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
