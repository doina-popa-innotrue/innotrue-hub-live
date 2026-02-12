import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RichTextDisplay } from "@/components/ui/rich-text-display";

interface ModuleSection {
  id: string;
  module_id: string;
  order_index: number;
  section_type: "content" | "separator";
  title: string | null;
  content: string | null;
}

type SectionType = "content" | "separator";

interface ModuleSectionsDisplayProps {
  moduleId: string;
}

export function ModuleSectionsDisplay({ moduleId }: ModuleSectionsDisplayProps) {
  const [sections, setSections] = useState<ModuleSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSections() {
      const { data, error } = await supabase
        .from("module_sections")
        .select("*")
        .eq("module_id", moduleId)
        .order("order_index");

      if (!error && data) {
        setSections(
          data.map((s) => ({
            ...s,
            section_type: s.section_type as SectionType,
          })),
        );
      }
      setLoading(false);
    }

    fetchSections();
  }, [moduleId]);

  if (loading) {
    return <div className="text-muted-foreground">Loading content...</div>;
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        if (section.section_type === "separator") {
          return <Separator key={section.id} className="my-6" />;
        }

        // Content section
        return (
          <Card key={section.id}>
            {section.title && (
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
            )}
            <CardContent className={section.title ? "" : "pt-6"}>
              <RichTextDisplay content={section.content || ""} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
