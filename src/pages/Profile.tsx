import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Upload, Bell, Link as LinkIcon, CheckCircle, XCircle, PlayCircle, Crown, Zap, Edit2, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { profileSchema, emailChangeSchema, passwordChangeSchema } from '@/lib/validations';
import { z } from 'zod';
import { resetTour } from '@/hooks/useOnboardingTour';
import { InterestsValuesForm } from '@/components/profile/InterestsValuesForm';
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
} from '@/components/ui/alert-dialog';

interface Education {
  institution: string;
  degree: string;
  year: string;
}

interface Certification {
  name: string;
  url: string;
  platform: string;
}

interface Profile {
  name: string;
  avatar_url: string | null;
  bio: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  bluesky_url: string | null;
  education: Education[];
  certifications: Certification[];
}

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

interface TalentLmsMapping {
  talentlms_user_id: string;
  talentlms_username: string;
}

interface CircleMapping {
  circle_user_id: string;
  circle_email: string;
}

interface LucidMapping {
  lucid_email: string;
  lucid_url: string | null;
}

interface MiroMapping {
  miro_email: string;
  miro_url: string | null;
}

interface MuralMapping {
  mural_email: string;
  mural_url: string | null;
}

export default function Profile() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    name: '',
    avatar_url: null,
    bio: null,
    linkedin_url: null,
    x_url: null,
    bluesky_url: null,
    education: [],
    certifications: [],
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
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
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [talentLmsMapping, setTalentLmsMapping] = useState<TalentLmsMapping | null>(null);
  const [circleMapping, setCircleMapping] = useState<CircleMapping | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectingCircle, setDisconnectingCircle] = useState(false);
  const [disconnectingLucid, setDisconnectingLucid] = useState(false);
  const [requestingReconnect, setRequestingReconnect] = useState(false);
  const [accessingCircle, setAccessingCircle] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<{ name: string; key: string } | null>(null);
  const [lucidMapping, setLucidMapping] = useState<LucidMapping | null>(null);
  const [lucidEmail, setLucidEmail] = useState('');
  const [lucidUrl, setLucidUrl] = useState('');
  const [savingLucid, setSavingLucid] = useState(false);
  const [editingLucid, setEditingLucid] = useState(false);
  
  // Miro state
  const [miroMapping, setMiroMapping] = useState<MiroMapping | null>(null);
  const [miroEmail, setMiroEmail] = useState('');
  const [miroUrl, setMiroUrl] = useState('');
  const [savingMiro, setSavingMiro] = useState(false);
  const [editingMiro, setEditingMiro] = useState(false);
  const [disconnectingMiro, setDisconnectingMiro] = useState(false);
  
  // Mural state
  const [muralMapping, setMuralMapping] = useState<MuralMapping | null>(null);
  const [muralEmail, setMuralEmail] = useState('');
  const [muralUrl, setMuralUrl] = useState('');
  const [savingMural, setSavingMural] = useState(false);
  const [editingMural, setEditingMural] = useState(false);
  const [disconnectingMural, setDisconnectingMural] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile({
        name: data.name || '',
        avatar_url: data.avatar_url || null,
        bio: data.bio || null,
        linkedin_url: data.linkedin_url || null,
        x_url: data.x_url || null,
        bluesky_url: data.bluesky_url || null,
        education: (data.education as unknown as Education[]) || [],
        certifications: (data.certifications as unknown as Certification[]) || [],
      });

      // Load notification preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
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

      // Load user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!rolesError && rolesData) {
        setUserRoles(rolesData.map(r => r.role));
      }

      // Load TalentLMS mapping
      const { data: talentLmsData, error: talentLmsError } = await supabase
        .from('talentlms_users')
        .select('talentlms_user_id, talentlms_username')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!talentLmsError && talentLmsData) {
        setTalentLmsMapping(talentLmsData);
      }

      // Load Circle mapping
      const { data: circleData, error: circleError } = await supabase
        .from('circle_users')
        .select('circle_user_id, circle_email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!circleError && circleData) {
        setCircleMapping(circleData);
      }

      // Load Lucid mapping
      const { data: lucidData, error: lucidError } = await supabase
        .from('lucid_users')
        .select('lucid_email, lucid_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!lucidError && lucidData) {
        setLucidMapping(lucidData);
      }

      // Load Miro mapping
      const { data: miroData, error: miroError } = await supabase
        .from('miro_users')
        .select('miro_email, miro_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!miroError && miroData) {
        setMiroMapping(miroData);
      }

      // Load Mural mapping
      const { data: muralData, error: muralError } = await supabase
        .from('mural_users')
        .select('mural_email, mural_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!muralError && muralData) {
        setMuralMapping(muralData);
      }

      // Load current plan
      if (data.plan_id) {
        const { data: planData } = await supabase
          .from('plans')
          .select('name, key')
          .eq('id', data.plan_id)
          .single();

        if (planData) {
          setCurrentPlan(planData);
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error loading profile',
        description: error.message,
        variant: 'destructive',
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
      
      // Validate file type
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: 'Please upload an image smaller than 5MB',
          variant: 'destructive',
        });
        return;
      }

      const fileExt = file.name.split('.').pop();
      const userId = user?.id ?? 'unknown';
      const fileName = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setProfile({ ...profile, avatar_url: publicUrl });

      toast({
        title: 'Avatar uploaded',
        description: 'Your profile picture has been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error uploading avatar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);

      // Validate profile data
      const validated = profileSchema.parse({
        name: profile.name,
        bio: profile.bio,
        linkedin_url: profile.linkedin_url || '',
        x_url: profile.x_url || '',
        bluesky_url: profile.bluesky_url || '',
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          name: validated.name,
          avatar_url: profile.avatar_url,
          bio: validated.bio,
          linkedin_url: validated.linkedin_url || null,
          x_url: validated.x_url || null,
          bluesky_url: validated.bluesky_url || null,
          education: profile.education as any,
          certifications: profile.certifications as any,
        })
        .eq('id', user?.id ?? '');

      if (error) throw error;

      // Send notification email only if user has it enabled
      if (notificationPrefs.profile_updates) {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            email: user?.email,
            name: profile.name,
            type: 'profile_update',
            timestamp: new Date().toISOString(),
          },
        });
      }

      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved successfully.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error saving profile',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const changeEmail = async () => {
    try {
      const validated = emailChangeSchema.parse({ email: newEmail });

      if (validated.email === user?.email) {
        toast({
          title: 'Same email',
          description: 'This is already your current email address.',
          variant: 'destructive',
        });
        return;
      }

      const oldEmail = user?.email;
      const targetEmail = validated.email;

      const { error: updateError } = await supabase.auth.updateUser({
        email: targetEmail,
      });

      if (updateError) {
        throw updateError;
      }

      if (notificationPrefs.email_changes) {
        const notificationPromises: Promise<any>[] = [];

        if (oldEmail) {
          notificationPromises.push(
            supabase.functions.invoke('send-notification-email', {
              body: {
                email: oldEmail,
                name: profile.name || 'User',
                type: 'email_change_old',
                timestamp: new Date().toISOString(),
                programName: targetEmail,
              },
            })
          );
        }

        notificationPromises.push(
          supabase.functions.invoke('send-notification-email', {
            body: {
              email: targetEmail,
              name: profile.name || 'User',
              type: 'email_change_new',
              timestamp: new Date().toISOString(),
              programName: targetEmail,
            },
          })
        );

        await Promise.allSettled(notificationPromises);
      }

      setNewEmail('');
      await loadProfile();

      toast({
        title: 'Success',
        description: `Email updated to ${targetEmail}. Notification emails sent to both addresses.`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error updating email',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const changePassword = async () => {
    try {
      // Validate passwords
      const validated = passwordChangeSchema.parse({
        newPassword,
        confirmPassword,
      });
      const { error } = await supabase.auth.updateUser({
        password: validated.newPassword,
      });

      if (error) throw error;

      // Get profile data for email notification
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user?.id ?? '')
        .single();

      // Send security notification email only if enabled
      if (notificationPrefs.password_changes) {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            email: user?.email,
            name: profileData?.name || 'User',
            type: 'password_change',
            timestamp: new Date().toISOString(),
          },
        });
      }

      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully. A confirmation email has been sent.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error changing password',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const addEducation = () => {
    setProfile({
      ...profile,
      education: [...profile.education, { institution: '', degree: '', year: '' }],
    });
  };

  const removeEducation = (index: number) => {
    setProfile({
      ...profile,
      education: profile.education.filter((_, i) => i !== index),
    });
  };

  const updateEducation = (index: number, field: keyof Education, value: string) => {
    const newEducation = [...profile.education];
    newEducation[index] = { ...newEducation[index], [field]: value };
    setProfile({ ...profile, education: newEducation });
  };

  const addCertification = () => {
    setProfile({
      ...profile,
      certifications: [...profile.certifications, { name: '', url: '', platform: '' }],
    });
  };

  const removeCertification = (index: number) => {
    setProfile({
      ...profile,
      certifications: profile.certifications.filter((_, i) => i !== index),
    });
  };

  const updateCertification = (index: number, field: keyof Certification, value: string) => {
    const newCertifications = [...profile.certifications];
    newCertifications[index] = { ...newCertifications[index], [field]: value };
    setProfile({ ...profile, certifications: newCertifications });
  };

  const saveNotificationPreferences = async () => {
    try {
      setSavingPrefs(true);

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user?.id ?? '',
          profile_updates: notificationPrefs.profile_updates,
          password_changes: notificationPrefs.password_changes,
          email_changes: notificationPrefs.email_changes,
          program_assignments: notificationPrefs.program_assignments,
          program_completions: notificationPrefs.program_completions,
          module_completions: notificationPrefs.module_completions,
          instructor_program_assignments: notificationPrefs.instructor_program_assignments ?? true,
          instructor_module_assignments: notificationPrefs.instructor_module_assignments ?? true,
          coach_program_assignments: notificationPrefs.coach_program_assignments ?? true,
          coach_module_assignments: notificationPrefs.coach_module_assignments ?? true,
        });

      if (error) throw error;

      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving preferences',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  const disconnectTalentLms = async () => {
    try {
      setDisconnecting(true);

      const { error } = await supabase
        .from('talentlms_users')
        .delete()
        .eq('user_id', user?.id ?? '');

      if (error) throw error;

      setTalentLmsMapping(null);

      toast({
        title: 'Academy disconnected',
        description: 'Your Academy account has been disconnected.',
      });
    } catch (error: any) {
      toast({
        title: 'Error disconnecting Academy',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const disconnectCircle = async () => {
    try {
      setDisconnectingCircle(true);

      const { error } = await supabase
        .from('circle_users')
        .delete()
        .eq('user_id', user?.id ?? '');

      if (error) throw error;

      setCircleMapping(null);

      toast({
        title: 'Community disconnected',
        description: 'Your Community account has been disconnected.',
      });
    } catch (error: any) {
      toast({
        title: 'Error disconnecting Community',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDisconnectingCircle(false);
    }
  };

  const saveLucidConnection = async () => {
    try {
      setSavingLucid(true);

      if (!lucidEmail.trim()) {
        toast({
          title: 'Email required',
          description: 'Please enter your Lucid email address.',
          variant: 'destructive',
        });
        return;
      }

      if (lucidMapping) {
        // Update existing mapping
        const { error } = await supabase
          .from('lucid_users')
          .update({
            lucid_email: lucidEmail.trim(),
            lucid_url: lucidUrl.trim() || null,
          })
          .eq('user_id', user?.id ?? '');

        if (error) throw error;
      } else {
        // Create new mapping
        const { error } = await supabase
          .from('lucid_users')
          .insert({
            user_id: user?.id ?? '',
            lucid_email: lucidEmail.trim(),
            lucid_url: lucidUrl.trim() || null,
          });

        if (error) throw error;
      }

      setLucidMapping({
        lucid_email: lucidEmail.trim(),
        lucid_url: lucidUrl.trim() || null,
      });
      setEditingLucid(false);

      toast({
        title: 'Lucid connected',
        description: 'Your Lucid account has been linked successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving Lucid connection',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingLucid(false);
    }
  };

  const disconnectLucid = async () => {
    try {
      setDisconnectingLucid(true);

      const { error } = await supabase
        .from('lucid_users')
        .delete()
        .eq('user_id', user?.id ?? '');

      if (error) throw error;

      setLucidMapping(null);
      setLucidEmail('');
      setLucidUrl('');

      toast({
        title: 'Lucid disconnected',
        description: 'Your Lucid account has been disconnected.',
      });
    } catch (error: any) {
      toast({
        title: 'Error disconnecting Lucid',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDisconnectingLucid(false);
    }
  };

  const accessLucid = () => {
    const url = lucidMapping?.lucid_url || 'https://lucid.app';
    window.open(url, '_blank');
    toast({
      title: 'Opening Lucid',
      description: 'Opening Lucid in a new window...',
    });
  };

  const startEditingLucid = () => {
    setLucidEmail(lucidMapping?.lucid_email || '');
    setLucidUrl(lucidMapping?.lucid_url || '');
    setEditingLucid(true);
  };

  // Miro functions
  const saveMiroConnection = async () => {
    try {
      setSavingMiro(true);

      if (!miroEmail.trim()) {
        toast({
          title: 'Email required',
          description: 'Please enter your Miro email address.',
          variant: 'destructive',
        });
        return;
      }

      if (miroMapping) {
        const { error } = await supabase
          .from('miro_users')
          .update({
            miro_email: miroEmail.trim(),
            miro_url: miroUrl.trim() || null,
          })
          .eq('user_id', user?.id ?? '');

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('miro_users')
          .insert({
            user_id: user?.id ?? '',
            miro_email: miroEmail.trim(),
            miro_url: miroUrl.trim() || null,
          });

        if (error) throw error;
      }

      setMiroMapping({
        miro_email: miroEmail.trim(),
        miro_url: miroUrl.trim() || null,
      });
      setEditingMiro(false);

      toast({
        title: 'Miro connected',
        description: 'Your Miro account has been linked successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving Miro connection',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingMiro(false);
    }
  };

  const disconnectMiro = async () => {
    try {
      setDisconnectingMiro(true);

      const { error } = await supabase
        .from('miro_users')
        .delete()
        .eq('user_id', user?.id ?? '');

      if (error) throw error;

      setMiroMapping(null);
      setMiroEmail('');
      setMiroUrl('');

      toast({
        title: 'Miro disconnected',
        description: 'Your Miro account has been disconnected.',
      });
    } catch (error: any) {
      toast({
        title: 'Error disconnecting Miro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDisconnectingMiro(false);
    }
  };

  const accessMiro = () => {
    const url = miroMapping?.miro_url || 'https://miro.com';
    window.open(url, '_blank');
    toast({
      title: 'Opening Miro',
      description: 'Opening Miro in a new window...',
    });
  };

  const startEditingMiro = () => {
    setMiroEmail(miroMapping?.miro_email || '');
    setMiroUrl(miroMapping?.miro_url || '');
    setEditingMiro(true);
  };

  // Mural functions
  const saveMuralConnection = async () => {
    try {
      setSavingMural(true);

      if (!muralEmail.trim()) {
        toast({
          title: 'Email required',
          description: 'Please enter your Mural email address.',
          variant: 'destructive',
        });
        return;
      }

      if (muralMapping) {
        const { error } = await supabase
          .from('mural_users')
          .update({
            mural_email: muralEmail.trim(),
            mural_url: muralUrl.trim() || null,
          })
          .eq('user_id', user?.id ?? '');

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mural_users')
          .insert({
            user_id: user?.id ?? '',
            mural_email: muralEmail.trim(),
            mural_url: muralUrl.trim() || null,
          });

        if (error) throw error;
      }

      setMuralMapping({
        mural_email: muralEmail.trim(),
        mural_url: muralUrl.trim() || null,
      });
      setEditingMural(false);

      toast({
        title: 'Mural connected',
        description: 'Your Mural account has been linked successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving Mural connection',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingMural(false);
    }
  };

  const disconnectMural = async () => {
    try {
      setDisconnectingMural(true);

      const { error } = await supabase
        .from('mural_users')
        .delete()
        .eq('user_id', user?.id ?? '');

      if (error) throw error;

      setMuralMapping(null);
      setMuralEmail('');
      setMuralUrl('');

      toast({
        title: 'Mural disconnected',
        description: 'Your Mural account has been disconnected.',
      });
    } catch (error: any) {
      toast({
        title: 'Error disconnecting Mural',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDisconnectingMural(false);
    }
  };

  const accessMural = () => {
    const url = muralMapping?.mural_url || 'https://mural.co';
    window.open(url, '_blank');
    toast({
      title: 'Opening Mural',
      description: 'Opening Mural in a new window...',
    });
  };

  const startEditingMural = () => {
    setMuralEmail(muralMapping?.mural_email || '');
    setMuralUrl(muralMapping?.mural_url || '');
    setEditingMural(true);
  };

  const accessCircle = async () => {
    try {
      setAccessingCircle(true);

      const { data, error } = await supabase.functions.invoke('circle-sso', {
        body: {},
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.loginUrl) {
        window.open(data.loginUrl, '_blank');
        toast({
          title: 'Opening Community',
          description: 'Opening InnoTrue Community in a new window...',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error accessing Community',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAccessingCircle(false);
    }
  };

  const requestReconnect = async () => {
    try {
      setRequestingReconnect(true);

      const response = await supabase.functions.invoke('send-notification-email', {
        body: {
          email: user?.email,
          name: profile.name,
          type: 'talentlms_reconnect_request',
          timestamp: new Date().toISOString(),
        },
      });

      if (response.error) throw response.error;

      toast({
        title: 'Request sent',
        description: 'Your administrator has been notified of your reconnection request.',
      });
    } catch (error: any) {
      toast({
        title: 'Error sending request',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRequestingReconnect(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your profile information and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a profile picture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
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
                accept="image/*"
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
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>
                {currentPlan ? `You are on the ${currentPlan.name} plan` : 'No active subscription'}
              </CardDescription>
            </div>
            {currentPlan?.key === 'enterprise' && (
              <Crown className="h-6 w-6 text-primary" />
            )}
            {currentPlan?.key === 'pro' && (
              <Zap className="h-6 w-6 text-primary" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{currentPlan?.name || 'Free Plan'}</p>
              <p className="text-sm text-muted-foreground">
                View available plans and features
              </p>
            </div>
            <Button onClick={() => window.location.href = '/subscription'}>
              {currentPlan ? 'Manage Subscription' : 'View Plans'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Media Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              placeholder="https://linkedin.com/in/username"
              value={profile.linkedin_url || ''}
              onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="x">X (Twitter)</Label>
            <Input
              id="x"
              placeholder="https://x.com/username"
              value={profile.x_url || ''}
              onChange={(e) => setProfile({ ...profile, x_url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bluesky">Bluesky</Label>
            <Input
              id="bluesky"
              placeholder="https://bsky.app/profile/username"
              value={profile.bluesky_url || ''}
              onChange={(e) => setProfile({ ...profile, bluesky_url: e.target.value })}
            />
          </div>
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
          {talentLmsMapping ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Academy Username</Label>
                  <p className="font-medium">{talentLmsMapping.talentlms_username}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Academy User ID</Label>
                  <p className="font-mono text-sm">{talentLmsMapping.talentlms_user_id}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is linked to InnoTrue Academy. When you access Academy modules, you'll be automatically signed in.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={disconnecting}>
                    {disconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Disconnect Academy
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Academy Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the link between your InnoTrue Hub account and your Academy account. 
                      You won't be able to access Academy modules through single sign-on until an administrator 
                      reconnects your account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={disconnectTalentLms}>
                      Disconnect
                    </AlertDialogAction>
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
              <p className="text-sm text-muted-foreground">
                Your account is not currently linked to InnoTrue Academy. You can request your administrator to set up the connection.
              </p>
              <Button onClick={requestReconnect} disabled={requestingReconnect}>
                {requestingReconnect && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request Reconnection
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
          {circleMapping ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Community Email</Label>
                  <p className="font-medium">{circleMapping.circle_email}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Community User ID</Label>
                  <p className="font-mono text-sm">{circleMapping.circle_user_id}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is connected to InnoTrue Community. Click below to access the community.
              </p>
              <div className="flex gap-2">
                <Button onClick={accessCircle} disabled={accessingCircle}>
                  {accessingCircle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Access Community
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={disconnectingCircle}>
                      {disconnectingCircle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Disconnect Community
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Community Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the link between your InnoTrue Hub account and your Community account. 
                        You won't be able to access the Community through single sign-on until an administrator 
                        reconnects your account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={disconnectCircle}>
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
              <p className="text-sm text-muted-foreground">
                Your account is not currently linked to InnoTrue Community. When you first access Community content, an account will be automatically created for you, or you can contact your administrator to set up the connection.
              </p>
              <Button onClick={accessCircle} disabled={accessingCircle}>
                {accessingCircle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Access Community
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
              <CardTitle>Lucid Connection</CardTitle>
              <CardDescription>Link your LucidChart / LucidSpark account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {lucidMapping && !editingLucid ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Lucid Email</Label>
                  <p className="font-medium">{lucidMapping.lucid_email}</p>
                </div>
                {lucidMapping.lucid_url && (
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Lucid URL</Label>
                    <p className="font-mono text-sm truncate">{lucidMapping.lucid_url}</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is linked to Lucid. Click below to access Lucid.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={accessLucid}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Access Lucid
                </Button>
                <Button variant="outline" onClick={startEditingLucid}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={disconnectingLucid}>
                      {disconnectingLucid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Lucid Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the link between your Evolve360 Hub account and your Lucid account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={disconnectLucid}>
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!editingLucid && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Not Connected</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {editingLucid 
                  ? 'Update your Lucid account details below.'
                  : 'Link your Lucid account to quickly access LucidChart and LucidSpark from Evolve360 Hub.'
                }
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lucid-email">Lucid Email *</Label>
                  <Input
                    id="lucid-email"
                    type="email"
                    placeholder="you@example.com"
                    value={lucidEmail}
                    onChange={(e) => setLucidEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lucid-url">Lucid URL (optional)</Label>
                  <Input
                    id="lucid-url"
                    type="url"
                    placeholder="https://lucid.app/..."
                    value={lucidUrl}
                    onChange={(e) => setLucidUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a direct link to your Lucid workspace or document
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveLucidConnection} disabled={savingLucid}>
                  {savingLucid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingLucid ? 'Update Connection' : 'Connect Lucid'}
                </Button>
                {editingLucid && (
                  <Button variant="outline" onClick={() => setEditingLucid(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <div>
              <CardTitle>Miro Connection</CardTitle>
              <CardDescription>Link your Miro whiteboard account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {miroMapping && !editingMiro ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Miro Email</Label>
                  <p className="font-medium">{miroMapping.miro_email}</p>
                </div>
                {miroMapping.miro_url && (
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Miro URL</Label>
                    <p className="font-mono text-sm truncate">{miroMapping.miro_url}</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is linked to Miro. Click below to access Miro.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={accessMiro}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Access Miro
                </Button>
                <Button variant="outline" onClick={startEditingMiro}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={disconnectingMiro}>
                      {disconnectingMiro && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Miro Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the link between your Evolve360 Hub account and your Miro account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={disconnectMiro}>
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!editingMiro && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Not Connected</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {editingMiro 
                  ? 'Update your Miro account details below.'
                  : 'Link your Miro account to quickly access Miro whiteboards from Evolve360 Hub.'
                }
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="miro-email">Miro Email *</Label>
                  <Input
                    id="miro-email"
                    type="email"
                    placeholder="you@example.com"
                    value={miroEmail}
                    onChange={(e) => setMiroEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="miro-url">Miro URL (optional)</Label>
                  <Input
                    id="miro-url"
                    type="url"
                    placeholder="https://miro.com/app/board/..."
                    value={miroUrl}
                    onChange={(e) => setMiroUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a direct link to your Miro board or workspace
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveMiroConnection} disabled={savingMiro}>
                  {savingMiro && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingMiro ? 'Update Connection' : 'Connect Miro'}
                </Button>
                {editingMiro && (
                  <Button variant="outline" onClick={() => setEditingMiro(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <div>
              <CardTitle>Mural Connection</CardTitle>
              <CardDescription>Link your Mural collaboration account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {muralMapping && !editingMural ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Mural Email</Label>
                  <p className="font-medium">{muralMapping.mural_email}</p>
                </div>
                {muralMapping.mural_url && (
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Mural URL</Label>
                    <p className="font-mono text-sm truncate">{muralMapping.mural_url}</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is linked to Mural. Click below to access Mural.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={accessMural}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Access Mural
                </Button>
                <Button variant="outline" onClick={startEditingMural}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={disconnectingMural}>
                      {disconnectingMural && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Mural Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the link between your Evolve360 Hub account and your Mural account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={disconnectMural}>
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!editingMural && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Not Connected</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {editingMural 
                  ? 'Update your Mural account details below.'
                  : 'Link your Mural account to quickly access Mural workspaces from Evolve360 Hub.'
                }
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mural-email">Mural Email *</Label>
                  <Input
                    id="mural-email"
                    type="email"
                    placeholder="you@example.com"
                    value={muralEmail}
                    onChange={(e) => setMuralEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mural-url">Mural URL (optional)</Label>
                  <Input
                    id="mural-url"
                    type="url"
                    placeholder="https://app.mural.co/..."
                    value={muralUrl}
                    onChange={(e) => setMuralUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a direct link to your Mural workspace or mural
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveMuralConnection} disabled={savingMural}>
                  {savingMural && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingMural ? 'Update Connection' : 'Connect Mural'}
                </Button>
                {editingMural && (
                  <Button variant="outline" onClick={() => setEditingMural(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Education</CardTitle>
              <CardDescription>Add your educational background</CardDescription>
            </div>
            <Button onClick={addEducation} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Education
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.education.map((edu, index) => (
            <div key={index} className="space-y-3 p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Education {index + 1}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEducation(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Institution</Label>
                <Input
                  value={edu.institution}
                  onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                  placeholder="University name"
                />
              </div>
              <div className="space-y-2">
                <Label>Degree</Label>
                <Input
                  value={edu.degree}
                  onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                  placeholder="e.g., Bachelor of Science"
                />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  value={edu.year}
                  onChange={(e) => updateEducation(index, 'year', e.target.value)}
                  placeholder="e.g., 2020"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Certifications</CardTitle>
              <CardDescription>Add your professional certifications and badges</CardDescription>
            </div>
            <Button onClick={addCertification} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Certification
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.certifications.map((cert, index) => (
            <div key={index} className="space-y-3 p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Certification {index + 1}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCertification(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Certification Name</Label>
                <Input
                  value={cert.name}
                  onChange={(e) => updateCertification(index, 'name', e.target.value)}
                  placeholder="e.g., AWS Certified Solutions Architect"
                />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Input
                  value={cert.platform}
                  onChange={(e) => updateCertification(index, 'platform', e.target.value)}
                  placeholder="e.g., Credly, Accredible"
                />
              </div>
              <div className="space-y-2">
                <Label>Certificate URL</Label>
                <Input
                  value={cert.url}
                  onChange={(e) => updateCertification(index, 'url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Email Address</CardTitle>
          <CardDescription>
            Update your email address. We'll send security notifications to both your old and new email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-email">Current Email</Label>
            <Input
              id="current-email"
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">New Email Address</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="Enter new email address"
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
          <CardDescription>Update your account password</CardDescription>
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
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button onClick={changePassword} disabled={!newPassword || !confirmPassword}>
            Change Password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <div>
              <CardTitle>Email Notification Preferences</CardTitle>
              <CardDescription>Choose which email notifications you want to receive</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="profile-updates">Profile Updates</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when your profile information is updated
              </p>
            </div>
            <Switch
              id="profile-updates"
              checked={notificationPrefs.profile_updates}
              onCheckedChange={(checked) => 
                setNotificationPrefs({ ...notificationPrefs, profile_updates: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="password-changes">Password Changes</Label>
              <p className="text-sm text-muted-foreground">
                Security alerts when your password is changed
              </p>
            </div>
            <Switch
              id="password-changes"
              checked={notificationPrefs.password_changes}
              onCheckedChange={(checked) => 
                setNotificationPrefs({ ...notificationPrefs, password_changes: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-changes">Email Changes</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when your email address is updated
              </p>
            </div>
            <Switch
              id="email-changes"
              checked={notificationPrefs.email_changes}
              onCheckedChange={(checked) => 
                setNotificationPrefs({ ...notificationPrefs, email_changes: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="program-assignments">Program Assignments</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you're enrolled in new programs
              </p>
            </div>
            <Switch
              id="program-assignments"
              checked={notificationPrefs.program_assignments}
              onCheckedChange={(checked) => 
                setNotificationPrefs({ ...notificationPrefs, program_assignments: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="program-completions">Program Completions</Label>
              <p className="text-sm text-muted-foreground">
                Celebrate when you complete a program
              </p>
            </div>
            <Switch
              id="program-completions"
              checked={notificationPrefs.program_completions}
              onCheckedChange={(checked) => 
                setNotificationPrefs({ ...notificationPrefs, program_completions: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="module-completions">Module Completions</Label>
              <p className="text-sm text-muted-foreground">
                Get notified for each module you complete (can be frequent)
              </p>
            </div>
            <Switch
              id="module-completions"
              checked={notificationPrefs.module_completions}
              onCheckedChange={(checked) => 
                setNotificationPrefs({ ...notificationPrefs, module_completions: checked })
              }
            />
          </div>

          {userRoles.includes('instructor') && (
            <>
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Instructor Notifications</h4>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="instructor-program-assignments">Program Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you're assigned to instruct a program
                  </p>
                </div>
                <Switch
                  id="instructor-program-assignments"
                  checked={notificationPrefs.instructor_program_assignments ?? true}
                  onCheckedChange={(checked) => 
                    setNotificationPrefs({ ...notificationPrefs, instructor_program_assignments: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="instructor-module-assignments">Module Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you're assigned to instruct specific modules
                  </p>
                </div>
                <Switch
                  id="instructor-module-assignments"
                  checked={notificationPrefs.instructor_module_assignments ?? true}
                  onCheckedChange={(checked) => 
                    setNotificationPrefs({ ...notificationPrefs, instructor_module_assignments: checked })
                  }
                />
              </div>
            </>
          )}

          {userRoles.includes('coach') && (
            <>
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Coach Notifications</h4>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="coach-program-assignments">Program Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you're assigned to coach a program
                  </p>
                </div>
                <Switch
                  id="coach-program-assignments"
                  checked={notificationPrefs.coach_program_assignments ?? true}
                  onCheckedChange={(checked) => 
                    setNotificationPrefs({ ...notificationPrefs, coach_program_assignments: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="coach-module-assignments">Module Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you're assigned to coach specific modules
                  </p>
                </div>
                <Switch
                  id="coach-module-assignments"
                  checked={notificationPrefs.coach_module_assignments ?? true}
                  onCheckedChange={(checked) => 
                    setNotificationPrefs({ ...notificationPrefs, coach_module_assignments: checked })
                  }
                />
              </div>
            </>
          )}

          <div className="pt-4 border-t">
            <Button onClick={saveNotificationPreferences} disabled={savingPrefs} className="w-full">
              {savingPrefs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Notification Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            <div>
              <CardTitle>Onboarding Tour</CardTitle>
              <CardDescription>Replay the guided tour for your role</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Want to see the feature tour again? Click below to restart the onboarding tour for your current role.
          </p>
          <Button 
            variant="outline" 
            onClick={() => {
              const tourId = userRole === 'admin' 
                ? 'admin-tour' 
                : (userRole === 'instructor' || userRole === 'coach') 
                  ? 'instructor-tour' 
                  : 'client-tour';
              resetTour(tourId);
              toast({
                title: "Tour Restarted",
                description: "The onboarding tour will start in a moment. Navigate to the relevant pages to see the tour steps.",
              });
              setTimeout(() => window.location.reload(), 1000);
            }}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Restart Onboarding Tour
          </Button>
        </CardContent>
      </Card>

      <InterestsValuesForm />

      <div className="flex justify-end">
        <Button onClick={saveProfile} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Profile
        </Button>
      </div>
    </div>
  );
}
