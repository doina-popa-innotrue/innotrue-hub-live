import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Calendar, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface CheckInWithProfile {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  mood: string | null;
  check_in_date: string;
  created_at: string;
  profile?: { id: string; name: string | null; avatar_url: string | null } | null;
}

export default function GroupCheckInDetail() {
  const { groupId, checkInId } = useParams<{ groupId: string; checkInId: string }>();
  if (!groupId || !checkInId) return null;

  const { data: checkIn, isLoading } = useQuery<CheckInWithProfile | null>({
    queryKey: ["group-check-in", checkInId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_check_ins")
        .select("*")
        .eq("id", checkInId)
        .single();
      if (error) throw error;

      // Fetch author profile
      if (data.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .eq("id", data.user_id)
          .single();
        return { ...data, profile } as CheckInWithProfile;
      }
      return data as CheckInWithProfile;
    },
    enabled: !!checkInId,
  });

  const { data: group } = useQuery({
    queryKey: ["group-basic", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!checkIn) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Check-in not found</p>
            <Button asChild className="mt-4">
              <Link to={`/groups/${groupId}`}>Back to Group</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getMoodEmoji = (mood: string | null) => {
    switch (mood) {
      case "great":
        return "😊";
      case "good":
        return "🙂";
      case "okay":
        return "😐";
      case "struggling":
        return "😔";
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/groups">Groups</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/groups/${groupId}`}>{group?.name || "Group"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Check-in</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" asChild>
        <Link to={`/groups/${groupId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Group
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {checkIn.profile && (
                <Avatar className="h-12 w-12">
                  <AvatarImage src={checkIn.profile.avatar_url || undefined} />
                  <AvatarFallback>{checkIn.profile.name?.charAt(0) || "?"}</AvatarFallback>
                </Avatar>
              )}
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  Check-in from {checkIn.profile?.name || "Unknown"}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(checkIn.check_in_date), "PPP")}</span>
                </div>
              </div>
            </div>
            {checkIn.mood && (
              <Badge variant="outline" className="text-lg">
                {getMoodEmoji(checkIn.mood)} {checkIn.mood}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{checkIn.content}</p>
        </CardContent>
      </Card>
    </div>
  );
}
