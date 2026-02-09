import { useAIPreferences } from '@/hooks/useAIPreferences';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AIPrivacyNotice } from './AIPrivacyNotice';
import { Sparkles, Brain, BookOpen } from 'lucide-react';

export function AIPreferencesSection() {
  const { preferences, isLoading, updatePreference } = useAIPreferences();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Features
        </CardTitle>
        <CardDescription>
          Control which AI-powered features are enabled for your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AIPrivacyNotice />
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="ai-insights" className="text-base font-medium">
                  Decision AI Insights
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get AI-powered analysis of your decision-making patterns and personalized recommendations.
                </p>
              </div>
            </div>
            <Switch
              id="ai-insights"
              checked={preferences?.ai_insights_enabled ?? false}
              onCheckedChange={(checked) => updatePreference('ai_insights_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="ai-recommendations" className="text-base font-medium">
                  Course Recommendations
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive personalized learning path suggestions based on your progress and interests.
                </p>
              </div>
            </div>
            <Switch
              id="ai-recommendations"
              checked={preferences?.ai_recommendations_enabled ?? false}
              onCheckedChange={(checked) => updatePreference('ai_recommendations_enabled', checked)}
            />
          </div>
        </div>

        {preferences?.consent_given_at && (
          <p className="text-xs text-muted-foreground text-center">
            AI features consent given on {new Date(preferences.consent_given_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
