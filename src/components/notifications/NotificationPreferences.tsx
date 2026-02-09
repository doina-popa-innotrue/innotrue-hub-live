import { 
  Bell, Mail, Monitor, Lock, RotateCcw,
  BookOpen, Calendar, FileText, Target, Scale, 
  CreditCard, Users, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useNotificationPreferences, NotificationTypeWithPreference } from '@/hooks/useNotificationPreferences';
import { cn } from '@/lib/utils';

const categoryIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'programs': BookOpen,
  'sessions': Calendar,
  'assignments': FileText,
  'goals': Target,
  'decisions': Scale,
  'credits': CreditCard,
  'groups': Users,
  'system': Settings,
};

export function NotificationPreferences() {
  const {
    typesByCategory,
    isLoading,
    updatePreference,
    bulkUpdateCategory,
    resetToDefaults,
    isUpdating,
  } = useNotificationPreferences();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleToggle = (
    type: NotificationTypeWithPreference,
    field: 'email_enabled' | 'in_app_enabled',
    value: boolean
  ) => {
    // Can't disable critical notifications
    if (type.is_critical) return;

    updatePreference({
      typeId: type.id,
      emailEnabled: field === 'email_enabled' ? value : type.email_enabled,
      inAppEnabled: field === 'in_app_enabled' ? value : type.in_app_enabled,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose how you want to be notified about different activities
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetToDefaults()}
            disabled={isUpdating}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex items-center gap-6 mb-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>Email</span>
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <span>In-App</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span>Critical (cannot disable)</span>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={typesByCategory.map(c => c.key)} className="space-y-2">
          {typesByCategory.map((category) => {
            const CategoryIcon = categoryIconMap[category.key] || Bell;
            const allEmailEnabled = category.types.filter(t => !t.is_critical).every(t => t.email_enabled);
            const allInAppEnabled = category.types.filter(t => !t.is_critical).every(t => t.in_app_enabled);

            return (
              <AccordionItem key={category.id} value={category.key} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <CategoryIcon className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">{category.name}</div>
                      {category.description && (
                        <div className="text-sm text-muted-foreground font-normal">
                          {category.description}
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {/* Category-level controls */}
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                    <span className="text-sm text-muted-foreground">Toggle all:</span>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Switch
                        checked={allEmailEnabled}
                        onCheckedChange={(checked) => 
                          bulkUpdateCategory({ categoryId: category.id, emailEnabled: checked })
                        }
                        disabled={isUpdating}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <Switch
                        checked={allInAppEnabled}
                        onCheckedChange={(checked) => 
                          bulkUpdateCategory({ categoryId: category.id, inAppEnabled: checked })
                        }
                        disabled={isUpdating}
                      />
                    </div>
                  </div>

                  {/* Individual notification types */}
                  <div className="space-y-4">
                    {category.types.map((type) => (
                      <div
                        key={type.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg',
                          type.is_critical ? 'bg-muted/50' : 'hover:bg-muted/30'
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label className="font-medium">{type.name}</Label>
                            {type.is_critical && (
                              <Badge variant="outline" className="text-xs">
                                <Lock className="h-3 w-3 mr-1" />
                                Critical
                              </Badge>
                            )}
                          </div>
                          {type.description && (
                            <p className="text-sm text-muted-foreground">{type.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <Switch
                              checked={type.email_enabled}
                              onCheckedChange={(checked) => 
                                handleToggle(type, 'email_enabled', checked)
                              }
                              disabled={type.is_critical || isUpdating}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            <Switch
                              checked={type.in_app_enabled}
                              onCheckedChange={(checked) => 
                                handleToggle(type, 'in_app_enabled', checked)
                              }
                              disabled={type.is_critical || isUpdating}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
