import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Calendar,
  BookOpen,
  CheckSquare,
  MessageSquare,
  FileText,
  Plus,
  ExternalLink,
  Loader2,
  UserPlus,
  Video,
  CalendarPlus,
  Link as LinkIcon,
  FolderOpen,
  Trash2,
  Hash,
  Clock,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MeetingTimesPreference,
  MeetingTimePreference,
} from "@/components/profile/MeetingTimesPreference";
import { GroupPeerAssessmentsPanel } from "@/components/groups/GroupPeerAssessmentsPanel";
import { format } from "date-fns";
import {
  useGroupSessionMutations,
  getEmptySessionForm,
  SessionFormData,
} from "@/hooks/useGroupSessionMutations";
import { FeatureGate } from "@/components/FeatureGate";
import { GroupSessionsList } from "@/components/groups/sessions";
import { SessionMismatchGuard } from "@/components/auth/SessionMismatchGuard";
import { ErrorState } from "@/components/ui/error-state";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("sessions");
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [deleteSessionDialog, setDeleteSessionDialog] = useState<{
    open: boolean;
    session: any | null;
    deleteAll: boolean;
  }>({ open: false, session: null, deleteAll: false });

  // Form states
  const [taskForm, setTaskForm] = useState({ title: "", description: "", due_date: "" });
  const [checkInForm, setCheckInForm] = useState({ content: "", mood: "" });
  const [noteForm, setNoteForm] = useState({ title: "", content: "" });
  const [linkForm, setLinkForm] = useState({ title: "", url: "", description: "" });

  // Fetch group details
  const { data: group, isLoading: loadingGroup } = useQuery({
    queryKey: ["group", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select(`*, programs (name)`)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch current user's profile for timezone
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-tz", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const userTimezone = userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Check membership (role/status row may be hidden by access rules, so we also
  // compute membership via the backend helper to reliably gate the UI)
  const { data: membership } = useQuery({
    queryKey: ["group-membership", id, user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("group_memberships")
        .select("*")
        .eq("group_id", id!)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user?.id,
  });

  const { data: isMemberFlag } = useQuery({
    queryKey: ["is-group-member", id, user?.id],
    queryFn: async () => {
      if (!user || !id) throw new Error("Missing user or group id");
      const { data, error } = await supabase.rpc("is_group_member", {
        _user_id: user.id,
        _group_id: id!,
      });
      if (error) throw error;
      return Boolean(data);
    },
    enabled: !!id && !!user?.id,
  });

  // Fetch members with email via secure RPC
  const { data: members } = useQuery({
    queryKey: ["group-members", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_member_directory", { _group_id: id! });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch tasks with creator profiles
  const { data: tasks } = useQuery({
    queryKey: ["group-tasks", id],
    queryFn: async () => {
      const { data: tasksData, error } = await supabase
        .from("group_tasks")
        .select("*")
        .eq("group_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set((tasksData ?? []).map((t: any) => t.created_by).filter(Boolean)),
      ) as string[];

      if (userIds.length === 0) return tasksData;

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileById = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
      return (tasksData ?? []).map((t: any) => ({
        ...t,
        profiles: profileById.get(t.created_by) ?? null,
      }));
    },
    enabled: !!id,
  });

  // Fetch check-ins
  const { data: checkIns } = useQuery({
    queryKey: ["group-check-ins", id],
    queryFn: async () => {
      const { data: checkInsData, error } = await supabase
        .from("group_check_ins")
        .select("*")
        .eq("group_id", id!)
        .order("check_in_date", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set((checkInsData ?? []).map((c: any) => c.user_id).filter(Boolean)),
      ) as string[];

      if (userIds.length === 0) return checkInsData;

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileById = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
      return (checkInsData ?? []).map((c: any) => ({
        ...c,
        profiles: profileById.get(c.user_id) ?? null,
      }));
    },
    enabled: !!id,
  });

  // Fetch notes
  const { data: notes } = useQuery({
    queryKey: ["group-notes", id],
    queryFn: async () => {
      const { data: notesData, error } = await supabase
        .from("group_notes")
        .select("*")
        .eq("group_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set((notesData ?? []).map((n: any) => n.created_by).filter(Boolean)),
      ) as string[];

      if (userIds.length === 0) return notesData;

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileById = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
      return (notesData ?? []).map((n: any) => ({
        ...n,
        profiles: profileById.get(n.created_by) ?? null,
      }));
    },
    enabled: !!id,
  });

  // Fetch sessions with booker profiles
  const { data: sessions } = useQuery({
    queryKey: ["group-sessions", id],
    queryFn: async () => {
      const { data: sessionsData, error } = await supabase
        .from("group_sessions")
        .select("*")
        .eq("group_id", id!)
        .order("session_date", { ascending: true });
      if (error) throw error;

      const userIds = Array.from(
        new Set((sessionsData ?? []).map((s: any) => s.booked_by).filter(Boolean)),
      ) as string[];

      if (userIds.length === 0) return sessionsData;

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileById = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
      return (sessionsData ?? []).map((s: any) => ({
        ...s,
        profiles: profileById.get(s.booked_by) ?? null,
      }));
    },
    enabled: !!id,
  });

  // Fetch member links
  const { data: memberLinks } = useQuery({
    queryKey: ["group-member-links", id],
    queryFn: async () => {
      const { data: linksData, error } = await supabase
        .from("group_member_links")
        .select("*")
        .eq("group_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set((linksData ?? []).map((l: any) => l.user_id).filter(Boolean)),
      ) as string[];

      if (userIds.length === 0) return linksData;

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileById = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
      return (linksData ?? []).map((l: any) => ({
        ...l,
        profiles: profileById.get(l.user_id) ?? null,
      }));
    },
    enabled: !!id,
  });

  // Request to join mutation
  const requestJoin = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("group_interest_registrations")
        .insert({ group_id: id!, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request sent", description: "Your request to join has been submitted." });
      queryClient.invalidateQueries({ queryKey: ["group-membership", id] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("group_tasks").insert({
        group_id: id!,
        title: taskForm.title,
        description: taskForm.description || null,
        due_date: taskForm.due_date || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-tasks", id] });
      toast({ title: "Task created" });
      setIsTaskDialogOpen(false);
      setTaskForm({ title: "", description: "", due_date: "" });
      setActiveTab("tasks");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create check-in mutation
  const createCheckIn = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("group_check_ins").insert({
        group_id: id!,
        user_id: user.id,
        content: checkInForm.content,
        mood: checkInForm.mood || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-check-ins", id] });
      toast({ title: "Check-in added" });
      setIsCheckInDialogOpen(false);
      setCheckInForm({ content: "", mood: "" });
      setActiveTab("check-ins");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create note mutation
  const createNote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("group_notes").insert({
        group_id: id!,
        title: noteForm.title,
        content: noteForm.content || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-notes", id] });
      toast({ title: "Note created" });
      setIsNoteDialogOpen(false);
      setNoteForm({ title: "", content: "" });
      setActiveTab("notes");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create member link mutation
  const createMemberLink = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("group_member_links").insert({
        group_id: id!,
        user_id: user.id,
        title: linkForm.title,
        url: linkForm.url,
        description: linkForm.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-member-links", id] });
      toast({ title: "Link added" });
      setIsLinkDialogOpen(false);
      setLinkForm({ title: "", url: "", description: "" });
      setActiveTab("resources");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete member link mutation
  const deleteMemberLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("group_member_links").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-member-links", id] });
      toast({ title: "Link deleted" });
    },
  });

  // Use shared session mutations hook
  const {
    createSession: createSessionMutation,
    updateSession: updateSessionMutation,
    deleteSession: deleteSessionMutation,
  } = useGroupSessionMutations(id, "group-sessions");

  // Wrapper handlers for the shared component - includes Google Calendar integration for Leaders
  const handleCreateSessionForList = async (
    formData: SessionFormData,
    timezone?: string,
    useGoogleCalendar?: boolean,
  ) => {
    if (!user || !id) return;

    const sessionTimezoneToUse = timezone || userTimezone;

    // Build the session datetime
    const sessionDateTime = formData.session_time
      ? new Date(`${formData.session_date}T${formData.session_time}`)
      : new Date(formData.session_date);

    // Calculate end time based on duration
    const durationMinutes = parseInt(formData.duration_minutes) || 60;
    const endDateTime = new Date(sessionDateTime.getTime() + durationMinutes * 60 * 1000);

    return new Promise<void>((resolve, reject) => {
      createSessionMutation.mutate(
        {
          groupId: id,
          userId: user.id,
          formData: {
            ...formData,
            location: formData.location,
            timezone: sessionTimezoneToUse,
          },
        },
        {
          onSuccess: async (masterSession) => {
            // Create Google Calendar event with Meet link if enabled and user is a Leader
            if (masterSession?.id && useGoogleCalendar && canManage) {
              try {
                // Get active member user IDs - the edge function will fetch their emails server-side
                const memberUserIds =
                  members?.filter((m: any) => m.status === "active").map((m: any) => m.user_id) ||
                  [];

                const { data: calendarResult, error: calendarError } =
                  await supabase.functions.invoke("google-calendar-create-event", {
                    body: {
                      summary: formData.title,
                      description: formData.description || `Group session for ${group?.name}`,
                      startTime: sessionDateTime.toISOString(),
                      endTime: endDateTime.toISOString(),
                      timezone: sessionTimezoneToUse,
                      memberUserIds,
                      sessionId: masterSession.id,
                      recurrencePattern: formData.is_recurring
                        ? formData.recurrence_pattern
                        : undefined,
                      recurrenceEndDate: formData.is_recurring
                        ? formData.recurrence_end_date || undefined
                        : undefined,
                    },
                  });

                if (calendarError) {
                  console.error("Google Calendar error:", calendarError);
                  toast({
                    title: "Session created",
                    description: "Could not create Google Meet link. You can add one manually.",
                    variant: "default",
                  });
                } else if (calendarResult?.meetingLink) {
                  toast({
                    title: "Session created with Google Meet",
                    description: "Calendar event and meeting link created successfully.",
                  });
                  queryClient.invalidateQueries({ queryKey: ["group-sessions", id] });
                } else {
                  toast({
                    title: "Session created",
                    description: "Calendar event created but no meeting link returned.",
                  });
                }
              } catch (err) {
                console.error("Error creating Google Calendar event:", err);
                toast({
                  title: "Session created",
                  description:
                    "Could not create calendar event. Session saved without meeting link.",
                });
              }
            }
            resolve();
          },
          onError: (error) => {
            reject(error);
          },
        },
      );
    });
  };

  const handleEditSessionForList = (
    session: any,
    formData: SessionFormData,
    updateAll: boolean,
  ) => {
    updateSessionMutation.mutate({
      sessionId: session.id,
      formData,
      updateAll,
      session: {
        id: session.id,
        is_recurring: session.is_recurring,
        parent_session_id: session.parent_session_id,
      },
    });
  };

  const handleDeleteSessionForList = (session: any, deleteAll: boolean) => {
    if (session.is_recurring || session.parent_session_id) {
      setDeleteSessionDialog({ open: true, session, deleteAll: false });
    } else {
      if (confirm("Delete this session?")) {
        deleteSessionMutation.mutate({
          sessionId: session.id,
          deleteAll: false,
          session: {
            id: session.id,
            is_recurring: session.is_recurring,
            parent_session_id: session.parent_session_id,
          },
        });
      }
    }
  };

  const handleConfirmDeleteSession = () => {
    if (!deleteSessionDialog.session) return;
    deleteSessionMutation.mutate(
      {
        sessionId: deleteSessionDialog.session.id,
        deleteAll: deleteSessionDialog.deleteAll,
        session: {
          id: deleteSessionDialog.session.id,
          is_recurring: deleteSessionDialog.session.is_recurring,
          parent_session_id: deleteSessionDialog.session.parent_session_id,
        },
      },
      {
        onSuccess: () => {
          setDeleteSessionDialog({ open: false, session: null, deleteAll: false });
        },
      },
    );
  };

  // Update task status
  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase.from("group_tasks").update({ status }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-tasks", id] });
    },
  });

  // Delete task (for leaders)
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("group_tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-tasks", id] });
      toast({ title: "Task deleted" });
    },
  });

  // Delete note (for leaders)
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("group_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-notes", id] });
      toast({ title: "Note deleted" });
    },
  });

  // Delete check-in (for leaders or own check-ins)
  const deleteCheckIn = useMutation({
    mutationFn: async (checkInId: string) => {
      const { error } = await supabase.from("group_check_ins").delete().eq("id", checkInId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-check-ins", id] });
      toast({ title: "Check-in deleted" });
    },
  });

  if (!id) return null;

  if (loadingGroup) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto py-6">
        <ErrorState title="Not Found" description="The requested group could not be found." />
      </div>
    );
  }

  const isMember = Boolean(isMemberFlag) || (!!membership && membership.status === "active");
  const canManage = membership?.role === "leader";

  // Generate ICS file for calendar download
  const downloadICS = (session: any) => {
    const startDate = new Date(session.session_date);
    const endDate = new Date(startDate.getTime() + (session.duration_minutes || 60) * 60 * 1000);

    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const formatICSDateOnly = (date: Date) => {
      return date.toISOString().split("T")[0].replace(/-/g, "");
    };

    // Build RRULE for recurring sessions
    const buildRRule = () => {
      if (!session.is_recurring || !session.recurrence_pattern) return "";

      const pattern = session.recurrence_pattern.toLowerCase();
      let freq = "";
      let interval = 1;

      if (pattern === "daily") {
        freq = "DAILY";
      } else if (pattern === "weekly") {
        freq = "WEEKLY";
      } else if (pattern === "biweekly" || pattern === "bi-weekly") {
        freq = "WEEKLY";
        interval = 2;
      } else if (pattern === "monthly") {
        freq = "MONTHLY";
      } else {
        return "";
      }

      let rrule = `RRULE:FREQ=${freq}`;
      if (interval > 1) {
        rrule += `;INTERVAL=${interval}`;
      }
      if (session.recurrence_end_date) {
        const endRecurrence = new Date(session.recurrence_end_date);
        rrule += `;UNTIL=${formatICSDateOnly(endRecurrence)}T235959Z`;
      }

      return rrule;
    };

    const rrule = buildRRule();

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//InnoTrue Hub//Group Session//EN",
      "BEGIN:VEVENT",
      `UID:${session.id}@innotruehub`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${session.title}`,
      session.description ? `DESCRIPTION:${session.description.replace(/\n/g, "\\n")}` : "",
      session.location ? `LOCATION:${session.location}` : "",
      rrule,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${session.title.replace(/[^a-z0-9]/gi, "_")}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <SessionMismatchGuard>
      <FeatureGate featureKey="groups">
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
                <BreadcrumbPage>{group.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">{group.name}</h1>
              {group.programs?.name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{group.programs.name}</span>
                </div>
              )}
              {group.description && (
                <p className="text-muted-foreground max-w-2xl">{group.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                To delete sessions, notes, or tasks, please contact your group leader.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {group.google_drive_folder_url && (
                <Button variant="destructive" asChild size="sm">
                  <a href={group.google_drive_folder_url} target="_blank" rel="noopener noreferrer">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Drive
                  </a>
                </Button>
              )}
              {group.slack_channel_url && (
                <Button
                  asChild
                  size="sm"
                  className="bg-[#4A154B] hover:bg-[#611f69] text-white border-0"
                >
                  <a href={group.slack_channel_url} target="_blank" rel="noopener noreferrer">
                    <Hash className="mr-2 h-4 w-4" />
                    Slack
                  </a>
                </Button>
              )}
              {group.circle_group_url && (
                <Button variant="outline" asChild size="sm">
                  <a href={group.circle_group_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Community
                  </a>
                </Button>
              )}
              {!isMember && group.join_type === "open" && (
                <Button
                  onClick={() => requestJoin.mutate()}
                  disabled={requestJoin.isPending}
                  size="sm"
                >
                  {requestJoin.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Request to Join
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-4">
            <Card>
              <CardContent className="p-3 md:pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xl md:text-2xl font-bold">{members?.length || 0}</span>
                  </div>
                  <span className="text-xs md:text-sm text-muted-foreground">Members</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-1.5">
                    <CheckSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xl md:text-2xl font-bold">
                      {tasks?.filter((t) => t.status === "completed").length || 0}/
                      {tasks?.length || 0}
                    </span>
                  </div>
                  <span className="text-xs md:text-sm text-muted-foreground">Tasks</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xl md:text-2xl font-bold">{checkIns?.length || 0}</span>
                  </div>
                  <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                    Check-ins
                  </span>
                </div>
              </CardContent>
            </Card>
            {group.start_date && (
              <Card className="col-span-3 md:col-span-1">
                <CardContent className="p-3 md:pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs md:text-sm">
                      {format(new Date(group.start_date), "MMM d, yyyy")}
                    </span>
                    {group.end_date && (
                      <span className="text-xs md:text-sm text-muted-foreground">
                        - {format(new Date(group.end_date), "MMM d")}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Organisation Info */}
          {isMember && (
            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Peer Group Organisation & Scheduling
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground font-medium">
                  Peer groups are self-organised by design.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    Groups decide when and how often to meet
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    Facilitation rotates between members
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    Any member can propose a session
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    Meeting links and scheduling are handled by the group
                  </li>
                </ul>
                <div className="pt-2 border-t border-border/50 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Recommended cadence:</span>{" "}
                    bi-weekly, 60–90 minutes.
                  </p>
                </div>
                <p className="text-sm italic text-muted-foreground">
                  Groups that take ownership of organisation and facilitation get the most value
                  from the program.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          {isMember ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="relative">
                {/* Left fade indicator */}
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none z-10 sm:hidden" />
                {/* Right fade indicator */}
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 sm:hidden" />
                <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 scrollbar-none">
                  <TabsTrigger value="sessions" className="text-xs sm:text-sm shrink-0">
                    <Video className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Sessions</span>
                    <span className="sm:hidden">Sess.</span>
                  </TabsTrigger>
                  <TabsTrigger value="peer-assessments" className="text-xs sm:text-sm shrink-0">
                    <Hash className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Peer Assessments</span>
                    <span className="sm:hidden">Assess</span>
                  </TabsTrigger>
                  <TabsTrigger value="resources" className="text-xs sm:text-sm shrink-0">
                    <LinkIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Resources</span>
                    <span className="sm:hidden">Res.</span>
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="text-xs sm:text-sm shrink-0">
                    <CheckSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Tasks
                  </TabsTrigger>
                  <TabsTrigger value="check-ins" className="text-xs sm:text-sm shrink-0">
                    <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Check-ins</span>
                    <span className="sm:hidden">Check</span>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs sm:text-sm shrink-0">
                    <FileText className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="members" className="text-xs sm:text-sm shrink-0">
                    <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Members</span>
                    <span className="sm:hidden">Mem.</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="space-y-4">
                {/* External booking link removed - sessions are managed via Google Calendar integration */}

                <GroupSessionsList
                  sessions={sessions || []}
                  groupId={id}
                  userTimezone={userTimezone}
                  isAdmin={false}
                  linkPrefix="/groups"
                  onCreateSession={handleCreateSessionForList}
                  onEditSession={handleEditSessionForList}
                  onDeleteSession={handleDeleteSessionForList}
                  onDownloadICS={downloadICS}
                  isCreating={createSessionMutation.isPending}
                  isUpdating={updateSessionMutation.isPending}
                  showPastSessions={true}
                  showTimezone={canManage}
                  initialTimezone={userTimezone}
                  showGoogleCalendarOption={canManage}
                  initialUseGoogleCalendar={true}
                />

                {/* Delete session confirmation dialog for recurring sessions */}
                <Dialog
                  open={deleteSessionDialog.open}
                  onOpenChange={(open) => setDeleteSessionDialog({ ...deleteSessionDialog, open })}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Session</DialogTitle>
                      <DialogDescription>
                        This is a recurring session. How would you like to delete it?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          setDeleteSessionDialog({ ...deleteSessionDialog, deleteAll: false });
                          handleConfirmDeleteSession();
                        }}
                      >
                        Delete this session only
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full justify-start"
                        onClick={() => {
                          setDeleteSessionDialog({ ...deleteSessionDialog, deleteAll: true });
                          handleConfirmDeleteSession();
                        }}
                      >
                        Delete all future sessions in this series
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDeleteSessionDialog({ open: false, session: null, deleteAll: false })
                        }
                      >
                        Cancel
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>
              <TabsContent value="resources" className="space-y-6">
                {/* Google Drive Section */}
                {group.google_drive_folder_url && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FolderOpen className="h-5 w-5" />
                        Shared Drive Folder
                      </CardTitle>
                      <CardDescription>
                        Access shared files and documents for this group
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild>
                        <a
                          href={group.google_drive_folder_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Google Drive Folder
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Member Links Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold">Shared Links</h3>
                      <p className="text-sm text-muted-foreground">
                        Useful links shared by group members
                      </p>
                    </div>
                    <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Link
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Useful Link</DialogTitle>
                          <DialogDescription>
                            Share a helpful resource with your group
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                              value={linkForm.title}
                              onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                              placeholder="e.g., Group Spreadsheet"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>URL *</Label>
                            <Input
                              value={linkForm.url}
                              onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                              placeholder="https://..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={linkForm.description}
                              onChange={(e) =>
                                setLinkForm({ ...linkForm, description: e.target.value })
                              }
                              placeholder="Brief description of the resource"
                              rows={2}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => createMemberLink.mutate()}
                            disabled={
                              !linkForm.title || !linkForm.url || createMemberLink.isPending
                            }
                          >
                            {createMemberLink.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Add Link
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {memberLinks && memberLinks.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {memberLinks.map((link: any) => (
                        <Card key={link.id}>
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-primary hover:underline flex items-center gap-1"
                                >
                                  <LinkIcon className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{link.title}</span>
                                </a>
                                {link.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {link.description}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  Added by {link.profiles?.name || "Team member"} •{" "}
                                  {format(new Date(link.created_at), "MMM d")}
                                </p>
                              </div>
                              {link.user_id === user?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("Delete this link?"))
                                      deleteMemberLink.mutate(link.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <LinkIcon className="mx-auto h-8 w-8 mb-2" />
                        No shared links yet. Be the first to add one!
                      </CardContent>
                    </Card>
                  )}
                </div>

                {!group.google_drive_folder_url && (!memberLinks || memberLinks.length === 0) && (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <LinkIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No resources available yet.</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Contact your group admin to add a shared folder, or add useful links
                        yourself.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Group Tasks</h3>
                  <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Task</DialogTitle>
                        <DialogDescription>Add a new task for the group</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Title *</Label>
                          <Input
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={taskForm.description}
                            onChange={(e) =>
                              setTaskForm({ ...taskForm, description: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input
                            type="date"
                            value={taskForm.due_date}
                            onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createTask.mutate()}
                          disabled={!taskForm.title || createTask.isPending}
                        >
                          {createTask.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {tasks && tasks.length > 0 ? (
                  <div className="space-y-2">
                    {tasks.map((task: any) => (
                      <Card
                        key={task.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <CardContent className="py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Select
                              value={task.status}
                              onValueChange={(status) =>
                                updateTaskStatus.mutate({ taskId: task.id, status })
                              }
                            >
                              <SelectTrigger className="w-32" onClick={(e) => e.stopPropagation()}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                            <Link to={`/groups/${id}/tasks/${task.id}`} className="flex-1">
                              <p
                                className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}
                              >
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {task.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Added by {task.profiles?.name || "Team member"} •{" "}
                                {format(new Date(task.created_at), "MMM d")}
                              </p>
                            </Link>
                          </div>
                          <div className="flex items-center gap-2">
                            {task.due_date && (
                              <Badge variant="outline">
                                {format(new Date(task.due_date), "MMM d")}
                              </Badge>
                            )}
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (confirm("Delete this task?")) deleteTask.mutate(task.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No tasks yet
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Check-ins Tab */}
              <TabsContent value="check-ins" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Accountability Check-ins</h3>
                  <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Check-in
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Check-in</DialogTitle>
                        <DialogDescription>Share your progress with the group</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>How are you feeling?</Label>
                          <Select
                            value={checkInForm.mood}
                            onValueChange={(mood) => setCheckInForm({ ...checkInForm, mood })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select mood" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="great">😊 Great</SelectItem>
                              <SelectItem value="good">🙂 Good</SelectItem>
                              <SelectItem value="okay">😐 Okay</SelectItem>
                              <SelectItem value="struggling">😔 Struggling</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>What's your update? *</Label>
                          <Textarea
                            value={checkInForm.content}
                            onChange={(e) =>
                              setCheckInForm({ ...checkInForm, content: e.target.value })
                            }
                            rows={4}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCheckInDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createCheckIn.mutate()}
                          disabled={!checkInForm.content || createCheckIn.isPending}
                        >
                          {createCheckIn.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Submit
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {checkIns && checkIns.length > 0 ? (
                  <div className="space-y-4">
                    {checkIns.map((checkIn: any) => (
                      <Card
                        key={checkIn.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={checkIn.profiles?.avatar_url ?? undefined} />
                              <AvatarFallback>
                                {checkIn.profiles?.name?.charAt(0) || "T"}
                              </AvatarFallback>
                            </Avatar>
                            <Link to={`/groups/${id}/check-ins/${checkIn.id}`} className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">
                                  {checkIn.profiles?.name || "Team member"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(checkIn.check_in_date), "MMM d, yyyy")}
                                </span>
                                {checkIn.mood && (
                                  <span>
                                    {checkIn.mood === "great"
                                      ? "😊"
                                      : checkIn.mood === "good"
                                        ? "🙂"
                                        : checkIn.mood === "okay"
                                          ? "😐"
                                          : "😔"}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm line-clamp-2">{checkIn.content}</p>
                            </Link>
                            {(canManage || checkIn.user_id === user?.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (confirm("Delete this check-in?"))
                                    deleteCheckIn.mutate(checkIn.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No check-ins yet
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Shared Notes</h3>
                  <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Note
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Note</DialogTitle>
                        <DialogDescription>Share notes with the group</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Title *</Label>
                          <Input
                            value={noteForm.title}
                            onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Content</Label>
                          <Textarea
                            value={noteForm.content}
                            onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                            rows={6}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createNote.mutate()}
                          disabled={!noteForm.title || createNote.isPending}
                        >
                          {createNote.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {notes && notes.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {notes.map((note: any) => (
                      <Card
                        key={note.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors h-full"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <Link to={`/groups/${id}/notes/${note.id}`} className="flex-1">
                              <CardTitle className="text-base">{note.title}</CardTitle>
                              <CardDescription>
                                By {note.profiles?.name || "Team member"} •{" "}
                                {format(new Date(note.created_at), "MMM d")}
                              </CardDescription>
                            </Link>
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (confirm("Delete this note?")) deleteNote.mutate(note.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        {note.content && (
                          <CardContent>
                            <Link to={`/groups/${id}/notes/${note.id}`}>
                              <p className="text-sm line-clamp-3">{note.content}</p>
                            </Link>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No notes yet
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Peer Assessments Tab */}
              <TabsContent value="peer-assessments" className="space-y-4">
                <GroupPeerAssessmentsPanel
                  groupId={id}
                  members={
                    members?.map((m: any) => ({
                      user_id: m.user_id,
                      name: m.name,
                      avatar_url: m.avatar_url,
                    })) || []
                  }
                  currentUserId={user?.id || ""}
                />
              </TabsContent>

              {/* Members Tab */}
              <TabsContent value="members" className="space-y-4">
                <h3 className="text-lg font-semibold">Group Members</h3>
                <div className="grid gap-2">
                  {members?.map((member: any) => {
                    const meetingTimes = (member.preferred_meeting_times ||
                      []) as MeetingTimePreference[];
                    const hasMeetingTimes = meetingTimes.length > 0;

                    return (
                      <Card key={member.user_id}>
                        <CardContent className="py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.avatar_url ?? undefined} />
                              <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.name}</p>
                              {member.email && (
                                <a
                                  href={`mailto:${member.email}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {member.email}
                                </a>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  Joined {format(new Date(member.joined_at), "MMM d, yyyy")}
                                </span>
                                {member.timezone && (
                                  <Badge variant="outline" className="text-xs py-0 px-1">
                                    {member.timezone}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Assess button - only show for other members */}
                            {member.user_id !== user?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab("peer-assessments")}
                                className="text-muted-foreground"
                              >
                                <Hash className="h-4 w-4 mr-1" />
                                Assess
                              </Button>
                            )}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-muted-foreground"
                                >
                                  <Clock className="h-4 w-4 mr-1" />
                                  Availability
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto max-w-sm" align="end">
                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm">
                                    {member.name}'s Availability
                                  </h4>
                                  {member.timezone && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>Timezone: {member.timezone}</span>
                                    </div>
                                  )}
                                  {hasMeetingTimes ? (
                                    <MeetingTimesPreference
                                      value={meetingTimes}
                                      onChange={() => {}}
                                      readOnly
                                    />
                                  ) : (
                                    <p className="text-sm text-muted-foreground py-2">
                                      No meeting time preferences set
                                    </p>
                                  )}
                                  {member.scheduling_url && (
                                    <div className="border-t pt-3">
                                      <a
                                        href={member.scheduling_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                                      >
                                        <Calendar className="h-4 w-4" />
                                        Book a meeting
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Badge
                              variant={
                                member.role === "leader"
                                  ? "default"
                                  : member.role === "facilitator"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {member.role}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {group.join_type === "open"
                    ? "Request to join this group to see tasks, check-ins, and notes."
                    : "This group is invitation only. Contact an admin to be added."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </FeatureGate>
    </SessionMismatchGuard>
  );
}
