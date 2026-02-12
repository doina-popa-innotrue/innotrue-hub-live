import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ChevronDown, Loader2, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { useSkillCategoryLookup } from "@/hooks/useSkillCategories";

interface ResourceSkillsManagerProps {
  resourceId: string;
  selectedSkillIds: string[];
  onSkillsChange: (skillIds: string[]) => void;
  inline?: boolean;
}

export function ResourceSkillsManager({
  resourceId,
  selectedSkillIds,
  onSkillsChange,
  inline = false,
}: ResourceSkillsManagerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { lookup: categoryLookup } = useSkillCategoryLookup();

  const { data: skills, isLoading } = useQuery({
    queryKey: ["skills-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("id, name, category, category_id")
        .order("category")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (skillIds: string[]) => {
      // Delete existing links
      await supabase.from("resource_library_skills").delete().eq("resource_id", resourceId);

      // Insert new links
      if (skillIds.length > 0) {
        const { error } = await supabase.from("resource_library_skills").insert(
          skillIds.map((skillId) => ({
            resource_id: resourceId,
            skill_id: skillId,
          })),
        );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-library"] });
      queryClient.invalidateQueries({ queryKey: ["resource-skills", resourceId] });
      toast.success("Skills updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update skills");
    },
  });

  const toggleSkill = (skillId: string) => {
    const newSkillIds = selectedSkillIds.includes(skillId)
      ? selectedSkillIds.filter((id) => id !== skillId)
      : [...selectedSkillIds, skillId];

    onSkillsChange(newSkillIds);

    // If we have a resourceId, persist immediately
    if (resourceId && !inline) {
      updateMutation.mutate(newSkillIds);
    }
  };

  const getCategoryName = (skill: { category_id?: string | null; category?: string | null }) => {
    if (skill.category_id && categoryLookup[skill.category_id]) {
      return categoryLookup[skill.category_id].name;
    }
    return skill.category || "Uncategorized";
  };

  const filteredSkills = skills?.filter((skill) => {
    const categoryName = getCategoryName(skill);
    return (
      skill.name.toLowerCase().includes(search.toLowerCase()) ||
      categoryName.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Group skills by category
  const groupedSkills = filteredSkills?.reduce(
    (acc, skill) => {
      const category = getCategoryName(skill);
      if (!acc[category]) acc[category] = [];
      acc[category].push(skill);
      return acc;
    },
    {} as Record<string, typeof skills>,
  );

  if (inline) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="space-y-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {selectedSkillIds.length === 0
                ? "No skills assigned"
                : `${selectedSkillIds.length} skill(s) assigned`}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="border rounded-md p-3 max-h-60 overflow-y-auto space-y-4">
              {groupedSkills &&
                Object.entries(groupedSkills).map(([category, categorySkills]) => (
                  <div key={category}>
                    <div className="text-xs font-medium text-muted-foreground mb-2">{category}</div>
                    <div className="space-y-2">
                      {categorySkills?.map((skill) => (
                        <div key={skill.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`skill-${skill.id}`}
                            checked={selectedSkillIds.includes(skill.id)}
                            onCheckedChange={() => toggleSkill(skill.id)}
                          />
                          <label htmlFor={`skill-${skill.id}`} className="text-sm cursor-pointer">
                            {skill.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              {!filteredSkills?.length && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {search ? "No skills match your search" : "No skills available"}
                </p>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Non-inline version for table rows
  return (
    <div className="flex flex-wrap gap-1">
      {selectedSkillIds.length === 0 ? (
        <span className="text-muted-foreground text-sm">-</span>
      ) : (
        selectedSkillIds.slice(0, 3).map((skillId) => {
          const skill = skills?.find((s) => s.id === skillId);
          return skill ? (
            <Badge key={skillId} variant="outline" className="text-xs">
              {skill.name}
            </Badge>
          ) : null;
        })
      )}
      {selectedSkillIds.length > 3 && (
        <Badge variant="secondary" className="text-xs">
          +{selectedSkillIds.length - 3}
        </Badge>
      )}
    </div>
  );
}
