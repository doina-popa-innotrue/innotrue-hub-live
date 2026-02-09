import { PlatformTermsManager } from '@/components/admin/PlatformTermsManager';

export default function PlatformTermsManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Terms Management</h1>
        <p className="text-muted-foreground">
          Manage platform-wide terms and conditions that all users must accept
        </p>
      </div>
      <PlatformTermsManager />
    </div>
  );
}
