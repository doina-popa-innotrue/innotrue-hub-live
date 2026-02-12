import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { CalendarSyncSettings } from "@/components/notifications/CalendarSyncSettings";
import { BackButton } from "@/components/navigation/BackButton";

export default function NotificationSettings() {
  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground">
            Manage your notification preferences and calendar sync
          </p>
        </div>
      </div>

      <CalendarSyncSettings />
      <NotificationPreferences />
    </div>
  );
}
