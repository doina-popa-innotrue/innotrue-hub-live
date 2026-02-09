import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Linkedin, Globe, Target, BookOpen, GraduationCap, Award, Sparkles } from "lucide-react";

// Types for the static snapshot
interface PublicProfileSnapshot {
  generated_at: string;
  slug: string;
  profile: {
    name?: string;
    avatar_url?: string;
    bio?: string;
    target_role?: string;
    tagline?: string;
    job_title?: string;
    organisation?: string;
    linkedin_url?: string;
    twitter_url?: string;
    website_url?: string;
  };
  interests: string[];
  values: string[];
  drives: string[];
  education: Array<{ institution: string; qualification: string; year_completed?: number; degree?: string; year?: string }>;
  certifications: Array<{ name: string; issuing_body?: string; date_obtained?: string; url?: string; platform?: string }>;
  goals: Array<{ title: string; description?: string; status: string; target_date?: string }>;
  programs: Array<{ name: string; description?: string; status: string }>;
  external_courses: Array<{ title: string; provider?: string; completion_date?: string }>;
  skills: Array<{ name: string; category?: string }>;
  badges: Array<{ name: string; description?: string; issued_at?: string; image_url?: string }>;
}

export default function PublicProfile() {
  const { slug } = useParams<{ slug: string }>();

  const { data: snapshot, isLoading, error } = useQuery({
    queryKey: ["public-profile-snapshot", slug],
    queryFn: async () => {
      // Fetch static JSON from public storage
      const storageUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${storageUrl}/storage/v1/object/public/public-profiles/${slug}.json`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error("Failed to fetch profile");
      }
      
      return response.json() as Promise<PublicProfileSnapshot>;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
            <CardDescription>
              This public profile doesn't exist or is not publicly visible.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { profile, interests, values, drives, education, certifications, goals, programs, external_courses, skills, badges } = snapshot;

  const getInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    planned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    in_progress: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  };

  return (
    <div className="min-h-screen bg-[#000040]">
      {/* Header with branding */}
      <header className="bg-[#000040] text-white py-4 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/assets/bef0efe8-8bee-45e0-a7b2-9067b165d1e8.png" 
              alt="InnoTrue Hub" 
              className="h-8 w-auto"
            />
            <span className="text-sm text-white/70 hidden sm:inline">The system for lifelong development</span>
          </div>
          <a 
            href="https://innotrue.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Learn more
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <Card className="bg-white/10 border-white/10 text-white">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {profile.avatar_url && (
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="text-center md:text-left flex-1">
                {profile.name && (
                  <h1 className="text-3xl font-bold">{profile.name}</h1>
                )}
                {profile.tagline && (
                  <p className="mt-1 text-lg text-white/70">{profile.tagline}</p>
                )}
                {(profile.job_title || profile.organisation) && (
                  <p className="mt-2 text-sm text-white/60">
                    {profile.job_title}
                    {profile.job_title && profile.organisation && " at "}
                    {profile.organisation}
                  </p>
                )}
                {profile.bio && (
                  <p className="mt-2 text-white/70">{profile.bio}</p>
                )}
                {profile.target_role && (
                  <p className="mt-2 text-sm text-white/60 flex items-center gap-1 justify-center md:justify-start">
                    <Target className="h-4 w-4" />
                    Aspiring: {profile.target_role}
                  </p>
                )}
                {(profile.linkedin_url || profile.twitter_url || profile.website_url) && (
                  <div className="flex gap-4 mt-4 justify-center md:justify-start">
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white">
                        <Linkedin className="h-5 w-5" />
                      </a>
                    )}
                    {profile.twitter_url && (
                      <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white">
                        <Globe className="h-5 w-5" />
                      </a>
                    )}
                    {profile.website_url && (
                      <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white">
                        <Globe className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        {skills.length > 0 && (
          <Card className="bg-white/10 border-white/10 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <Sparkles className="h-5 w-5" />
                Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <Badge key={i} variant="secondary" className="bg-white/20 text-white border-white/20">
                    {skill.name}
                    {skill.category && <span className="ml-1 opacity-60">({skill.category})</span>}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Interests, Values, Personal Motivators */}
        {(interests.length > 0 || values.length > 0 || drives.length > 0) && (
          <div className="grid md:grid-cols-3 gap-4">
            {interests.length > 0 && (
              <Card className="bg-white/10 border-white/10 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">Interests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((item, i) => (
                      <Badge key={i} variant="secondary" className="bg-white/20 text-white border-white/20">{item}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {values.length > 0 && (
              <Card className="bg-white/10 border-white/10 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">Values</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {values.map((item, i) => (
                      <Badge key={i} variant="secondary" className="bg-white/20 text-white border-white/20">{item}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {drives.length > 0 && (
              <Card className="bg-white/10 border-white/10 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">Personal Motivators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {drives.map((item, i) => (
                      <Badge key={i} variant="secondary" className="bg-white/20 text-white border-white/20">{item}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Education */}
        {education.length > 0 && (
          <Card className="bg-white/10 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <GraduationCap className="h-5 w-5" />
                Education
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {education.map((edu, index) => (
                  <div key={index} className="border-l-2 border-white/30 pl-4">
                    <p className="font-medium">{edu.qualification || edu.degree}</p>
                    <p className="text-sm text-white/60">{edu.institution}</p>
                    {(edu.year_completed || edu.year) && (
                      <p className="text-sm text-white/60">{edu.year_completed || edu.year}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <Card className="bg-white/10 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Award className="h-5 w-5" />
                Certifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {certifications.map((cert, index) => (
                  <div key={index} className="p-4 border border-white/20 rounded-lg">
                    <p className="font-medium">{cert.name}</p>
                    <p className="text-sm text-white/60">{cert.issuing_body || cert.platform}</p>
                    {cert.url && (
                      <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0099FF] hover:underline">
                        View Badge
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <Card className="bg-white/10 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Award className="h-5 w-5" />
                Earned Badges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {badges.map((badge, index) => (
                  <div key={index} className="p-4 border border-white/20 rounded-lg text-center">
                    {badge.image_url && (
                      <img src={badge.image_url} alt={badge.name} className="h-16 w-16 mx-auto mb-2" />
                    )}
                    <p className="font-medium">{badge.name}</p>
                    {badge.description && (
                      <p className="text-sm text-white/60 mt-1">{badge.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goals */}
        {goals.length > 0 && (
          <Card className="bg-white/10 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="h-5 w-5" />
                Goals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {goals.map((goal, i) => (
                  <div key={i} className="p-4 border border-white/20 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{goal.title}</p>
                      <Badge className={statusColors[goal.status] || ""}>{goal.status}</Badge>
                    </div>
                    {goal.description && (
                      <p className="text-sm text-white/60">{goal.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Programs */}
        {programs.length > 0 && (
          <Card className="bg-white/10 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <BookOpen className="h-5 w-5" />
                Programs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {programs.map((program, i) => (
                  <div key={i} className="p-4 border border-white/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{program.name}</p>
                      <Badge className={statusColors[program.status] || ""}>{program.status}</Badge>
                    </div>
                    {program.description && (
                      <p className="text-sm text-white/60 mt-2">{program.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* External Courses */}
        {external_courses.length > 0 && (
          <Card className="bg-white/10 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <BookOpen className="h-5 w-5" />
                External Learning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {external_courses.map((course, i) => (
                  <div key={i} className="p-4 border border-white/20 rounded-lg">
                    <p className="font-medium">{course.title}</p>
                    {course.provider && (
                      <p className="text-sm text-white/60">{course.provider}</p>
                    )}
                    {course.completion_date && (
                      <p className="text-sm text-white/60">Completed: {course.completion_date}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Platform CTA */}
        <Card className="bg-white/10 border-white/20 text-white">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Start Your Development Journey</h2>
              <p className="text-white/70 max-w-lg mx-auto">
                Create your own public development profile and showcase your growth, skills, and achievements.
              </p>
              <a
                href="https://innotrue.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-[#0099FF] hover:bg-[#0088ee] text-white rounded-lg font-medium transition-colors"
              >
                Get Started
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="text-center py-6 text-white/50 text-sm">
          <p>Powered by InnoTrue Hub — The system for lifelong development</p>
        </footer>
      </div>
    </div>
  );
}
