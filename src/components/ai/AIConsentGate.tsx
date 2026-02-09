import { ReactNode } from 'react';
import { useAIPreferences } from '@/hooks/useAIPreferences';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AIPrivacyNotice } from './AIPrivacyNotice';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AIConsentGateProps {
  feature: 'insights' | 'recommendations';
  title: string;
  description: string;
  children: ReactNode;
}

export function AIConsentGate({ feature, title, description, children }: AIConsentGateProps) {
  const { preferences, isLoading, giveConsent } = useAIPreferences();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isEnabled = feature === 'insights' 
    ? preferences?.ai_insights_enabled 
    : preferences?.ai_recommendations_enabled;

  if (!isEnabled) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AIPrivacyNotice />
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => giveConsent(feature)} size="lg">
              <Sparkles className="mr-2 h-4 w-4" />
              Enable AI {feature === 'insights' ? 'Insights' : 'Recommendations'}
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate('/account')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage AI Settings
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            You can disable this feature at any time in Account Settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
