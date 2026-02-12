import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Link2,
  Image,
  File,
  Video,
  Download,
  ExternalLink,
  Search,
  Target,
  CheckSquare,
  BookOpen,
  ClipboardList,
  Lightbulb,
  Globe,
  User,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ResourceViewer } from "@/components/resources/ResourceViewer";
import { toast } from "sonner";
import { format } from "date-fns";

interface UnifiedResource {
  id: string;
  title: string;
  description?: string | null;
  resource_type: string;
  url?: string | null;
  file_path?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  source:
    | "goal"
    | "task"
    | "module_reflection"
    | "module_assignment"
    | "development_item"
    | "shared_library"
    | "coach_feedback"
    | "module_content"
    | "personalized_resource";
  source_label: string;
  created_at: string;
  context?: string;
}

export default function MyResources() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerResource, setViewerResource] = useState<UnifiedResource | null>(null);

  // Fetch goal resources
  const { data: goalResources = [] } = useQuery({
    queryKey: ["my-goal-resources", user?.id],
    queryFn: async (): Promise<UnifiedResource[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("goal_resources")
        .select("*, goals(title)")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.title,
          description: r.description,
          resource_type: r.resource_type,
          url: r.url,
          file_path: r.file_path,
          source: "goal",
          source_label: "Goal",
          created_at: r.created_at,
          context: r.goals?.title,
        }),
      );
    },
    enabled: !!user?.id,
  });

  // Fetch task note resources
  const { data: taskResources = [] } = useQuery({
    queryKey: ["my-task-resources", user?.id],
    queryFn: async (): Promise<UnifiedResource[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("task_note_resources")
        .select("*, task_notes(content, tasks(title))")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.title,
          description: r.description,
          resource_type: r.resource_type,
          url: r.url,
          file_path: r.file_path,
          source: "task",
          source_label: "Task",
          created_at: r.created_at,
          context: r.task_notes?.tasks?.title,
        }),
      );
    },
    enabled: !!user?.id,
  });

  // Fetch module reflection resources
  const { data: reflectionResources = [] } = useQuery({
    queryKey: ["my-reflection-resources", user?.id],
    queryFn: async (): Promise<UnifiedResource[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("module_reflection_resources")
        .select("*, module_reflections(modules(title))")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.title,
          description: r.description,
          resource_type: r.resource_type,
          url: r.url,
          file_path: r.file_path,
          file_size: r.file_size,
          source: "module_reflection",
          source_label: "Reflection",
          created_at: r.created_at,
          context: r.module_reflections?.modules?.title,
        }),
      );
    },
    enabled: !!user?.id,
  });

  // Fetch module assignment attachments
  const { data: assignmentResources = [] } = useQuery({
    queryKey: ["my-assignment-resources", user?.id],
    queryFn: async (): Promise<UnifiedResource[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("module_assignment_attachments")
        .select("*, module_assignments!inner(user_id, modules(title))")
        .eq("module_assignments.user_id", user.id);
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.title,
          description: r.description,
          resource_type: r.attachment_type,
          url: r.url,
          file_path: r.file_path,
          file_size: r.file_size,
          mime_type: r.mime_type,
          source: "module_assignment",
          source_label: "Assignment",
          created_at: r.created_at,
          context: r.module_assignments?.modules?.title,
        }),
      );
    },
    enabled: !!user?.id,
  });

  // Fetch development items that are resources
  const { data: developmentResources = [] } = useQuery({
    queryKey: ["my-development-resources", user?.id],
    queryFn: async (): Promise<UnifiedResource[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("development_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("item_type", "resource");
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.title || "Untitled Resource",
          description: r.content,
          resource_type: r.resource_type || "link",
          url: r.resource_url,
          file_path: r.file_path,
          file_size: r.file_size,
          mime_type: r.mime_type,
          source: "development_item",
          source_label: "Development",
          created_at: r.created_at,
        }),
      );
    },
    enabled: !!user?.id,
  });

  // Fetch coach feedback attachments (shared with the user)
  const { data: coachFeedbackResources = [] } = useQuery({
    queryKey: ["my-coach-feedback-resources", user?.id],
    queryFn: async (): Promise<UnifiedResource[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("coach_feedback_attachments")
        .select("*, coach_module_feedback!inner(client_user_id, modules(title))")
        .eq("coach_module_feedback.client_user_id", user.id);
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.title,
          description: r.description,
          resource_type: r.attachment_type,
          url: r.url,
          file_path: r.file_path,
          file_size: r.file_size,
          mime_type: r.mime_type,
          source: "coach_feedback",
          source_label: "Coach Feedback",
          created_at: r.created_at,
          context: r.coach_module_feedback?.modules?.title,
        }),
      );
    },
    enabled: !!user?.id,
  });

  // Fetch module client content attachments (shared with the user)
  const { data: moduleContentResources = [] } = useQuery({
    queryKey: ["my-module-content-resources", user?.id],
    queryFn: async (): Promise<UnifiedResource[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("module_client_content_attachments")
        .select("*, module_client_content!inner(client_user_id, modules(title))")
        .eq("module_client_content.client_user_id", user.id);
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.title,
          description: r.description,
          resource_type: r.attachment_type,
          url: r.url,
          file_path: r.file_path,
          file_size: r.file_size,
          mime_type: r.mime_type,
          source: "module_content",
          source_label: "Module Content",
          created_at: r.created_at,
          context: r.module_client_content?.modules?.title,
        }),
      );
    },
    enabled: !!user?.id,
  });

  // Fetch personalized resources from library assigned to client's content
  const { data: personalizedResources = [] } = useQuery({
    queryKey: ["my-personalized-resources", user?.id],
    queryFn: async (): Promise<UnifiedResource[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("module_client_content_resources")
        .select(
          `
          id,
          created_at,
          resource:resource_id(id, title, description, resource_type, url, file_path, file_size, mime_type),
          module_client_content!inner(user_id, module:module_id(title))
        `,
        )
        .eq("module_client_content.user_id", user.id);
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.resource?.title || "Resource",
          description: r.resource?.description,
          resource_type: r.resource?.resource_type || "file",
          url: r.resource?.url,
          file_path: r.resource?.file_path,
          file_size: r.resource?.file_size,
          mime_type: r.resource?.mime_type,
          source: "personalized_resource",
          source_label: "Personalized Resource",
          created_at: r.created_at,
          context: r.module_client_content?.module?.title,
        }),
      );
    },
    enabled: !!user?.id,
  });

  // Fetch public shared resources from resource library
  const { data: sharedLibraryResources = [] } = useQuery({
    queryKey: ["shared-library-resources"],
    queryFn: async (): Promise<UnifiedResource[]> => {
      const { data, error } = await supabase
        .from("resource_library")
        .select("*")
        .eq("is_active", true)
        .eq("is_published", true);
      if (error) throw error;
      return (data || []).map(
        (r: any): UnifiedResource => ({
          id: r.id,
          title: r.title,
          description: r.description,
          resource_type: r.resource_type,
          url: r.url,
          file_path: r.file_path,
          file_size: r.file_size,
          mime_type: r.mime_type,
          source: "shared_library",
          source_label: "Shared Library",
          created_at: r.created_at,
        }),
      );
    },
  });

  // Combine all resources
  const allResources = useMemo((): UnifiedResource[] => {
    return [
      ...goalResources,
      ...taskResources,
      ...reflectionResources,
      ...assignmentResources,
      ...developmentResources,
      ...coachFeedbackResources,
      ...moduleContentResources,
      ...personalizedResources,
      ...sharedLibraryResources,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [
    goalResources,
    taskResources,
    reflectionResources,
    assignmentResources,
    developmentResources,
    coachFeedbackResources,
    moduleContentResources,
    personalizedResources,
    sharedLibraryResources,
  ]);

  // Filter resources
  const filteredResources = useMemo((): UnifiedResource[] => {
    return allResources.filter((resource) => {
      const matchesSearch =
        searchQuery === "" ||
        resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.context?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSource = sourceFilter === "all" || resource.source === sourceFilter;
      const matchesType = typeFilter === "all" || resource.resource_type === typeFilter;

      return matchesSearch && matchesSource && matchesType;
    });
  }, [allResources, searchQuery, sourceFilter, typeFilter]);

  const {
    paginatedData,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    getPageNumbers,
  } = usePagination<UnifiedResource>(filteredResources, { pageSize: 12 });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "link":
        return <Link2 className="h-4 w-4" />;
      case "pdf":
      case "document":
        return <FileText className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "goal":
        return <Target className="h-3 w-3" />;
      case "task":
        return <CheckSquare className="h-3 w-3" />;
      case "module_reflection":
      case "module_assignment":
      case "module_content":
        return <BookOpen className="h-3 w-3" />;
      case "coach_feedback":
        return <ClipboardList className="h-3 w-3" />;
      case "development_item":
        return <Lightbulb className="h-3 w-3" />;
      case "personalized_resource":
        return <User className="h-3 w-3" />;
      case "shared_library":
        return <Globe className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (resource: UnifiedResource) => {
    if (!resource.file_path) return;
    try {
      // Try multiple buckets since resources come from different sources
      const buckets = [
        "resources",
        "goal-resources",
        "resource-library",
        "module-resources",
        "feedback-attachments",
      ];
      let data: Blob | null = null;

      for (const bucket of buckets) {
        const result = await supabase.storage.from(bucket).download(resource.file_path);
        if (!result.error && result.data) {
          data = result.data;
          break;
        }
      }

      if (!data) {
        throw new Error("Failed to download file from storage");
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = resource.title || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  const handleView = (resource: UnifiedResource) => {
    if (resource.url) {
      window.open(resource.url, "_blank");
    } else if (resource.file_path) {
      setViewerResource(resource);
      setViewerOpen(true);
    }
  };

  const canViewInBrowser = (mimeType?: string | null) => {
    if (!mimeType) return false;
    return (
      mimeType.startsWith("image/") ||
      mimeType === "application/pdf" ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/")
    );
  };

  // Get unique resource types for filter
  const resourceTypes = useMemo(() => {
    const types = new Set(allResources.map((r) => r.resource_type));
    return Array.from(types).filter(Boolean).sort();
  }, [allResources]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Resources</h1>
          <p className="text-muted-foreground">
            All resources you've added or have been shared with you
          </p>
        </div>
        <Badge variant="secondary" className="self-start">
          {filteredResources.length} resource{filteredResources.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="goal">Goals</SelectItem>
                <SelectItem value="task">Tasks</SelectItem>
                <SelectItem value="module_reflection">Reflections</SelectItem>
                <SelectItem value="module_assignment">Assignments</SelectItem>
                <SelectItem value="development_item">Development Items</SelectItem>
                <SelectItem value="coach_feedback">Coach Feedback</SelectItem>
                <SelectItem value="module_content">Module Content</SelectItem>
                <SelectItem value="personalized_resource">Personalized Resources</SelectItem>
                <SelectItem value="shared_library">Shared Library</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {resourceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resources Grid */}
      {paginatedData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No resources found</p>
            <p className="text-sm">
              {searchQuery || sourceFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your filters"
                : "Resources you add to goals, tasks, and modules will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedData.map((resource) => (
              <Card key={`${resource.source}-${resource.id}`} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted shrink-0">
                      {getTypeIcon(resource.resource_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base font-medium line-clamp-2">
                        {resource.title}
                      </CardTitle>
                      {resource.context && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {resource.context}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  {resource.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {resource.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      {getSourceIcon(resource.source)}
                      {resource.source_label}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {resource.resource_type}
                    </Badge>
                    {resource.file_size && (
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(resource.file_size)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(resource.created_at), "MMM d, yyyy")}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {(resource.url ||
                      (resource.file_path && canViewInBrowser(resource.mime_type))) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(resource)}
                        className="flex-1"
                      >
                        {resource.url ? (
                          <>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open
                          </>
                        ) : (
                          <>
                            <FileText className="h-3 w-3 mr-1" />
                            View
                          </>
                        )}
                      </Button>
                    )}
                    {resource.file_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(resource)}
                        className="flex-1"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => hasPreviousPage && previousPage()}
                    className={
                      !hasPreviousPage ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                {getPageNumbers().map((pageNum, index) => (
                  <PaginationItem key={index}>
                    {pageNum === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => goToPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => hasNextPage && nextPage()}
                    className={!hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      {/* Resource Viewer */}
      {viewerResource && viewerResource.file_path && (
        <ResourceViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          resource={{
            title: viewerResource.title,
            file_path: viewerResource.file_path,
            file_name: viewerResource.title,
            mime_type: viewerResource.mime_type || null,
            downloadable: true,
          }}
        />
      )}
    </div>
  );
}
