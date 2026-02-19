import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Target, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ModuleDomainMapperProps {
  moduleId: string;
  moduleName: string;
}

interface DomainMapping {
  id: string;
  capability_domain_id: string;
  domain_name: string;
  relevance: string;
}

interface CapabilityDomain {
  id: string;
  name: string;
}

export function ModuleDomainMapper({ moduleId, moduleName }: ModuleDomainMapperProps) {
  const queryClient = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedRelevance, setSelectedRelevance] = useState("primary");

  // Fetch existing mappings
  const { data: mappings, isLoading: loadingMappings } = useQuery({
    queryKey: ["module-domain-mappings", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_domain_mappings" as string)
        .select("id, capability_domain_id, relevance, capability_domains:capability_domain_id(name)")
        .eq("module_id", moduleId);

      if (error) throw error;
      return (data as any[])?.map((d) => ({
        id: d.id,
        capability_domain_id: d.capability_domain_id,
        domain_name: d.capability_domains?.name || "Unknown",
        relevance: d.relevance,
      })) as DomainMapping[];
    },
  });

  // Fetch available domains
  const { data: domains } = useQuery({
    queryKey: ["capability-domains-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_domains")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data as CapabilityDomain[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDomain) throw new Error("Select a domain");

      const { error } = await supabase
        .from("module_domain_mappings" as string)
        .insert({
          module_id: moduleId,
          capability_domain_id: selectedDomain,
          relevance: selectedRelevance,
        });

      if (error) {
        if (error.code === "23505") throw new Error("This domain is already mapped");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-domain-mappings", moduleId] });
      setSelectedDomain("");
      toast.success("Domain mapping added");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add mapping");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from("module_domain_mappings" as string)
        .delete()
        .eq("id", mappingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-domain-mappings", moduleId] });
      toast.success("Domain mapping removed");
    },
    onError: () => {
      toast.error("Failed to remove mapping");
    },
  });

  // Filter out already-mapped domains
  const availableDomains = (domains || []).filter(
    (d) => !(mappings || []).some((m) => m.capability_domain_id === d.id),
  );

  if (loadingMappings) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading domain mappings...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4" />
          Assessment Domain Mapping
        </CardTitle>
        <CardDescription className="text-xs">
          Link this module to capability assessment domains. Completing the module provides evidence for mapped domains.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Existing mappings */}
        {(mappings || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(mappings || []).map((mapping) => (
              <Badge
                key={mapping.id}
                variant={mapping.relevance === "primary" ? "default" : "secondary"}
                className="gap-1 pr-1"
              >
                {mapping.domain_name}
                <span className="text-[10px] opacity-70">({mapping.relevance})</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-destructive/20"
                  onClick={() => removeMutation.mutate(mapping.id)}
                  disabled={removeMutation.isPending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add mapping */}
        {availableDomains.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Select domain..." />
              </SelectTrigger>
              <SelectContent>
                {availableDomains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRelevance} onValueChange={setSelectedRelevance}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8"
              onClick={() => addMutation.mutate()}
              disabled={!selectedDomain || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}

        {availableDomains.length === 0 && (mappings || []).length > 0 && (
          <p className="text-xs text-muted-foreground">All available domains are already mapped.</p>
        )}

        {(domains || []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            No capability domains exist yet. Create them in the Assessment Builder first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
