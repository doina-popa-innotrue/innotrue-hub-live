import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award } from "lucide-react";

interface Props {
  userId: string;
}

interface UserSkill {
  id: string;
  skill_name: string;
  category_name: string | null;
  earned_at: string;
}

export function SkillsEarned({ userId }: Props) {
  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["dev-profile-skills", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_skills")
        .select(
          `
          id, created_at,
          skills!inner(name, skill_category_id,
            skill_categories(name)
          )
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        skill_name: (row.skills as any)?.name || "Unknown",
        category_name: (row.skills as any)?.skill_categories?.name ?? null,
        earned_at: row.created_at,
      })) as UserSkill[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Skills Earned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const byCategory = new Map<string, UserSkill[]>();
  for (const skill of skills) {
    const cat = skill.category_name || "Other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(skill);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Skills Earned
          {skills.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {skills.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No skills earned yet. Complete assessments and program milestones to earn skills.
          </p>
        ) : (
          <div className="space-y-4">
            {Array.from(byCategory.entries()).map(([category, catSkills]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {catSkills.map((skill) => (
                    <Badge key={skill.id} variant="secondary" className="gap-1">
                      <Award className="h-3 w-3" />
                      {skill.skill_name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
