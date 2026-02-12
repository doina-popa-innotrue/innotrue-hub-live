import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateFeedbackPdf, FeedbackData } from "@/lib/feedbackPdfExport";

interface FeedbackPdfExportProps {
  feedbackId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export default function FeedbackPdfExport({
  feedbackId,
  variant = "outline",
  size = "sm",
}: FeedbackPdfExportProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Fetch the feedback
      const { data: feedback, error: feedbackError } = await supabase
        .from("coach_module_feedback")
        .select("*")
        .eq("id", feedbackId)
        .single();

      if (feedbackError || !feedback) throw new Error("Failed to fetch feedback");

      // Fetch module progress
      const { data: progress } = await supabase
        .from("module_progress")
        .select("module_id, enrollment_id")
        .eq("id", feedback.module_progress_id)
        .single();

      if (!progress) throw new Error("Failed to fetch module progress");

      // Fetch module title
      const { data: moduleData } = await supabase
        .from("program_modules")
        .select("title")
        .eq("id", progress.module_id)
        .single();

      // Fetch enrollment with program
      const { data: enrollment } = await supabase
        .from("client_enrollments")
        .select("client_user_id, program_id")
        .eq("id", progress.enrollment_id)
        .single();

      // Fetch program name
      let programName = "Unknown Program";
      if (enrollment?.program_id) {
        const { data: program } = await supabase
          .from("programs")
          .select("name")
          .eq("id", enrollment.program_id)
          .single();
        programName = program?.name || programName;
      }

      // Fetch coach profile
      const { data: coachProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", feedback.coach_id)
        .single();

      // Fetch template if used
      let templateFields: FeedbackData["templateFields"] = [];
      if (feedback.template_type_id) {
        const { data: template } = await supabase
          .from("feedback_template_types")
          .select("structure")
          .eq("id", feedback.template_type_id)
          .single();
        if (template?.structure) {
          templateFields = template.structure as unknown as Array<{
            id: string;
            label: string;
            type: string;
          }>;
        }
      }

      // Fetch attachments
      const { data: attachments } = await supabase
        .from("coach_feedback_attachments")
        .select("title, description, attachment_type")
        .eq("feedback_id", feedbackId);

      // Determine client info
      let clientName = "Unknown Client";
      let clientEmail: string | undefined;

      if (enrollment?.client_user_id) {
        const { data: clientProfile } = await supabase
          .from("profiles")
          .select("name, username")
          .eq("id", enrollment.client_user_id)
          .single();
        clientName = clientProfile?.name || clientName;
        clientEmail = clientProfile?.username || undefined;
      }

      const pdfData: FeedbackData = {
        id: feedbackId,
        clientName,
        clientEmail,
        moduleName: moduleData?.title || "Unknown Module",
        programName,
        coachName: coachProfile?.name || "Unknown Coach",
        feedback: feedback.feedback,
        structuredResponses: (feedback.structured_responses as Record<string, unknown>) || {},
        templateFields,
        createdAt: feedback.created_at ?? "",
        updatedAt: feedback.updated_at ?? "",
        attachments: attachments?.map((a) => ({
          title: a.title,
          description: a.description || undefined,
          type: a.attachment_type,
        })),
      };

      generateFeedbackPdf(pdfData);
      toast.success("PDF downloaded");
    } catch (error) {
      console.error("Error exporting feedback PDF:", error);
      toast.error("Failed to export feedback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      <span className="ml-2 hidden sm:inline">Export PDF</span>
    </Button>
  );
}
