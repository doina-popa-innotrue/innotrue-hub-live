import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicIcon } from "@/components/admin/IconPicker";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Newspaper, Pin } from "lucide-react";

interface AnnouncementCategory {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string | null;
  icon: string | null;
  is_pinned: boolean;
  display_order: number;
  created_at: string;
  announcement_categories: AnnouncementCategory | null;
}

const colorClasses: Record<string, { bg: string; border: string; icon: string }> = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: "text-blue-600 dark:text-blue-400",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    icon: "text-green-600 dark:text-green-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    icon: "text-amber-600 dark:text-amber-400",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    icon: "text-orange-600 dark:text-orange-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    icon: "text-red-600 dark:text-red-400",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    icon: "text-purple-600 dark:text-purple-400",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-800",
    icon: "text-pink-600 dark:text-pink-400",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
};

const ROLLING_INTERVAL_MS = 8000; // Rotate every 8 seconds

function AnnouncementCard({
  announcement,
  isPinned,
}: {
  announcement: Announcement;
  isPinned?: boolean;
}) {
  const color = announcement.announcement_categories?.color || "blue";
  const colorClass = colorClasses[color] || colorClasses.blue;
  const iconName = announcement.icon || announcement.announcement_categories?.icon || "Info";
  const categoryLabel = announcement.announcement_categories?.label;

  return (
    <div className={cn("rounded-lg border p-4", colorClass.bg, colorClass.border)}>
      <div className="flex gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", colorClass.icon)}>
          <DynamicIcon name={iconName} className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isPinned && <Pin className="h-3 w-3 text-muted-foreground" />}
            {categoryLabel && (
              <span className={cn("text-xs font-medium uppercase tracking-wide", colorClass.icon)}>
                {categoryLabel}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-foreground">{announcement.title}</h4>
          {announcement.content && (
            <div className="mt-1 text-sm text-muted-foreground prose prose-sm max-w-none break-words [&_a]:break-all">
              <RichTextDisplay content={announcement.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnnouncementsWidget() {
  const [rollingIndex, setRollingIndex] = useState(0);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["active-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*, announcement_categories(*)")
        .eq("is_active", true)
        .order("is_pinned", { ascending: false })
        .order("display_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  // Separate pinned and rolling announcements
  const pinnedAnnouncements = announcements.filter((a) => a.is_pinned);
  const rollingAnnouncements = announcements.filter((a) => !a.is_pinned);

  // Rotate through rolling announcements
  const advanceRolling = useCallback(() => {
    if (rollingAnnouncements.length > 1) {
      setRollingIndex((prev) => (prev + 1) % rollingAnnouncements.length);
    }
  }, [rollingAnnouncements.length]);

  useEffect(() => {
    if (rollingAnnouncements.length <= 1) return;

    const interval = setInterval(advanceRolling, ROLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [advanceRolling, rollingAnnouncements.length]);

  // Reset rolling index if announcements change
  useEffect(() => {
    setRollingIndex(0);
  }, [announcements.length]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (announcements.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No announcements"
        description="Check back later for the latest news and updates"
      />
    );
  }

  const currentRollingAnnouncement = rollingAnnouncements[rollingIndex];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DynamicIcon name="Newspaper" className="h-5 w-5" />
          Relevant News on the InnoTrue Hub
        </CardTitle>
        <CardDescription>Latest updates and announcements</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pinned announcements always shown first */}
        {pinnedAnnouncements.map((announcement) => (
          <AnnouncementCard key={announcement.id} announcement={announcement} isPinned />
        ))}

        {/* Rolling announcement (one at a time, cycles through) */}
        {currentRollingAnnouncement && (
          <div className="relative">
            <AnnouncementCard announcement={currentRollingAnnouncement} />
            {rollingAnnouncements.length > 1 && (
              <div className="flex justify-center gap-1 mt-2">
                {rollingAnnouncements.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setRollingIndex(idx)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      idx === rollingIndex
                        ? "w-4 bg-primary"
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                    )}
                    aria-label={`Go to announcement ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
