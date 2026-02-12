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
}

export function ModuleTeamContact({ moduleId, programId }: ModuleTeamContactProps) {
  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState<TeamMember[]>([]);
  const [coaches, setCoaches] = useState<TeamMember[]>([]);

  useEffect(() => {
    async function fetchTeamData() {
      setLoading(true);

      // First try to fetch module-specific instructors
      const { data: moduleInstructorsData } = await supabase
        .from("module_instructors")
        .select(
          `
          instructor_id,
          profiles!module_instructors_instructor_id_fkey (
            id,
            name,
            avatar_url
          )
        `,
        )
        .eq("module_id", moduleId);

      // Then try module-specific coaches
      const { data: moduleCoachesData } = await supabase
        .from("module_coaches")
        .select(
          `
          coach_id,
          profiles!module_coaches_coach_id_fkey (
            id,
            name,
            avatar_url
          )
        `,
        )
        .eq("module_id", moduleId);

      let finalInstructors: TeamMember[] = [];
      let finalCoaches: TeamMember[] = [];

      // Use module-level assignments if available, otherwise fall back to program-level
      if (moduleInstructorsData && moduleInstructorsData.length > 0) {
        finalInstructors = moduleInstructorsData.map((i) => ({
          id: i.instructor_id,
          name: (i.profiles as any)?.name || "Instructor",
          avatar_url: (i.profiles as any)?.avatar_url,
          role: "instructor" as const,
        }));
      } else {
        // Fallback to program instructors
        const { data: programInstructorsData } = await supabase
          .from("program_instructors")
          .select(
            `
            instructor_id,
            profiles!program_instructors_instructor_id_fkey (
              id,
              name,
              avatar_url
            )
          `,
          )
          .eq("program_id", programId);

        finalInstructors = (programInstructorsData || []).map((i) => ({
          id: i.instructor_id,
          name: (i.profiles as any)?.name || "Instructor",
          avatar_url: (i.profiles as any)?.avatar_url,
          role: "instructor" as const,
        }));
      }

      if (moduleCoachesData && moduleCoachesData.length > 0) {
        finalCoaches = moduleCoachesData.map((c) => ({
          id: c.coach_id,
          name: (c.profiles as any)?.name || "Coach",
          avatar_url: (c.profiles as any)?.avatar_url,
          role: "coach" as const,
        }));
      } else {
        // Fallback to program coaches
        const { data: programCoachesData } = await supabase
          .from("program_coaches")
          .select(
            `
            coach_id,
            profiles!program_coaches_coach_id_fkey (
              id,
              name,
              avatar_url
            )
          `,
          )
          .eq("program_id", programId);

        finalCoaches = (programCoachesData || []).map((c) => ({
          id: c.coach_id,
          name: (c.profiles as any)?.name || "Coach",
          avatar_url: (c.profiles as any)?.avatar_url,
          role: "coach" as const,
        }));
      }

      setInstructors(finalInstructors);
      setCoaches(finalCoaches);
      setLoading(false);
    }

    fetchTeamData();
  }, [moduleId, programId]);

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

  const hasTeam = instructors.length > 0 || coaches.length > 0;

  if (!hasTeam) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        <Users className="h-4 w-4" />
        <span>Your Team:</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {instructors.map((member) => (
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
        {coaches.map((member) => (
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
