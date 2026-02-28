import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Link as LinkIcon,
  Paperclip,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { ModuleAssignmentsView } from "./ModuleAssignmentsView";
import { ModuleSelfAssessment } from "./ModuleSelfAssessment";
import ModuleReflections from "./ModuleReflections";
import ModuleFeedback from "./ModuleFeedback";
import { AssignedScenarioItem } from "./AssignedScenarioItem";

// ── Types ──────────────────────────────────────────────────────────────

export interface ClientContent {
  id: string;
  content: string;
  attachments?: {
    id: string;
    title: string;
    attachment_type: string;
    file_path?: string;
    url?: string;
    description?: string;
  }[];
  resources?: {
    id: string;
    resource: {
      id: string;
      title: string;
      description: string | null;
      resource_type: string;
      url: string | null;
      file_path: string | null;
    };
  }[];
  scenarios?: {
    id: string;
    scenario_template_id: string;
    scenario_templates: {
      id: string;
      title: string;
      description: string | null;
      is_protected: boolean;
      capability_assessments?: {
        id: string;
        name: string;
      } | null;
    } | null;
  }[];
}

interface AssignmentSectionProps {
  clientContent: ClientContent | null;
  moduleId: string;
  moduleProgressId: string;
  enrollmentId: string;
}

// ── Component ──────────────────────────────────────────────────────────

export function AssignmentSection({
  clientContent,
  moduleId,
  moduleProgressId,
  enrollmentId,
}: AssignmentSectionProps) {
  // When there's personalised content, render the unified flow.
  // Otherwise render sub-components independently (unchanged layout).
  if (clientContent) {
    return (
      <div className="space-y-4">
        {/* Section heading */}
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Your Assignment</h2>
        </div>

        {/* Assignment Brief — personalised content from instructor */}
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Assignment Brief
            </CardTitle>
            <CardDescription>
              This content has been specifically assigned to you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="whitespace-pre-wrap">{clientContent.content}</div>

            {clientContent.attachments && clientContent.attachments.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Attached Files & Links</p>
                <div className="flex flex-wrap gap-2">
                  {clientContent.attachments.map((att) => (
                    <Button
                      key={att.id}
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (att.url) {
                          window.open(att.url, "_blank");
                        } else if (att.file_path) {
                          const { data } = await supabase.storage
                            .from("module-client-content")
                            .createSignedUrl(att.file_path, 3600);
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, "_blank");
                          }
                        }
                      }}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      {att.title}
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {clientContent.resources && clientContent.resources.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Assigned Resources</p>
                <div className="flex flex-wrap gap-2">
                  {clientContent.resources
                    .filter((res) => res.resource)
                    .map((res) => (
                      <Button
                        key={res.id}
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          if (res.resource.url) {
                            window.open(res.resource.url, "_blank");
                          } else if (res.resource.file_path) {
                            const { data } = await supabase.storage
                              .from("resource-library")
                              .createSignedUrl(res.resource.file_path, 3600);
                            if (data?.signedUrl) {
                              window.open(data.signedUrl, "_blank");
                            }
                          }
                        }}
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        {res.resource.title}
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    ))}
                </div>
              </div>
            )}

            {clientContent.scenarios && clientContent.scenarios.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Assigned Scenarios</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Complete these scenarios as part of your assignment. Click to start.
                </p>
                <div className="space-y-2">
                  {clientContent.scenarios.map((scen) => (
                    <AssignedScenarioItem
                      key={scen.id}
                      scenarioTemplateId={scen.scenario_template_id}
                      title={scen.scenario_templates?.title || "Untitled Scenario"}
                      assessmentName={scen.scenario_templates?.capability_assessments?.name}
                      moduleId={moduleId}
                      enrollmentId={enrollmentId}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Self-Assessment (renders own Card, returns null if not configured) */}
        <ModuleSelfAssessment moduleId={moduleId} enrollmentId={enrollmentId} />

        {/* Submission form(s) — header hidden since we're inside "Your Assignment" */}
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            Your Submission
          </h3>
          <ModuleAssignmentsView
            moduleId={moduleId}
            moduleProgressId={moduleProgressId}
            isEditable={true}
            hideHeader
          />
        </div>

        {/* Reflections (renders own Card) */}
        <ModuleReflections moduleProgressId={moduleProgressId} />

        {/* Module-level coach/instructor feedback (renders own Card, null if none) */}
        <ModuleFeedback moduleProgressId={moduleProgressId} />
      </div>
    );
  }

  // Non-individualised module — render sub-components independently (same as before)
  return (
    <>
      <ModuleSelfAssessment moduleId={moduleId} enrollmentId={enrollmentId} />
      <ModuleAssignmentsView
        moduleId={moduleId}
        moduleProgressId={moduleProgressId}
        isEditable={true}
      />
      <ModuleReflections moduleProgressId={moduleProgressId} />
      <ModuleFeedback moduleProgressId={moduleProgressId} />
    </>
  );
}
