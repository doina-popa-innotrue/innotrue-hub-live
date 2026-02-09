import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GraduationCap, BookOpen, FileText, ChevronDown, ChevronRight, ExternalLink, FolderOpen, Lock, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useGuidedResourceAccess, AccessStatus } from "@/hooks/useGuidedResourceAccess";

interface GuidedLearningSectionProps {
  domainId: string;
  questionIds: string[];
  domainName: string;
}

type LinkType = "program" | "module" | "resource";

interface GuidedResource {
  id: string;
  name: string;
  type: LinkType;
  programName?: string;
  programId?: string;
  moduleId?: string;
  resourceId?: string;
  fromCollection?: string;
}

export function GuidedLearningSection({ domainId, questionIds, domainName }: GuidedLearningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  // Fetch guided learning resources for this domain and its questions
  const { data: resources, isLoading } = useQuery({
    queryKey: ["guided-learning-resources", domainId, questionIds],
    queryFn: async () => {
      const allResources: GuidedResource[] = [];
      const seen = new Set<string>();

      // Helper to add resource without duplicates
      const addResource = (resource: GuidedResource) => {
        const key = `${resource.type}-${resource.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          allResources.push(resource);
        }
      };

      // Fetch domain-level program links
      const { data: domainPrograms } = await (supabase as any)
        .from("domain_program_links")
        .select("program_id, programs(id, name)")
        .eq("domain_id", domainId)
        .order("order_index");
      
      domainPrograms?.forEach((link: any) => {
        if (link.programs) {
          addResource({
            id: link.program_id,
            name: link.programs.name,
            type: "program",
            programId: link.program_id,
          });
        }
      });

      // Fetch domain-level module links
      const { data: domainModules } = await (supabase as any)
        .from("domain_module_links")
        .select("module_id, program_modules(id, title, program_id, programs(id, name))")
        .eq("domain_id", domainId)
        .order("order_index");
      
      domainModules?.forEach((link: any) => {
        if (link.program_modules) {
          addResource({
            id: link.module_id,
            name: link.program_modules.title,
            type: "module",
            programName: link.program_modules.programs?.name,
            programId: link.program_modules.program_id,
            moduleId: link.module_id,
          });
        }
      });

      // Fetch domain-level resource links
      const { data: domainResources } = await (supabase as any)
        .from("domain_resource_links")
        .select("resource_id, resource_library(id, title)")
        .eq("domain_id", domainId)
        .order("order_index");
      
      domainResources?.forEach((link: any) => {
        if (link.resource_library) {
          addResource({
            id: link.resource_id,
            name: link.resource_library.title,
            type: "resource",
            resourceId: link.resource_id,
          });
        }
      });

      // Fetch domain-level collection links and resolve their resources
      const { data: domainCollections } = await (supabase as any)
        .from("domain_collection_links")
        .select(`
          collection_id,
          resource_collections(
            id, 
            name,
            resource_collection_items(
              resource_id,
              resource_library(id, title)
            )
          )
        `)
        .eq("domain_id", domainId)
        .order("order_index");
      
      domainCollections?.forEach((link: any) => {
        if (link.resource_collections?.resource_collection_items) {
          link.resource_collections.resource_collection_items.forEach((item: any) => {
            if (item.resource_library) {
              addResource({
                id: item.resource_id,
                name: item.resource_library.title,
                type: "resource",
                resourceId: item.resource_id,
                fromCollection: link.resource_collections.name,
              });
            }
          });
        }
      });

      // Fetch question-level links for all questions in this domain
      if (questionIds.length > 0) {
        const { data: questionPrograms } = await (supabase as any)
          .from("question_program_links")
          .select("program_id, programs(id, name)")
          .in("question_id", questionIds)
          .order("order_index");
        
        questionPrograms?.forEach((link: any) => {
          if (link.programs) {
            addResource({
              id: link.program_id,
              name: link.programs.name,
              type: "program",
              programId: link.program_id,
            });
          }
        });

        const { data: questionModules } = await (supabase as any)
          .from("question_module_links")
          .select("module_id, program_modules(id, title, program_id, programs(id, name))")
          .in("question_id", questionIds)
          .order("order_index");
        
        questionModules?.forEach((link: any) => {
          if (link.program_modules) {
            addResource({
              id: link.module_id,
              name: link.program_modules.title,
              type: "module",
              programName: link.program_modules.programs?.name,
              programId: link.program_modules.program_id,
              moduleId: link.module_id,
            });
          }
        });

        const { data: questionResources } = await (supabase as any)
          .from("question_resource_links")
          .select("resource_id, resource_library(id, title)")
          .in("question_id", questionIds)
          .order("order_index");
        
        questionResources?.forEach((link: any) => {
          if (link.resource_library) {
            addResource({
              id: link.resource_id,
              name: link.resource_library.title,
              type: "resource",
              resourceId: link.resource_id,
            });
          }
        });

        // Fetch question-level collection links and resolve their resources
        const { data: questionCollections } = await (supabase as any)
          .from("question_collection_links")
          .select(`
            collection_id,
            resource_collections(
              id, 
              name,
              resource_collection_items(
                resource_id,
                resource_library(id, title)
              )
            )
          `)
          .in("question_id", questionIds)
          .order("order_index");
        
        questionCollections?.forEach((link: any) => {
          if (link.resource_collections?.resource_collection_items) {
            link.resource_collections.resource_collection_items.forEach((item: any) => {
              if (item.resource_library) {
                addResource({
                  id: item.resource_id,
                  name: item.resource_library.title,
                  type: "resource",
                  resourceId: item.resource_id,
                  fromCollection: link.resource_collections.name,
                });
              }
            });
          }
        });
      }

      return allResources;
    },
  });

  // Build module to program map for access checking
  const moduleToProgram = new Map<string, { programId: string; programName: string }>();
  const programIds: string[] = [];
  const moduleIds: string[] = [];

  resources?.forEach((r) => {
    if (r.type === "program" && r.programId) {
      programIds.push(r.programId);
    }
    if (r.type === "module" && r.moduleId && r.programId) {
      moduleIds.push(r.moduleId);
      moduleToProgram.set(r.moduleId, {
        programId: r.programId,
        programName: r.programName || "Unknown Program",
      });
    }
  });

  // Fetch access status for programs and modules
  const { data: accessMap } = useGuidedResourceAccess(
    [...new Set(programIds)],
    [...new Set(moduleIds)],
    moduleToProgram
  );

  // Don't render if no resources
  if (isLoading || !resources || resources.length === 0) {
    return null;
  }

  const getIconForType = (type: LinkType) => {
    switch (type) {
      case "program": return <GraduationCap className="h-3.5 w-3.5 text-primary" />;
      case "module": return <BookOpen className="h-3.5 w-3.5 text-secondary-foreground" />;
      case "resource": return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getAccessStatus = (resource: GuidedResource): { status: AccessStatus; info?: any } => {
    if (resource.type === "resource") {
      return { status: "accessible" };
    }
    
    const key = resource.type === "program" 
      ? `program-${resource.programId}` 
      : `module-${resource.moduleId}`;
    
    const accessInfo = accessMap?.get(key);
    return { status: accessInfo?.status || "accessible", info: accessInfo };
  };

  const handleResourceClick = (resource: GuidedResource, accessStatus: AccessStatus, programId?: string) => {
    if (accessStatus === "not_enrolled" && programId) {
      // Navigate to Explore Programs filtered to this program
      navigate(`/explore-programs?highlight=${programId}`);
      return;
    }
    
    // For accessible resources, navigate normally
    if (accessStatus === "accessible") {
      if (resource.type === "program") {
        navigate(`/programs/${resource.programId}`);
      } else if (resource.type === "module") {
        navigate(`/modules/${resource.moduleId}`);
      } else {
        navigate(`/resources/${resource.resourceId}`);
      }
    }
  };

  const getStatusBadge = (status: AccessStatus, info?: any) => {
    switch (status) {
      case "not_enrolled":
        return (
          <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
            Not Enrolled
          </Badge>
        );
      case "tier_locked":
        return (
          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
            <Lock className="h-3 w-3 mr-1" />
            {info?.requiredTier || "Upgrade Required"}
          </Badge>
        );
      case "prerequisites_locked":
        return (
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Prerequisites
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTooltipContent = (status: AccessStatus, info?: any) => {
    switch (status) {
      case "not_enrolled":
        return `You're not enrolled in ${info?.programName || "this program"}. Click to view in Explore Programs.`;
      case "tier_locked":
        return `Requires ${info?.requiredTier || "higher tier"} access. You have ${info?.userTier || "base"} tier.`;
      case "prerequisites_locked":
        const prereqs = info?.missingPrerequisites || [];
        const prereqNames = prereqs.map((p: any) => p.title).join(", ");
        return `Complete first: ${prereqNames || "required modules"}`;
      default:
        return "";
    }
  };

  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className="mt-3 border rounded-lg bg-muted/30"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Development Resources</span>
          <Badge variant="secondary" className="text-xs">{resources.length}</Badge>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            These resources are associated with this area to help you develop your skills.
          </p>
          <div className="space-y-1.5">
            <TooltipProvider>
              {resources.map((resource) => {
                const { status, info } = getAccessStatus(resource);
                const isAccessible = status === "accessible";
                const isClickable = isAccessible || status === "not_enrolled";

                return (
                  <Tooltip key={`${resource.type}-${resource.id}`}>
                    <TooltipTrigger asChild>
                      {isAccessible ? (
                        <Link
                          to={
                            resource.type === "program"
                              ? `/programs/${resource.programId}`
                              : resource.type === "module"
                              ? `/modules/${resource.moduleId}`
                              : `/resources/${resource.resourceId}`
                          }
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-background transition-colors group"
                        >
                          {getIconForType(resource.type)}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block group-hover:text-primary transition-colors">
                              {resource.name}
                            </span>
                            {resource.programName && (
                              <span className="text-xs text-muted-foreground">
                                in {resource.programName}
                              </span>
                            )}
                            {resource.fromCollection && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <FolderOpen className="h-3 w-3" />
                                {resource.fromCollection}
                              </span>
                            )}
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleResourceClick(resource, status, info?.programId || resource.programId)}
                          disabled={!isClickable}
                          className={`flex items-center gap-2 p-2 rounded-md w-full text-left transition-colors ${
                            isClickable
                              ? "hover:bg-background cursor-pointer group"
                              : "opacity-60 cursor-not-allowed"
                          }`}
                        >
                          {getIconForType(resource.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate ${isClickable ? "group-hover:text-primary transition-colors" : ""}`}>
                                {resource.name}
                              </span>
                              {getStatusBadge(status, info)}
                            </div>
                            {resource.programName && (
                              <span className="text-xs text-muted-foreground">
                                in {resource.programName}
                              </span>
                            )}
                            {resource.fromCollection && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <FolderOpen className="h-3 w-3" />
                                {resource.fromCollection}
                              </span>
                            )}
                          </div>
                          {isClickable && status === "not_enrolled" && (
                            <span className="text-xs text-primary whitespace-nowrap">View in Explore →</span>
                          )}
                        </button>
                      )}
                    </TooltipTrigger>
                    {status !== "accessible" && (
                      <TooltipContent side="top" className="max-w-xs">
                        <p>{getTooltipContent(status, info)}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
