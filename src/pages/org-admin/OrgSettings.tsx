import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save, Settings, Globe, Bell } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface OrgSettingsData {
  notifyOnMemberJoin?: boolean;
  notifyOnEnrollment?: boolean;
  allowMemberInvites?: boolean;
  [key: string]: any;
}

interface OrganizationSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  settings: OrgSettingsData | null;
}

export default function OrgSettings() {
  const { organizationMembership } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    notifyOnMemberJoin: true,
    notifyOnEnrollment: true,
    allowMemberInvites: false,
  });

  useEffect(() => {
    if (organizationMembership?.organization_id) {
      loadOrganization();
    }
  }, [organizationMembership?.organization_id]);

  const loadOrganization = async () => {
    if (!organizationMembership?.organization_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationMembership.organization_id)
        .single();

      if (error) throw error;

      const settings = (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) 
        ? data.settings as OrgSettingsData 
        : {};

      setOrganization({
        ...data,
        settings,
      } as OrganizationSettings);
      setFormData({
        name: data.name || '',
        description: data.description || '',
        website: data.website || '',
        notifyOnMemberJoin: settings?.notifyOnMemberJoin ?? true,
        notifyOnEnrollment: settings?.notifyOnEnrollment ?? true,
        allowMemberInvites: settings?.allowMemberInvites ?? false,
      });
    } catch (error) {
      console.error('Error loading organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organization settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          description: formData.description || null,
          website: formData.website || null,
          settings: {
            ...organization.settings,
            notifyOnMemberJoin: formData.notifyOnMemberJoin,
            notifyOnEnrollment: formData.notifyOnEnrollment,
            allowMemberInvites: formData.allowMemberInvites,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', organization.id);

      if (error) throw error;

      toast({
        title: 'Settings Saved',
        description: 'Your organization settings have been updated',
      });
      loadOrganization();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization's settings and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Details
          </CardTitle>
          <CardDescription>
            Basic information about your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your Organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <Input
              id="slug"
              value={organization?.slug || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              The URL slug cannot be changed after creation
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell us about your organization..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://www.yourcompany.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure notification preferences for your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New Member Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when a new member joins the organization
              </p>
            </div>
            <Switch
              checked={formData.notifyOnMemberJoin}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, notifyOnMemberJoin: checked })
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enrollment Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when members enroll in programs
              </p>
            </div>
            <Switch
              checked={formData.notifyOnEnrollment}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, notifyOnEnrollment: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Permissions
          </CardTitle>
          <CardDescription>
            Control what members can do in your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Member Invites</Label>
              <p className="text-sm text-muted-foreground">
                Allow managers to invite new members (admins can always invite)
              </p>
            </div>
            <Switch
              checked={formData.allowMemberInvites}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, allowMemberInvites: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
