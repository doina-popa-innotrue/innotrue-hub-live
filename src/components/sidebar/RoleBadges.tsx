import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

const roleColors: Record<string, string> = {
  admin: 'bg-primary/15 text-primary',
  instructor: 'bg-chart-1/15 text-chart-1',
  coach: 'bg-chart-3/15 text-chart-3',
  client: 'bg-secondary text-secondary-foreground',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  instructor: 'Instructor',
  coach: 'Coach',
  client: 'Client',
};

export function RoleBadges() {
  const { userRoles } = useAuth();

  if (userRoles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2">
      {userRoles.map((role) => (
        <Badge
          key={role}
          variant="secondary"
          className={`text-xs ${roleColors[role] || 'bg-secondary'}`}
        >
          {roleLabels[role]}
        </Badge>
      ))}
    </div>
  );
}
