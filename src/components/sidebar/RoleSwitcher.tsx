import { Check, ChevronDown } from 'lucide-react';
import { useAuth, UserRoleType } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const roleLabels: Record<string, string> = {
  admin: 'Platform Admin',
  org_admin: 'Org Admin',
  instructor: 'Instructor',
  coach: 'Coach',
  client: 'Client',
};

const roleIcons: Record<string, string> = {
  admin: '👑',
  org_admin: '🏢',
  instructor: '🎓',
  coach: '💼',
  client: '👤',
};

export function RoleSwitcher() {
  const { userRole, userRoles, switchRole, organizationMembership } = useAuth();

  // Only show switcher if user has multiple roles
  if (userRoles.length <= 1) {
    return null;
  }

  // Get display label for org_admin (include org name if available)
  const getDisplayLabel = (role: string) => {
    if (role === 'org_admin' && organizationMembership) {
      return `${organizationMembership.organization_name} Admin`;
    }
    return roleLabels[role] || role;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-background hover:bg-accent"
        >
          <span className="flex items-center gap-2">
            <span>{roleIcons[userRole || 'client']}</span>
            <span className="font-medium truncate">{getDisplayLabel(userRole || 'client')}</span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-background border border-border z-50" align="start">
        {userRoles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => switchRole(role as UserRoleType)}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent"
          >
            <span>{roleIcons[role]}</span>
            <span className="flex-1 truncate">{getDisplayLabel(role)}</span>
            {role === userRole && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
