import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  Clock,
  Users,
  ChevronRight,
  Link as LinkIcon,
  User,
  FileText,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { ModuleSessionManager } from "@/components/modules/ModuleSessionManager";
import { ModuleSectionsDisplay } from "@/components/modules/ModuleSectionsDisplay";
import { ModuleResourceAssignment } from "@/components/modules/ModuleResourceAssignment";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ModuleClientContentManager from "@/components/admin/ModuleClientContentManager";
import { InlineClientContentEditor } from "@/components/modules/InlineClientContentEditor";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { ErrorState } from "@/components/ui/error-state";

interface ModuleLink {
  name: string;
  url: string;
  type: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  content?: string;
  module_type: string;
  estimated_minutes: number;
  tier_required: string;
  is_individualized?: boolean;
  links?: ModuleLink[];
  program_id: string;
  order_index: number;
  content_package_path?: string | null;
}

interface EnrolledClient {
  enrollment_id: string;
  user_id: string;
  name: string;
  email: string;
}

type LocationState = {
  enrollmentId?: string;
  clientName?: string;
};

export default function InstructorModuleDetail() {
  const { programId, moduleId } = useParams();
  if (!programId || !moduleId) return null;
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Prefer location state; keep URL params as fallback (for backwards compatibility)
  const state = (location.state || {}) as LocationState;
  const enrollmentIdFromState = state.enrollmentId || null;
  const clientNameFromState = state.clientName || null;

  const enrollmentIdFromUrl = searchParams.get("enrollmentId");
  const clientNameFromUrl = searchParams.get("clientName");

  const desiredEnrollmentId = enrollmentIdFromState || enrollmentIdFromUrl;
  const desiredClientName =
    clientNameFromState || (clientNameFromUrl ? decodeURIComponent(clientNameFromUrl) : null);

  const navigate = useNavigate();
  const { user } = useAuth();
  const [module, setModule] = useState<Module | null>(null);
  const [programName, setProgramName] = useState<string>("Program");
  const [programSlug, setProgramSlug] = useState<string>("");
  const [enrolledClients, setEnrolledClients] = useState<EnrolledClient[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrolledClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get access token for content package iframe (iframes can't send Authorization headers)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, [user]);

  useEffect(() => {
    async function fetchData() {
      if (!user || !moduleId || !programId) return;

      // Fetch program info
      const { data: programData } = await supabase
        .from("programs")
        .select("name, slug")
        .eq("id", programId)
        .single();

      if (programData) {
        setProgramName(programData.name);
        setProgramSlug(programData.slug);
      }

      // Fetch module
      const { data: moduleData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("id", moduleId)
        .single();

      if (moduleData) {
        setModule({
          ...moduleData,
          links: (moduleData.links as unknown as ModuleLink[]) || [],
        } as Module);
      }

      // Fetch enrolled clients for this program (used when no specific client context is provided)
      // Use staff_enrollments view which respects RLS for instructor/coach access
      const { data: enrollments, error: enrollError } = await supabase
        .from("staff_enrollments")
        .select("id, client_user_id")
        .eq("program_id", programId)
        .eq("status", "active");

      if (enrollError) {
        console.error("Error fetching enrollments:", enrollError);
      }

      // Fetch profiles for enrolled clients
      const clientUserIds = (enrollments || []).map((e: any) => e.client_user_id).filter(Boolean);
      let profilesMap: Record<string, { name: string; username: string }> = {};

      if (clientUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, username")
          .in("id", clientUserIds);

        profilesMap = (profiles || []).reduce(
          (acc, p) => {
            acc[p.id] = { name: p.name || "Unknown", username: p.username || "N/A" };
            return acc;
          },
          {} as Record<string, { name: string; username: string }>,
        );
      }

      const clients: EnrolledClient[] = (enrollments || []).map((e: any) => ({
        enrollment_id: e.id,
        user_id: e.client_user_id,
        name: profilesMap[e.client_user_id]?.name || "Unknown",
        email: profilesMap[e.client_user_id]?.username || "N/A",
      }));
      setEnrolledClients(clients);

      // If a client context is provided (state or URL), fetch the exact enrollment + profile
      if (desiredEnrollmentId) {
        try {
          const { data: enrollment } = await supabase
            .from("client_enrollments")
            .select("id, client_user_id")
            .eq("id", desiredEnrollmentId)
            .single();

          if (enrollment?.client_user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("name, username")
              .eq("id", enrollment.client_user_id)
              .single();

            setSelectedEnrollment({
              enrollment_id: enrollment.id,
              user_id: enrollment.client_user_id,
              name: profile?.name || desiredClientName || "Unknown",
              email: profile?.username || "",
            });
          } else if (desiredClientName) {
            setSelectedEnrollment({
              enrollment_id: desiredEnrollmentId,
              user_id: "",
              name: desiredClientName,
              email: "",
            });
          }
        } catch {
          if (desiredClientName) {
            setSelectedEnrollment({
              enrollment_id: desiredEnrollmentId,
              user_id: "",
              name: desiredClientName,
              email: "",
            });
          }
        }
      }

      setLoading(false);
    }
    fetchData();
  }, [user, moduleId, programId, desiredEnrollmentId, desiredClientName]);

  if (loading) {
    return <PageLoadingState />;
  }

  if (!module) {
    return (
      <div className="container mx-auto py-8">
        <ErrorState title="Not Found" description="The requested module could not be found." />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => navigate("/teaching/programs")}
              className="cursor-pointer"
            >
              Programs
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => navigate(`/teaching/programs/${programSlug}`)}
              className="cursor-pointer"
            >
              {programName}
            </BreadcrumbLink>
          </BreadcrumbItem>
          {selectedEnrollment && (
            <>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => navigate(`/teaching/students/${selectedEnrollment.enrollment_id}`)}
                  className="cursor-pointer"
                >
                  {selectedEnrollment.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{module.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Client context indicator */}
      {selectedEnrollment && (
        <Alert className="bg-primary/5 border-primary/20">
          <User className="h-4 w-4" />
          <AlertDescription>
            Viewing module for client: <strong>{selectedEnrollment.name}</strong>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{module.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{module.module_type}</Badge>
            {module.is_individualized && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                <Users className="h-3 w-3 mr-1" />
                Personalised
              </Badge>
            )}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{module.estimated_minutes} min</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Module Description</CardTitle>
            </CardHeader>
            <CardContent>
              {module.description ? (
                <RichTextDisplay content={module.description} />
              ) : (
                <p className="text-muted-foreground">No description provided.</p>
              )}
            </CardContent>
          </Card>

          {module.content && (
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
              </CardHeader>
              <CardContent>
                <RichTextDisplay content={module.content} />
              </CardContent>
            </Card>
          )}

          <ModuleSectionsDisplay moduleId={moduleId!} />

          {/* Embedded content package preview (Rise/web export) */}
          {module.content_package_path && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Content Package Preview
                </CardTitle>
                <CardDescription>
                  This is how the embedded learning content appears to participants
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accessToken && (
                  <iframe
                    src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-content-package?module=${module.id}&path=index.html&token=${accessToken}`}
                    className="w-full border-0 rounded-lg"
                    style={{ minHeight: "75vh" }}
                    title={module.title}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    allow="autoplay; fullscreen"
                  />
                )}
              </CardContent>
            </Card>
          )}

          {module.links && module.links.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {module.links.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <LinkIcon className="h-4 w-4 text-primary" />
                      <span>{link.name}</span>
                      <Badge variant="outline" className="ml-auto">
                        {link.type}
                      </Badge>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <ModuleResourceAssignment moduleId={moduleId!} />
          {/* Client-specific content for personalized modules */}
          {module.is_individualized && (
            <>
              {/* When viewing a specific client's module, show inline editor */}
              {selectedEnrollment && selectedEnrollment.user_id ? (
                <InlineClientContentEditor
                  moduleId={moduleId!}
                  clientUserId={selectedEnrollment.user_id}
                  clientName={selectedEnrollment.name}
                />
              ) : (
                /* When not viewing a specific client, show the manager dialog */
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Personalised Client Content
                      </CardTitle>
                      <CardDescription className="mt-1.5">
                        Assign unique scenarios, files, or instructions to individual clients for
                        this module.
                      </CardDescription>
                    </div>
                    <ModuleClientContentManager
                      moduleId={moduleId!}
                      moduleName={module.title}
                      programId={programId!}
                    />
                  </CardHeader>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {/* If a specific client is selected via URL, show session manager for that client */}
          {selectedEnrollment ? (
            <Card>
              <CardHeader>
                <CardTitle>Sessions with {selectedEnrollment.name}</CardTitle>
                <CardDescription>
                  Schedule and manage individual sessions with this client for this module.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ModuleSessionManager
                  moduleId={moduleId!}
                  programId={programId}
                  enrollmentId={selectedEnrollment.enrollment_id}
                  clientName={selectedEnrollment.name}
                />
              </CardContent>
            </Card>
          ) : module.is_individualized ? (
            // For personalized modules without client context, show enrolled clients to select
            <Card>
              <CardHeader>
                <CardTitle>Individual Sessions</CardTitle>
                <CardDescription>
                  This is a personalized module. Select a client to schedule individual sessions
                  with them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {enrolledClients.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No clients currently enrolled in this program.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {enrolledClients.map((client) => (
                      <div
                        key={client.enrollment_id}
                        className="flex items-center justify-between p-3 rounded-md border hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => setSelectedEnrollment(client)}
                      >
                        <div>
                          <div className="font-medium">{client.name}</div>
                          <div className="text-sm text-muted-foreground">{client.email}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            // For non-personalized modules, show group session management
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Group Sessions</CardTitle>
                  <CardDescription>
                    Schedule sessions for all or selected enrolled clients. These sessions will be
                    visible to selected participants.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ModuleSessionManager
                    moduleId={moduleId!}
                    programId={programId}
                    showGroupSessions={true}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Enrolled Clients</CardTitle>
                  <CardDescription>
                    Click on a client to view their progress and manage individual sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {enrolledClients.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No clients currently enrolled in this program.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {enrolledClients.map((client) => (
                        <div
                          key={client.enrollment_id}
                          className="flex items-center justify-between p-3 rounded-md border hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => navigate(`/teaching/students/${client.enrollment_id}`)}
                        >
                          <div>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-sm text-muted-foreground">{client.email}</div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
