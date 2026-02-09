import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Map, Search, Target, Flag, BookOpen, Compass, FolderTree, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeatureGate } from '@/components/FeatureGate';
import { GuidedPathSurveyWizard } from '@/components/guided-paths/GuidedPathSurveyWizard';
import { FamilyCard } from '@/components/guided-paths/FamilyCard';

interface TemplateGoal {
  id: string;
  title: string;
  guided_path_template_milestones: { id: string }[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  program_id?: string | null;
  family_id?: string | null;
  is_active?: boolean;
  is_base_template?: boolean;
  programs?: { id: string; name: string } | null;
  guided_path_template_goals: TemplateGoal[];
  conditions?: { question_id: string; operator: string; value: unknown }[];
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: { value: string; label: string }[] | null;
  help_text: string | null;
  is_required: boolean;
}

interface Family {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_active: boolean;
  questions: SurveyQuestion[];
  templates: Template[];
}

function GuidedPathsFallback() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <Map className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Guided Paths</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          Follow curated paths with goals, milestones, and tasks to help you achieve your objectives systematically.
        </p>
        <Button onClick={() => navigate('/programs')}>Explore Programs</Button>
      </div>
    </div>
  );
}

export default function GuidedPaths() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'families' | 'templates'>('families');
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [filter, setFilter] = useState<'all' | 'general' | 'program'>('all');

  // Fetch families with their questions and templates
  const { data: families = [], isLoading: familiesLoading } = useQuery({
    queryKey: ['client-guided-path-families'],
    queryFn: async () => {
      const { data: familiesData, error } = await supabase
        .from('guided_path_template_families')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;

      // Fetch questions and templates for each family
      const familiesWithData = await Promise.all(
        (familiesData || []).map(async (family) => {
          const [questionsResult, templatesResult] = await Promise.all([
            supabase
              .from('family_survey_questions')
              .select('*')
              .eq('family_id', family.id)
              .order('order_index'),
            supabase
              .from('guided_path_templates')
              .select(`
                id, name, description, is_base_template, family_id,
                guided_path_template_goals(id, title, guided_path_template_milestones(id))
              `)
              .eq('family_id', family.id)
              .eq('is_active', true)
              .order('order_in_family'),
          ]);

          // Fetch conditions for each template
          const templateIds = (templatesResult.data || []).map(t => t.id);
          const { data: conditionsData } = await supabase
            .from('template_conditions')
            .select('template_id, question_id, operator, value')
            .in('template_id', templateIds);

          const conditionsByTemplate = (conditionsData || []).reduce((acc, c) => {
            if (!acc[c.template_id]) acc[c.template_id] = [];
            acc[c.template_id].push(c);
            return acc;
          }, {} as Record<string, typeof conditionsData>);

          return {
            ...family,
            questions: (questionsResult.data || []).map(q => ({
              ...q,
              options: q.options as { value: string; label: string }[] | null,
            })) as SurveyQuestion[],
            templates: (templatesResult.data || []).map(t => ({
              ...t,
              conditions: conditionsByTemplate[t.id] || [],
            })),
          };
        })
      );

      return familiesWithData as Family[];
    },
    enabled: !!user,
  });

  // Fetch standalone templates (not in any family)
  const { data: standaloneTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['client-standalone-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guided_path_templates')
        .select(`
          *,
          programs(id, name),
          guided_path_template_goals(
            id,
            title,
            guided_path_template_milestones(id)
          )
        `)
        .is('family_id', null)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as Template[];
    },
    enabled: !!user,
  });

  const isLoading = familiesLoading || templatesLoading;

  const filteredFamilies = families.filter((f) => {
    const matchesSearch = !search || 
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.description?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const filteredTemplates = standaloneTemplates.filter((t) => {
    const matchesSearch = !search || 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = filter === 'all' ||
      (filter === 'general' && !t.program_id) ||
      (filter === 'program' && t.program_id);

    return matchesSearch && matchesFilter;
  });

  const generalTemplates = filteredTemplates.filter(t => !t.program_id);
  const programTemplates = filteredTemplates.filter(t => t.program_id);

  const countMilestones = (goals: TemplateGoal[]) => 
    goals.reduce((sum, g) => sum + (g.guided_path_template_milestones?.length || 0), 0);

  function handleFamilySelect(family: Family) {
    setSelectedFamily(family);
  }

  function handleSurveyComplete(selectedTemplateIds: string[]) {
    // Navigate to the path detail or goals page
    setSelectedFamily(null);
    navigate('/goals');
  }

  function handleSurveyCancel() {
    setSelectedFamily(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  // Show survey wizard if a family is selected
  if (selectedFamily) {
    return (
      <FeatureGate featureKey="guided_paths" fallback={<GuidedPathsFallback />}>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Map className="h-8 w-8" />
              {selectedFamily.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Answer a few questions to personalize your path
            </p>
          </div>
          <GuidedPathSurveyWizard
            familyId={selectedFamily.id}
            familyName={selectedFamily.name}
            questions={selectedFamily.questions}
            templates={selectedFamily.templates}
            onComplete={handleSurveyComplete}
            onCancel={handleSurveyCancel}
          />
        </div>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate
      featureKey="guided_paths"
      fallback={<GuidedPathsFallback />}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Map className="h-8 w-8" />
            Guided Paths
          </h1>
          <p className="text-muted-foreground mt-1">
            Choose a path to follow or browse individual templates
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search paths and templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'families' | 'templates')}>
          <TabsList>
            <TabsTrigger value="families" className="gap-2">
              <Compass className="h-4 w-4" />
              Path Journeys ({families.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FolderTree className="h-4 w-4" />
              Standalone Templates ({standaloneTemplates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="families" className="space-y-6">
            {filteredFamilies.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Compass className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Path Journeys Found</h3>
                  <p className="text-muted-foreground">
                    {search ? 'Try adjusting your search terms' : 'No guided path journeys are available yet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFamilies.map((family) => (
                  <FamilyCard
                    key={family.id}
                    id={family.id}
                    name={family.name}
                    description={family.description}
                    questionCount={family.questions.length}
                    templateCount={family.templates.length}
                    onClick={() => handleFamilySelect(family)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'general' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('general')}
              >
                General
              </Button>
              <Button
                variant={filter === 'program' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('program')}
              >
                Program-Specific
              </Button>
            </div>

            {filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Map className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Templates Found</h3>
                  <p className="text-muted-foreground">
                    {search ? 'Try adjusting your search terms' : 'No standalone templates are available yet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {generalTemplates.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      General Paths
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {generalTemplates.map((template) => (
                        <Card 
                          key={template.id} 
                          className="cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate(`/guided-paths/${template.id}`)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              <Badge variant="secondary">General</Badge>
                            </div>
                            <CardDescription className="line-clamp-2">
                              {template.description || 'No description'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Target className="h-4 w-4" />
                                {template.guided_path_template_goals.length} goals
                              </div>
                              <div className="flex items-center gap-1">
                                <Flag className="h-4 w-4" />
                                {countMilestones(template.guided_path_template_goals)} milestones
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {programTemplates.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Program-Specific Paths
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {programTemplates.map((template) => (
                        <Card 
                          key={template.id} 
                          className="cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate(`/guided-paths/${template.id}`)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                            </div>
                            <CardDescription className="line-clamp-2">
                              {template.description || 'No description'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <Badge variant="outline" className="text-xs">
                                <BookOpen className="h-3 w-3 mr-1" />
                                {template.programs?.name}
                              </Badge>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Target className="h-4 w-4" />
                                  {template.guided_path_template_goals.length} goals
                                </div>
                                <div className="flex items-center gap-1">
                                  <Flag className="h-4 w-4" />
                                  {countMilestones(template.guided_path_template_goals)} milestones
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  );
}
