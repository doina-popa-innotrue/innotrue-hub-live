import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Award, Lock, Eye, EyeOff, ExternalLink, Target, Sparkles, BookOpen, Filter, LayoutGrid, List } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureGate } from '@/components/FeatureGate';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface UserSkill {
  id: string;
  skill_id: string;
  acquired_at: string;
  source_type: string;
  source_id: string | null;
  is_public: boolean;
  skill: Skill;
}

interface AvailableSkill extends Skill {
  modules: { id: string; title: string; program_id: string; program_name: string }[];
  isAcquired: boolean;
}

// Extracted skill card component for reuse
function SkillCard({ skill }: { skill: AvailableSkill }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-2 right-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-muted">
            <Award className="h-4 w-4 text-muted-foreground" />
          </div>
          {skill.name}
        </CardTitle>
        {skill.category && (
          <Badge variant="outline" className="w-fit text-xs">
            {skill.category}
          </Badge>
        )}
        {skill.description && (
          <CardDescription>{skill.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Available in:</p>
          <div className="space-y-2">
            {skill.modules.slice(0, 3).map((module) => (
              <div key={module.id} className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{module.title}</span>
                <Link 
                  to={`/programs/explore?highlight=${module.program_id}`} 
                  className="text-xs text-primary hover:underline"
                >
                  {module.program_name}
                </Link>
              </div>
            ))}
            {skill.modules.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{skill.modules.length - 3} more modules
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SkillsMap() {
  const { user } = useAuth();
  if (!user) return null;
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicProfileSlug, setPublicProfileSlug] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'grouped'>('grid');

  useEffect(() => {
    if (user) {
      fetchSkillsData();
      fetchPublicProfileSlug();
    }
  }, [user]);

  async function fetchPublicProfileSlug() {
    const { data } = await supabase
      .from('public_profile_settings')
      .select('custom_slug, is_public')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data?.is_public && data?.custom_slug) {
      setPublicProfileSlug(data.custom_slug);
    }
  }

  async function fetchSkillsData() {
    if (!user) return;

    // Fetch user's acquired skills
    const { data: userSkillsData, error: userSkillsError } = await supabase
      .from('user_skills')
      .select(`
        id,
        skill_id,
        acquired_at,
        source_type,
        source_id,
        is_public,
        skill:skills(id, name, description, category)
      `)
      .eq('user_id', user.id);

    if (userSkillsError) {
      console.error('Error fetching user skills:', userSkillsError);
    }

    // Fetch all skills with their module associations
    const { data: allSkills } = await supabase
      .from('skills')
      .select('id, name, description, category');

    const { data: moduleSkills } = await supabase
      .from('module_skills')
      .select(`
        skill_id,
        module:program_modules(id, title, program:programs(id, name))
      `);

    // Build available skills map
    const skillModulesMap: Record<string, { id: string; title: string; program_id: string; program_name: string }[]> = {};
    moduleSkills?.forEach((ms: any) => {
      if (!skillModulesMap[ms.skill_id]) {
        skillModulesMap[ms.skill_id] = [];
      }
      if (ms.module && ms.module.program) {
        skillModulesMap[ms.skill_id].push({
          id: ms.module.id,
          title: ms.module.title,
          program_id: ms.module.program.id,
          program_name: ms.module.program.name || 'Unknown Program',
        });
      }
    });

    const acquiredSkillIds = new Set(userSkillsData?.map(us => us.skill_id) || []);

    const available: AvailableSkill[] = (allSkills || []).map((skill) => ({
      ...skill,
      modules: skillModulesMap[skill.id] || [],
      isAcquired: acquiredSkillIds.has(skill.id),
    }));

    setUserSkills((userSkillsData as any) || []);
    setAvailableSkills(available);
    setLoading(false);
  }

  async function toggleSkillVisibility(skillId: string, currentVisibility: boolean) {
    const { error } = await supabase
      .from('user_skills')
      .update({ is_public: !currentVisibility })
      .eq('id', skillId)
      .eq('user_id', user!.id);

    if (error) {
      toast.error('Failed to update skill visibility');
    } else {
      setUserSkills(prev =>
        prev.map(s => s.id === skillId ? { ...s, is_public: !currentVisibility } : s)
      );
      toast.success(`Skill ${!currentVisibility ? 'visible' : 'hidden'} on public profile`);
    }
  }

  const acquiredSkills = userSkills;
  const pendingSkills = availableSkills.filter(s => !s.isAcquired && s.modules.length > 0);
  const skillsByCategory = acquiredSkills.reduce((acc, us) => {
    const category = us.skill?.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(us);
    return acc;
  }, {} as Record<string, UserSkill[]>);

  // Get unique categories from pending skills
  const pendingCategories = useMemo(() => {
    const categories = new Set<string>();
    pendingSkills.forEach(s => {
      categories.add(s.category || 'General');
    });
    return Array.from(categories).sort();
  }, [pendingSkills]);

  // Filter/group pending skills by category
  const filteredPendingSkills = useMemo(() => {
    if (categoryFilter === 'all') return pendingSkills;
    return pendingSkills.filter(s => (s.category || 'General') === categoryFilter);
  }, [pendingSkills, categoryFilter]);

  // Group pending skills by category for grouped view
  const pendingSkillsByCategory = useMemo(() => {
    const skillsToGroup = categoryFilter === 'all' ? pendingSkills : filteredPendingSkills;
    return skillsToGroup.reduce((acc, skill) => {
      const category = skill.category || 'General';
      if (!acc[category]) acc[category] = [];
      acc[category].push(skill);
      return acc;
    }, {} as Record<string, AvailableSkill[]>);
  }, [pendingSkills, filteredPendingSkills, categoryFilter]);

  const totalPossibleSkills = availableSkills.filter(s => s.modules.length > 0).length;
  const progressPercentage = totalPossibleSkills > 0 
    ? Math.round((acquiredSkills.length / totalPossibleSkills) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <FeatureGate featureKey="skills_map">
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Skills Map</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            My Skills Map
          </h1>
          <p className="text-muted-foreground mt-1">Track your acquired skills and share them on your public profile</p>
        </div>
        {publicProfileSlug && (
          <Button variant="outline" asChild size="sm" className="self-start flex-shrink-0">
            <Link to={`/profile/${publicProfileSlug}`} target="_blank">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Public Profile
            </Link>
          </Button>
        )}
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Skills Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{acquiredSkills.length} of {totalPossibleSkills} skills acquired</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>Acquired</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted" />
                <span>Available</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="acquired" className="space-y-4">
        <TabsList className="w-full sm:w-auto overflow-x-auto flex-nowrap justify-start h-auto p-1">
          <TabsTrigger value="acquired" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <Award className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Acquired Skills</span>
            <span className="sm:hidden">Acquired</span>
            <span>({acquiredSkills.length})</span>
          </TabsTrigger>
          <TabsTrigger value="available" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Available to Earn</span>
            <span className="sm:hidden">Available</span>
            <span>({pendingSkills.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="acquired" className="space-y-6">
          {acquiredSkills.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No skills acquired yet</h3>
                <p className="text-muted-foreground mb-4">
                  Complete program modules to earn skills and showcase them on your profile.
                </p>
                <Button asChild>
                  <Link to="/programs">Browse Programs</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            Object.entries(skillsByCategory).map(([category, skills]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg">{category}</CardTitle>
                  <CardDescription>{skills.length} skill{skills.length !== 1 ? 's' : ''} acquired</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {skills.map((userSkill) => (
                      <div
                        key={userSkill.id}
                        className="flex items-start justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Award className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{userSkill.skill?.name}</h4>
                            {userSkill.skill?.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {userSkill.skill.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Acquired {new Date(userSkill.acquired_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSkillVisibility(userSkill.id, userSkill.is_public)}
                            title={userSkill.is_public ? 'Visible on public profile' : 'Hidden from public profile'}
                          >
                            {userSkill.is_public ? (
                              <Eye className="h-4 w-4 text-primary" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {pendingSkills.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">You've acquired all available skills!</h3>
                <p className="text-muted-foreground">
                  Congratulations on your learning journey.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {pendingCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categoryFilter !== 'all' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setCategoryFilter('all')}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">View:</span>
                  <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'grid' | 'grouped')}>
                    <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
                      <LayoutGrid className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="grouped" aria-label="Grouped view" size="sm">
                      <List className="h-4 w-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              {filteredPendingSkills.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No skills found in this category.</p>
                    <Button 
                      variant="link" 
                      onClick={() => setCategoryFilter('all')}
                      className="mt-2"
                    >
                      View all categories
                    </Button>
                  </CardContent>
                </Card>
              ) : viewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredPendingSkills.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(pendingSkillsByCategory)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([category, skills]) => (
                      <Card key={category}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Badge variant="secondary">{category}</Badge>
                            <span className="text-sm font-normal text-muted-foreground">
                              {skills.length} skill{skills.length !== 1 ? 's' : ''}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {skills.map((skill) => (
                              <SkillCard key={skill.id} skill={skill} />
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </FeatureGate>
  );
}
