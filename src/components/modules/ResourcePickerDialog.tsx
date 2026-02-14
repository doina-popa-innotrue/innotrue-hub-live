import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Library,
  FileText,
  Video,
  Link as LinkIcon,
  ImageIcon,
  Search,
  Check,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Resource {
  id: string;
  canonical_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  category_id: string | null;
}

interface ResourceWithPrograms extends Resource {
  program_ids: string[];
}

interface Category {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
}

interface ResourcePickerDialogProps {
  excludeResourceIds: string[];
  onSelect: (resource: Resource) => void;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

function getResourceIcon(type: string, className?: string) {
  const iconClass = cn("h-4 w-4", className);
  switch (type) {
    case "video":
      return <Video className={iconClass} />;
    case "link":
      return <LinkIcon className={iconClass} />;
    case "image":
      return <ImageIcon className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
}

export function ResourcePickerDialog({
  excludeResourceIds,
  onSelect,
  disabled,
  trigger,
}: ResourcePickerDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ["resource-categories-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
    enabled: dialogOpen,
  });

  // Fetch programs for filter
  const { data: programs = [] } = useQuery({
    queryKey: ["programs-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Program[];
    },
    enabled: dialogOpen,
  });

  // Fetch available resources from library (published & active)
  const { data: availableResources = [], isLoading } = useQuery({
    queryKey: ["available-resources-for-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_library")
        .select("id, canonical_id, title, description, resource_type, category_id")
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (error) throw error;

      // Fetch program assignments
      const resourceIds = data.map((r) => r.id);
      const { data: programLinks } = await supabase
        .from("resource_library_programs")
        .select("resource_id, program_id")
        .in("resource_id", resourceIds);

      // Map program IDs to resources
      const resourcesWithPrograms: ResourceWithPrograms[] = data.map((resource) => ({
        ...resource,
        program_ids:
          programLinks?.filter((pl) => pl.resource_id === resource.id).map((pl) => pl.program_id) ||
          [],
      }));

      return resourcesWithPrograms;
    },
    enabled: dialogOpen,
  });

  // Filter and search resources
  const filteredResources = useMemo(() => {
    return availableResources.filter((resource) => {
      // Exclude already assigned
      if (excludeResourceIds.includes(resource.id)) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = resource.title.toLowerCase().includes(query);
        const matchesDescription = resource.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) return false;
      }

      // Category filter
      if (filterCategory !== "all" && resource.category_id !== filterCategory) return false;

      // Program filter
      if (filterProgram !== "all") {
        if (!resource.program_ids.includes(filterProgram)) return false;
      }

      // Type filter
      if (filterType !== "all" && resource.resource_type !== filterType) return false;

      return true;
    });
  }, [
    availableResources,
    excludeResourceIds,
    searchQuery,
    filterCategory,
    filterProgram,
    filterType,
  ]);

  const selectedResource = availableResources.find((r) => r.id === selectedResourceId);

  const handleSelect = () => {
    if (selectedResource) {
      onSelect(selectedResource);
      setDialogOpen(false);
      resetFilters();
    }
  };

  const resetFilters = () => {
    setSelectedResourceId("");
    setSearchQuery("");
    setFilterCategory("all");
    setFilterProgram("all");
    setFilterType("all");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetFilters();
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name;
  };

  const hasActiveFilters =
    filterCategory !== "all" || filterProgram !== "all" || filterType !== "all";

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Library className="h-4 w-4 mr-1" /> Add Resource
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Resource from Library</DialogTitle>
          <DialogDescription>
            Search and filter to find resources for this content
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="space-y-3 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterProgram} onValueChange={setFilterProgram}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programs.map((prog) => (
                  <SelectItem key={prog.id} value={prog.id}>
                    {prog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCategory("all");
                  setFilterProgram("all");
                  setFilterType("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Library className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No resources found</p>
              <p className="text-sm">
                {searchQuery || hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "All available resources have been added"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-1">
                {filteredResources.map((resource) => {
                  const isSelected = selectedResourceId === resource.id;
                  const categoryName = getCategoryName(resource.category_id);

                  return (
                    <button
                      key={resource.id}
                      type="button"
                      onClick={() => setSelectedResourceId(resource.id)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "bg-card hover:bg-muted/50 border-border",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 p-1.5 rounded",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        {getResourceIcon(resource.resource_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{resource.title}</span>
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        {resource.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            {resource.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">
                            {resource.resource_type}
                          </Badge>
                          {categoryName && (
                            <Badge variant="secondary" className="text-xs">
                              {categoryName}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer with count and actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {filteredResources.length} resource{filteredResources.length !== 1 ? "s" : ""} found
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSelect} disabled={!selectedResourceId}>
              Add Resource
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
