import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Upload,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  Crown,
  Zap,
  Globe,
  Clock,
  Shield,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { emailChangeSchema, passwordChangeSchema } from "@/lib/validations";
import { z } from "zod";
import { AIPreferencesSection } from "@/components/ai/AIPreferencesSection";
import { TrackSelector } from "@/components/tracks/TrackSelector";
import { TimezoneSelect } from "@/components/profile/TimezoneSelect";
import {
  MeetingTimesPreference,
  MeetingTimePreference,
} from "@/components/profile/MeetingTimesPreference";
import { SchedulingUrlInput } from "@/components/profile/SchedulingUrlInput";
import { CoachSharingConsentSection } from "@/components/consent/CoachSharingConsentSection";
import { OrganizationSharingConsentSection } from "@/components/consent/OrganizationSharingConsentSection";
import { DataExportSection } from "@/components/gdpr/DataExportSection";
import { PrivacyPolicyLink, TermsOfServiceLink } from "@/components/gdpr/PrivacyLinks";
import { AnalyticsOptOut } from "@/components/privacy/AnalyticsOptOut";
import { usePageView } from "@/hooks/useAnalytics";
import { validateFile, acceptStringForBucket } from "@/lib/fileValidation";
import { toast as sonnerToast } from "sonner";

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

interface NotificationPreferences {
  profile_updates: boolean;
  password_changes: boolean;
  email_changes: boolean;
  program_assignments: boolean;
  program_completions: boolean;
  module_completions: boolean;
  instructor_program_assignments?: boolean;
  instructor_module_assignments?: boolean;
  coach_program_assignments?: boolean;
  coach_module_assignments?: boolean;
}

interface AcademyMapping {
  talentlms_user_id: string;
  talentlms_username: string;
}

interface CommunityMapping {
  circle_user_id: string;
  circle_email: string;
}

interface ExternalToolMapping {
  email: string;
  url: string | null;
}

interface GoogleDriveMapping {
  folder_url: string;
  folder_name: string | null;
}

export default function AccountSettings() {
  // Track page view for analytics
  usePageView("Account Settings");

  const { user, userRoles, loading: authLoading, organizationMembership } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [savingMeetingTimes, setSavingMeetingTimes] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [tagline, setTagline] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentEmail, setCurrentEmail] = useState(user?.email || "");
  const [timezone, setTimezone] = useState("UTC");
  const [meetingTimes, setMeetingTimes] = useState<MeetingTimePreference[]>([]);
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    profile_updates: true,
    password_changes: true,
    email_changes: true,
    program_assignments: true,
    program_completions: true,
    module_completions: false,
    instructor_program_assignments: true,
    instructor_module_assignments: true,
    coach_program_assignments: true,
    coach_module_assignments: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [academyMapping, setAcademyMapping] = useState<AcademyMapping | null>(null);
  const [communityMapping, setCommunityMapping] = useState<CommunityMapping | null>(null);
  const [disconnectingAcademy, setDisconnectingAcademy] = useState(false);
  const [disconnectingCommunity, setDisconnectingCommunity] = useState(false);
  const [requestingAcademy, setRequestingAcademy] = useState(false);
  const [requestingCommunity, setRequestingCommunity] = useState(false);
  const [accessingCommunity, setAccessingCommunity] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<{ name: string; key: string } | null>(null);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // External tools state (user-managed)
  const [lucidMapping, setLucidMapping] = useState<ExternalToolMapping | null>(null);
  const [miroMapping, setMiroMapping] = useState<ExternalToolMapping | null>(null);
  const [muralMapping, setMuralMapping] = useState<ExternalToolMapping | null>(null);
  const [lucidEmail, setLucidEmail] = useState("");
  const [lucidUrl, setLucidUrl] = useState("");
  const [miroEmail, setMiroEmail] = useState("");
  const [miroUrl, setMiroUrl] = useState("");
  const [muralEmail, setMuralEmail] = useState("");
  const [muralUrl, setMuralUrl] = useState("");
  const [savingLucid, setSavingLucid] = useState(false);
  const [savingMiro, setSavingMiro] = useState(false);
  const [savingMural, setSavingMural] = useState(false);

  // Google Drive (admin-assigned, read-only for user)
  const [googleDriveMapping, setGoogleDriveMapping] = useState<GoogleDriveMapping | null>(null);

  const isAdmin = userRoles.includes("admin");

  useEffect(() => {
    console.log("[AccountSettings] Auth state:", {
      user: !!user,
      userId: user?.id,
      authLoading,
      isUpdatingEmail,
    });
    if (user && !isUpdatingEmail && !authLoading) {
      console.log("[AccountSettings] Loading account data for user:", user.id);
      loadAccountData();
    } else if (!authLoading && !user) {
      console.log("[AccountSettings] No user found after auth loading completed");
      setLoading(false);
      setLoadError("No authenticated user found");
    }
  }, [user, isUpdatingEmail, authLoading]);

  useEffect(() => {
    if (user?.email) {
      setCurrentEmail(user.email);
    }
  }, [user?.email]);

  const loadAccountData = async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setName(data.name || "");
      setUsername(data.username || "");
      setJobTitle(data.job_title || "");
      setOrganisation(data.organisation || "");
      setTagline(data.tagline || "");
      setAvatarUrl(data.avatar_url || null);
      setTimezone(data.timezone || "UTC");
      setMeetingTimes((data.preferred_meeting_times as unknown as MeetingTimePreference[]) || []);
      setSchedulingUrl(data.scheduling_url || "");

      // Load billing info from billing_info table

      // Load notification preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prefsError && prefsData) {
        setNotificationPrefs({
          profile_updates: prefsData.profile_updates ?? true,
          password_changes: prefsData.password_changes ?? true,
          email_changes: prefsData.email_changes ?? true,
          program_assignments: prefsData.program_assignments ?? true,
          program_completions: prefsData.program_completions ?? true,
          module_completions: prefsData.module_completions ?? false,
          instructor_program_assignments: prefsData.instructor_program_assignments ?? true,
          instructor_module_assignments: prefsData.instructor_module_assignments ?? true,
          coach_program_assignments: prefsData.coach_program_assignments ?? true,
          coach_module_assignments: prefsData.coach_module_assignments ?? true,
        });
      }

      // Load Academy mapping
      const { data: academyData, error: academyError } = await supabase
        .from("talentlms_users")
        .select("talentlms_user_id, talentlms_username")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!academyError && academyData) {
        setAcademyMapping(academyData);
      }

      // Load Community mapping
      const { data: communityData, error: communityError } = await supabase
        .from("circle_users")
        .select("circle_user_id, circle_email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!communityError && communityData) {
        setCommunityMapping(communityData);
      }

      // Load external tools (user-managed)
      const { data: lucidData } = await supabase
        .from("lucid_users")
        .select("lucid_email, lucid_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (lucidData) {
        setLucidMapping({ email: lucidData.lucid_email, url: lucidData.lucid_url });
        setLucidEmail(lucidData.lucid_email || "");
        setLucidUrl(lucidData.lucid_url || "");
      }

      const { data: miroData } = await supabase
        .from("miro_users")
        .select("miro_email, miro_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (miroData) {
        setMiroMapping({ email: miroData.miro_email, url: miroData.miro_url });
        setMiroEmail(miroData.miro_email || "");
        setMiroUrl(miroData.miro_url || "");
      }

      const { data: muralData } = await supabase
        .from("mural_users")
        .select("mural_email, mural_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (muralData) {
        setMuralMapping({ email: muralData.mural_email, url: muralData.mural_url });
        setMuralEmail(muralData.mural_email || "");
        setMuralUrl(muralData.mural_url || "");
      }

      // Load Google Drive (admin-assigned, read-only)
      const { data: driveData } = await supabase
        .from("google_drive_users")
        .select("folder_url, folder_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (driveData) {
        setGoogleDriveMapping(driveData);
      }

      // Load current plan
      if (data.plan_id) {
        const { data: planData } = await supabase
          .from("plans")
          .select("name, key")
          .eq("id", data.plan_id)
          .single();

        if (planData) {
          setCurrentPlan(planData);
        }
      }
    } catch (error: any) {
      console.error("Error loading account data:", error);
      setLoadError(error.message || "Failed to load account data");
      toast({
        title: "Error loading account",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      const validation = validateFile(file, "avatars");
      if (!validation.valid) {
        sonnerToast.error(validation.error);
        return;
      }

      const fileExt = file.name.split(".").pop();
      const userId = user?.id ?? "unknown";
      const fileName = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      setAvatarUrl(publicUrl);

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user?.id ?? "");

      if (error) throw error;

      // Notify other components that profile was updated
      window.dispatchEvent(new CustomEvent("profile-updated"));

      toast({
        title: "Avatar uploaded",
        description: "Your profile picture has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading avatar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const saveName = async () => {
    try {
      setSavingName(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          job_title: jobTitle || null,
          organisation: organisation || null,
          tagline: tagline || null,
        })
        .eq("id", user?.id ?? "");

      if (error) throw error;

      // Notify other components that profile was updated
      window.dispatchEvent(new CustomEvent("profile-updated"));

      toast({
        title: "Profile updated",
        description: "Your profile information has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingName(false);
    }
  };

  const saveTimezone = async () => {
    try {
      setSavingTimezone(true);

      const { error } = await supabase
        .from("profiles")
        .update({ timezone })
        .eq("id", user?.id ?? "");

      if (error) throw error;

      toast({
        title: "Timezone updated",
        description: "Your timezone has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving timezone",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingTimezone(false);
    }
  };

  const saveMeetingTimes = async () => {
    try {
      setSavingMeetingTimes(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          preferred_meeting_times: meetingTimes as unknown as any,
          scheduling_url: schedulingUrl || null,
        })
        .eq("id", user?.id ?? "");

      if (error) throw error;

      toast({
        title: "Meeting preferences updated",
        description: "Your preferred meeting times and scheduling link have been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving meeting preferences",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingMeetingTimes(false);
    }
  };

  const changeEmail = async () => {
    try {
      setSavingEmail(true);
      setIsUpdatingEmail(true);
      const validated = emailChangeSchema.parse({ email: newEmail });

      if (validated.email === user?.email) {
        toast({
          title: "Same email",
          description: "This is already your current email address.",
          variant: "destructive",
        });
        return;
      }

      const oldEmail = user?.email;
      const newEmailAddress = validated.email;

      // Generate a verification token and hash it for storage
      const verificationToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 60); // Token expires in 1 hour (security: short-lived tokens)

      // Hash the token before storing (using SHA-256)
      const encoder = new TextEncoder();
      const data = encoder.encode(verificationToken);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Store the email change request with hashed token
      const { error: requestError } = await supabase.from("email_change_requests").insert({
        user_id: user?.id ?? "",
        old_email: oldEmail!,
        new_email: newEmailAddress,
        verification_token: tokenHash, // Store the hash, not the plain token
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

      if (requestError) {
        throw requestError;
      }

      // Send confirmation email to new address
      const verificationUrl = `${window.location.origin}/account/verify-email-change?token=${verificationToken}`;

      const { error: emailError } = await supabase.functions.invoke("send-notification-email", {
        body: {
          email: newEmailAddress,
          name: name,
          type: "email_change_verification",
          timestamp: new Date().toISOString(),
          verificationUrl,
        },
      });

      if (emailError) {
        console.error("Error sending verification email:", emailError);
      }

      // Also send notification to old email
      if (notificationPrefs.email_changes && oldEmail) {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            email: oldEmail,
            name: name,
            type: "email_change_initiated",
            timestamp: new Date().toISOString(),
            programName: newEmailAddress,
          },
        });
      }

      toast({
        title: "Verification email sent",
        description:
          "Please check your new email address and click the confirmation link to complete the email change.",
      });

      setNewEmail("");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (
        error.message?.includes("already registered") ||
        error.message?.includes("already been registered")
      ) {
        toast({
          title: "Email already in use",
          description: "This email is already registered. Please use a different email address.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error updating email",
          description: error.message || "Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setSavingEmail(false);
      setIsUpdatingEmail(false);
    }
  };
  const changePassword = async () => {
    try {
      setSavingPassword(true);
      const validated = passwordChangeSchema.parse({
        newPassword,
        confirmPassword,
      });

      const { error } = await supabase.auth.updateUser({
        password: validated.newPassword,
      });

      if (error) throw error;

      if (notificationPrefs.password_changes) {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            email: user?.email,
            name: name,
            type: "password_change",
            timestamp: new Date().toISOString(),
          },
        });
      }

      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    } catch (error: any) {
      console.error("Change password error:", error);
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error changing password",
          description: error.message || "Failed to change password. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const saveNotificationPreferences = async () => {
    try {
      setSavingPrefs(true);

      const { error } = await supabase.from("notification_preferences").upsert({
        user_id: user?.id ?? "",
        ...notificationPrefs,
      });

      if (error) throw error;

      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving preferences",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  const disconnectAcademy = async () => {
    try {
      setDisconnectingAcademy(true);

      const { error } = await supabase
        .from("talentlms_users")
        .delete()
        .eq("user_id", user?.id ?? "");

      if (error) throw error;

      setAcademyMapping(null);

      toast({
        title: "Academy disconnected",
        description: "Your InnoTrue Academy account has been disconnected.",
      });
    } catch (error: any) {
      toast({
        title: "Error disconnecting academy",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDisconnectingAcademy(false);
    }
  };

  const disconnectCommunity = async () => {
    try {
      setDisconnectingCommunity(true);

      const { error } = await supabase
        .from("circle_users")
        .delete()
        .eq("user_id", user?.id ?? "");

      if (error) throw error;

      setCommunityMapping(null);

      toast({
        title: "Community disconnected",
        description: "Your InnoTrue Community account has been disconnected.",
      });
    } catch (error: any) {
      toast({
        title: "Error disconnecting community",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDisconnectingCommunity(false);
    }
  };

  const accessCommunity = async () => {
    try {
      setAccessingCommunity(true);

      const { data, error } = await supabase.functions.invoke("circle-sso", {
        body: {},
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.loginUrl) {
        window.open(data.loginUrl, "_blank");
        toast({
          title: "Opening InnoTrue Community",
          description: "Opening InnoTrue Community in a new window...",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error accessing community",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAccessingCommunity(false);
    }
  };

  const requestAcademyConnection = async () => {
    try {
      setRequestingAcademy(true);

      const response = await supabase.functions.invoke("send-notification-email", {
        body: {
          email: user?.email,
          name: name,
          type: "academy_connect_request",
          timestamp: new Date().toISOString(),
        },
      });

      if (response.error) throw response.error;

      toast({
        title: "Request sent",
        description: "Your administrator has been notified of your connection request.",
      });
    } catch (error: any) {
      toast({
        title: "Error sending request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRequestingAcademy(false);
    }
  };

  const requestCommunityConnection = async () => {
    try {
      setRequestingCommunity(true);

      // First, insert into circle_interest_registrations
      const { error: insertError } = await supabase.from("circle_interest_registrations").insert({
        user_id: user?.id ?? "",
        status: "pending",
      });

      if (insertError) {
        // Check if it's a duplicate error
        if (insertError.code === "23505") {
          toast({
            title: "Already requested",
            description: "You have already submitted a connection request.",
          });
          return;
        }
        throw insertError;
      }

      // Then send email notification to admins
      const response = await supabase.functions.invoke("send-notification-email", {
        body: {
          email: user?.email,
          name: name,
          type: "circle_connection_request",
          timestamp: new Date().toISOString(),
          userName: name,
          userEmail: user?.email,
        },
      });

      if (response.error) throw response.error;

      toast({
        title: "Request sent",
        description: "Your administrator has been notified of your connection request.",
      });
    } catch (error: any) {
      toast({
        title: "Error sending request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRequestingCommunity(false);
    }
  };

  // External tools save functions (user-managed)
  const saveLucid = async () => {
    try {
      setSavingLucid(true);

      if (lucidMapping) {
        const { error } = await supabase
          .from("lucid_users")
          .update({
            lucid_email: lucidEmail.trim() || undefined,
            lucid_url: lucidUrl.trim() || null,
          })
          .eq("user_id", user?.id ?? "");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lucid_users").insert({
          user_id: user?.id ?? "",
          lucid_email: lucidEmail.trim() || "",
          lucid_url: lucidUrl.trim() || null,
        });
        if (error) throw error;
      }

      setLucidMapping({ email: lucidEmail.trim() || "", url: lucidUrl.trim() || null });
      toast({
        title: "Lucid settings saved",
        description: "Your Lucid connection has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving Lucid settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingLucid(false);
    }
  };

  const saveMiro = async () => {
    try {
      setSavingMiro(true);

      if (miroMapping) {
        const { error } = await supabase
          .from("miro_users")
          .update({
            miro_email: miroEmail.trim() || undefined,
            miro_url: miroUrl.trim() || null,
          })
          .eq("user_id", user?.id ?? "");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("miro_users").insert({
          user_id: user?.id ?? "",
          miro_email: miroEmail.trim() || "",
          miro_url: miroUrl.trim() || null,
        });
        if (error) throw error;
      }

      setMiroMapping({ email: miroEmail.trim() || "", url: miroUrl.trim() || null });
      toast({
        title: "Miro settings saved",
        description: "Your Miro connection has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving Miro settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingMiro(false);
    }
  };

  const saveMural = async () => {
    try {
      setSavingMural(true);

      if (muralMapping) {
        const { error } = await supabase
          .from("mural_users")
          .update({
            mural_email: muralEmail.trim() || undefined,
            mural_url: muralUrl.trim() || null,
          })
          .eq("user_id", user?.id ?? "");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mural_users").insert({
          user_id: user?.id ?? "",
          mural_email: muralEmail.trim() || "",
          mural_url: muralUrl.trim() || null,
        });
        if (error) throw error;
      }

      setMuralMapping({ email: muralEmail.trim() || "", url: muralUrl.trim() || null });
      toast({
        title: "Mural settings saved",
        description: "Your Mural connection has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving Mural settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingMural(false);
    }
  };

  if (authLoading || loading) {
    return <PageLoadingState message="Loading account settings..." />;
  }

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => window.location.reload()} />;
  }

  if (!user) {
    // ProtectedRoute should handle redirect, but keep showing loader as fallback
    return <PageLoadingState message="Checking authentication..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and integrations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a profile picture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 hover:bg-accent">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>Upload Photo</span>
                </div>
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept={acceptStringForBucket("avatars")}
                onChange={uploadAvatar}
                disabled={uploading}
                className="hidden"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Username</CardTitle>
          <CardDescription>
            Your username is automatically set to your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} disabled placeholder="your_username" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your basic profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A brief description about yourself"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Current Role</Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Product Manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organisation">Current Organisation</Label>
              <Input
                id="organisation"
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                placeholder="e.g. InnoTrue"
              />
            </div>
          </div>
          <Button onClick={saveName} disabled={savingName}>
            {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <div>
              <CardTitle>Timezone</CardTitle>
              <CardDescription>Your timezone is visible to other users</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <TimezoneSelect value={timezone} onChange={setTimezone} />
          <Button onClick={saveTimezone} disabled={savingTimezone}>
            {savingTimezone && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Timezone
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <div>
              <CardTitle>Preferred Meeting Times</CardTitle>
              <CardDescription>Visible to other users for scheduling</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <MeetingTimesPreference value={meetingTimes} onChange={setMeetingTimes} />

          <div className="border-t pt-4">
            <SchedulingUrlInput value={schedulingUrl} onChange={setSchedulingUrl} />
          </div>

          <Button onClick={saveMeetingTimes} disabled={savingMeetingTimes}>
            {savingMeetingTimes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Meeting Preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-email">Current Email</Label>
            <Input id="current-email" value={currentEmail} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">New Email</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="new@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <Button onClick={changeEmail} disabled={!newEmail}>
            Update Email
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            onClick={changePassword}
            disabled={!newPassword || !confirmPassword || savingPassword}
          >
            {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change Password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Choose which emails you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Profile Updates</Label>
              <p className="text-sm text-muted-foreground">
                Receive emails when your profile is updated
              </p>
            </div>
            <Switch
              checked={notificationPrefs.profile_updates}
              onCheckedChange={(checked) =>
                setNotificationPrefs({ ...notificationPrefs, profile_updates: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Password Changes</Label>
              <p className="text-sm text-muted-foreground">
                Security notification when password is changed
              </p>
            </div>
            <Switch
              checked={notificationPrefs.password_changes}
              onCheckedChange={(checked) =>
                setNotificationPrefs({ ...notificationPrefs, password_changes: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Changes</Label>
              <p className="text-sm text-muted-foreground">
                Security notification when email is changed
              </p>
            </div>
            <Switch
              checked={notificationPrefs.email_changes}
              onCheckedChange={(checked) =>
                setNotificationPrefs({ ...notificationPrefs, email_changes: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Program Assignments</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when assigned to new programs
              </p>
            </div>
            <Switch
              checked={notificationPrefs.program_assignments}
              onCheckedChange={(checked) =>
                setNotificationPrefs({ ...notificationPrefs, program_assignments: checked })
              }
            />
          </div>
          <Button onClick={saveNotificationPreferences} disabled={savingPrefs}>
            {savingPrefs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>
                {currentPlan ? `You are on the ${currentPlan.name} plan` : "No active subscription"}
              </CardDescription>
            </div>
            {currentPlan?.key === "enterprise" && <Crown className="h-6 w-6 text-primary" />}
            {currentPlan?.key === "pro" && <Zap className="h-6 w-6 text-primary" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4">
            <div className="min-w-0">
              <p className="font-medium">{currentPlan?.name || "Free Plan"}</p>
              <p className="text-sm text-muted-foreground">View available plans and features</p>
            </div>
            <Button onClick={() => (window.location.href = "/subscription")} className="shrink-0">
              {currentPlan ? "Manage Subscription" : "View Plans"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AIPreferencesSection />

      <TrackSelector />

      {/* My External Tools - User-managed personal workspace links */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <div>
              <CardTitle>My External Tools</CardTitle>
              <CardDescription>
                Link your personal collaboration workspaces for quick access. These are tools you
                manage - we'll use these details to help connect you.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lucid */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Lucid (LucidChart / LucidSpark)</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="lucid-email" className="text-sm text-muted-foreground">
                  Account Email
                </Label>
                <Input
                  id="lucid-email"
                  type="email"
                  placeholder="you@example.com"
                  value={lucidEmail}
                  onChange={(e) => setLucidEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lucid-url" className="text-sm text-muted-foreground">
                  Workspace URL
                </Label>
                <Input
                  id="lucid-url"
                  placeholder="https://lucid.app/..."
                  value={lucidUrl}
                  onChange={(e) => setLucidUrl(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={saveLucid} disabled={savingLucid} size="sm">
              {savingLucid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Lucid Settings
            </Button>
          </div>

          {/* Miro */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Miro</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="miro-email" className="text-sm text-muted-foreground">
                  Account Email
                </Label>
                <Input
                  id="miro-email"
                  type="email"
                  placeholder="you@example.com"
                  value={miroEmail}
                  onChange={(e) => setMiroEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="miro-url" className="text-sm text-muted-foreground">
                  Board/Workspace URL
                </Label>
                <Input
                  id="miro-url"
                  placeholder="https://miro.com/app/board/..."
                  value={miroUrl}
                  onChange={(e) => setMiroUrl(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={saveMiro} disabled={savingMiro} size="sm">
              {savingMiro && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Miro Settings
            </Button>
          </div>

          {/* Mural */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Mural</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="mural-email" className="text-sm text-muted-foreground">
                  Account Email
                </Label>
                <Input
                  id="mural-email"
                  type="email"
                  placeholder="you@example.com"
                  value={muralEmail}
                  onChange={(e) => setMuralEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mural-url" className="text-sm text-muted-foreground">
                  Workspace URL
                </Label>
                <Input
                  id="mural-url"
                  placeholder="https://app.mural.co/..."
                  value={muralUrl}
                  onChange={(e) => setMuralUrl(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={saveMural} disabled={savingMural} size="sm">
              {savingMural && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Mural Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Google Drive - Admin-assigned, read-only */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <div>
              <CardTitle>Google Drive Folder</CardTitle>
              <CardDescription>Your assigned InnoTrue workspace folder</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {googleDriveMapping ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Folder Assigned</span>
              </div>
              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Folder Name</p>
                <p className="font-medium">{googleDriveMapping.folder_name || "InnoTrue Folder"}</p>
              </div>
              <Button
                onClick={() =>
                  window.open(googleDriveMapping.folder_url, "_blank", "noopener,noreferrer")
                }
              >
                Open Google Drive Folder
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">No Folder Assigned</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your administrator will assign a Google Drive folder to your account when needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <div>
              <CardTitle>InnoTrue Academy Connection</CardTitle>
              <CardDescription>Your InnoTrue Academy account integration status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {academyMapping ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Academy Username</Label>
                  <p className="font-medium">{academyMapping.talentlms_username}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Academy User ID</Label>
                  <p className="font-mono text-sm">{academyMapping.talentlms_user_id}</p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={disconnectingAcademy}>
                    {disconnectingAcademy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Disconnect Academy
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect InnoTrue Academy Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the link between your account and InnoTrue Academy.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={disconnectAcademy}>Disconnect</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Not Connected</span>
              </div>
              <Button onClick={requestAcademyConnection} disabled={requestingAcademy}>
                {requestingAcademy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request Connection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <div>
              <CardTitle>InnoTrue Community Connection</CardTitle>
              <CardDescription>Your InnoTrue Community access</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {communityMapping ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Community Email</Label>
                  <p className="font-medium">{communityMapping.circle_email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={accessCommunity} disabled={accessingCommunity}>
                  {accessingCommunity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Access InnoTrue Community
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={disconnectingCommunity}>
                      {disconnectingCommunity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect InnoTrue Community Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the link between your account and InnoTrue Community.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={disconnectCommunity}>
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Not Connected</span>
              </div>
              <Button onClick={requestCommunityConnection} disabled={requestingCommunity}>
                {requestingCommunity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request Connection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy & Data Section */}
      <div className="pt-6 border-t">
        <h2 className="text-xl font-semibold mb-4">Privacy & Data</h2>
      </div>

      <CoachSharingConsentSection />

      {/* Organization Sharing - only show if user belongs to an organization */}
      {organizationMembership?.organization_id && (
        <OrganizationSharingConsentSection
          organizationId={organizationMembership.organization_id}
          organizationName={organizationMembership.organization_name}
        />
      )}

      <DataExportSection />

      <AnalyticsOptOut />

      <Card>
        <CardHeader>
          <CardTitle>Privacy & Legal</CardTitle>
          <CardDescription>
            Review our privacy policy, terms of service, and your acceptance history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <PrivacyPolicyLink />
            <TermsOfServiceLink />
            <Button variant="outline" asChild>
              <a href="/account/terms-history">
                <Shield className="h-4 w-4 mr-2" />
                Terms History
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            By using InnoTrue Hub, you agree to our terms of service and privacy policy. You can
            manage your cookie preferences at any time by clicking "Customize" on the cookie consent
            banner.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
