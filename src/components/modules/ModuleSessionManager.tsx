import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Edit2,
  Trash2,
  Plus,
  User,
  Users,
  CheckSquare,
  Repeat,
  AlertCircle,
  ExternalLink,
  Filter,
  RefreshCw,
} from "lucide-react";
import { format, isBefore, isAfter } from "date-fns";
import { generateRecurringDates as generateRecurringDatesLib } from "@/lib/recurringDates";
import { useRecurrenceSettings } from "@/hooks/useRecurrenceSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TimezoneSelect } from "@/components/profile/TimezoneSelect";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { buildCalcomBookingUrl, buildCalcomRescheduleUrl } from "@/lib/calcom-booking-url";

interface ModuleSession {
  id: string;
  module_id: string;
  enrollment_id: string | null;
  program_id: string | null;
  session_type: "individual" | "group";
  title: string;
  description: string | null;
  session_date: string | null;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  status: string;
  instructor_id: string | null;
  notes: string | null;
  created_at: string;
  client_name?: string;
  requested_by?: string | null;
  request_message?: string | null;
  requester_name?: string;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  parent_session_id: string | null;
  // New fields for client-initiated sessions
  source?: string | null;
  preferred_date?: string | null;
  request_notes?: string | null;
  // Cal.com booking fields
  calcom_booking_uid?: string | null;
  booking_source?: string | null;
}

type RecurrencePattern = "daily" | "weekly" | "bi-weekly" | "monthly";

interface EnrolledClient {
  enrollment_id: string;
  user_id: string;
  full_name: string;
  cohort_id?: string | null;
  cohort_name?: string | null;
}

interface ModuleSessionManagerProps {
  moduleId: string;
  programId?: string; // For group sessions
  enrollmentId?: string; // For individual sessions
  clientName?: string;
  showGroupSessions?: boolean; // Show group sessions for this module
}

export function ModuleSessionManager({
  moduleId,
  programId,
  enrollmentId,
  clientName,
  showGroupSessions = true,
}: ModuleSessionManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ModuleSession | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [useCalcomUrl, setUseCalcomUrl] = useState(true);
  const [selectedCohortFilter, setSelectedCohortFilter] = useState<string>("all");

  // Get user's timezone with fallback
  const { timezone: userTimezone } = useUserTimezone();
  const [selectedTimezone, setSelectedTimezone] = useState(userTimezone);

  // Update selected timezone when user timezone loads
  useEffect(() => {
    setSelectedTimezone(userTimezone);
  }, [userTimezone]);

  const [formData, setFormData] = useState({
    session_type: "individual" as "individual" | "group",
    title: "",
    description: "",
    session_date: "",
    session_time: "",
    duration_minutes: 60,
    location: "",
    meeting_url: "",
    status: "scheduled",
    notes: "",
    is_recurring: false,
    recurrence_pattern: "weekly" as RecurrencePattern,
    recurrence_end_type: "count" as "count" | "date",
    recurrence_count: 4,
    recurrence_end_date: "",
  });

  // Use shared recurrence settings hook
  const { maxRecurrenceLimit } = useRecurrenceSettings();

  // Fetch the module's type to find Cal.com mapping
  const { data: moduleData } = useQuery({
    queryKey: ["module-type-for-calcom", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules")
        .select("module_type, title")
        .eq("id", moduleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!moduleId,
  });

  // Fetch Cal.com mapping for this module's type
  const { data: calcomMapping } = useQuery({
    queryKey: ["calcom-mapping-for-module-type", moduleData?.module_type],
    queryFn: async () => {
      if (!moduleData?.module_type) return null;
      const { data, error } = await supabase
        .from("calcom_event_type_mappings")
        .select("id, calcom_event_type_id, calcom_event_type_name, scheduling_url")
        .eq("module_type", moduleData.module_type)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!moduleData?.module_type,
  });

  // Fetch cohorts for the program (for filtering)
  const { data: programCohorts } = useQuery({
    queryKey: ["program-cohorts-for-filter", programId],
    queryFn: async () => {
      if (!programId) return [];
      const { data, error } = await supabase
        .from("program_cohorts")
        .select("id, name")
        .eq("program_id", programId)
        .in("status", ["upcoming", "active"])
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!programId,
  });

  // Fetch enrolled clients for the program (for group session participant selection)
  // Only show clients who have NOT completed the module
  const { data: enrolledClients } = useQuery({
    queryKey: ["enrolled-clients", programId, moduleId],
    queryFn: async () => {
      if (!programId) return [];

      // First get all active enrollments with cohort info
      const { data: enrollments, error } = await supabase
        .from("client_enrollments")
        .select("id, client_user_id, cohort_id, program_cohorts(name)")
        .eq("program_id", programId)
        .eq("status", "active");
      if (error) throw error;
      if (!enrollments || enrollments.length === 0) return [];

      // Fetch profiles for enrolled clients
      const clientUserIds = enrollments.map((e: any) => e.client_user_id).filter(Boolean);
      let profilesMap: Record<string, string> = {};

      if (clientUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", clientUserIds);

        profilesMap = (profiles || []).reduce(
          (acc, p) => {
            acc[p.id] = p.name || "Unknown Client";
            return acc;
          },
          {} as Record<string, string>,
        );
      }

      // Get completed module progress for this module
      const enrollmentIds = enrollments.map((e: any) => e.id);
      const { data: completedProgress } = await supabase
        .from("module_progress")
        .select("enrollment_id")
        .eq("module_id", moduleId)
        .eq("status", "completed")
        .in("enrollment_id", enrollmentIds);

      const completedEnrollmentIds = new Set(
        (completedProgress || []).map((p: any) => p.enrollment_id),
      );

      // Filter out clients who have completed the module
      return enrollments
        .filter((e: any) => !completedEnrollmentIds.has(e.id))
        .map((e: any) => ({
          enrollment_id: e.id,
          user_id: e.client_user_id,
          full_name: profilesMap[e.client_user_id] || "Unknown Client",
          cohort_id: e.cohort_id || null,
          cohort_name: e.program_cohorts?.name || null,
        })) as EnrolledClient[];
    },
    enabled: !!programId,
  });

  // Fetch existing participants when editing a group session
  const { data: existingParticipants } = useQuery({
    queryKey: ["session-participants", editingSession?.id],
    queryFn: async () => {
      if (!editingSession?.id) return [];
      const { data, error } = await supabase
        .from("module_session_participants")
        .select("user_id")
        .eq("session_id", editingSession.id);
      if (error) throw error;
      return (data || []).map((p: any) => p.user_id) as string[];
    },
    enabled: !!editingSession?.id && editingSession?.session_type === "group",
  });

  // Update selected participants when editing session loads
  useEffect(() => {
    if (existingParticipants) {
      setSelectedParticipants(existingParticipants);
    }
  }, [existingParticipants]);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["module-sessions", moduleId, enrollmentId, programId],
    queryFn: async () => {
      // Build query - no FK join available for requested_by
      let query = supabase
        .from("module_sessions")
        .select("*")
        .eq("module_id", moduleId)
        .order("session_date", { ascending: true, nullsFirst: true });

      const { data, error } = await query;
      if (error) throw error;

      // Filter sessions based on context
      const filteredSessions = (data || []).filter((session: any) => {
        if (session.status === "requested" && programId) return true;
        if (session.session_type === "individual" && enrollmentId) {
          return session.enrollment_id === enrollmentId;
        }
        if (session.session_type === "group" && showGroupSessions) {
          return programId ? session.program_id === programId : true;
        }
        return false;
      });

      // Fetch requester names if needed
      const requestedSessions = filteredSessions.filter((s: any) => s.requested_by);
      if (requestedSessions.length > 0) {
        const requesterIds = [...new Set(requestedSessions.map((s: any) => s.requested_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", requesterIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));
        filteredSessions.forEach((session: any) => {
          if (session.requested_by) {
            session.requester_name = profileMap.get(session.requested_by) || "Unknown";
          }
        });
      }

      return filteredSessions as ModuleSession[];
    },
    staleTime: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const isGroup = data.session_type === "group";

      if (isGroup && !programId) throw new Error("Program ID required for group sessions");
      if (!isGroup && !enrollmentId)
        throw new Error("Enrollment ID required for individual sessions");
      if (isGroup && selectedParticipants.length === 0)
        throw new Error("Please select at least one participant for group sessions");

      const sessionDateTime =
        data.session_date && data.session_time
          ? new Date(`${data.session_date}T${data.session_time}`).toISOString()
          : null;

      // For hybrid Cal.com flow, we'll set status to pending_booking and not include meeting URL yet
      // The webhook will update with meeting link and final time when Cal.com booking is made
      const isHybridCalcomFlow = useCalcomUrl && calcomMapping?.scheduling_url && !editingSession;

      // Master session payload
      const payload = {
        module_id: moduleId,
        session_type: data.session_type,
        enrollment_id: isGroup ? null : enrollmentId,
        program_id: isGroup ? programId : null,
        title: data.title,
        description: data.description || null,
        session_date: sessionDateTime, // May be null for hybrid flow - Cal.com will provide the final time
        duration_minutes: data.duration_minutes,
        location: data.location || null,
        meeting_url: isHybridCalcomFlow ? null : data.meeting_url || null, // Will be set by webhook
        status: isHybridCalcomFlow ? "pending_booking" : data.status,
        instructor_id: user?.id,
        notes: data.notes || null,
        is_recurring: isHybridCalcomFlow ? false : data.is_recurring, // Recurrence not supported with Cal.com hybrid flow
        recurrence_pattern: isHybridCalcomFlow
          ? null
          : data.is_recurring
            ? data.recurrence_pattern
            : null,
        recurrence_end_date: isHybridCalcomFlow
          ? null
          : data.is_recurring && data.recurrence_end_type === "date"
            ? data.recurrence_end_date
            : null,
        recurrence_count: isHybridCalcomFlow
          ? null
          : data.is_recurring && data.recurrence_end_type === "count"
            ? data.recurrence_count
            : null,
        timezone: selectedTimezone || "UTC",
      };

      let masterId: string;
      const isNewSession = !editingSession;

      if (editingSession) {
        // Don't allow changing recurrence on existing sessions - update only non-recurrence fields
        const updatePayload = {
          module_id: moduleId,
          session_type: data.session_type,
          enrollment_id: isGroup ? null : enrollmentId,
          program_id: isGroup ? programId : null,
          title: data.title,
          description: data.description || null,
          session_date: sessionDateTime,
          duration_minutes: data.duration_minutes,
          location: data.location || null,
          meeting_url: data.meeting_url || null,
          status: data.status,
          instructor_id: user?.id,
          notes: data.notes || null,
          timezone: selectedTimezone || "UTC",
        };

        const { error } = await supabase
          .from("module_sessions")
          .update(updatePayload)
          .eq("id", editingSession.id);
        if (error) throw error;
        masterId = editingSession.id;
      } else {
        const { data: newSession, error } = await supabase
          .from("module_sessions")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          if (
            error.code === "23505" &&
            error.message?.includes("module_sessions_unique_individual")
          ) {
            throw new Error(
              "An individual session already exists for this module. Please edit the existing session instead.",
            );
          }
          throw error;
        }
        masterId = newSession.id;

        // Generate recurring instances if this is a new recurring session
        if (data.is_recurring && sessionDateTime) {
          const startDate = new Date(sessionDateTime);
          const recurringDates = generateRecurringDatesLib({
            startDate,
            pattern: data.recurrence_pattern,
            endType: data.recurrence_end_type,
            count: data.recurrence_count,
            endDate: data.recurrence_end_type === "date" ? data.recurrence_end_date : null,
            maxLimit: maxRecurrenceLimit,
          });

          if (recurringDates.length > 0) {
            const childSessions = recurringDates.map((date) => ({
              ...payload,
              session_date: date.toISOString(),
              parent_session_id: masterId,
              is_recurring: false, // Child sessions are not recurring themselves
              recurrence_pattern: null as string | null,
              recurrence_end_date: null as string | null,
              recurrence_count: null as number | null,
            }));

            const { error: childError } = await supabase
              .from("module_sessions")
              .insert(childSessions);
            if (childError) {
              console.error("Failed to create recurring instances:", childError);
              // Don't fail the whole operation, just log
            }
          }
        }
      }

      // Handle participants for group sessions
      if (isGroup) {
        // Delete existing participants
        await supabase.from("module_session_participants").delete().eq("session_id", masterId);

        // Insert new participants
        const participantRecords = selectedParticipants.map((userId) => {
          const client = enrolledClients?.find((c) => c.user_id === userId);
          return {
            session_id: masterId,
            user_id: userId,
            enrollment_id: client?.enrollment_id || null,
          };
        });

        if (participantRecords.length > 0) {
          const { error: participantError } = await supabase
            .from("module_session_participants")
            .insert(participantRecords);
          if (participantError) throw participantError;
        }
      }

      // For Cal.com API flow, call the edge function to create booking programmatically
      if (isHybridCalcomFlow && calcomMapping?.calcom_event_type_id && sessionDateTime) {
        // Get attendee info for the booking
        let attendees: Array<{ email: string; name: string; timeZone: string }> = [];

        if (isGroup) {
          // Get emails for all selected participants
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email, name")
            .in("id", selectedParticipants);

          if (profiles && profiles.length > 0) {
            attendees = profiles.map((p: any) => ({
              email: p.email || `user-${p.id}@placeholder.com`,
              name: p.name || "Participant",
              timeZone: selectedTimezone || "UTC",
            }));
          }
        } else if (enrollmentId) {
          // Get the client's email for individual sessions
          const { data: enrollment } = await supabase
            .from("client_enrollments")
            .select("client_user_id, profiles:client_user_id(email, name)")
            .eq("id", enrollmentId)
            .single();

          if (enrollment) {
            const profile = enrollment.profiles as any;
            attendees = [
              {
                email: profile?.email || `user-${enrollment.client_user_id}@placeholder.com`,
                name: profile?.name || clientName || "Client",
                timeZone: selectedTimezone || "UTC",
              },
            ];
          }
        }

        if (attendees.length > 0) {
          console.log("Creating Cal.com booking via API...");
          const { data: bookingResult, error: bookingError } = await supabase.functions.invoke(
            "calcom-create-booking",
            {
              body: {
                eventTypeId: calcomMapping.calcom_event_type_id,
                startTime: sessionDateTime,
                attendees,
                sessionId: masterId,
                sessionType: "module_session",
                title: data.title,
                description: data.description || undefined,
                metadata: {
                  module_id: moduleId,
                  enrollment_id: isGroup ? undefined : enrollmentId,
                  session_type: isGroup ? "group" : "individual",
                },
              },
            },
          );

          if (bookingError) {
            console.error("Cal.com booking creation failed:", bookingError);
            // Don't fail the whole operation - session is created, just without Cal.com booking
          } else {
            console.log("Cal.com booking created:", bookingResult);
          }
        }
      }

      // For non-Cal.com flow, send notifications immediately
      if (!isHybridCalcomFlow && (isNewSession || data.status === "scheduled")) {
        const siteUrl = window.location.origin;
        const deepLinkUrl = `${siteUrl}/modules/${moduleId}?session_id=${masterId}`;

        // Get module name for the notification
        const moduleResult = await supabase
          .from("program_modules")
          .select("title, program_id, programs!inner(title)")
          .eq("id", moduleId)
          .single();
        const moduleData = moduleResult.data as unknown as {
          title: string;
          program_id: string;
          programs: { title: string };
        } | null;

        // Get instructor name
        const { data: instructorProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user?.id || "")
          .single();

        const notificationPayload = {
          type: "session_scheduled",
          timestamp: new Date().toISOString(),
          moduleName: moduleData?.title || "Session",
          programName: moduleData?.programs?.title || "",
          sessionTitle: data.title,
          instructorName: instructorProfile?.name || "Your instructor",
          scheduledDate: sessionDateTime,
          meetingUrl: data.meeting_url || null,
          entityLink: deepLinkUrl,
        };

        if (isGroup) {
          // Send to all participants
          for (const userId of selectedParticipants) {
            const { data: clientProfile } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", userId)
              .single();

            try {
              await supabase.functions.invoke("send-notification-email", {
                body: {
                  ...notificationPayload,
                  userId,
                  name: clientProfile?.name || "Client",
                },
              });
            } catch (emailError) {
              console.error("Failed to send session notification to", userId, emailError);
            }
          }
        } else if (enrollmentId) {
          // Get the client user ID from enrollment
          const { data: enrollment } = await supabase
            .from("client_enrollments")
            .select("client_user_id, profiles:client_user_id(name)")
            .eq("id", enrollmentId)
            .single();

          if (enrollment?.client_user_id) {
            try {
              await supabase.functions.invoke("send-notification-email", {
                body: {
                  ...notificationPayload,
                  userId: enrollment.client_user_id,
                  name: (enrollment.profiles as any)?.name || clientName || "Client",
                },
              });
            } catch (emailError) {
              console.error("Failed to send session notification", emailError);
            }
          }
        }
      }

      return { sessionId: masterId, isHybridCalcomFlow };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["module-sessions", moduleId] });
      queryClient.invalidateQueries({ queryKey: ["session-participants"] });

      if (result?.isHybridCalcomFlow) {
        toast({
          title: "Session scheduled with Cal.com",
          description: "Meeting link and calendar invites have been sent to participants.",
        });
      } else {
        toast({ title: editingSession ? "Session updated" : "Session scheduled" });
      }

      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error saving session", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ sessionId, deleteAll }: { sessionId: string; deleteAll?: boolean }) => {
      if (deleteAll) {
        // Delete all sessions in the series (children with this parent, or the parent itself)
        const session = sessions?.find((s) => s.id === sessionId);
        const masterId = session?.parent_session_id || sessionId;

        // Delete children first
        const { error: childError } = await supabase
          .from("module_sessions")
          .delete()
          .eq("parent_session_id", masterId);
        if (childError) throw childError;

        // Delete the master
        const { error: masterError } = await supabase
          .from("module_sessions")
          .delete()
          .eq("id", masterId);
        if (masterError) throw masterError;
      } else {
        const { error } = await supabase.from("module_sessions").delete().eq("id", sessionId);
        if (error) throw error;
      }
    },
    onSuccess: (_, { deleteAll }) => {
      queryClient.invalidateQueries({ queryKey: ["module-sessions", moduleId] });
      toast({ title: deleteAll ? "All sessions in series deleted" : "Session deleted" });
    },
    onError: (error) => {
      toast({
        title: "Error deleting session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (session: ModuleSession) => {
      // Find the enrollment for the requester
      const { data: enrollment } = await supabase
        .from("client_enrollments")
        .select("id")
        .eq("client_user_id", session.requested_by!)
        .eq("program_id", programId!)
        .single();

      // For external bookings, use session_date; for requests, use preferred_date if available
      const sessionDate =
        session.source === "client_external"
          ? session.session_date
          : session.preferred_date || session.session_date;

      const { error } = await supabase
        .from("module_sessions")
        .update({
          status: "scheduled",
          enrollment_id: enrollment?.id || null,
          instructor_id: user?.id,
          session_date: sessionDate,
        })
        .eq("id", session.id);
      if (error) throw error;

      // Send notification to the client that their request was accepted
      if (session.requested_by) {
        const siteUrl = window.location.origin;
        const deepLinkUrl = `${siteUrl}/modules/${moduleId}?session_id=${session.id}`;

        // Get module name for the notification
        const moduleResult = await supabase
          .from("program_modules")
          .select("title, program_id, programs!inner(title)")
          .eq("id", moduleId)
          .single();
        const moduleData = moduleResult.data as unknown as {
          title: string;
          program_id: string;
          programs: { title: string };
        } | null;

        // Get instructor name
        const { data: instructorProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user?.id || "")
          .single();

        // Get requester name
        const { data: requesterProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", session.requested_by)
          .single();

        try {
          await supabase.functions.invoke("send-notification-email", {
            body: {
              type: "session_scheduled",
              userId: session.requested_by,
              name: requesterProfile?.name || "Client",
              timestamp: new Date().toISOString(),
              moduleName: moduleData?.title || session.title,
              programName: moduleData?.programs?.title || "",
              sessionTitle: session.title,
              instructorName: instructorProfile?.name || "Your instructor",
              scheduledDate: session.session_date,
              meetingUrl: session.meeting_url || null,
              entityLink: deepLinkUrl,
            },
          });
        } catch (emailError) {
          console.error("Failed to send session acceptance notification", emailError);
        }
      }
    },
    onSuccess: (_, session) => {
      queryClient.invalidateQueries({ queryKey: ["module-sessions", moduleId] });
      if (session.source === "client_external") {
        toast({
          title: "Booking confirmed",
          description: "The external booking has been confirmed.",
        });
      } else {
        toast({
          title: "Request accepted",
          description: "The session has been scheduled. You can edit details if needed.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error accepting request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      session_type: enrollmentId ? "individual" : "group",
      title: "",
      description: "",
      session_date: "",
      session_time: "",
      duration_minutes: 60,
      location: "",
      meeting_url: "",
      status: "scheduled",
      notes: "",
      is_recurring: false,
      recurrence_pattern: "weekly",
      recurrence_end_type: "count",
      recurrence_count: 4,
      recurrence_end_date: "",
    });
    setEditingSession(null);
    setSelectedParticipants([]);
    setUseCalcomUrl(true);
    setSelectedCohortFilter("all");
  };

  // Filter clients by cohort
  const filteredClients =
    enrolledClients?.filter((client) => {
      if (selectedCohortFilter === "all") return true;
      if (selectedCohortFilter === "no-cohort") return !client.cohort_id;
      return client.cohort_id === selectedCohortFilter;
    }) || [];

  const handleSelectAll = () => {
    if (selectedParticipants.length === filteredClients.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(filteredClients.map((c) => c.user_id));
    }
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleEdit = (session: ModuleSession) => {
    const sessionDate = session.session_date ? new Date(session.session_date) : null;
    setEditingSession(session);
    setFormData({
      session_type: session.session_type,
      title: session.title,
      description: session.description || "",
      session_date: sessionDate ? format(sessionDate, "yyyy-MM-dd") : "",
      session_time: sessionDate ? format(sessionDate, "HH:mm") : "",
      duration_minutes: session.duration_minutes,
      location: session.location || "",
      meeting_url: session.meeting_url || "",
      status: session.status,
      notes: session.notes || "",
      is_recurring: session.is_recurring || false,
      recurrence_pattern: (session.recurrence_pattern as RecurrencePattern) || "weekly",
      recurrence_end_type: session.recurrence_end_date ? "date" : "count",
      recurrence_count: session.recurrence_count || 4,
      recurrence_end_date: session.recurrence_end_date || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (session: ModuleSession) => {
    const isPartOfSeries = session.is_recurring || session.parent_session_id;

    if (isPartOfSeries) {
      const choice = window.confirm(
        "This session is part of a recurring series.\n\nClick OK to delete ALL sessions in the series, or Cancel to keep them.",
      );
      if (choice) {
        deleteMutation.mutate({ sessionId: session.id, deleteAll: true });
      }
    } else {
      if (confirm("Delete this session?")) {
        deleteMutation.mutate({ sessionId: session.id });
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "cancelled":
        return "destructive";
      case "rescheduled":
        return "secondary";
      case "requested":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading sessions...</div>;
  }

  // Check if this module type supports sessions (has Cal.com mapping)
  const hasSessionCapability = !!calcomMapping;

  // If no session capability, show configuration message for instructors/admins
  if (!hasSessionCapability && moduleData?.module_type) {
    return (
      <Alert variant="default" className="bg-muted">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <span className="font-medium">Sessions not configured for this module type.</span>
          <br />
          <span className="text-sm text-muted-foreground">
            To enable session scheduling for "{moduleData.module_type}" modules, add an Event Type
            Mapping in the Admin → Integrations → Cal.com settings.
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // If module type is still loading, don't show anything yet
  if (!moduleData?.module_type) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Module Sessions</h3>
        </div>
        {(enrollmentId || programId) && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Schedule Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSession ? "Edit Session" : "Schedule Session"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {programId && enrollmentId && (
                  <div>
                    <Label>Session Type</Label>
                    <Select
                      value={formData.session_type}
                      onValueChange={(v: "individual" | "group") =>
                        setFormData({ ...formData, session_type: v })
                      }
                      disabled={!!editingSession}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Individual (1:1)
                          </div>
                        </SelectItem>
                        <SelectItem value="group">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Group Session
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.session_type === "group"
                        ? "Select which clients should attend this session"
                        : "Only this specific client will see this session"}
                    </p>
                  </div>
                )}

                {/* Participant Selection for Group Sessions */}
                {formData.session_type === "group" &&
                  enrolledClients &&
                  enrolledClients.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Participants *</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAll}
                          className="h-7 text-xs"
                        >
                          <CheckSquare className="h-3 w-3 mr-1" />
                          {selectedParticipants.length === filteredClients.length
                            ? "Deselect All"
                            : "Select All"}
                        </Button>
                      </div>

                      {/* Cohort Filter */}
                      {programCohorts && programCohorts.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-muted-foreground" />
                          <Select
                            value={selectedCohortFilter}
                            onValueChange={setSelectedCohortFilter}
                          >
                            <SelectTrigger className="h-8 w-48">
                              <SelectValue placeholder="Filter by cohort" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All participants</SelectItem>
                              <SelectItem value="no-cohort">No cohort assigned</SelectItem>
                              {programCohorts.map((cohort) => (
                                <SelectItem key={cohort.id} value={cohort.id}>
                                  {cohort.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <ScrollArea className="h-40 rounded-md border p-2">
                        <div className="space-y-2">
                          {filteredClients.map((client) => (
                            <div key={client.user_id} className="flex items-center space-x-2">
                              <Checkbox
                                id={client.user_id}
                                checked={selectedParticipants.includes(client.user_id)}
                                onCheckedChange={() => toggleParticipant(client.user_id)}
                              />
                              <label
                                htmlFor={client.user_id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                              >
                                {client.full_name}
                                {client.cohort_name && (
                                  <Badge variant="outline" className="text-xs font-normal">
                                    {client.cohort_name}
                                  </Badge>
                                )}
                              </label>
                            </div>
                          ))}
                          {filteredClients.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2 text-center">
                              No participants match the filter
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground">
                        {selectedParticipants.length} selected
                        {selectedCohortFilter !== "all" &&
                          ` (showing ${filteredClients.length} of ${enrolledClients.length})`}
                      </p>
                    </div>
                  )}
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Solution Presentation"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Session details..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formData.session_date}
                      onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={formData.session_time}
                      onChange={(e) => setFormData({ ...formData, session_time: e.target.value })}
                    />
                  </div>
                </div>

                {/* Timezone Selection */}
                <TimezoneSelect value={selectedTimezone} onChange={setSelectedTimezone} />

                {/* Recurrence Options - Only for new sessions */}
                {!editingSession && (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_recurring"
                        checked={formData.is_recurring}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, is_recurring: !!checked })
                        }
                      />
                      <label
                        htmlFor="is_recurring"
                        className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1"
                      >
                        <Repeat className="h-4 w-4" />
                        Make this a recurring session
                      </label>
                    </div>

                    {formData.is_recurring && (
                      <div className="space-y-3 pt-2">
                        <div>
                          <Label>Repeat</Label>
                          <Select
                            value={formData.recurrence_pattern}
                            onValueChange={(v: RecurrencePattern) =>
                              setFormData({ ...formData, recurrence_pattern: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Ends</Label>
                          <Select
                            value={formData.recurrence_end_type}
                            onValueChange={(v: "count" | "date") =>
                              setFormData({ ...formData, recurrence_end_type: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="count">After number of occurrences</SelectItem>
                              <SelectItem value="date">On specific date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {formData.recurrence_end_type === "count" && (
                          <div>
                            <Label>Number of occurrences</Label>
                            <Input
                              type="number"
                              min={2}
                              max={maxRecurrenceLimit || 20}
                              value={formData.recurrence_count}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 2;
                                const max = maxRecurrenceLimit || 20;
                                setFormData({
                                  ...formData,
                                  recurrence_count: Math.min(Math.max(val, 2), max),
                                });
                              }}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Maximum {maxRecurrenceLimit || 20} occurrences allowed
                            </p>
                          </div>
                        )}

                        {formData.recurrence_end_type === "date" && (
                          <div>
                            <Label>End date</Label>
                            <Input
                              type="date"
                              value={formData.recurrence_end_date}
                              min={formData.session_date}
                              onChange={(e) =>
                                setFormData({ ...formData, recurrence_end_date: e.target.value })
                              }
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Sessions will be created up to this date (max{" "}
                              {maxRecurrenceLimit || 20} occurrences or 3 months)
                            </p>
                          </div>
                        )}

                        <Alert variant="default" className="bg-primary/5">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {formData.recurrence_end_type === "count"
                              ? `${formData.recurrence_count} sessions will be created (including this one).`
                              : "Sessions will be pre-generated until the end date or limit is reached."}
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })
                    }
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Online, Room 101"
                  />
                </div>
                {/* Meeting URL / Cal.com URL */}
                <div className="space-y-3">
                  <Label>Meeting URL</Label>

                  {/* Cal.com toggle - only show if mapping exists */}
                  {calcomMapping?.scheduling_url && (
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="use_calcom_url"
                        checked={useCalcomUrl}
                        onCheckedChange={(checked) => setUseCalcomUrl(!!checked)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="use_calcom_url"
                          className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Use Cal.com booking link
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {calcomMapping.calcom_event_type_name || "Configured booking type"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Manual URL input - show when not using Cal.com or no Cal.com configured */}
                  {(!calcomMapping?.scheduling_url || !useCalcomUrl) && (
                    <Input
                      value={formData.meeting_url}
                      onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                      placeholder="https://meet.google.com/..."
                    />
                  )}

                  {/* Info when Cal.com is enabled */}
                  {calcomMapping?.scheduling_url && useCalcomUrl && (
                    <p className="text-xs text-muted-foreground">
                      Booking link will include module context automatically
                    </p>
                  )}
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="rescheduled">Rescheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes (internal)</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Internal notes for instructors..."
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => saveMutation.mutate(formData)}
                    disabled={saveMutation.isPending || !formData.title}
                  >
                    {saveMutation.isPending ? "Saving..." : editingSession ? "Update" : "Schedule"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className={
                session.status === "requested"
                  ? "bg-yellow-500/10 border-yellow-500/30"
                  : "bg-muted/50"
              }
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{session.title}</span>
                      <Badge variant={session.session_type === "group" ? "secondary" : "outline"}>
                        {session.session_type === "group" ? (
                          <>
                            <Users className="h-3 w-3 mr-1" />
                            Group
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            1:1
                          </>
                        )}
                      </Badge>
                      {(session.is_recurring || session.parent_session_id) && (
                        <Badge variant="outline" className="text-primary border-primary/50">
                          <Repeat className="h-3 w-3 mr-1" />
                          {session.is_recurring ? "Recurring" : "Part of series"}
                        </Badge>
                      )}
                      <Badge variant={getStatusColor(session.status)}>
                        {session.status === "requested"
                          ? session.source === "client_external"
                            ? "External - Pending Confirmation"
                            : "Pending Request"
                          : session.status}
                      </Badge>
                    </div>
                    {session.status === "requested" && session.requester_name && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-warning">
                          Requested by: {session.requester_name}
                        </p>
                        {session.source === "client_external" && (
                          <Badge
                            variant="outline"
                            className="text-primary border-primary/30 bg-primary/10"
                          >
                            External Booking
                          </Badge>
                        )}
                      </div>
                    )}
                    {session.status === "requested" && session.preferred_date && (
                      <p className="text-sm text-muted-foreground">
                        Preferred date: {format(new Date(session.preferred_date), "PPP p")}
                      </p>
                    )}
                    {session.status === "requested" && session.request_notes && (
                      <p className="text-sm text-muted-foreground italic">
                        "{session.request_notes}"
                      </p>
                    )}
                    {session.status === "requested" && session.request_message && (
                      <p className="text-sm text-muted-foreground italic">
                        "{session.request_message}"
                      </p>
                    )}
                    {session.description && session.status !== "requested" && (
                      <p className="text-sm text-muted-foreground">{session.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {session.session_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(session.session_date), "PPP p")}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {session.duration_minutes} min
                      </div>
                      {session.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {session.location}
                        </div>
                      )}
                    </div>
                    {session.meeting_url && (
                      <a
                        href={session.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Video className="h-3 w-3" />
                        Join Meeting
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap items-center">
                    {/* Reschedule button for scheduled sessions */}
                    {session.status === "scheduled" && session.session_date && (
                      <>
                        {/* Cal.com reschedule for sessions with booking UID */}
                        {session.calcom_booking_uid ? (
                          <a
                            href={buildCalcomRescheduleUrl(
                              session.calcom_booking_uid,
                              undefined,
                              window.location.href,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm">
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Reschedule
                            </Button>
                          </a>
                        ) : calcomMapping?.scheduling_url ? (
                          /* For non-Cal.com sessions, offer to rebook via Cal.com */
                          <a
                            href={buildCalcomBookingUrl({
                              schedulingUrl: calcomMapping.scheduling_url,
                              enrollmentId: session.enrollment_id || enrollmentId,
                              moduleId: moduleId,
                              userId: user?.id,
                              sessionType: session.session_type,
                              pendingSessionId: session.id,
                              redirectUrl: window.location.href,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm">
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Rebook via Cal.com
                            </Button>
                          </a>
                        ) : null}
                      </>
                    )}

                    {session.status === "requested" && programId && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => acceptRequestMutation.mutate(session)}
                        disabled={acceptRequestMutation.isPending}
                      >
                        {session.source === "client_external"
                          ? "Confirm Booking"
                          : "Accept & Schedule"}
                      </Button>
                    )}
                    {(enrollmentId || (programId && session.status !== "requested")) && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(session)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(session)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {enrollmentId ? "No sessions scheduled for this module yet." : "No sessions scheduled."}
        </p>
      )}
    </div>
  );
}
