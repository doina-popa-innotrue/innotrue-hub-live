import { useMemo } from 'react';
import { TourStep } from '@/hooks/useOnboardingTour';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { 
  adminTourSteps, 
  instructorTourSteps, 
  clientTourSteps, 
  orgAdminTourSteps 
} from '@/data/tourSteps';

/**
 * Feature key mappings for tour steps.
 * Maps tour target selectors to the feature keys that control their visibility.
 * Steps without a mapping are always shown.
 */
const tourStepFeatureMapping: Record<string, string> = {
  // Client tour step mappings
  '[data-tour="client-groups"]': 'groups',
  '[data-tour="client-guided-paths"]': 'guided_paths',
  '[data-tour="client-analytics"]': 'usage',
  '[data-tour="client-recommendations"]': 'ai_recommendations',
  '[data-tour="client-external-courses"]': 'external_courses',
  '[data-tour="client-goals"]': 'goals',
  '[data-tour="client-decisions"]': 'decision_toolkit_basic',
  '[data-tour="client-tasks"]': 'tasks',
  '[data-tour="client-development-items"]': 'development_items',
  '[data-tour="client-timeline"]': 'development_timeline',
  '[data-tour="client-credits"]': 'credits',
  '[data-tour="client-wheel-of-life"]': 'wheel_of_life',
  '[data-tour="client-assessments"]': 'assessments',
  
  // Instructor tour step mappings
  '[data-tour="teaching-groups"]': 'groups',
  '[data-tour="teaching-shared-goals"]': 'goals',
  '[data-tour="coaching-decisions"]': 'decision_toolkit_basic',
  '[data-tour="coaching-tasks"]': 'tasks',
  
  // Admin tour step mappings (mostly always visible for admins, but some can be gated)
  '[data-tour="admin-guided-paths"]': 'guided_paths',
  '[data-tour="admin-groups"]': 'groups',
  '[data-tour="admin-credit-services"]': 'credits',
  
  // Org admin mappings
  '[data-tour="org-admin-analytics"]': 'org_analytics',
};

/**
 * Returns tour steps filtered by the user's current entitlements.
 * Steps for features the user doesn't have access to are excluded.
 */
export function useDynamicTourSteps(role: 'admin' | 'instructor' | 'client' | 'org_admin') {
  const { hasFeature, isLoading } = useEntitlements();
  const { userRoles } = useAuth();
  
  const isAdmin = userRoles.includes('admin');
  
  const baseSteps = useMemo(() => {
    switch (role) {
      case 'admin':
        return adminTourSteps;
      case 'instructor':
        return instructorTourSteps;
      case 'client':
        return clientTourSteps;
      case 'org_admin':
        return orgAdminTourSteps;
      default:
        return [];
    }
  }, [role]);
  
  const filteredSteps = useMemo(() => {
    // Admins see all steps regardless of feature visibility
    if (isAdmin) {
      return baseSteps;
    }
    
    // For non-admins, filter based on entitlements
    return baseSteps.filter((step: TourStep) => {
      const featureKey = tourStepFeatureMapping[step.target];
      
      // If no feature mapping exists, the step is always visible
      if (!featureKey) {
        return true;
      }
      
      // Check if user has access to this feature
      return hasFeature(featureKey);
    });
  }, [baseSteps, isAdmin, hasFeature]);
  
  return {
    steps: filteredSteps,
    isLoading,
    totalSteps: filteredSteps.length,
  };
}

/**
 * Get the appropriate tour steps for the user's active role.
 * Used to dynamically select which tour to show based on context.
 */
export function getFilteredTourStepsForRole(
  role: 'admin' | 'instructor' | 'client' | 'org_admin',
  hasFeatureFn: (key: string) => boolean,
  isAdmin: boolean = false
): TourStep[] {
  let baseSteps: TourStep[];
  
  switch (role) {
    case 'admin':
      baseSteps = adminTourSteps;
      break;
    case 'instructor':
      baseSteps = instructorTourSteps;
      break;
    case 'client':
      baseSteps = clientTourSteps;
      break;
    case 'org_admin':
      baseSteps = orgAdminTourSteps;
      break;
    default:
      baseSteps = [];
  }
  
  // Admins see all steps
  if (isAdmin) {
    return baseSteps;
  }
  
  // Filter for non-admins
  return baseSteps.filter((step) => {
    const featureKey = tourStepFeatureMapping[step.target];
    if (!featureKey) return true;
    return hasFeatureFn(featureKey);
  });
}
