import { useAuth } from '@/contexts/AuthContext';
import { OrganizationTermsManager } from '@/components/admin/OrganizationTermsManager';

export default function OrgTerms() {
  const { organizationMembership } = useAuth();

  if (!organizationMembership?.organization_id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">No organization found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Terms & Conditions</h1>
        <p className="text-muted-foreground">
          Manage your organization's terms and conditions that members must accept
        </p>
      </div>
      <OrganizationTermsManager organizationId={organizationMembership.organization_id} />
    </div>
  );
}
