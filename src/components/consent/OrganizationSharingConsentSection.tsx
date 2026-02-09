import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Eye, Target, Brain, ListTodo, TrendingUp, ClipboardCheck, Lightbulb, FileText } from "lucide-react";
import { useOrganizationSharingConsent } from "@/hooks/useOrganizationSharingConsent";

const consentItems = [
  { 
    key: 'share_goals' as const, 
    label: 'Goals', 
    icon: Target,
    description: 'Allow organization admins to view your goals and milestones'
  },
  { 
    key: 'share_decisions' as const, 
    label: 'Decisions', 
    icon: Brain,
    description: 'Allow organization admins to view your decision journal'
  },
  { 
    key: 'share_tasks' as const, 
    label: 'Tasks', 
    icon: ListTodo,
    description: 'Allow organization admins to view your tasks and action items'
  },
  { 
    key: 'share_progress' as const, 
    label: 'Progress', 
    icon: TrendingUp,
    description: 'Allow organization admins to view your program progress'
  },
  { 
    key: 'share_assessments' as const, 
    label: 'Assessments', 
    icon: ClipboardCheck,
    description: 'Allow organization admins to view your assessment results'
  },
  { 
    key: 'share_development_items' as const, 
    label: 'Development Items', 
    icon: Lightbulb,
    description: 'Allow organization admins to view your development items'
  },
  { 
    key: 'share_assignments' as const, 
    label: 'Assignments', 
    icon: FileText,
    description: 'Allow organization admins to view your assignment submissions'
  },
];

interface OrganizationSharingConsentSectionProps {
  organizationId: string;
  organizationName?: string;
}

export function OrganizationSharingConsentSection({ 
  organizationId, 
  organizationName = 'your organization' 
}: OrganizationSharingConsentSectionProps) {
  const { consent, isLoading, toggleConsent, giveFullConsent, revokeAllConsent, updateConsent } = useOrganizationSharingConsent(organizationId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const enabledCount = consentItems.filter(item => consent?.[item.key]).length;
  const allEnabled = enabledCount === consentItems.length;
  const noneEnabled = enabledCount === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Organization Data Sharing</CardTitle>
          </div>
          <Badge variant={allEnabled ? "default" : noneEnabled ? "secondary" : "outline"}>
            {enabledCount}/{consentItems.length} shared
          </Badge>
        </div>
        <CardDescription>
          Control what data {organizationName} admins can access. Your organization may have their own requirements - check with them if unsure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={giveFullConsent}
            disabled={allEnabled || updateConsent.isPending}
          >
            <Eye className="h-4 w-4 mr-2" />
            Share All
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={revokeAllConsent}
            disabled={noneEnabled || updateConsent.isPending}
          >
            Revoke All
          </Button>
        </div>

        <div className="space-y-4">
          {consentItems.map((item) => {
            const Icon = item.icon;
            const isEnabled = consent?.[item.key] ?? false;

            return (
              <div 
                key={item.key} 
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => toggleConsent(item.key)}
                  disabled={updateConsent.isPending}
                />
              </div>
            );
          })}
        </div>

        {consent?.consent_given_at && (
          <p className="text-xs text-muted-foreground text-center">
            Last updated: {new Date(consent.consent_updated_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
