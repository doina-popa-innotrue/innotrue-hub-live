import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  BookOpen,
  FileText,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GuidedLearningLinksEditorProps {
  entityType: "domain" | "question";
  entityId: string;
  entityName: string;
}

type LinkType = "program" | "module" | "resource" | "collection";

interface LinkedItem {
  id: string;
  linkId: string;
  name: string;
  type: LinkType;
  programName?: string;
  resourceCount?: number;
}

export function GuidedLearningLinksEditor({
  entityType,
  entityId,
  entityName,
}: GuidedLearningLinksEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [selectedCollection, setSelectedCollection] = useState<string>("");

  // Determine table names based on entity type
  const programTable = entityType === "domain" ? "domain_program_links" : "question_program_links";
  const moduleTable = entityType === "domain" ? "domain_module_links" : "question_module_links";
  const resourceTable =
    entityType === "domain" ? "domain_resource_links" : "question_resource_links";
  const collectionTable =
    entityType === "domain" ? "domain_collection_links" : "question_collection_links";
  const idColumn = entityType === "domain" ? "domain_id" : "question_id";

  // Fetch available programs
  const { data: programs } = useQuery({
    queryKey: ["programs-for-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch available modules with their programs
  const { data: modules } = useQuery({
    queryKey: ["modules-for-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules")
        .select(
          `
          id,
          title,
          programs!inner(id, name)
        `,
        )
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  // Fetch available resources
  const { data: resources } = useQuery({
    queryKey: ["resources-for-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_library")
        .select("id, title")
        .eq("is_published", true)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  // Fetch available collections
  const { data: collections } = useQuery({
    queryKey: ["collections-for-links"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_collections")
        .select("id, name, resource_collection_items(count)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        resourceCount: c.resource_collection_items?.[0]?.count || 0,
      }));
    },
  });

  // Fetch current links for this entity
  const { data: currentLinks, isLoading: linksLoading } = useQuery({
    queryKey: ["guided-learning-links", entityType, entityId],
    queryFn: async () => {
      const links: LinkedItem[] = [];

      // Fetch program links
      const { data: programLinks } = await (supabase as any)
        .from(programTable)
        .select(`id, program_id, programs(id, name)`)
        .eq(idColumn, entityId);

      programLinks?.forEach((link: any) => {
        if (link.programs) {
          links.push({
            id: link.program_id,
            linkId: link.id,
            name: link.programs.name,
            type: "program",
          });
        }
      });

      // Fetch module links
      const { data: moduleLinks } = await (supabase as any)
        .from(moduleTable)
        .select(`id, module_id, program_modules(id, title, programs(name))`)
        .eq(idColumn, entityId);

      moduleLinks?.forEach((link: any) => {
        if (link.program_modules) {
          links.push({
            id: link.module_id,
            linkId: link.id,
            name: link.program_modules.title,
            type: "module",
            programName: link.program_modules.programs?.name,
          });
        }
      });

      // Fetch resource links
      const { data: resourceLinks } = await (supabase as any)
        .from(resourceTable)
        .select(`id, resource_id, resource_library(id, title)`)
        .eq(idColumn, entityId);

      resourceLinks?.forEach((link: any) => {
        if (link.resource_library) {
          links.push({
            id: link.resource_id,
            linkId: link.id,
            name: link.resource_library.title,
            type: "resource",
          });
        }
      });

      // Fetch collection links
      const { data: collectionLinks } = await (supabase as any)
        .from(collectionTable)
        .select(
          `id, collection_id, resource_collections(id, name, resource_collection_items(count))`,
        )
        .eq(idColumn, entityId);

      collectionLinks?.forEach((link: any) => {
        if (link.resource_collections) {
          links.push({
            id: link.collection_id,
            linkId: link.id,
            name: link.resource_collections.name,
            type: "collection",
            resourceCount: link.resource_collections.resource_collection_items?.[0]?.count || 0,
          });
        }
      });

      return links;
    },
    enabled: !!entityId,
  });

  // Add link mutation
  const addLinkMutation = useMutation({
    mutationFn: async ({ type, itemId }: { type: LinkType; itemId: string }) => {
      let table: string;
      let column: string;

      switch (type) {
        case "program":
          table = programTable;
          column = "program_id";
          break;
        case "module":
          table = moduleTable;
          column = "module_id";
          break;
        case "resource":
          table = resourceTable;
          column = "resource_id";
          break;
        case "collection":
          table = collectionTable;
          column = "collection_id";
          break;
      }

      const { error } = await (supabase as any)
        .from(table)
        .insert({ [idColumn]: entityId, [column]: itemId });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["guided-learning-links", entityType, entityId] });
      toast({
        description: `${variables.type.charAt(0).toUpperCase() + variables.type.slice(1)} linked successfully`,
      });

      // Reset selections
      if (variables.type === "program") setSelectedProgram("");
      if (variables.type === "module") setSelectedModule("");
      if (variables.type === "resource") setSelectedResource("");
      if (variables.type === "collection") setSelectedCollection("");
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast({
          title: "Already linked",
          description: "This item is already linked",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  // Remove link mutation
  const removeLinkMutation = useMutation({
    mutationFn: async ({ type, linkId }: { type: LinkType; linkId: string }) => {
      let table: string;

      switch (type) {
        case "program":
          table = programTable;
          break;
        case "module":
          table = moduleTable;
          break;
        case "resource":
          table = resourceTable;
          break;
        case "collection":
          table = collectionTable;
          break;
      }

      const { error } = await (supabase as any).from(table).delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guided-learning-links", entityType, entityId] });
      toast({ description: "Link removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getIconForType = (type: LinkType) => {
    switch (type) {
      case "program":
        return <GraduationCap className="h-3 w-3" />;
      case "module":
        return <BookOpen className="h-3 w-3" />;
      case "resource":
        return <FileText className="h-3 w-3" />;
      case "collection":
        return <FolderOpen className="h-3 w-3" />;
    }
  };

  const getBadgeVariant = (type: LinkType): "default" | "secondary" | "outline" => {
    switch (type) {
      case "program":
        return "default";
      case "module":
        return "secondary";
      case "resource":
        return "outline";
      case "collection":
        return "default";
    }
  };

  // Filter out already linked items
  const availablePrograms =
    programs?.filter((p) => !currentLinks?.some((l) => l.type === "program" && l.id === p.id)) ||
    [];
  const availableModules =
    modules?.filter((m) => !currentLinks?.some((l) => l.type === "module" && l.id === m.id)) || [];
  const availableResources =
    resources?.filter((r) => !currentLinks?.some((l) => l.type === "resource" && l.id === r.id)) ||
    [];
  const availableCollections =
    collections?.filter(
      (c: any) => !currentLinks?.some((l) => l.type === "collection" && l.id === c.id),
    ) || [];

  const linkCount = currentLinks?.length || 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 h-auto">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Guided Learning Resources</span>
            {linkCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {linkCount}
              </Badge>
            )}
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <p className="text-sm text-muted-foreground mb-4">
          Link programs, modules, resources, or collections to guide learners on how to improve in
          this area.
        </p>

        {linksLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            {/* Current links */}
            {currentLinks && currentLinks.length > 0 && (
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Linked Resources</Label>
                <div className="flex flex-wrap gap-2">
                  {currentLinks.map((link) => (
                    <Badge
                      key={link.linkId}
                      variant={getBadgeVariant(link.type)}
                      className={`flex items-center gap-1 pr-1 ${link.type === "collection" ? "bg-primary/80" : ""}`}
                    >
                      {getIconForType(link.type)}
                      <span className="max-w-[150px] truncate">
                        {link.name}
                        {link.programName && (
                          <span className="text-xs opacity-70"> ({link.programName})</span>
                        )}
                        {link.type === "collection" && link.resourceCount !== undefined && (
                          <span className="text-xs opacity-70"> ({link.resourceCount})</span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-destructive/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLinkMutation.mutate({ type: link.type, linkId: link.linkId });
                        }}
                        disabled={removeLinkMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Add new links */}
            <Tabs defaultValue="collections" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="collections" className="text-xs">
                  Collections
                </TabsTrigger>
                <TabsTrigger value="programs" className="text-xs">
                  Programs
                </TabsTrigger>
                <TabsTrigger value="modules" className="text-xs">
                  Modules
                </TabsTrigger>
                <TabsTrigger value="resources" className="text-xs">
                  Resources
                </TabsTrigger>
              </TabsList>

              <TabsContent value="collections" className="mt-2">
                <div className="flex gap-2">
                  <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a collection..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCollections.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No collections available
                        </SelectItem>
                      ) : (
                        availableCollections.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}{" "}
                            <span className="text-muted-foreground">
                              ({c.resourceCount} resources)
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    onClick={() =>
                      addLinkMutation.mutate({ type: "collection", itemId: selectedCollection })
                    }
                    disabled={!selectedCollection || addLinkMutation.isPending}
                  >
                    {addLinkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Collections group multiple resources together. Changes to the collection are
                  automatically reflected here.
                </p>
              </TabsContent>

              <TabsContent value="programs" className="mt-2">
                <div className="flex gap-2">
                  <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a program..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePrograms.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No programs available
                        </SelectItem>
                      ) : (
                        availablePrograms.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    onClick={() =>
                      addLinkMutation.mutate({ type: "program", itemId: selectedProgram })
                    }
                    disabled={!selectedProgram || addLinkMutation.isPending}
                  >
                    {addLinkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="modules" className="mt-2">
                <div className="flex gap-2">
                  <Select value={selectedModule} onValueChange={setSelectedModule}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a module..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModules.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No modules available
                        </SelectItem>
                      ) : (
                        availableModules.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.title}{" "}
                            <span className="text-muted-foreground">({m.programs?.name})</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    onClick={() =>
                      addLinkMutation.mutate({ type: "module", itemId: selectedModule })
                    }
                    disabled={!selectedModule || addLinkMutation.isPending}
                  >
                    {addLinkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="resources" className="mt-2">
                <div className="flex gap-2">
                  <Select value={selectedResource} onValueChange={setSelectedResource}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a resource..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableResources.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No resources available
                        </SelectItem>
                      ) : (
                        availableResources.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    onClick={() =>
                      addLinkMutation.mutate({ type: "resource", itemId: selectedResource })
                    }
                    disabled={!selectedResource || addLinkMutation.isPending}
                  >
                    {addLinkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
