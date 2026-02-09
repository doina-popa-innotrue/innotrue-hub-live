import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

// Map routes to friendly names
const routeNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar': 'Calendar',
  '/programs': 'Programs',
  '/goals': 'Goals',
  '/tasks': 'Tasks',
  '/decisions': 'Decisions',
  '/wheel-of-life': 'Wheel of Life',
  '/development-items': 'Development Items',
  '/development-timeline': 'Timeline',
  '/my-assessments': 'My Assessments',
  '/capability-assessments': 'Capability Assessments',
  '/my-resources': 'My Resources',
  '/guided-paths': 'Guided Paths',
  '/groups': 'Groups',
  '/external-courses': 'External Courses',
  '/explore-programs': 'Explore Programs',
  '/explore-assessments': 'Explore Assessments',
  '/services': 'Services',
  '/credits': 'Credits',
  '/skills-map': 'Skills Map',
  '/learning-analytics': 'Learning Analytics',
  '/teaching': 'Teaching Dashboard',
  '/teaching/students': 'Students',
  '/teaching/shared-goals': 'Shared Goals',
  '/teaching/coaching-decisions': 'Coaching Decisions',
  '/teaching/coaching-tasks': 'Coaching Tasks',
  '/teaching/pending-assignments': 'Pending Assignments',
  '/teaching/badge-approval': 'Badge Approval',
  '/admin': 'Admin Dashboard',
  '/admin/clients': 'Clients',
  '/admin/programs': 'Programs',
  '/admin/organizations': 'Organizations',
  '/admin/capability-assessments': 'Capability Assessments',
  '/admin/credit-services': 'Credit Services',
  '/admin/resources': 'Resources',
  '/admin/modules': 'Modules',
  '/admin/skills': 'Skills',
  '/admin/features': 'Features',
  '/admin/plans': 'Plans',
  '/admin/users': 'Users',
  '/admin/coaches': 'Coaches',
  '/admin/instructors': 'Instructors',
  '/admin/enrollments': 'Enrollments',
  '/admin/groups': 'Groups',
  '/admin/session-types': 'Session Types',
  '/admin/discount-codes': 'Discount Codes',
  '/admin/auth-contexts': 'Auth Contexts',
  '/profile': 'Profile',
  '/account': 'Account Settings',
  '/subscription': 'Subscription',
};

function getRouteName(path: string): string {
  // Check for exact match first
  if (routeNames[path]) {
    return routeNames[path];
  }
  
  // Check for partial matches (for detail pages)
  for (const [route, name] of Object.entries(routeNames)) {
    if (path.startsWith(route + '/')) {
      return name;
    }
  }
  
  // Fallback: extract and format the last segment
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    // Don't show UUIDs
    if (lastSegment.match(/^[0-9a-f-]{36}$/i)) {
      return segments.length > 1 ? segments[segments.length - 2].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Previous Page';
    }
    return lastSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return 'Previous Page';
}

// Keep a stack of navigation history for proper back button labeling
const NAV_HISTORY_KEY = 'navHistory';
const MAX_HISTORY_LENGTH = 50;

function getNavHistory(): string[] {
  try {
    const stored = sessionStorage.getItem(NAV_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function pushNavHistory(path: string): void {
  const history = getNavHistory();
  // Don't add duplicate consecutive entries
  if (history[history.length - 1] === path) return;
  
  // If navigating to the second-to-last page (effectively going "back" via forward navigation),
  // pop the current page instead of pushing - prevents A → B → A → B ping-pong
  if (history.length >= 2 && history[history.length - 2] === path) {
    history.pop();
    sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(history));
    return;
  }
  
  history.push(path);
  // Keep history bounded
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }
  sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(history));
}

function popNavHistory(): string | null {
  const history = getNavHistory();
  if (history.length < 2) return null;
  // Remove current page only
  history.pop();
  // Get the previous page (where we're going) - keep it in history
  const previousPath = history[history.length - 1] || null;
  sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(history));
  return previousPath;
}

function peekPreviousPath(): string | null {
  const history = getNavHistory();
  // Return the second-to-last item (the page before current)
  return history.length >= 2 ? history[history.length - 2] : null;
}

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [canGoBack, setCanGoBack] = useState(false);
  const [previousPath, setPreviousPath] = useState<string | null>(null);

  useEffect(() => {
    // Push current path to our navigation history
    pushNavHistory(location.pathname);
    
    // Check if there's history to go back to
    const isDashboard = location.pathname === '/dashboard';
    const prevPath = peekPreviousPath();
    
    setCanGoBack(!!prevPath && !isDashboard);
    setPreviousPath(prevPath);
  }, [location.pathname]);

  const handleGoBack = () => {
    // Pop current page and get actual target path
    const targetPath = popNavHistory();
    if (targetPath) {
      navigate(targetPath);
    }
  };

  if (!canGoBack) {
    return null;
  }

  const displayName = previousPath ? getRouteName(previousPath) : 'Back';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleGoBack}
      className="gap-2 text-muted-foreground hover:text-foreground mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Back to {displayName}</span>
      <span className="sm:hidden">Back</span>
    </Button>
  );
}
