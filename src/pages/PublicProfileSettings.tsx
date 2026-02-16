import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePublicProfileSettings } from "@/hooks/usePublicProfileSettings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Globe,
  Eye,
  EyeOff,
  Link,
  Check,
  X,
  Upload,
  Trash2,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function PublicProfileSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    settings,
    publicInterests,
    isLoading,
    upsertSettings,
    togglePublicInterest,
    checkSlugAvailability,
    publishProfile,
    unpublishProfile,
  } = usePublicProfileSettings();

  const [slug, setSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Fetch user interests
  const { data: userInterests } = useQuery({
    queryKey: ["user-interests"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("user_interests")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch goals
  const { data: goals } = useQuery({
    queryKey: ["goals-public-settings"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("goals")
        .select("id, title, status, is_public")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  // Fetch enrollments
  const { data: enrollments } = useQuery({
    queryKey: ["enrollments-public-settings"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("client_enrollments")
        .select("id, status, is_public, programs(id, name)")
        .eq("client_user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  // Fetch external courses
  const { data: externalCourses } = useQuery({
    queryKey: ["external-courses-public-settings"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("external_courses")
        .select("id, title, provider, status, is_public")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings?.custom_slug) {
      setSlug(settings.custom_slug);
    }
  }, [settings]);

  const handleSlugChange = async (value: string) => {
    const normalizedSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setSlug(normalizedSlug);

    if (normalizedSlug.length >= 3) {
      setCheckingSlug(true);
      const available = await checkSlugAvailability(normalizedSlug);
      setSlugAvailable(available);
      setCheckingSlug(false);
    } else {
      setSlugAvailable(null);
    }
  };

  const toggleGoalPublic = useMutation({
    mutationFn: async ({ goalId, isPublic }: { goalId: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from("goals")
        .update({ is_public: isPublic })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals-public-settings"] });
    },
  });

  const toggleEnrollmentPublic = useMutation({
    mutationFn: async ({ enrollmentId, isPublic }: { enrollmentId: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from("client_enrollments")
        .update({ is_public: isPublic })
        .eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments-public-settings"] });
    },
  });

  const toggleExternalCoursePublic = useMutation({
    mutationFn: async ({ courseId, isPublic }: { courseId: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from("external_courses")
        .update({ is_public: isPublic })
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-courses-public-settings"] });
    },
  });

  const isInterestPublic = (type: string, value: string) => {
    return publicInterests.some((p) => p.interest_type === type && p.item_value === value);
  };

  const publicUrl = settings?.custom_slug
    ? `${window.location.origin}/p/${settings.custom_slug}`
    : null;

  if (isLoading) {
    return <PageLoadingState />;
  }

  const isPublished = !!settings?.published_at;
  const canPublish = !!settings?.custom_slug && settings.custom_slug.length >= 3;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Public Profile</h1>
        <p className="text-muted-foreground">
          Configure what information is visible on your public profile
        </p>
      </div>

      {/* Publish Status Card */}
      <Card
        className={
          isPublished
            ? "border-green-500/50 bg-green-500/5"
            : "border-orange-500/50 bg-orange-500/5"
        }
      >
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isPublished ? (
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-green-600" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <EyeOff className="h-5 w-5 text-orange-600" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">
                  {isPublished ? "Profile Published" : "Profile Not Published"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isPublished
                    ? `Last published ${format(new Date(settings.published_at!), "PPp")}`
                    : "Configure your settings below and publish when ready"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {isPublished ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => publishProfile.mutate()}
                    disabled={publishProfile.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    {publishProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Republish
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => unpublishProfile.mutate()}
                    disabled={unpublishProfile.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    {unpublishProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Unpublish
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => publishProfile.mutate()}
                  disabled={!canPublish || publishProfile.isPending}
                  className="w-full sm:w-auto"
                >
                  {publishProfile.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Publish Profile
                </Button>
              )}
            </div>
          </div>
          {isPublished && publicUrl && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-background rounded-lg border">
              <Link className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium shrink-0">Public URL:</span>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate"
              >
                {publicUrl}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            URL Settings
          </CardTitle>
          <CardDescription>Set your custom profile URL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Custom URL Slug</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex gap-2 items-center flex-1">
                <span className="text-sm text-muted-foreground shrink-0">/p/</span>
                <div className="flex-1 relative">
                  <Input
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="your-custom-url"
                    className="pr-10"
                  />
                  {checkingSlug && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                  )}
                  {!checkingSlug && slugAvailable === true && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {!checkingSlug && slugAvailable === false && (
                    <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              <Button
                onClick={() => upsertSettings.mutate({ custom_slug: slug })}
                disabled={!slugAvailable || slug.length < 3}
                className="w-full sm:w-auto"
              >
                Save URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use 3-50 lowercase letters, numbers, and hyphens. Remember to republish after
              changing.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Elements</CardTitle>
          <CardDescription>Choose which parts of your profile to show publicly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {[
              { key: "show_name", label: "Name", description: "Your display name" },
              { key: "show_avatar", label: "Avatar", description: "Your profile picture" },
              { key: "show_tagline", label: "Tagline", description: "Your personal tagline" },
              {
                key: "show_job_title",
                label: "Current Role",
                description: "Your current job title",
              },
              {
                key: "show_organisation",
                label: "Organisation",
                description: "Your current organisation",
              },
              { key: "show_bio", label: "Bio", description: "Your biography/about me" },
              {
                key: "show_target_role",
                label: "Target Role",
                description: "Your desired future career role",
              },
              {
                key: "show_social_links",
                label: "Social Links",
                description: "LinkedIn, X, Bluesky",
              },
              {
                key: "show_education",
                label: "Education",
                description: "Your educational background",
              },
              {
                key: "show_certifications",
                label: "Certifications",
                description: "Your certifications and badges",
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <Label>{item.label}</Label>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={(settings as any)?.[item.key] || false}
                  onCheckedChange={(checked) => upsertSettings.mutate({ [item.key]: checked })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="interests" className="w-full">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="interests" className="flex-1 min-w-fit text-xs sm:text-sm">
            Interests & Values
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex-1 min-w-fit text-xs sm:text-sm">
            Goals
          </TabsTrigger>
          <TabsTrigger value="programs" className="flex-1 min-w-fit text-xs sm:text-sm">
            Programs
          </TabsTrigger>
          <TabsTrigger value="external" className="flex-1 min-w-fit text-xs sm:text-sm">
            External Courses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interests</CardTitle>
              <CardDescription>Select which interests to show publicly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {userInterests?.interests?.map((interest: string) => (
                  <Badge
                    key={interest}
                    variant={isInterestPublic("interest", interest) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() =>
                      togglePublicInterest.mutate({
                        type: "interest",
                        value: interest,
                        isPublic: !isInterestPublic("interest", interest),
                      })
                    }
                  >
                    {isInterestPublic("interest", interest) ? (
                      <Eye className="h-3 w-3 mr-1" />
                    ) : (
                      <EyeOff className="h-3 w-3 mr-1" />
                    )}
                    {interest}
                  </Badge>
                ))}
                {(!userInterests?.interests || userInterests.interests.length === 0) && (
                  <p className="text-sm text-muted-foreground">No interests added yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Values</CardTitle>
              <CardDescription>Select which values to show publicly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {userInterests?.values?.map((value: string) => (
                  <Badge
                    key={value}
                    variant={isInterestPublic("value", value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() =>
                      togglePublicInterest.mutate({
                        type: "value",
                        value: value,
                        isPublic: !isInterestPublic("value", value),
                      })
                    }
                  >
                    {isInterestPublic("value", value) ? (
                      <Eye className="h-3 w-3 mr-1" />
                    ) : (
                      <EyeOff className="h-3 w-3 mr-1" />
                    )}
                    {value}
                  </Badge>
                ))}
                {(!userInterests?.values || userInterests.values.length === 0) && (
                  <p className="text-sm text-muted-foreground">No values added yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personal Motivators</CardTitle>
              <CardDescription>Select which personal motivators to show publicly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {userInterests?.drives?.map((drive: string) => (
                  <Badge
                    key={drive}
                    variant={isInterestPublic("drive", drive) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() =>
                      togglePublicInterest.mutate({
                        type: "drive",
                        value: drive,
                        isPublic: !isInterestPublic("drive", drive),
                      })
                    }
                  >
                    {isInterestPublic("drive", drive) ? (
                      <Eye className="h-3 w-3 mr-1" />
                    ) : (
                      <EyeOff className="h-3 w-3 mr-1" />
                    )}
                    {drive}
                  </Badge>
                ))}
                {(!userInterests?.drives || userInterests.drives.length === 0) && (
                  <p className="text-sm text-muted-foreground">No personal motivators added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals">
          <Card>
            <CardHeader>
              <CardTitle>Goals</CardTitle>
              <CardDescription>Select which goals to show on your public profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {goals?.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={goal.is_public}
                        onCheckedChange={(checked) =>
                          toggleGoalPublic.mutate({ goalId: goal.id, isPublic: !!checked })
                        }
                      />
                      <div>
                        <p className="font-medium">{goal.title}</p>
                        <Badge variant="outline" className="text-xs">
                          {goal.status}
                        </Badge>
                      </div>
                    </div>
                    {goal.is_public ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
                {(!goals || goals.length === 0) && (
                  <p className="text-sm text-muted-foreground">No goals created yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programs">
          <Card>
            <CardHeader>
              <CardTitle>InnoTrue Programs</CardTitle>
              <CardDescription>Select which program enrollments to show publicly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {enrollments?.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={enrollment.is_public}
                        onCheckedChange={(checked) =>
                          toggleEnrollmentPublic.mutate({
                            enrollmentId: enrollment.id,
                            isPublic: !!checked,
                          })
                        }
                      />
                      <div>
                        <p className="font-medium">{(enrollment.programs as any)?.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {enrollment.status}
                        </Badge>
                      </div>
                    </div>
                    {enrollment.is_public ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
                {(!enrollments || enrollments.length === 0) && (
                  <p className="text-sm text-muted-foreground">No program enrollments yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external">
          <Card>
            <CardHeader>
              <CardTitle>External Courses</CardTitle>
              <CardDescription>Select which external courses to show publicly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {externalCourses?.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={course.is_public}
                        onCheckedChange={(checked) =>
                          toggleExternalCoursePublic.mutate({
                            courseId: course.id,
                            isPublic: !!checked,
                          })
                        }
                      />
                      <div>
                        <p className="font-medium">{course.title}</p>
                        <p className="text-sm text-muted-foreground">{course.provider}</p>
                        <Badge variant="outline" className="text-xs">
                          {course.status}
                        </Badge>
                      </div>
                    </div>
                    {course.is_public ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
                {(!externalCourses || externalCourses.length === 0) && (
                  <p className="text-sm text-muted-foreground">No external courses added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
