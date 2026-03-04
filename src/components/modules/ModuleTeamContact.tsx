import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, User, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamMember {
  id: string;
  name: string;
  avatar_url: string | null;
  role: "instructor" | "coach";
}

interface ModuleTeamContactProps {
  moduleId: string;
  programId: string;
  enrollmentId?: string;
}

/** Fetch profiles for a list of user IDs and return a Map<id, {name, avatar_url}> */
async function fetchProfiles(userIds: string[]) {
  const map = new Map<string, { name: string; avatar_url: string | null }>();
  if (userIds.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", userIds);
  for (const p of data || []) {
    map.set(p.id, { name: p.name || "Unknown", avatar_url: p.avatar_url });
  }
  return map;
}

export function ModuleTeamContact({ moduleId, programId, enrollmentId }: ModuleTeamContactProps) {
  const [loading, setLoading] = useState(true);
  const [personalInstructor, setPersonalInstructor] = useState<TeamMember | null>(null);
  const [instructors, setInstructors] = useState<TeamMember[]>([]);
  const [coaches, setCoaches] = useState<TeamMember[]>([]);

  useEffect(() => {
    async function fetchTeamData() {
      setLoading(true);

      // Check for personal instructor (enrollment-level assignment)
      if (enrollmentId) {
        const { data: personalStaff } = await supabase
          .from("enrollment_module_staff")
          .select("staff_user_id, role")
          .eq("enrollment_id", enrollmentId)
          .eq("module_id", moduleId)
          .maybeSingle();

        if (personalStaff) {
          const profiles = await fetchProfiles([personalStaff.staff_user_id]);
          const profile = profiles.get(personalStaff.staff_user_id);
          if (profile) {
            setPersonalInstructor({
              id: personalStaff.staff_user_id,
              name: profile.name,
              avatar_url: profile.avatar_url,
              role: (personalStaff.role === "coach" ? "coach" : "instructor") as "instructor" | "coach",
            });
          }
        }
      }

      // First try to fetch module-specific instructors
      const { data: moduleInstructorsData } = await supabase
        .from("module_instructors")
        .select("instructor_id")
        .eq("module_id", moduleId);

      // Then try module-specific coaches
      const { data: moduleCoachesData } = await supabase
        .from("module_coaches")
        .select("coach_id")
        .eq("module_id", moduleId);

      let finalInstructors: TeamMember[] = [];
      let finalCoaches: TeamMember[] = [];

      // Use module-level assignments if available, otherwise fall back to program-level
      if (moduleInstructorsData && moduleInstructorsData.length > 0) {
        const ids = moduleInstructorsData.map((i) => i.instructor_id);
        const profiles = await fetchProfiles(ids);
        finalInstructors = ids.map((id) => ({
          id,
          name: profiles.get(id)?.name || "Instructor",
          avatar_url: profiles.get(id)?.avatar_url || null,
          role: "instructor" as const,
        }));
      } else {
        // Fallback to program instructors
        const { data: programInstructorsData } = await supabase
          .from("program_instructors")
          .select("instructor_id")
          .eq("program_id", programId);

        if (programInstructorsData && programInstructorsData.length > 0) {
          const ids = programInstructorsData.map((i) => i.instructor_id);
          const profiles = await fetchProfiles(ids);
          finalInstructors = ids.map((id) => ({
            id,
            name: profiles.get(id)?.name || "Instructor",
            avatar_url: profiles.get(id)?.avatar_url || null,
            role: "instructor" as const,
          }));
        }
      }

      if (moduleCoachesData && moduleCoachesData.length > 0) {
        const ids = moduleCoachesData.map((c) => c.coach_id);
        const profiles = await fetchProfiles(ids);
        finalCoaches = ids.map((id) => ({
          id,
          name: profiles.get(id)?.name || "Coach",
          avatar_url: profiles.get(id)?.avatar_url || null,
          role: "coach" as const,
        }));
      } else {
        // Fallback to program coaches
        const { data: programCoachesData } = await supabase
          .from("program_coaches")
          .select("coach_id")
          .eq("program_id", programId);

        if (programCoachesData && programCoachesData.length > 0) {
          const ids = programCoachesData.map((c) => c.coach_id);
          const profiles = await fetchProfiles(ids);
          finalCoaches = ids.map((id) => ({
            id,
            name: profiles.get(id)?.name || "Coach",
            avatar_url: profiles.get(id)?.avatar_url || null,
            role: "coach" as const,
          }));
        }
      }

      setInstructors(finalInstructors);
      setCoaches(finalCoaches);
      setLoading(false);
    }

    fetchTeamData();
  }, [moduleId, programId, enrollmentId]);

  const handleContact = async (userId: string, name: string, role: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-user-email", {
        body: { userId },
      });

      if (error || !data?.email) {
        window.location.href = `mailto:support@innotrue.com?subject=Question for ${name} (${role})`;
        return;
      }

      window.location.href = `mailto:${data.email}?subject=Question about the module`;
    } catch {
      window.location.href = `mailto:support@innotrue.com?subject=Question for ${name} (${role})`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  const hasTeam = instructors.length > 0 || coaches.length > 0 || personalInstructor;

  if (!hasTeam) {
    return null;
  }

  // Filter out the personal instructor from the general lists to avoid duplication
  const filteredInstructors = instructors.filter(
    (i) => !personalInstructor || i.id !== personalInstructor.id,
  );
  const filteredCoaches = coaches.filter(
    (c) => !personalInstructor || c.id !== personalInstructor.id,
  );

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        <Users className="h-4 w-4" />
        <span>Your Team:</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {personalInstructor && (
          <div
            className="flex items-center gap-2 bg-primary/10 rounded-full pl-1 pr-2 py-1 border border-primary/30"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={personalInstructor.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{personalInstructor.name}</span>
            <Badge className="text-xs px-1.5 py-0 bg-primary/20 text-primary border-primary/30" variant="outline">
              Your {personalInstructor.role === "coach" ? "Coach" : "Instructor"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() =>
                handleContact(
                  personalInstructor.id,
                  personalInstructor.name,
                  personalInstructor.role === "coach" ? "Coach" : "Instructor",
                )
              }
            >
              <Mail className="h-3 w-3" />
            </Button>
          </div>
        )}
        {filteredInstructors.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-2 bg-background rounded-full pl-1 pr-2 py-1 border"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={member.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{member.name}</span>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              Instructor
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleContact(member.id, member.name, "Instructor")}
            >
              <Mail className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {filteredCoaches.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-2 bg-background rounded-full pl-1 pr-2 py-1 border"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={member.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{member.name}</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              Coach
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleContact(member.id, member.name, "Coach")}
            >
              <Mail className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
