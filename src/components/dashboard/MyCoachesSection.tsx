import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Mail, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StaffMember {
  id: string;
  name: string;
  avatar_url: string | null;
  role: "coach" | "instructor";
  context: string;
}

export function MyCoachesSection() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: staff, isLoading } = useQuery({
    queryKey: ["my-coaches-instructors", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const allStaff: StaffMember[] = [];
      const staffIds = new Set<string>();

      // Get direct coach assignments
      const { data: directCoaches } = await supabase
        .from("client_coaches")
        .select("coach_id")
        .eq("client_id", user.id);

      // Get direct instructor assignments
      const { data: directInstructors } = await supabase
        .from("client_instructors")
        .select("instructor_id")
        .eq("client_id", user.id);

      // Get program enrollments
      const { data: enrollments } = await supabase
        .from("client_enrollments")
        .select("program_id, programs(name)")
        .eq("client_user_id", user.id)
        .in("status", ["active", "completed"]);

      const programIds = enrollments?.map((e) => e.program_id) || [];

      // Get program coaches
      let programCoachIds: { coach_id: string; program_name: string }[] = [];
      if (programIds.length > 0) {
        const { data: programCoaches } = await supabase
          .from("program_coaches")
          .select("coach_id, program_id")
          .in("program_id", programIds);

        if (programCoaches) {
          programCoachIds = programCoaches.map((pc) => ({
            coach_id: pc.coach_id,
            program_name:
              enrollments?.find((e) => e.program_id === pc.program_id)?.programs?.name || "Program",
          }));
        }
      }

      // Get program instructors
      let programInstructorIds: { instructor_id: string; program_name: string }[] = [];
      if (programIds.length > 0) {
        const { data: programInstructors } = await supabase
          .from("program_instructors")
          .select("instructor_id, program_id")
          .in("program_id", programIds);

        if (programInstructors) {
          programInstructorIds = programInstructors.map((pi) => ({
            instructor_id: pi.instructor_id,
            program_name:
              enrollments?.find((e) => e.program_id === pi.program_id)?.programs?.name || "Program",
          }));
        }
      }

      // Collect all unique staff IDs
      const allStaffIds = [
        ...(directCoaches?.map((c) => c.coach_id) || []),
        ...(directInstructors?.map((i) => i.instructor_id) || []),
        ...programCoachIds.map((pc) => pc.coach_id),
        ...programInstructorIds.map((pi) => pi.instructor_id),
      ].filter(Boolean);

      const uniqueStaffIds = [...new Set(allStaffIds)];

      if (uniqueStaffIds.length === 0) return [];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", uniqueStaffIds);

      const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Add direct coaches
      directCoaches?.forEach((c) => {
        if (!staffIds.has(c.coach_id)) {
          const profile = profilesMap.get(c.coach_id);
          if (profile) {
            allStaff.push({
              id: c.coach_id,
              name: profile.name || "Coach",
              avatar_url: profile.avatar_url,
              role: "coach",
              context: "Personal Coach",
            });
            staffIds.add(c.coach_id);
          }
        }
      });

      // Add direct instructors
      directInstructors?.forEach((i) => {
        if (!staffIds.has(i.instructor_id)) {
          const profile = profilesMap.get(i.instructor_id);
          if (profile) {
            allStaff.push({
              id: i.instructor_id,
              name: profile.name || "Instructor",
              avatar_url: profile.avatar_url,
              role: "instructor",
              context: "Personal Instructor",
            });
            staffIds.add(i.instructor_id);
          }
        }
      });

      // Add program coaches
      programCoachIds.forEach((pc) => {
        if (!staffIds.has(pc.coach_id)) {
          const profile = profilesMap.get(pc.coach_id);
          if (profile) {
            allStaff.push({
              id: pc.coach_id,
              name: profile.name || "Coach",
              avatar_url: profile.avatar_url,
              role: "coach",
              context: pc.program_name,
            });
            staffIds.add(pc.coach_id);
          }
        }
      });

      // Add program instructors
      programInstructorIds.forEach((pi) => {
        if (!staffIds.has(pi.instructor_id)) {
          const profile = profilesMap.get(pi.instructor_id);
          if (profile) {
            allStaff.push({
              id: pi.instructor_id,
              name: profile.name || "Instructor",
              avatar_url: profile.avatar_url,
              role: "instructor",
              context: pi.program_name,
            });
            staffIds.add(pi.instructor_id);
          }
        }
      });

      return allStaff;
    },
    enabled: !!user,
  });

  const handleEmail = async (staffId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-user-email", {
        body: { userId: staffId },
      });

      if (error) throw error;
      if (data?.email) {
        window.location.href = `mailto:${data.email}`;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not retrieve email address",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!staff || staff.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No coaches or instructors yet"
        description="Your assigned coaches and instructors will appear here"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          My Coaches & Instructors
        </h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-xs capitalize shrink-0">
                      {member.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground break-words">
                      {member.context}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEmail(member.id)}
                  className="shrink-0"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
