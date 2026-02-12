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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Search, Check, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScenarioTemplate {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  is_protected: boolean;
  capability_assessments?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  scenario_categories?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface ScenarioCategory {
  id: string;
  name: string;
  color: string | null;
}

interface ScenarioPickerDialogProps {
  excludeScenarioIds: string[];
  onSelect: (scenario: ScenarioTemplate) => void;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

export function ScenarioPickerDialog({
  excludeScenarioIds,
  onSelect,
  disabled,
  trigger,
}: ScenarioPickerDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch available scenarios (active only)
  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: ["available-scenarios-for-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenario_templates")
        .select(
          `
          id, 
          title, 
          description, 
          is_active, 
          is_protected,
           capability_assessments(id, name, slug),
           scenario_categories(id, name, color)
        `,
        )
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (error) throw error;
      return data as ScenarioTemplate[];
    },
    enabled: dialogOpen,
  });

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ["scenario-categories-for-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenario_categories")
        .select("id, name, color")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as ScenarioCategory[];
    },
    enabled: dialogOpen,
  });

  // Filter and search scenarios
  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario) => {
      // Exclude already assigned
      if (excludeScenarioIds.includes(scenario.id)) return false;

      // Category filter
      if (categoryFilter !== "all") {
        if (categoryFilter === "uncategorized") {
          if (scenario.scenario_categories) return false;
        } else {
          if (scenario.scenario_categories?.id !== categoryFilter) return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = scenario.title.toLowerCase().includes(query);
        const matchesDescription = scenario.description?.toLowerCase().includes(query);
        const matchesAssessment = scenario.capability_assessments?.name
          .toLowerCase()
          .includes(query);
        const matchesCategory = scenario.scenario_categories?.name.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription && !matchesAssessment && !matchesCategory)
          return false;
      }

      return true;
    });
  }, [scenarios, excludeScenarioIds, searchQuery, categoryFilter]);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);

  const handleSelect = () => {
    if (selectedScenario) {
      onSelect(selectedScenario);
      setDialogOpen(false);
      resetFilters();
    }
  };

  const resetFilters = () => {
    setSelectedScenarioId("");
    setSearchQuery("");
    setCategoryFilter("all");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetFilters();
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <ClipboardList className="h-4 w-4 mr-1" /> Add Scenario
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add System Scenario</DialogTitle>
          <DialogDescription>
            Select a scenario template for the client to complete
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="py-2">
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search scenarios by title or assessment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredScenarios.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No scenarios found</p>
              <p className="text-sm">
                {searchQuery
                  ? "Try adjusting your search"
                  : "All available scenarios have been assigned"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-1">
                {filteredScenarios.map((scenario) => {
                  const isSelected = selectedScenarioId === scenario.id;

                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => setSelectedScenarioId(scenario.id)}
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
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{scenario.title}</span>
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        {scenario.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            {scenario.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {scenario.scenario_categories && (
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: scenario.scenario_categories.color
                                  ? `var(--${scenario.scenario_categories.color}-500, currentColor)`
                                  : undefined,
                              }}
                            >
                              {scenario.scenario_categories.name}
                            </Badge>
                          )}
                          {scenario.capability_assessments && (
                            <Badge variant="secondary" className="text-xs">
                              {scenario.capability_assessments.name}
                            </Badge>
                          )}
                          {scenario.is_protected && (
                            <Badge variant="outline" className="text-xs">
                              Protected
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
            {filteredScenarios.length} scenario{filteredScenarios.length !== 1 ? "s" : ""} found
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSelect} disabled={!selectedScenarioId}>
              Add Scenario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
