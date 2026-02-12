import { useUserTracks } from "@/hooks/useUserTracks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Check } from "lucide-react";

export function TrackSelector() {
  const { allTracks, userTracks, isLoading, toggleTrack, isToggling } = useUserTracks();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isTrackActive = (trackId: string) => {
    const userTrack = userTracks?.find((ut) => ut.track_id === trackId);
    return userTrack?.is_active ?? false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          My Tracks
        </CardTitle>
        <CardDescription>
          Select which tracks are relevant to you. This customizes your experience to show only what
          matters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {allTracks?.map((track) => {
          const isActive = isTrackActive(track.id);
          return (
            <div
              key={track.id}
              className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`track-${track.id}`}
                    className="text-base font-medium cursor-pointer"
                  >
                    {track.name}
                  </Label>
                  {isActive && (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
                {track.description && (
                  <p className="text-sm text-muted-foreground">{track.description}</p>
                )}
              </div>
              <Switch
                id={`track-${track.id}`}
                checked={isActive}
                onCheckedChange={(checked) => toggleTrack({ trackId: track.id, isActive: checked })}
                disabled={isToggling}
              />
            </div>
          );
        })}

        {(!allTracks || allTracks.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No tracks available</p>
        )}
      </CardContent>
    </Card>
  );
}
