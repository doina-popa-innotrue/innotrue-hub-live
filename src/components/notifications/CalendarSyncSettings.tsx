import { useState } from "react";
import { Calendar, Copy, Check, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { useToast } from "@/hooks/use-toast";

export function CalendarSyncSettings() {
  const { toast } = useToast();
  const { isEnabled, feedUrl, isLoading, toggleSync, regenerateToken, isUpdating } =
    useCalendarSync();

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!feedUrl) return;

    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    toast({ title: "Calendar URL copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Sync
        </CardTitle>
        <CardDescription>
          Subscribe to your sessions and events in your favorite calendar app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="calendar-sync">Enable Calendar Sync</Label>
            <p className="text-sm text-muted-foreground">
              Generate a subscription URL for your calendar app
            </p>
          </div>
          <Switch
            id="calendar-sync"
            checked={isEnabled}
            onCheckedChange={toggleSync}
            disabled={isUpdating}
          />
        </div>

        {isEnabled && feedUrl && (
          <>
            <div className="space-y-2">
              <Label>Calendar Subscription URL</Label>
              <div className="flex gap-2">
                <Input value={feedUrl} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={handleCopy} disabled={copied}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Add this URL to Google Calendar, Apple Calendar, Outlook, or any calendar app that
                supports iCal feeds.
              </p>
            </div>

            {/* Quick add buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`,
                    "_blank",
                  )
                }
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Add to Google Calendar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`webcal://${feedUrl.replace("https://", "")}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Add to Apple Calendar
              </Button>
            </div>

            {/* Regenerate token */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>If your calendar URL has been compromised, you can regenerate it.</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isUpdating}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate URL
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regenerate Calendar URL?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will invalidate your current calendar subscription URL. You'll need to
                        update the URL in any calendar apps that are currently subscribed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => regenerateToken()}>
                        Regenerate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </AlertDescription>
            </Alert>
          </>
        )}

        {!isEnabled && (
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              Enable calendar sync to see your scheduled sessions, group meetings, and assignment
              due dates in your calendar app.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
