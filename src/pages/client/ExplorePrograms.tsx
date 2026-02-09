import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, BookOpen, CheckCircle, Sparkles, Heart, Clock, ChevronRight, ChevronDown, Lock, RotateCcw } from 'lucide-react';
import { ProgramPreviewDialog } from '@/components/programs/ProgramPreviewDialog';
import { ExpressInterestDialog } from '@/components/programs/ExpressInterestDialog';
import { useToast } from '@/hooks/use-toast';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { PlanLockBadge } from '@/components/programs/PlanLockBadge';
import { useExploreModuleCompletions } from '@/hooks/useExploreModuleCompletions';

interface CrossProgramModule {
  moduleId: string;
  moduleTitle: string;
  completedInProgram: string;
  completedAt: string | null;
  completionSource: 'internal' | 'talentlms';
}

interface ProgramCompletionInfo {
  totalModules: number;
  completedElsewhere: CrossProgramModule[];
  suggestedDiscountPercent: number;
}

interface ProgramCategory {
  id: string;
  key: string;
  name: string;
  display_order: number;
}

interface Program {
  id: string;
  name: string;
  description: string;
  category: string;
  isEnrolled: boolean;
  isCompleted: boolean;
  isRecommended: boolean;
  isFavorite: boolean;
  hasInterest: boolean;
  recommendationScore?: number;
  tiers?: string[];
  scheduled_dates?: Array<{ 
    id: string; 
    date: string; 
    title: string; 
    capacity?: number; 
    enrolled_count?: number 
  }>;
  plan_id?: string | null;
  min_plan_tier?: number;
  requires_separate_purchase?: boolean;
  allow_repeat_enrollment?: boolean;
  hasActiveEnrollment?: boolean;
  enrollmentCount?: number;
}

interface Module {
  id: string;
  title: string;
  module_type: string;
  estimated_minutes: number | null;
  description: string | null;
  tier_required: string | null;
}

interface Skill {
  name: string;
  category: string | null;
}

interface Instructor {
  id: string;
  name: string;
  avatar_url: string | null;
}

export default function ExplorePrograms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [favoritePrograms, setFavoritePrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [previewProgram, setPreviewProgram] = useState<Program | null>(null);
  const [previewModules, setPreviewModules] = useState<Module[]>([]);
  const [previewSkills, setPreviewSkills] = useState<Skill[]>([]);
  const [previewInstructors, setPreviewInstructors] = useState<Instructor[]>([]);
  const [previewCoaches, setPreviewCoaches] = useState<Instructor[]>([]);
  const [interestProgram, setInterestProgram] = useState<Program | null>(null);
  const [isSubmittingInterest, setIsSubmittingInterest] = useState(false);
  const [programAccessMap, setProgramAccessMap] = useState<Map<string, { isLocked: boolean; reason: 'plan_required' | 'payment_outstanding' | 'separate_purchase_required' | null; requiredTier: number; requiresSeparatePurchase?: boolean }>>(new Map());
  const [previewCrossCompletions, setPreviewCrossCompletions] = useState<ProgramCompletionInfo | null>(null);
  const [interestCrossCompletions, setInterestCrossCompletions] = useState<ProgramCompletionInfo | null>(null);
  
  const { isLoading: planAccessLoading, checkProgramAccess, getPlanNameForTier, userPlan } = usePlanAccess();
  const { checkProgramCompletions } = useExploreModuleCompletions(user?.id);


  // Fetch categories
  const { data: programCategories = [] } = useQuery({
    queryKey: ['program-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_categories')
        .select('id, key, name, display_order')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as ProgramCategory[];
    },
  });

  useEffect(() => {
    if (!user) return;

    const fetchPrograms = async () => {
      // Fetch all active programs
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('id, name, description, category, scheduled_dates, tiers, plan_id, min_plan_tier, requires_separate_purchase, allow_repeat_enrollment')
        .eq('is_active', true)
        .order('name');

      if (programsError) {
        console.error('Error fetching programs:', programsError);
        setLoading(false);
        return;
      }

      // Fetch user's enrollments
      const { data: enrollmentsData } = await supabase
        .from('client_enrollments')
        .select('program_id, status, enrollment_number')
        .eq('client_user_id', user.id);

      // Create maps for enrollment status
      // enrollmentMap: program_id -> array of statuses (for all enrollments)
      const enrollmentsByProgram = new Map<string, { status: string; enrollment_number: number }[]>();
      enrollmentsData?.forEach(e => {
        const existing = enrollmentsByProgram.get(e.program_id) || [];
        existing.push({ status: e.status, enrollment_number: e.enrollment_number || 1 });
        enrollmentsByProgram.set(e.program_id, existing);
      });

      // Fetch user's favorites
      const { data: favoritesData } = await supabase
        .from('program_favorites')
        .select('program_id')
        .eq('user_id', user.id);

      const favoriteSet = new Set(favoritesData?.map(f => f.program_id) || []);

      // Fetch user's interest registrations
      const { data: interestsData } = await supabase
        .from('program_interest_registrations')
        .select('program_id')
        .eq('user_id', user.id);

      const interestSet = new Set(interestsData?.map(i => i.program_id) || []);

      // Calculate recommendations based on completed modules and skills
      const { data: completedProgress } = await supabase
        .from('module_progress')
        .select(`
          module_id,
          program_modules!inner (
            program_id,
            program_skills (
              skills (
                id,
                name,
                category
              )
            )
          ),
          client_enrollments!inner (
            client_user_id
          )
        `)
        .eq('client_enrollments.client_user_id', user.id)
        .eq('status', 'completed');

      // Extract skills from completed modules
      const userSkills = new Set<string>();
      const programCompletionCounts = new Map<string, number>();
      
      completedProgress?.forEach((progress: any) => {
        const programId = progress.program_modules.program_id;
        programCompletionCounts.set(
          programId,
          (programCompletionCounts.get(programId) || 0) + 1
        );
        
        progress.program_modules.program_skills?.forEach((ps: any) => {
          if (ps.skills) {
            userSkills.add(ps.skills.id);
          }
        });
      });

      // Calculate recommendation scores
      const recommendationScores = new Map<string, number>();
      
      for (const program of programsData || []) {
        if (enrollmentsByProgram.has(program.id)) continue; // Skip enrolled programs for recommendation

        let score = 0;

        // Get program skills
        const { data: programSkills } = await supabase
          .from('program_skills')
          .select('skill_id')
          .eq('program_id', program.id);

        // Score based on skill overlap
        const matchingSkills = programSkills?.filter(ps => userSkills.has(ps.skill_id)).length || 0;
        const totalSkills = programSkills?.length || 1;
        score += (matchingSkills / totalSkills) * 50;

        // Score based on category match with completed programs
        const completedInSameCategory = Array.from(enrollmentsByProgram.entries())
          .filter(([pid, enrollments]) => {
            const prog = programsData.find(p => p.id === pid);
            return prog?.category === program.category && enrollments.some(e => e.status === 'completed');
          }).length;
        score += completedInSameCategory * 20;

        // Score based on category match with active programs
        const activeInSameCategory = Array.from(enrollmentsByProgram.entries())
          .filter(([pid, enrollments]) => {
            const prog = programsData.find(p => p.id === pid);
            return prog?.category === program.category && enrollments.some(e => e.status === 'active');
          }).length;
        score += activeInSameCategory * 10;

        recommendationScores.set(program.id, score);
      }

      const enrichedPrograms: Program[] = (programsData || []).map((program) => {
        const programEnrollments = enrollmentsByProgram.get(program.id) || [];
        const hasActiveEnrollment = programEnrollments.some(e => e.status === 'active');
        const hasCompletedEnrollment = programEnrollments.some(e => e.status === 'completed');
        
        return {
          id: program.id,
          name: program.name,
          description: program.description || '',
          category: program.category,
          isEnrolled: programEnrollments.length > 0,
          isCompleted: hasCompletedEnrollment && !hasActiveEnrollment,
          isRecommended: (recommendationScores.get(program.id) || 0) > 30 && programEnrollments.length === 0,
          isFavorite: favoriteSet.has(program.id),
          hasInterest: interestSet.has(program.id),
          recommendationScore: recommendationScores.get(program.id) || 0,
          tiers: Array.isArray(program.tiers) ? program.tiers as string[] : [],
          scheduled_dates: (program as any).scheduled_dates || [],
          plan_id: program.plan_id,
          min_plan_tier: program.min_plan_tier || 0,
          allow_repeat_enrollment: (program as any).allow_repeat_enrollment || false,
          hasActiveEnrollment,
          enrollmentCount: programEnrollments.length,
        };
      });

      setPrograms(enrichedPrograms);
      setFavoritePrograms(enrichedPrograms.filter(p => p.isFavorite));
      setLoading(false);
    };

    fetchPrograms();
  }, [user]);

  // Check plan access for all programs once plan data is loaded
  useEffect(() => {
    if (planAccessLoading || programs.length === 0) return;
    
    const checkAllProgramAccess = async () => {
      const accessMap = new Map<string, { isLocked: boolean; reason: 'plan_required' | 'payment_outstanding' | 'separate_purchase_required' | null; requiredTier: number; requiresSeparatePurchase?: boolean }>();
      
      for (const program of programs) {
        const access = await checkProgramAccess(
          program.id, 
          program.plan_id || null, 
          program.min_plan_tier || 0,
          program.requires_separate_purchase || false
        );
        accessMap.set(program.id, {
          isLocked: access.isLocked,
          reason: access.reason,
          requiredTier: access.requiredPlanTier,
          requiresSeparatePurchase: access.requiresSeparatePurchase,
        });
      }
      
      setProgramAccessMap(accessMap);
    };
    
    checkAllProgramAccess();
  }, [planAccessLoading, programs, checkProgramAccess]);

  // Handle highlight query param to auto-open preview
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && programs.length > 0 && !previewProgram) {
      const programToHighlight = programs.find(p => p.id === highlightId);
      if (programToHighlight) {
        handlePreviewProgram(programToHighlight);
        // Clear the query param after opening
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, programs, previewProgram]);

  const handlePreviewProgram = async (program: Program) => {
    // Fetch modules
    const { data: modulesData } = await supabase
      .from('program_modules')
      .select('id, title, description, module_type, estimated_minutes, order_index, tier_required')
      .eq('program_id', program.id)
      .eq('is_active', true)
      .order('order_index');

    setPreviewModules(modulesData || []);

    // Fetch skills
    const { data: skillsData } = await supabase
      .from('program_skills')
      .select('skills (name, category)')
      .eq('program_id', program.id);

    const skills = skillsData?.map((s: any) => s.skills).filter(Boolean) || [];
    setPreviewSkills(skills);

    // Fetch instructors
    const { data: instructorsData } = await supabase
      .from('program_instructors')
      .select('profiles!instructor_id (id, name, avatar_url)')
      .eq('program_id', program.id);

    const instructors = instructorsData?.map((i: any) => i.profiles).filter(Boolean) || [];
    setPreviewInstructors(instructors);

    // Fetch coaches
    const { data: coachesData } = await supabase
      .from('program_coaches')
      .select('profiles!coach_id (id, name, avatar_url)')
      .eq('program_id', program.id);

    const coaches = coachesData?.map((c: any) => c.profiles).filter(Boolean) || [];
    setPreviewCoaches(coaches);

    // Fetch cross-program completions
    const crossCompletions = await checkProgramCompletions(program.id);
    setPreviewCrossCompletions(crossCompletions);

    setPreviewProgram(program);
  };

  const handleToggleFavorite = async (programId: string) => {
    if (!user) return;

    const program = programs.find(p => p.id === programId);
    if (!program) return;

    try {
      if (program.isFavorite) {
        // Remove favorite
        const { error } = await supabase
          .from('program_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('program_id', programId);

        if (error) throw error;
        toast({ title: "Removed from favorites" });
      } else {
        // Add favorite
        const { error } = await supabase
          .from('program_favorites')
          .insert({ user_id: user.id, program_id: programId });

        if (error) throw error;
        toast({ title: "Added to favorites" });
      }

      // Update local state
      setPrograms(prev => prev.map(p => 
        p.id === programId ? { ...p, isFavorite: !p.isFavorite } : p
      ));
      setFavoritePrograms(prev => 
        program.isFavorite 
          ? prev.filter(p => p.id !== programId)
          : [...prev, { ...program, isFavorite: true }]
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({ title: "Failed to update favorites", variant: "destructive" });
    }
  };

  const handleExpressInterest = async (
    selection: string, 
    preferredTier?: string,
    crossCompletions?: CrossProgramModule[],
    suggestedDiscount?: number
  ) => {
    if (!user || !interestProgram) return;

    setIsSubmittingInterest(true);
    try {
      // Check if selection is a scheduled date ID or a timeframe
      const scheduledDates = interestProgram.scheduled_dates || [];
      const selectedSchedule = scheduledDates.find(sd => sd.id === selection);
      const isScheduledDate = !!selectedSchedule;

      // Check capacity if it's a scheduled date
      if (isScheduledDate && selectedSchedule) {
        const capacity = selectedSchedule.capacity || 0;
        const enrolledCount = selectedSchedule.enrolled_count || 0;

        if (capacity > 0 && enrolledCount >= capacity) {
          // Session is full, add to waitlist
          const { data: waitlistData, error: waitlistError } = await supabase
            .from('program_waitlist')
            .select('position')
            .eq('program_id', interestProgram.id)
            .eq('scheduled_date_id', selection)
            .order('position', { ascending: false })
            .limit(1)
            .single();

          const nextPosition = waitlistData ? waitlistData.position + 1 : 1;

          const { error: insertError } = await supabase
            .from('program_waitlist')
            .insert({
              user_id: user.id,
              program_id: interestProgram.id,
              scheduled_date_id: selection,
              position: nextPosition,
            });

          if (insertError) throw insertError;

          toast({
            title: "Added to Waiting List",
            description: `This session is full. You're #${nextPosition} on the waiting list. We'll notify you if a spot opens up.`,
          });

          setInterestProgram(null);
          setIsSubmittingInterest(false);
          return;
        }

        // Increment enrolled_count for the selected schedule
        const updatedSchedules = scheduledDates.map(s =>
          s.id === selection
            ? { ...s, enrolled_count: (s.enrolled_count || 0) + 1 }
            : s
        );

        await supabase
          .from('programs')
          .update({ scheduled_dates: updatedSchedules })
          .eq('id', interestProgram.id);
      }

      const insertData: any = {
        user_id: user.id,
        program_id: interestProgram.id,
      };

      if (isScheduledDate) {
        insertData.scheduled_date_id = selection;
        insertData.enrollment_timeframe = 'scheduled';
      } else {
        insertData.enrollment_timeframe = selection;
      }

      // Add preferred tier if available
      if (preferredTier) {
        insertData.preferred_tier = preferredTier;
      }

      // Add cross-completion data if available
      if (crossCompletions && crossCompletions.length > 0) {
        insertData.completed_modules_elsewhere = crossCompletions;
        insertData.suggested_discount_percent = suggestedDiscount || 0;
      }

      const { error } = await supabase
        .from('program_interest_registrations')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Interest Registered! 📝",
        description: preferredTier 
          ? `An administrator will contact you soon about ${preferredTier} tier enrollment options.`
          : "An administrator will contact you soon about enrollment options.",
      });

      // Update local state
      setPrograms(prev => prev.map(p => 
        p.id === interestProgram.id ? { ...p, hasInterest: true } : p
      ));
      
      setInterestProgram(null);
    } catch (error: any) {
      console.error('Error expressing interest:', error);
      if (error.code === '23505') {
        toast({ title: "You've already expressed interest in this program", variant: "destructive" });
      } else {
        toast({ title: "Failed to register interest", variant: "destructive" });
      }
    } finally {
      setIsSubmittingInterest(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cta':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'leadership':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'executive':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'ai':
        return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
      case 'deep-dive':
        return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = programCategories.find(c => c.key === category);
    return cat?.name || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const filteredPrograms = programs.filter((program) => {
    const matchesSearch = program.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || program.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Sort within each group: Recommended first, then favorites, then enrolled, then available, then completed
  const sortPrograms = (progs: Program[]) => {
    return [...progs].sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      if (a.isRecommended && b.isRecommended) {
        return (b.recommendationScore || 0) - (a.recommendationScore || 0);
      }
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.isEnrolled && !a.isCompleted && (!b.isEnrolled || b.isCompleted)) return -1;
      if ((!a.isEnrolled || a.isCompleted) && b.isEnrolled && !b.isCompleted) return 1;
      if (!a.isEnrolled && !a.isCompleted && (b.isEnrolled || b.isCompleted)) return -1;
      if ((a.isEnrolled || a.isCompleted) && !b.isEnrolled && !b.isCompleted) return 1;
      return 0;
    });
  };

  // Group programs by category
  const programsByCategory = useMemo(() => {
    const categoryOrder = ['cta', 'leadership', 'executive', 'ai', 'deep-dive'];
    const groups: { category: string; programs: Program[] }[] = [];
    
    categoryOrder.forEach(cat => {
      const catPrograms = filteredPrograms.filter(p => p.category === cat);
      if (catPrograms.length > 0) {
        groups.push({ category: cat, programs: sortPrograms(catPrograms) });
      }
    });
    
    // Handle any unknown categories
    const knownCategories = new Set(categoryOrder);
    const otherPrograms = filteredPrograms.filter(p => !knownCategories.has(p.category));
    if (otherPrograms.length > 0) {
      groups.push({ category: 'other', programs: sortPrograms(otherPrograms) });
    }
    
    return groups;
  }, [filteredPrograms]);

  // Track collapsed state for each category
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate('/programs')} className="cursor-pointer">
                Programs
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Explore</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading programs...</div>
        </div>
      </div>
    );
  }

  const ProgramCard = ({ program }: { program: Program }) => {
    const accessInfo = programAccessMap.get(program.id);
    const isPlanLocked = accessInfo?.isLocked && !program.isEnrolled;
    const requiredPlanName = accessInfo?.requiredTier ? getPlanNameForTier(accessInfo.requiredTier) : '';
    
    return (
      <Card
        key={program.id}
        className={`relative transition-all ${
          program.isCompleted
            ? 'opacity-60'
            : isPlanLocked
            ? 'opacity-80 border-dashed'
            : 'hover:shadow-lg'
        } ${
          program.isEnrolled && !program.isCompleted
            ? 'ring-2 ring-primary/50'
            : ''
        }`}
      >
        {program.isEnrolled && !program.isCompleted && (
          <div className="absolute -top-2 -left-2 z-10">
            <Badge className="bg-primary text-primary-foreground border-0 shadow-lg text-sm font-semibold px-3 py-1">
              <BookOpen className="h-4 w-4 mr-1" />
              Enrolled
            </Badge>
          </div>
        )}
        
        {program.isRecommended && !isPlanLocked && (
          <div className="absolute -top-2 -right-2 z-10">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg">
              <Sparkles className="h-3 w-3 mr-1" />
              Recommended
            </Badge>
          </div>
        )}

        {isPlanLocked && (
          <div className="absolute -top-2 -right-2 z-10">
            <PlanLockBadge requiredPlanName={requiredPlanName} reason={accessInfo?.reason} />
          </div>
        )}
        
        <button
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-muted transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFavorite(program.id);
          }}
        >
          <Heart
            className={`h-5 w-5 ${
              program.isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
            }`}
          />
        </button>

        <CardHeader>
          <div className="flex items-start justify-between gap-2 pr-12">
            <div className="flex-1">
              <CardTitle className="line-clamp-2 mb-2">
                {program.name}
              </CardTitle>
              <CardDescription className="line-clamp-3">
                {program.description?.replace(/<[^>]*>/g, '') || ''}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge className={getCategoryColor(program.category)}>
              {program.category}
            </Badge>
            {program.isCompleted && (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
            {program.hasInterest && !program.isEnrolled && (
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                <Clock className="h-3 w-3 mr-1" />
                Interest Registered
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handlePreviewProgram(program)}
          >
            View Details
          </Button>
          {isPlanLocked ? (
            <Button variant="secondary" className="w-full" onClick={() => navigate('/subscription')}>
              <Lock className="h-4 w-4 mr-2" />
              Upgrade to Unlock
            </Button>
          ) : program.hasActiveEnrollment ? (
            <Button className="w-full" onClick={() => navigate(`/programs/${program.id}`)}>
              Continue Learning
            </Button>
          ) : program.isCompleted && program.allow_repeat_enrollment ? (
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => navigate(`/programs/${program.id}`)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                View Completed {program.enrollmentCount && program.enrollmentCount > 1 ? `(${program.enrollmentCount})` : ''}
              </Button>
              <Button 
                className="w-full" 
                onClick={() => setInterestProgram(program)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Enroll Again
              </Button>
            </div>
          ) : program.isCompleted ? (
            <Button variant="outline" className="w-full" onClick={() => navigate(`/programs/${program.id}`)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              View Completed
            </Button>
          ) : program.hasInterest ? (
            <Button variant="outline" className="w-full" disabled>
              <Clock className="h-4 w-4 mr-2" />
              Interest Registered
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => setInterestProgram(program)}
            >
              Express Interest
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/programs')} className="cursor-pointer">
              Programs
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Explore</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Explore InnoTrue Programs</h1>
        <p className="text-muted-foreground">
          Discover all available programs and continue your learning journey
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Programs</TabsTrigger>
          <TabsTrigger value="favorites">
            My Favorites ({favoritePrograms.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {programCategories.map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {programsByCategory.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                  <Search className="h-16 w-16 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Programs Found</h3>
                    <p className="text-muted-foreground">
                      No programs match your search criteria. Try adjusting your filters.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {programsByCategory.map(({ category, programs: catPrograms }) => (
                <Collapsible
                  key={category}
                  open={!collapsedCategories.has(category)}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-3 w-full text-left group py-2">
                      <ChevronDown 
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          collapsedCategories.has(category) ? '-rotate-90' : ''
                        }`} 
                      />
                      <h2 className="text-xl font-semibold">{getCategoryLabel(category)}</h2>
                      <Badge variant="secondary" className="ml-2">
                        {catPrograms.length}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                      {catPrograms.map((program) => (
                        <ProgramCard key={program.id} program={program} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="favorites" className="space-y-6">
          {favoritePrograms.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                  <Heart className="h-16 w-16 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Favorites Yet</h3>
                    <p className="text-muted-foreground">
                      Click the heart icon on any program to add it to your favorites.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {favoritePrograms.map((program) => (
                <ProgramCard key={program.id} program={program} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Program Preview Dialog */}
      <ProgramPreviewDialog
        open={!!previewProgram}
        onOpenChange={(open) => !open && setPreviewProgram(null)}
        program={previewProgram}
        modules={previewModules}
        skills={previewSkills}
        instructors={previewInstructors}
        coaches={previewCoaches}
        crossCompletions={previewCrossCompletions || undefined}
      />

      {/* Express Interest Dialog */}
      <ExpressInterestDialog
        open={!!interestProgram}
        onOpenChange={(open) => !open && setInterestProgram(null)}
        programName={interestProgram?.name || ''}
        scheduledDates={interestProgram?.scheduled_dates}
        availableTiers={interestProgram?.tiers || []}
        onSubmit={handleExpressInterest}
        isSubmitting={isSubmittingInterest}
        crossCompletions={interestCrossCompletions || undefined}
      />
    </div>
  );
}
