import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  HelpCircle 
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ExternalCalendar {
  id: string;
  name: string;
  ical_url: string;
  color: string;
  is_active: boolean;
  last_synced_at: string | null;
}

interface ExternalCalendarManagerProps {
  onCalendarsChange?: () => void;
}

const COLOR_OPTIONS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f97316', label: 'Orange' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#64748b', label: 'Slate' },
];

// Detect common incorrect URL patterns
function detectUrlIssue(url: string): { hasIssue: boolean; message: string } {
  const trimmedUrl = url.trim().toLowerCase();
  
  // Google Calendar web page link (not iCal)
  if (trimmedUrl.includes('calendar.google.com/calendar/u/') && !trimmedUrl.includes('/ical/')) {
    return {
      hasIssue: true,
      message: 'This looks like a Google Calendar web link, not an iCal feed. Use the "Secret address in iCal format" instead.'
    };
  }
  
  // Google Calendar sharing link
  if (trimmedUrl.includes('calendar.google.com') && trimmedUrl.includes('?cid=')) {
    return {
      hasIssue: true,
      message: 'This is a calendar sharing link. You need the iCal feed URL (ends with .ics).'
    };
  }
  
  // Outlook web link
  if (trimmedUrl.includes('outlook.live.com/calendar') && !trimmedUrl.includes('/ical/') && !trimmedUrl.includes('.ics')) {
    return {
      hasIssue: true,
      message: 'This looks like an Outlook web link. Use the iCal subscription URL from sharing settings.'
    };
  }
  
  return { hasIssue: false, message: '' };
}

export function ExternalCalendarManager({ onCalendarsChange }: ExternalCalendarManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [calendars, setCalendars] = useState<ExternalCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    eventCount?: number;
  } | null>(null);
  
  const [newCalendar, setNewCalendar] = useState({
    name: '',
    ical_url: '',
    color: '#6366f1',
  });

  const urlWarning = newCalendar.ical_url ? detectUrlIssue(newCalendar.ical_url) : null;

  useEffect(() => {
    if (user) {
      loadCalendars();
    }
  }, [user]);

  // Reset test result when URL changes
  useEffect(() => {
    setTestResult(null);
  }, [newCalendar.ical_url]);

  const loadCalendars = async () => {
    try {
      const { data, error } = await supabase
        .from('user_external_calendars')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCalendars(data || []);
    } catch (error: any) {
      console.error('Error loading calendars:', error);
      toast({
        title: 'Error',
        description: 'Failed to load external calendars',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestFeed = async () => {
    if (!newCalendar.ical_url.trim()) {
      toast({
        title: 'Missing URL',
        description: 'Please enter an iCal feed URL to test',
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(newCalendar.ical_url);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-ical-feed', {
        body: {
          testOnly: true,
          testUrl: newCalendar.ical_url.trim(),
        },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult({
          success: true,
          message: data.message,
          eventCount: data.eventCount,
        });
      } else {
        setTestResult({
          success: false,
          message: data?.error || 'Failed to validate the feed',
        });
      }
    } catch (error: any) {
      console.error('Error testing feed:', error);
      setTestResult({
        success: false,
        message: error.message || 'Failed to test the calendar feed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAddCalendar = async () => {
    if (!newCalendar.name.trim() || !newCalendar.ical_url.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide both a name and iCal URL',
        variant: 'destructive',
      });
      return;
    }

    // Require successful test before adding
    if (!testResult?.success) {
      toast({
        title: 'Test required',
        description: 'Please test the feed URL before adding the calendar',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_external_calendars')
        .insert({
          user_id: user?.id,
          name: newCalendar.name.trim(),
          ical_url: newCalendar.ical_url.trim(),
          color: newCalendar.color,
        });

      if (error) throw error;

      toast({
        title: 'Calendar added',
        description: `Connected "${newCalendar.name}" with ${testResult.eventCount || 0} events`,
      });
      
      setNewCalendar({ name: '', ical_url: '', color: '#6366f1' });
      setTestResult(null);
      setDialogOpen(false);
      loadCalendars();
      onCalendarsChange?.();
    } catch (error: any) {
      console.error('Error adding calendar:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add calendar',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (calendar: ExternalCalendar) => {
    try {
      const { error } = await supabase
        .from('user_external_calendars')
        .update({ is_active: !calendar.is_active })
        .eq('id', calendar.id);

      if (error) throw error;

      setCalendars(prev => 
        prev.map(c => c.id === calendar.id ? { ...c, is_active: !c.is_active } : c)
      );
      onCalendarsChange?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update calendar',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCalendar = async (calendarId: string) => {
    try {
      const { error } = await supabase
        .from('user_external_calendars')
        .delete()
        .eq('id', calendarId);

      if (error) throw error;

      toast({
        title: 'Calendar removed',
        description: 'The external calendar has been disconnected',
      });
      
      setCalendars(prev => prev.filter(c => c.id !== calendarId));
      onCalendarsChange?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to remove calendar',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Reset state when closing
      setNewCalendar({ name: '', ical_url: '', color: '#6366f1' });
      setTestResult(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading calendars...</div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              External Calendars
            </CardTitle>
            <CardDescription className="text-sm">
              Connect your Google, Outlook, or Apple calendar to see all your events
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Calendar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add External Calendar</DialogTitle>
                <DialogDescription>
                  Connect an external calendar using its iCal feed URL. This is read-only and helps you see scheduling conflicts.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="cal-name">Calendar Name</Label>
                  <Input
                    id="cal-name"
                    placeholder="e.g., Work Calendar"
                    value={newCalendar.name}
                    onChange={(e) => setNewCalendar(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cal-url">iCal Feed URL</Label>
                  <Input
                    id="cal-url"
                    placeholder="https://calendar.google.com/calendar/ical/...basic.ics"
                    value={newCalendar.ical_url}
                    onChange={(e) => setNewCalendar(prev => ({ ...prev, ical_url: e.target.value }))}
                  />
                  
                  {/* URL Warning */}
                  {urlWarning?.hasIssue && (
                    <Alert variant="destructive" className="py-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {urlWarning.message}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Test Result */}
                  {testResult && (
                    <Alert 
                      variant={testResult.success ? "default" : "destructive"} 
                      className="py-2"
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <AlertDescription className="text-xs">
                        {testResult.message}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleTestFeed}
                    disabled={testing || !newCalendar.ical_url.trim()}
                    className="w-full"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing Feed...
                      </>
                    ) : (
                      'Test Feed URL'
                    )}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    {COLOR_OPTIONS.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          newCalendar.color === color.value 
                            ? 'border-foreground scale-110' 
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setNewCalendar(prev => ({ ...prev, color: color.value }))}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Help Section */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="help" className="border-none">
                    <AccordionTrigger className="text-sm py-2 hover:no-underline">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <HelpCircle className="h-4 w-4" />
                        How to find your iCal URL
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-xs text-muted-foreground">
                        <div>
                          <p className="font-medium text-foreground mb-1">Google Calendar:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Open Google Calendar Settings (gear icon)</li>
                            <li>Click on your calendar under "Settings for my calendars"</li>
                            <li>Scroll to "Integrate calendar"</li>
                            <li>Copy "Secret address in iCal format"</li>
                          </ol>
                        </div>
                        <div>
                          <p className="font-medium text-foreground mb-1">Outlook:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Go to Calendar Settings → Shared calendars</li>
                            <li>Under "Publish a calendar", select your calendar</li>
                            <li>Click "Publish" and copy the ICS link</li>
                          </ol>
                        </div>
                        <div>
                          <p className="font-medium text-foreground mb-1">Apple Calendar:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Right-click on a calendar → Share Calendar</li>
                            <li>Enable "Public Calendar"</li>
                            <li>Copy the subscription URL</li>
                          </ol>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddCalendar} 
                  disabled={submitting || !testResult?.success}
                >
                  {submitting ? 'Adding...' : 'Add Calendar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {calendars.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No external calendars connected yet
          </p>
        ) : (
          <div className="space-y-3">
            {calendars.map(calendar => (
              <div
                key={calendar.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: calendar.color }}
                  />
                  <div>
                    <p className="font-medium text-sm">{calendar.name}</p>
                    {calendar.last_synced_at && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {new Date(calendar.last_synced_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={calendar.is_active}
                    onCheckedChange={() => handleToggleActive(calendar)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteCalendar(calendar.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            <a 
              href="https://support.google.com/calendar/answer/37648" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              How to get your Google Calendar iCal URL
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
