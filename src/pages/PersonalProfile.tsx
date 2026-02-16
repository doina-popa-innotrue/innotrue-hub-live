import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
import { InterestsValuesForm } from "@/components/profile/InterestsValuesForm";

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

interface ExternalCredentialProfile {
  platform: string;
  profile_url: string;
}

export default function PersonalProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSocialLinks, setSavingSocialLinks] = useState(false);
  const [bio, setBio] = useState<string | null>(null);
  const [desiredTargetRole, setDesiredTargetRole] = useState<string | null>(null);
  const [education, setEducation] = useState<Education[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [externalCredentialProfiles, setExternalCredentialProfiles] = useState<
    ExternalCredentialProfile[]
  >([]);
  const [futureVision, setFutureVision] = useState("");
  const [constraints, setConstraints] = useState("");

  // Privacy settings
  const [futureVisionPrivate, setFutureVisionPrivate] = useState(false);
  const [constraintsPrivate, setConstraintsPrivate] = useState(false);
  const [desiredTargetRolePrivate, setDesiredTargetRolePrivate] = useState(false);

  // Social links state
  const [linkedinUrl, setLinkedinUrl] = useState<string | null>(null);
  const [xUrl, setXUrl] = useState<string | null>(null);
  const [blueskyUrl, setBlueskyUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState<string | null>(null);
  const [facebookUrl, setFacebookUrl] = useState<string | null>(null);

  // External credential profile state
  const [savingExternalCredentials, setSavingExternalCredentials] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setBio(data.bio || null);
      setDesiredTargetRole(data.desired_target_role || null);
      setEducation((data.education as unknown as Education[]) || []);
      setCertifications((data.certifications as unknown as Certification[]) || []);
      setExternalCredentialProfiles(
        (data.external_credential_profiles as unknown as ExternalCredentialProfile[]) || [],
      );
      setFutureVision(data.future_vision || "");
      setConstraints(data.constraints || "");
      setFutureVisionPrivate(data.future_vision_private || false);
      setConstraintsPrivate(data.constraints_private || false);
      setDesiredTargetRolePrivate(data.desired_target_role_private || false);
      setLinkedinUrl(data.linkedin_url || null);
      setXUrl(data.x_url || null);
      setBlueskyUrl(data.bluesky_url || null);
      setYoutubeUrl(data.youtube_url || null);
      setInstagramUrl(data.instagram_url || null);
      setFacebookUrl(data.facebook_url || null);
    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          bio,
          desired_target_role: desiredTargetRole,
          future_vision: futureVision || null,
          constraints: constraints || null,
          future_vision_private: futureVisionPrivate,
          constraints_private: constraintsPrivate,
          desired_target_role_private: desiredTargetRolePrivate,
          education: education as any,
          certifications: certifications as any,
        })
        .eq("id", user?.id ?? "");

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your personal profile has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveSocialLinks = async () => {
    try {
      setSavingSocialLinks(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          linkedin_url: linkedinUrl || null,
          x_url: xUrl || null,
          bluesky_url: blueskyUrl || null,
          youtube_url: youtubeUrl || null,
          instagram_url: instagramUrl || null,
          facebook_url: facebookUrl || null,
        })
        .eq("id", user?.id ?? "");

      if (error) throw error;

      toast({
        title: "Social links updated",
        description: "Your social media links have been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving social links",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingSocialLinks(false);
    }
  };

  const saveExternalCredentials = async () => {
    try {
      setSavingExternalCredentials(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          external_credential_profiles: externalCredentialProfiles as any,
        })
        .eq("id", user?.id ?? "");

      if (error) throw error;

      toast({
        title: "External credentials updated",
        description: "Your external credential profiles have been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving external credentials",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingExternalCredentials(false);
    }
  };

  const addExternalCredentialProfile = () => {
    setExternalCredentialProfiles([
      ...externalCredentialProfiles,
      { platform: "", profile_url: "" },
    ]);
  };

  const removeExternalCredentialProfile = (index: number) => {
    setExternalCredentialProfiles(externalCredentialProfiles.filter((_, i) => i !== index));
  };

  const updateExternalCredentialProfile = (
    index: number,
    field: keyof ExternalCredentialProfile,
    value: string,
  ) => {
    const newProfiles = [...externalCredentialProfiles];
    newProfiles[index] = { ...newProfiles[index], [field]: value };
    setExternalCredentialProfiles(newProfiles);
  };

  const addEducation = () => {
    setEducation([...education, { institution: "", degree: "", year: "" }]);
  };

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  const updateEducation = (index: number, field: keyof Education, value: string) => {
    const newEducation = [...education];
    newEducation[index] = { ...newEducation[index], [field]: value };
    setEducation(newEducation);
  };

  const addCertification = () => {
    setCertifications([...certifications, { name: "", url: "", platform: "" }]);
  };

  const removeCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  const updateCertification = (index: number, field: keyof Certification, value: string) => {
    const newCertifications = [...certifications];
    newCertifications[index] = { ...newCertifications[index], [field]: value };
    setCertifications(newCertifications);
  };

  if (loading) {
    return <PageLoadingState />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">InnoTrue Profile</h1>
        <p className="text-muted-foreground">Manage your personal information and credentials</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bio</CardTitle>
          <CardDescription>Tell us about yourself</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">About Me</Label>
            <Textarea
              id="bio"
              placeholder="Share your background, interests, and goals..."
              value={bio || ""}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desired-target-role">Desired Target Role</Label>
            <Input
              id="desired-target-role"
              placeholder="e.g., Chief Technology Officer, VP of Engineering..."
              value={desiredTargetRole || ""}
              onChange={(e) => setDesiredTargetRole(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              The role you aspire to reach in your career
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="desired-target-role-private"
                checked={desiredTargetRolePrivate}
                onCheckedChange={setDesiredTargetRolePrivate}
              />
              <Label
                htmlFor="desired-target-role-private"
                className="text-sm text-muted-foreground"
              >
                Keep private (only visible to you and admins)
              </Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="future-vision">Vision for My Future Self</Label>
            <Textarea
              id="future-vision"
              placeholder="Describe your ideal future self — who do you want to become? What impact do you want to have? What does success look like for you?"
              value={futureVision}
              onChange={(e) => setFutureVision(e.target.value)}
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              This helps personalize AI insights and course recommendations to align with your
              aspirations
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="future-vision-private"
                checked={futureVisionPrivate}
                onCheckedChange={setFutureVisionPrivate}
              />
              <Label htmlFor="future-vision-private" className="text-sm text-muted-foreground">
                Keep private (only visible to you and admins)
              </Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="constraints">Constraints</Label>
            <Textarea
              id="constraints"
              placeholder="What constraints or limitations should be considered? (e.g., family responsibilities, health conditions, location restrictions, time availability, financial considerations...)"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              Share any personal circumstances that may affect your availability, mobility, or
              decision-making. This helps AI provide more realistic and considerate recommendations.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="constraints-private"
                checked={constraintsPrivate}
                onCheckedChange={setConstraintsPrivate}
              />
              <Label htmlFor="constraints-private" className="text-sm text-muted-foreground">
                Keep private (only visible to you and admins)
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Media Links</CardTitle>
          <CardDescription>Connect your social profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              placeholder="https://linkedin.com/in/username"
              value={linkedinUrl || ""}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="x">X (Twitter)</Label>
            <Input
              id="x"
              placeholder="https://x.com/username"
              value={xUrl || ""}
              onChange={(e) => setXUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bluesky">Bluesky</Label>
            <Input
              id="bluesky"
              placeholder="https://bsky.app/profile/username"
              value={blueskyUrl || ""}
              onChange={(e) => setBlueskyUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube">YouTube</Label>
            <Input
              id="youtube"
              placeholder="https://youtube.com/@username"
              value={youtubeUrl || ""}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              placeholder="https://instagram.com/username"
              value={instagramUrl || ""}
              onChange={(e) => setInstagramUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebook">Facebook</Label>
            <Input
              id="facebook"
              placeholder="https://facebook.com/username"
              value={facebookUrl || ""}
              onChange={(e) => setFacebookUrl(e.target.value)}
            />
          </div>
          <Button onClick={saveSocialLinks} disabled={savingSocialLinks}>
            {savingSocialLinks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Social Links
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>External Credentials</CardTitle>
              <CardDescription>
                Link to your credential profiles (Credly, Trailhead, Accredible, etc.)
              </CardDescription>
            </div>
            <Button onClick={addExternalCredentialProfile} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {externalCredentialProfiles.map((profile, index) => (
            <div key={index} className="space-y-3 p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Credential Profile {index + 1}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeExternalCredentialProfile(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Input
                  value={profile.platform}
                  onChange={(e) =>
                    updateExternalCredentialProfile(index, "platform", e.target.value)
                  }
                  placeholder="e.g., Credly, Trailhead, Accredible"
                />
              </div>
              <div className="space-y-2">
                <Label>Profile URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={profile.profile_url}
                    onChange={(e) =>
                      updateExternalCredentialProfile(index, "profile_url", e.target.value)
                    }
                    placeholder="https://www.credly.com/users/..."
                  />
                  {profile.profile_url && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={profile.profile_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {externalCredentialProfiles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No external credential profiles added yet. Add your Credly, Trailhead, or other
              credential profiles to showcase your achievements.
            </p>
          )}
          {externalCredentialProfiles.length > 0 && (
            <Button onClick={saveExternalCredentials} disabled={savingExternalCredentials}>
              {savingExternalCredentials && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save External Credentials
            </Button>
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
          {education.map((edu, index) => (
            <div key={index} className="space-y-3 p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Education {index + 1}</h4>
                <Button variant="ghost" size="sm" onClick={() => removeEducation(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Institution</Label>
                <Input
                  value={edu.institution}
                  onChange={(e) => updateEducation(index, "institution", e.target.value)}
                  placeholder="University name"
                />
              </div>
              <div className="space-y-2">
                <Label>Degree</Label>
                <Input
                  value={edu.degree}
                  onChange={(e) => updateEducation(index, "degree", e.target.value)}
                  placeholder="Bachelor of Science"
                />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  value={edu.year}
                  onChange={(e) => updateEducation(index, "year", e.target.value)}
                  placeholder="2020"
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
              <CardDescription>Link to your certifications and badges</CardDescription>
            </div>
            <Button onClick={addCertification} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Certification
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {certifications.map((cert, index) => (
            <div key={index} className="space-y-3 p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Certification {index + 1}</h4>
                <Button variant="ghost" size="sm" onClick={() => removeCertification(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Certification Name</Label>
                <Input
                  value={cert.name}
                  onChange={(e) => updateCertification(index, "name", e.target.value)}
                  placeholder="AWS Certified Solutions Architect"
                />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Input
                  value={cert.platform}
                  onChange={(e) => updateCertification(index, "platform", e.target.value)}
                  placeholder="Credly, Accredible, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Badge URL</Label>
                <Input
                  value={cert.url}
                  onChange={(e) => updateCertification(index, "url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <InterestsValuesForm />

      <Button onClick={saveProfile} disabled={saving} size="lg" className="w-full">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Profile
      </Button>
    </div>
  );
}
