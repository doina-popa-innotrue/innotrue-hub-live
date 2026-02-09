import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Search, Save } from 'lucide-react';
import { useSkillCategoryLookup } from '@/hooks/useSkillCategories';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  category_id: string | null;
}

interface ModuleSkillsEditorProps {
  moduleId: string;
}

export function ModuleSkillsEditor({ moduleId }: ModuleSkillsEditorProps) {
  const { toast } = useToast();
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const { lookup: categoryLookup } = useSkillCategoryLookup();

  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Skill[];
    },
  });

  const { data: moduleSkills = [], isLoading: moduleSkillsLoading, refetch } = useQuery({
    queryKey: ['module-skills', moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_skills')
        .select('skill_id')
        .eq('module_id', moduleId);
      if (error) throw error;
      return data.map((ms) => ms.skill_id);
    },
  });

  useEffect(() => {
    setSelectedSkillIds(moduleSkills);
  }, [moduleSkills]);

  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing module skills
      const { error: deleteError } = await supabase
        .from('module_skills')
        .delete()
        .eq('module_id', moduleId);
      
      if (deleteError) throw deleteError;

      // Insert new module skills
      if (selectedSkillIds.length > 0) {
        const { error: insertError } = await supabase
          .from('module_skills')
          .insert(
            selectedSkillIds.map((skillId) => ({
              module_id: moduleId,
              skill_id: skillId,
            }))
          );
        if (insertError) throw insertError;
      }

      refetch();
      toast({ title: 'Skills updated successfully' });
    } catch (error) {
      toast({
        title: 'Error saving skills',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryName = (skill: Skill) => {
    if (skill.category_id && categoryLookup[skill.category_id]) {
      return categoryLookup[skill.category_id].name;
    }
    return skill.category || 'Uncategorized';
  };

  const filteredSkills = skills.filter((skill) => {
    const categoryName = getCategoryName(skill);
    return (
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Group skills by category
  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    const category = getCategoryName(skill);
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const categories = Object.keys(skillsByCategory).sort();

  const hasChanges = JSON.stringify(selectedSkillIds.sort()) !== JSON.stringify(moduleSkills.sort());

  if (skillsLoading || moduleSkillsLoading) {
    return <div className="text-muted-foreground">Loading skills...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Module Skills
        </CardTitle>
        <CardDescription>
          Select skills that will be awarded to users when they complete this module.
          {selectedSkillIds.length > 0 && (
            <span className="ml-2 font-medium text-foreground">
              ({selectedSkillIds.length} selected)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {skills.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No skills have been created yet. Go to Admin → Skills to create skills.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px] border rounded-md p-4">
              {categories.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No skills match your search.</p>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => (
                    <div key={category}>
                      <Label className="text-sm font-semibold text-muted-foreground mb-2 block">
                        {category}
                      </Label>
                      <div className="space-y-2">
                        {skillsByCategory[category].map((skill) => (
                          <div
                            key={skill.id}
                            className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              id={skill.id}
                              checked={selectedSkillIds.includes(skill.id)}
                              onCheckedChange={() => handleToggleSkill(skill.id)}
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={skill.id}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {skill.name}
                              </label>
                              {skill.description && (
                                <p className="text-xs text-muted-foreground">
                                  {skill.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {selectedSkillIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {skills
                  .filter((s) => selectedSkillIds.includes(s.id))
                  .map((skill) => (
                    <Badge key={skill.id} variant="secondary">
                      {skill.name}
                    </Badge>
                  ))}
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
