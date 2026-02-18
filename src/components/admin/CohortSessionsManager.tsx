import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  MapPin,
  Video,
  GripVertical,
  Loader2,
  UserCheck,
  CalendarPlus,
  FileText,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, addMonths, parseISO } from "date-fns";
import { TimezoneSelect } from "@/components/profile/TimezoneSelect";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CohortSessionAttendance } from "./CohortSessionAttendance";

interface CohortSessionsManagerProps {
  cohortId: string;
  programId: string;
  cohortInstructorId?: string | null;
  programInstructors?: { id: string; name: string }[];
}

interface GenerateFormData {
  titlePrefix: string;
  startDate: string;
  startTime: string;
  endTime: string;
  pattern: "weekly" | "biweekly" | "monthly";
  count: number;
  location: string;
  moduleAssignment: "none" | "sequential" | "same";
  sameModuleId: string;
  instructorId: string;
}

interface CohortSession {
  id: string;
  cohort_id: string;
  module_id: string | null;
  instructor_id: string | null;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_link: string | null;
  notes: string | null;
  recap: string | null;
  recording_url: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface SessionFormData {
  title: string;
  description: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  meeting_link: string;
  module_id: string;
  instructor_id: string;
  notes: string;
  recap: string;
  recording_url: string;
}

const defaultFormData: SessionFormData = {
  title: "",
  description: "",
  session_date: "",
  start_time: "",
  end_time: "",
  location: "",
  meeting_link: "",
  module_id: "",
  instructor_id: "",
  notes: "",
  recap: "",
  recording_url: "",
};

interface SortableSessionProps {
  session: CohortSession;
  onEdit: (session: CohortSession) => void;
  onDelete: (sessionId: string) => void;
  instructorName?: string | null;
  onToggleAttendance?: (sessionId: string) => void;
  attendanceStats?: { present: number; total: number } | null;
  isAttendanceExpanded?: boolean;
}

function SortableSession({ session, onEdit, onDelete, instructorName, onToggleAttendance, attendanceStats, isAttendanceExpanded }: SortableSessionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-3 rounded-lg border bg-card ${isDragging ? "shadow-lg" : ""}`}
    >
      <button
        className="mt-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium">{session.title}</p>
            {session.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {session.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => onEdit(session)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(session.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(session.session_date), "MMM d, yyyy")}
            {session.start_time && ` at ${session.start_time.slice(0, 5)}`}
            {session.end_time && ` - ${session.end_time.slice(0, 5)}`}
          </span>
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {session.location}
            </span>
          )}
          {session.meeting_link && (
            <Badge variant="outline" className="text-xs">
              <Video className="h-3 w-3 mr-1" />
              Virtual
            </Badge>
          )}
          {session.recap && (
            <Badge variant="secondary" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Recap
            </Badge>
          )}
          {instructorName && (
            <span className="flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              {instructorName}
            </span>
          )}
          {attendanceStats && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {attendanceStats.present}/{attendanceStats.total}
            </span>
          )}
        </div>
        {/* Attendance toggle button */}
        {onToggleAttendance && (
          <div className="mt-2">
            <Button
              variant={isAttendanceExpanded ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onToggleAttendance(session.id)}
              className="text-xs"
            >
              <Users className="h-3 w-3 mr-1" />
              Attendance
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CohortSessionsManager({
  cohortId,
  programId,
  cohortInstructorId,
  programInstructors = [],
}: CohortSessionsManagerProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<CohortSession | null>(null);
  const [formData, setFormData] = useState<SessionFormData>(defaultFormData);

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState<GenerateFormData>({
    titlePrefix: "Session",
    startDate: "",
    startTime: "09:00",
    endTime: "10:00",
    pattern: "weekly",
    count: 8,
    location: "",
    moduleAssignment: "none",
    sameModuleId: "",
    instructorId: cohortInstructorId || "",
  });

  const [expandedAttendanceId, setExpandedAttendanceId] = useState<string | null>(null);
  const [notifyingRecap, setNotifyingRecap] = useState(false);

  const [generatingMeetLink, setGeneratingMeetLink] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);

  // Get user's timezone with fallback
  const { timezone: userTimezone } = useUserTimezone();
  const [selectedTimezone, setSelectedTimezone] = useState(userTimezone);

  // Update timezone when user timezone loads
  useEffect(() => {
    setSelectedTimezone(userTimezone);
  }, [userTimezone]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["cohort-sessions", cohortId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohort_sessions")
        .select("*")
        .eq("cohort_id", cohortId)
        .order("order_index");

      if (error) throw error;
      return data as CohortSession[];
    },
  });

  const { data: modules } = useQuery({
    queryKey: ["program-modules-select", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules")
        .select("id, title, order_index")
        .eq("program_id", programId)
        .order("order_index");

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const payload = {
        cohort_id: cohortId,
        title: data.title,
        description: data.description || null,
        session_date: data.session_date,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        location: data.location || null,
        meeting_link: data.meeting_link || null,
        module_id: data.module_id || null,
        instructor_id: data.instructor_id || null,
        notes: data.notes || null,
        recap: data.recap || null,
        recording_url: data.recording_url || null,
        order_index: editingSession?.order_index ?? (sessions?.length || 0),
        timezone: selectedTimezone || "UTC",
      };

      if (editingSession) {
        const { error } = await supabase
          .from("cohort_sessions")
          .update(payload)
          .eq("id", editingSession.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cohort_sessions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-sessions", cohortId] });
      toast.success(editingSession ? "Session updated" : "Session added");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Failed to save session");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from("cohort_sessions").delete().eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-sessions", cohortId] });
      toast.success("Session deleted");
    },
    onError: () => {
      toast.error("Failed to delete session");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (reorderedSessions: CohortSession[]) => {
      const updates = reorderedSessions.map((session, index) => ({
        id: session.id,
        order_index: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("cohort_sessions")
          .update({ order_index: update.order_index })
          .eq("id", update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-sessions", cohortId] });
    },
    onError: () => {
      toast.error("Failed to reorder sessions");
    },
  });

  const handleOpenDialog = (session?: CohortSession) => {
    if (session) {
      setEditingSession(session);
      setFormData({
        title: session.title,
        description: session.description || "",
        session_date: session.session_date,
        start_time: session.start_time?.slice(0, 5) || "",
        end_time: session.end_time?.slice(0, 5) || "",
        location: session.location || "",
        meeting_link: session.meeting_link || "",
        module_id: session.module_id || "",
        instructor_id: session.instructor_id || "",
        notes: session.notes || "",
        recap: session.recap || "",
        recording_url: session.recording_url || "",
      });
    } else {
      setEditingSession(null);
      // Default new sessions to cohort's lead instructor
      setFormData({ ...defaultFormData, instructor_id: cohortInstructorId || "" });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSession(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Session title is required");
      return;
    }
    if (!formData.session_date) {
      toast.error("Session date is required");
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleDelete = (sessionId: string) => {
    if (confirm("Are you sure you want to delete this session?")) {
      deleteMutation.mutate(sessionId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && sessions) {
      const oldIndex = sessions.findIndex((s) => s.id === active.id);
      const newIndex = sessions.findIndex((s) => s.id === over.id);

      const reordered = arrayMove(sessions, oldIndex, newIndex);
      reorderMutation.mutate(reordered);
    }
  };

  async function handleGenerateMeetLink() {
    if (!formData.session_date || !formData.start_time) {
      toast.error("Set date and start time first");
      return;
    }
    setGeneratingMeetLink(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const startISO = `${formData.session_date}T${formData.start_time}:00`;
      const endISO = formData.end_time
        ? `${formData.session_date}T${formData.end_time}:00`
        : new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString(); // default 1h

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-create-event`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: formData.title || "Cohort Session",
            startTime: startISO,
            endTime: endISO,
            timezone: selectedTimezone || "UTC",
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to create Meet link");
      const result = await response.json();
      if (result.meetingLink) {
        setFormData((prev) => ({ ...prev, meeting_link: result.meetingLink }));
        toast.success("Google Meet link generated!");
      } else {
        toast.error("Event created but no Meet link returned. Check Google Workspace settings.");
      }
    } catch (err) {
      console.error("Meet link generation failed:", err);
      toast.error("Failed to generate Meet link. You can paste one manually.");
    } finally {
      setGeneratingMeetLink(false);
    }
  }

  async function handleBulkGenerateMeetLinks() {
    const sessionsWithoutLink = sessions?.filter((s) => !s.meeting_link) || [];
    if (sessionsWithoutLink.length === 0) {
      toast.info("All sessions already have meeting links");
      return;
    }

    setBulkGenerating(true);
    setBulkProgress(0);
    setBulkTotal(sessionsWithoutLink.length);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let successCount = 0;

      for (const cohortSession of sessionsWithoutLink) {
        try {
          const startISO = cohortSession.start_time
            ? `${cohortSession.session_date}T${cohortSession.start_time}`
            : `${cohortSession.session_date}T09:00:00`;
          const endISO = cohortSession.end_time
            ? `${cohortSession.session_date}T${cohortSession.end_time}`
            : new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-create-event`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session?.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                summary: cohortSession.title || "Cohort Session",
                startTime: startISO,
                endTime: endISO,
                timezone: selectedTimezone || "UTC",
                cohortSessionId: cohortSession.id,
              }),
            },
          );

          if (response.ok) {
            const result = await response.json();
            if (result.meetingLink) {
              // Update the session in DB (in case edge function cohortSessionId path didn't run)
              await supabase
                .from("cohort_sessions")
                .update({ meeting_link: result.meetingLink })
                .eq("id", cohortSession.id);
              successCount++;
            }
          }
        } catch (err) {
          console.error(`Failed to generate Meet link for session ${cohortSession.id}:`, err);
        }
        setBulkProgress((prev) => prev + 1);
      }

      queryClient.invalidateQueries({ queryKey: ["cohort-sessions", cohortId] });
      toast.success(`Generated Meet links for ${successCount}/${sessionsWithoutLink.length} sessions`);
    } catch (err) {
      console.error("Bulk Meet link generation failed:", err);
      toast.error("Failed to generate Meet links");
    } finally {
      setBulkGenerating(false);
      setBulkProgress(0);
      setBulkTotal(0);
    }
  }

  const generateMutation = useMutation({
    mutationFn: async (form: GenerateFormData) => {
      const dates: string[] = [];
      let currentDate = parseISO(form.startDate);
      for (let i = 0; i < form.count; i++) {
        dates.push(format(currentDate, "yyyy-MM-dd"));
        if (form.pattern === "weekly") currentDate = addWeeks(currentDate, 1);
        else if (form.pattern === "biweekly") currentDate = addWeeks(currentDate, 2);
        else if (form.pattern === "monthly") currentDate = addMonths(currentDate, 1);
      }

      const existingCount = sessions?.length || 0;

      const newSessions = dates.map((date, i) => {
        let moduleId: string | null = null;
        if (form.moduleAssignment === "sequential" && modules && modules[i]) {
          moduleId = modules[i].id;
        } else if (form.moduleAssignment === "same" && form.sameModuleId) {
          moduleId = form.sameModuleId;
        }

        return {
          cohort_id: cohortId,
          title: `${form.titlePrefix} ${i + 1}`,
          description: null,
          session_date: date,
          start_time: form.startTime || null,
          end_time: form.endTime || null,
          location: form.location || null,
          meeting_link: null,
          module_id: moduleId,
          instructor_id: form.instructorId || null,
          notes: null,
          order_index: existingCount + i,
          timezone: selectedTimezone || "UTC",
        };
      });

      const { error } = await supabase.from("cohort_sessions").insert(newSessions);
      if (error) throw error;
      return newSessions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["cohort-sessions", cohortId] });
      toast.success(`Generated ${count} sessions`);
      setGenerateDialogOpen(false);
      // Reset form for next use
      setGenerateForm({
        titlePrefix: "Session",
        startDate: "",
        startTime: "09:00",
        endTime: "10:00",
        pattern: "weekly",
        count: 8,
        location: "",
        moduleAssignment: "none",
        sameModuleId: "",
        instructorId: cohortInstructorId || "",
      });
    },
    onError: () => {
      toast.error("Failed to generate sessions");
    },
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateForm.startDate) {
      toast.error("Start date is required");
      return;
    }
    if (generateForm.count < 1 || generateForm.count > 52) {
      toast.error("Number of sessions must be between 1 and 52");
      return;
    }
    generateMutation.mutate(generateForm);
  };

  // Attendance stats per session (for badge display)
  const { data: attendanceStats } = useQuery({
    queryKey: ["attendance-stats", cohortId],
    queryFn: async () => {
      // Get all enrollments for this cohort
      const { data: enrollments } = await supabase
        .from("client_enrollments")
        .select("id")
        .eq("cohort_id" as string, cohortId)
        .eq("status", "active");

      const totalEnrolled = enrollments?.length || 0;
      if (totalEnrolled === 0) return {};

      // Get attendance records grouped by session
      const { data: records } = await supabase
        .from("cohort_session_attendance" as string)
        .select("session_id, status")
        .in(
          "session_id",
          (sessions || []).map((s) => s.id),
        );

      const stats: Record<string, { present: number; total: number }> = {};
      (records as { session_id: string; status: string }[] || []).forEach((r) => {
        if (!stats[r.session_id]) {
          stats[r.session_id] = { present: 0, total: totalEnrolled };
        }
        if (r.status === "present") {
          stats[r.session_id].present++;
        }
      });
      return stats;
    },
    enabled: !!sessions && sessions.length > 0,
  });

  async function handleSaveAndNotifyRecap() {
    if (!editingSession || !formData.recap?.trim()) {
      toast.error("Write a recap before notifying");
      return;
    }
    // First save
    saveMutation.mutate(formData, {
      onSuccess: async () => {
        // Then notify
        setNotifyingRecap(true);
        try {
          const { data, error } = await supabase.rpc("notify_cohort_session_recap", {
            p_session_id: editingSession!.id,
          });
          if (error) throw error;
          toast.success(`Recap saved & ${data} participants notified`);
        } catch (err) {
          console.error("Failed to send recap notifications:", err);
          toast.error("Recap saved but notification failed");
        } finally {
          setNotifyingRecap(false);
        }
      },
    });
  }

  const toggleAttendance = (sessionId: string) => {
    setExpandedAttendanceId((prev) => (prev === sessionId ? null : sessionId));
  };

  // Preview the dates that will be generated
  const previewDates = (() => {
    if (!generateForm.startDate) return [];
    try {
      const dates: string[] = [];
      let currentDate = parseISO(generateForm.startDate);
      for (let i = 0; i < Math.min(generateForm.count, 52); i++) {
        dates.push(format(currentDate, "MMM d, yyyy"));
        if (generateForm.pattern === "weekly") currentDate = addWeeks(currentDate, 1);
        else if (generateForm.pattern === "biweekly") currentDate = addWeeks(currentDate, 2);
        else if (generateForm.pattern === "monthly") currentDate = addMonths(currentDate, 1);
      }
      return dates;
    } catch {
      return [];
    }
  })();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading sessions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Live Sessions</h4>
        <div className="flex items-center gap-2">
          {sessions && sessions.some((s) => !s.meeting_link) && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkGenerateMeetLinks}
              disabled={bulkGenerating}
            >
              {bulkGenerating ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Video className="mr-2 h-3 w-3" />
              )}
              {bulkGenerating
                ? `Generating (${bulkProgress}/${bulkTotal})...`
                : "Generate All Meet Links"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGenerateDialogOpen(true)}
          >
            <CalendarPlus className="mr-2 h-3 w-3" />
            Generate Sessions
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-3 w-3" />
                Add Session
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSession ? "Edit Session" : "Add Session"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-title">Title *</Label>
                <Input
                  id="session-title"
                  placeholder="e.g., Week 1: Introduction Workshop"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-description">Description</Label>
                <Textarea
                  id="session-description"
                  placeholder="What will be covered in this session"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-date">Date *</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={formData.session_date}
                  onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Timezone Selection */}
              <TimezoneSelect value={selectedTimezone} onChange={setSelectedTimezone} />

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Room 101 or Online"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting-link">Meeting Link</Label>
                <div className="flex gap-2">
                  <Input
                    id="meeting-link"
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={formData.meeting_link}
                    onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateMeetLink}
                    disabled={generatingMeetLink || !formData.session_date || !formData.start_time}
                    title="Auto-generate Google Meet link"
                    className="shrink-0"
                  >
                    {generatingMeetLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Video className="h-4 w-4 mr-1" />
                    )}
                    {generatingMeetLink ? "" : "Meet"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a link manually or click &quot;Meet&quot; to auto-generate a Google Meet link.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="module-link">Link to Module (optional)</Label>
                <Select
                  value={formData.module_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, module_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No module linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No module linked</SelectItem>
                    {modules?.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        Module {module.order_index}: {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Session Instructor */}
              {programInstructors.length > 0 && (
                <div className="space-y-2">
                  <Label>Session Instructor</Label>
                  <Select
                    value={formData.instructor_id || "none"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, instructor_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No instructor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No instructor</SelectItem>
                      {programInstructors.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.name}
                          {instructor.id === cohortInstructorId ? " (Cohort default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Internal notes about this session"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Post-Session: Recap & Recording */}
              {editingSession && (
                <div className="space-y-4 border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Post-Session
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="recap">Session Recap (Markdown)</Label>
                    <Textarea
                      id="recap"
                      placeholder="Write a recap of the session... (visible to participants, supports Markdown)"
                      value={formData.recap}
                      onChange={(e) => setFormData({ ...formData, recap: e.target.value })}
                      rows={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recording-url">Recording URL</Label>
                    <Input
                      id="recording-url"
                      type="url"
                      placeholder="https://..."
                      value={formData.recording_url}
                      onChange={(e) =>
                        setFormData({ ...formData, recording_url: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                {editingSession && formData.recap?.trim() && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSaveAndNotifyRecap}
                    disabled={saveMutation.isPending || notifyingRecap}
                  >
                    <Send className="mr-2 h-3.5 w-3.5" />
                    {notifyingRecap ? "Notifying..." : "Save & Notify"}
                  </Button>
                )}
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingSession ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

          {/* Generate Sessions Dialog */}
          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Generate Multiple Sessions</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gen-title-prefix">Title Prefix</Label>
                  <Input
                    id="gen-title-prefix"
                    placeholder="e.g., Session, Week, Class"
                    value={generateForm.titlePrefix}
                    onChange={(e) =>
                      setGenerateForm({ ...generateForm, titlePrefix: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Sessions will be named &quot;{generateForm.titlePrefix || "Session"} 1&quot;,
                    &quot;{generateForm.titlePrefix || "Session"} 2&quot;, etc.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gen-start-date">First Session Date *</Label>
                  <Input
                    id="gen-start-date"
                    type="date"
                    value={generateForm.startDate}
                    onChange={(e) =>
                      setGenerateForm({ ...generateForm, startDate: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gen-start-time">Start Time</Label>
                    <Input
                      id="gen-start-time"
                      type="time"
                      value={generateForm.startTime}
                      onChange={(e) =>
                        setGenerateForm({ ...generateForm, startTime: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gen-end-time">End Time</Label>
                    <Input
                      id="gen-end-time"
                      type="time"
                      value={generateForm.endTime}
                      onChange={(e) =>
                        setGenerateForm({ ...generateForm, endTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recurrence Pattern</Label>
                    <Select
                      value={generateForm.pattern}
                      onValueChange={(v) =>
                        setGenerateForm({
                          ...generateForm,
                          pattern: v as GenerateFormData["pattern"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gen-count">Number of Sessions</Label>
                    <Input
                      id="gen-count"
                      type="number"
                      min="1"
                      max="52"
                      value={generateForm.count}
                      onChange={(e) =>
                        setGenerateForm({
                          ...generateForm,
                          count: Math.max(1, Math.min(52, parseInt(e.target.value) || 1)),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gen-location">Location (optional)</Label>
                  <Input
                    id="gen-location"
                    placeholder="e.g., Room 101 or Online"
                    value={generateForm.location}
                    onChange={(e) =>
                      setGenerateForm({ ...generateForm, location: e.target.value })
                    }
                  />
                </div>

                {/* Module assignment */}
                <div className="space-y-2">
                  <Label>Module Assignment</Label>
                  <Select
                    value={generateForm.moduleAssignment}
                    onValueChange={(v) =>
                      setGenerateForm({
                        ...generateForm,
                        moduleAssignment: v as GenerateFormData["moduleAssignment"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No module linked</SelectItem>
                      <SelectItem value="sequential">
                        Sequential (auto-assign modules in order)
                      </SelectItem>
                      <SelectItem value="same">Same module for all</SelectItem>
                    </SelectContent>
                  </Select>
                  {generateForm.moduleAssignment === "sequential" && modules && (
                    <p className="text-xs text-muted-foreground">
                      Will assign {Math.min(generateForm.count, modules.length)} modules in order.
                      {generateForm.count > modules.length &&
                        ` Sessions beyond module ${modules.length} will have no module.`}
                    </p>
                  )}
                  {generateForm.moduleAssignment === "same" && (
                    <Select
                      value={generateForm.sameModuleId || "none"}
                      onValueChange={(v) =>
                        setGenerateForm({
                          ...generateForm,
                          sameModuleId: v === "none" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select module" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select module</SelectItem>
                        {modules?.map((module) => (
                          <SelectItem key={module.id} value={module.id}>
                            Module {module.order_index}: {module.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Instructor */}
                {programInstructors.length > 0 && (
                  <div className="space-y-2">
                    <Label>Instructor</Label>
                    <Select
                      value={generateForm.instructorId || "none"}
                      onValueChange={(v) =>
                        setGenerateForm({
                          ...generateForm,
                          instructorId: v === "none" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No instructor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No instructor</SelectItem>
                        {programInstructors.map((instructor) => (
                          <SelectItem key={instructor.id} value={instructor.id}>
                            {instructor.name}
                            {instructor.id === cohortInstructorId ? " (Cohort default)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Preview */}
                {previewDates.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview ({previewDates.length} sessions)</Label>
                    <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                      {previewDates.map((date, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {generateForm.titlePrefix || "Session"} {i + 1}
                          </span>
                          {" — "}
                          {date}
                          {generateForm.startTime && ` at ${generateForm.startTime}`}
                          {generateForm.moduleAssignment === "sequential" &&
                            modules &&
                            modules[i] && (
                              <span className="text-primary ml-1">
                                → {modules[i].title}
                              </span>
                            )}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGenerateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={generateMutation.isPending}>
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    {generateMutation.isPending
                      ? "Generating..."
                      : `Generate ${generateForm.count} Sessions`}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {sessions?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No sessions scheduled. Click "Add Session" to create one.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sessions?.map((s) => s.id) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sessions?.map((session) => {
                const instrId = session.instructor_id || cohortInstructorId;
                const instrName = instrId
                  ? programInstructors.find((i) => i.id === instrId)?.name
                  : null;
                const sessionStats = attendanceStats?.[session.id] || null;
                return (
                  <div key={session.id}>
                    <SortableSession
                      session={session}
                      onEdit={handleOpenDialog}
                      onDelete={handleDelete}
                      instructorName={instrName}
                      onToggleAttendance={toggleAttendance}
                      attendanceStats={sessionStats}
                      isAttendanceExpanded={expandedAttendanceId === session.id}
                    />
                    {expandedAttendanceId === session.id && (
                      <CohortSessionAttendance
                        sessionId={session.id}
                        cohortId={cohortId}
                        onStatsChange={() =>
                          queryClient.invalidateQueries({
                            queryKey: ["attendance-stats", cohortId],
                          })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
