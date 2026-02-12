import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { decisionTemplates, DecisionTemplate } from "@/lib/decisionTemplates";
import {
  Briefcase,
  MapPin,
  DollarSign,
  GraduationCap,
  Heart,
  Rocket,
  FileText,
} from "lucide-react";

interface DecisionTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: DecisionTemplate) => void;
}

const iconMap: Record<string, any> = {
  briefcase: Briefcase,
  "map-pin": MapPin,
  "dollar-sign": DollarSign,
  "graduation-cap": GraduationCap,
  heart: Heart,
  rocket: Rocket,
};

export function DecisionTemplateDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: DecisionTemplateDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(decisionTemplates.map((t) => t.category)));
  const filteredTemplates = selectedCategory
    ? decisionTemplates.filter((t) => t.category === selectedCategory)
    : decisionTemplates;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose a Decision Template</DialogTitle>
          <DialogDescription>
            Start with a pre-structured template designed for common decision types
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Templates
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Template cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredTemplates.map((template) => {
              const Icon = iconMap[template.icon] || FileText;
              return (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    onSelectTemplate(template);
                    onOpenChange(false);
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold">Importance:</span>{" "}
                        <Badge variant="outline">{template.defaultImportance}</Badge>
                      </div>
                      <div>
                        <span className="font-semibold">Default Options:</span>{" "}
                        <span className="text-muted-foreground">
                          {template.defaultOptions.join(", ")}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">Key Values:</span>{" "}
                        <span className="text-muted-foreground">
                          {template.defaultValues.slice(0, 3).join(", ")}
                          {template.defaultValues.length > 3 && "..."}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No templates found in this category
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
