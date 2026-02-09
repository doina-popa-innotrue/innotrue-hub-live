 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Separator } from "@/components/ui/separator";
import { CheckCircle, CheckCircle2, Star, MessageSquare, BookOpen, ExternalLink, Download, TrendingUp, Lightbulb, ArrowRight, AlertTriangle } from "lucide-react";
 import { RichTextDisplay } from "@/components/ui/rich-text-display";
 import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
 
 interface Domain {
   id: string;
   name: string;
   description: string | null;
   order_index: number;
   questions: Question[];
 }
 
 interface Question {
   id: string;
   question_text: string;
   description: string | null;
   order_index: number;
 }
 
 interface ClientAssignmentFeedbackProps {
   assignmentId: string;
 }
 
 export function ClientAssignmentFeedback({ assignmentId }: ClientAssignmentFeedbackProps) {
   // Get assignment with scoring snapshot
   const { data: assignmentData, isLoading: assignmentLoading } = useQuery({
     queryKey: ["client-assignment-feedback", assignmentId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("module_assignments")
         .select("id, status, scoring_snapshot_id, instructor_notes, scored_by, scored_at")
         .eq("id", assignmentId)
         .single();
       if (error) throw error;
       return data;
     },
   });
 
   // Get scorer profile
   const { data: scorerProfile } = useQuery({
     queryKey: ["scorer-profile", assignmentData?.scored_by],
     queryFn: async () => {
       if (!assignmentData?.scored_by) return null;
       const { data, error } = await supabase
         .from("profiles")
         .select("id, name")
         .eq("id", assignmentData.scored_by)
         .single();
       if (error) return null;
       return data;
     },
     enabled: !!assignmentData?.scored_by,
   });
 
   // Get snapshot details
   const { data: snapshotData } = useQuery({
     queryKey: ["client-scoring-snapshot", assignmentData?.scoring_snapshot_id],
     queryFn: async () => {
       if (!assignmentData?.scoring_snapshot_id) return null;
       
       const { data: snapshot, error: snapshotError } = await supabase
         .from("capability_snapshots")
         .select("id, assessment_id, status")
         .eq("id", assignmentData.scoring_snapshot_id)
         .single();
       if (snapshotError) throw snapshotError;
 
       // Get assessment info
       const { data: assessment } = await supabase
         .from("capability_assessments")
          .select("id, name, rating_scale, pass_fail_enabled, pass_fail_threshold, pass_fail_mode")
         .eq("id", snapshot.assessment_id)
         .single();
 
       // Get ratings
       const { data: ratings } = await supabase
         .from("capability_snapshot_ratings")
         .select("question_id, rating")
         .eq("snapshot_id", snapshot.id);
 
       // Get question notes
       const { data: questionNotes } = await supabase
         .from("capability_question_notes")
         .select("question_id, content")
         .eq("snapshot_id", snapshot.id);
 
       // Get domain notes
       const { data: domainNotes } = await supabase
         .from("capability_domain_notes")
         .select("domain_id, content")
         .eq("snapshot_id", snapshot.id);
 
       return {
         snapshot,
         assessment,
         ratings: ratings || [],
         questionNotes: questionNotes || [],
         domainNotes: domainNotes || [],
       };
     },
     enabled: !!assignmentData?.scoring_snapshot_id,
   });
 
   // Get domains and questions for the assessment
   const { data: domains } = useQuery({
     queryKey: ["client-feedback-domains", snapshotData?.assessment?.id],
     queryFn: async () => {
       if (!snapshotData?.assessment?.id) return [];
       
       const { data: domainsData, error } = await supabase
         .from("capability_domains")
         .select("id, name, description, order_index")
         .eq("assessment_id", snapshotData.assessment.id)
         .order("order_index");
       if (error) throw error;
 
       // Fetch questions for each domain
       const domainsWithQuestions = await Promise.all(
         domainsData.map(async (domain) => {
           const { data: questions } = await supabase
             .from("capability_domain_questions")
             .select("id, question_text, description, order_index")
             .eq("domain_id", domain.id)
             .order("order_index");
           return { ...domain, questions: questions || [] } as Domain;
         })
       );
       return domainsWithQuestions;
     },
     enabled: !!snapshotData?.assessment?.id,
   });
 
   // Get development items/resources added by instructor
   const { data: instructorResources } = useQuery({
     queryKey: ["client-instructor-resources", snapshotData?.snapshot?.id],
     queryFn: async () => {
       if (!snapshotData?.snapshot?.id) return [];
       
       const { data: links, error: linksError } = await supabase
         .from("development_item_snapshot_links")
         .select("development_item_id")
         .eq("snapshot_id", snapshotData.snapshot.id);
       
       if (linksError) throw linksError;
       if (!links || links.length === 0) return [];
 
       const itemIds = links.map(l => l.development_item_id);
       const { data: items, error: itemsError } = await supabase
         .from("development_items")
         .select(`
           id, 
           item_type, 
           title, 
           content, 
           resource_url, 
           resource_type,
           library_resource_id,
           library_resources (
             id,
             title,
             url,
             resource_type,
             file_path
           )
         `)
         .in("id", itemIds)
         .in("item_type", ["resource", "note"]);
 
       if (itemsError) throw itemsError;
       return items || [];
     },
     enabled: !!snapshotData?.snapshot?.id,
   });
 
   // Don't show if not reviewed
   if (!assignmentData || assignmentData.status !== "reviewed") {
     return null;
   }
 
   // If there's no scoring snapshot, just show instructor notes if present
   if (!assignmentData.scoring_snapshot_id) {
     if (!assignmentData.instructor_notes) return null;
     
     return (
       <Card className="border-primary/30 bg-primary/5">
         <CardHeader className="pb-3">
           <div className="flex items-center gap-2">
             <CheckCircle className="h-5 w-5 text-primary" />
             <CardTitle className="text-base">Instructor Feedback</CardTitle>
           </div>
         </CardHeader>
         <CardContent>
           <RichTextDisplay content={assignmentData.instructor_notes} className="text-sm" />
         </CardContent>
       </Card>
     );
   }
 
   if (assignmentLoading || !snapshotData || !domains) {
     return <div className="text-sm text-muted-foreground">Loading feedback...</div>;
   }
 
   const ratingScale = snapshotData.assessment?.rating_scale || 5;
   
   // Create lookup maps
   const ratingsMap = new Map(snapshotData.ratings.map(r => [r.question_id, r.rating]));
   const questionNotesMap = new Map(snapshotData.questionNotes.map(n => [n.question_id, n.content]));
   const domainNotesMap = new Map(snapshotData.domainNotes.map(n => [n.domain_id, n.content]));
 
   // Calculate domain averages
   const getDomainAverage = (domain: Domain): number | null => {
     const domainRatings = domain.questions
       .map(q => ratingsMap.get(q.id))
       .filter((r): r is number => r !== undefined);
     if (domainRatings.length === 0) return null;
     return domainRatings.reduce((a, b) => a + b, 0) / domainRatings.length;
   };
 
   // Calculate overall average
   const allRatings = domains.flatMap(d => 
     d.questions.map(q => ratingsMap.get(q.id)).filter((r): r is number => r !== undefined)
   );
   const overallAverage = allRatings.length > 0 
     ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length 
     : null;
 
  // Calculate pass/fail status
  const getPassFailStatus = (): { passed: boolean; label: string } | null => {
    if (!snapshotData?.assessment?.pass_fail_enabled || 
        !snapshotData.assessment.pass_fail_threshold ||
        overallAverage === null ||
        !domains) {
      return null;
    }
    
    const threshold = snapshotData.assessment.pass_fail_threshold;
    
    if (snapshotData.assessment.pass_fail_mode === 'per_domain') {
      // Check if any domain is below threshold
      for (const domain of domains) {
        const domainAvg = getDomainAverage(domain);
        if (domainAvg !== null) {
          const domainPercentage = (domainAvg / ratingScale) * 100;
          if (domainPercentage < threshold) {
            return { passed: false, label: 'Needs Improvement' };
          }
        }
      }
      return { passed: true, label: 'Pass' };
    } else {
      // Overall mode
      const overallPercentage = (overallAverage / ratingScale) * 100;
      return overallPercentage >= threshold
        ? { passed: true, label: 'Pass' }
        : { passed: false, label: 'Needs Improvement' };
    }
  };

  const passFailStatus = getPassFailStatus();

   const handleResourceClick = async (resource: any) => {
     if (resource.library_resources?.url) {
       window.open(resource.library_resources.url, '_blank');
     } else if (resource.library_resources?.file_path) {
       const { data } = await supabase.storage
         .from("resources")
         .download(resource.library_resources.file_path);
       if (data) {
         const url = URL.createObjectURL(data);
         const a = document.createElement("a");
         a.href = url;
         a.download = resource.library_resources.title || "resource";
         a.click();
         URL.revokeObjectURL(url);
       }
     } else if (resource.resource_url) {
       window.open(resource.resource_url, '_blank');
     }
   };
 
   return (
     <Card className="border-primary/30 bg-primary/5">
       <CardHeader>
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <CheckCircle className="h-5 w-5 text-primary" />
             <CardTitle className="text-base">Instructor Feedback</CardTitle>
           </div>
            <div className="flex items-center gap-2">
              {passFailStatus && (
                <Badge 
                  variant={passFailStatus.passed ? "default" : "destructive"}
                  className={passFailStatus.passed ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {passFailStatus.passed ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  {passFailStatus.label}
                </Badge>
              )}
              {overallAverage !== null && (
                <Badge variant="default" className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {overallAverage.toFixed(1)} / {ratingScale}
                </Badge>
              )}
            </div>
         </div>
         {scorerProfile && assignmentData.scored_at && (
           <CardDescription>
             Reviewed by {scorerProfile.name} on {new Date(assignmentData.scored_at).toLocaleDateString()}
           </CardDescription>
         )}
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Instructor Notes */}
         {assignmentData.instructor_notes && (
           <div className="space-y-2">
             <div className="flex items-center gap-2">
               <MessageSquare className="h-4 w-4 text-muted-foreground" />
               <span className="font-medium text-sm">Overall Notes</span>
             </div>
             <RichTextDisplay content={assignmentData.instructor_notes} className="text-sm bg-background rounded-md p-3" />
           </div>
         )}
 
         {/* Instructor Resources */}
         {instructorResources && instructorResources.length > 0 && (
           <div className="space-y-2">
             <div className="flex items-center gap-2">
               <BookOpen className="h-4 w-4 text-muted-foreground" />
               <span className="font-medium text-sm">Resources & Recommendations</span>
             </div>
             <div className="space-y-2">
               {instructorResources.map((resource: any) => (
                 <div key={resource.id} className="flex items-start gap-2 p-2 bg-background rounded-md">
                   <div className="flex-1 min-w-0">
                     <p className="text-sm font-medium">
                       {resource.library_resources?.title || resource.title}
                     </p>
                     {resource.content && (
                       <p className="text-xs text-muted-foreground mt-1">{resource.content}</p>
                     )}
                   </div>
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8 shrink-0"
                     onClick={() => handleResourceClick(resource)}
                   >
                     {resource.library_resources?.file_path ? (
                       <Download className="h-4 w-4" />
                     ) : (
                       <ExternalLink className="h-4 w-4" />
                     )}
                   </Button>
                 </div>
               ))}
             </div>
           </div>
         )}
 
         <Separator />
 
         {/* Domain Scores */}
         <div className="space-y-4">
           {domains.map((domain) => {
             const domainAvg = getDomainAverage(domain);
             const domainNote = domainNotesMap.get(domain.id);
 
             return (
               <div key={domain.id} className="space-y-3">
                 <div className="flex items-center justify-between">
                   <h4 className="font-semibold text-sm">{domain.name}</h4>
                   {domainAvg !== null && (
                     <Badge variant="outline" className="text-xs">
                       {domainAvg.toFixed(1)} / {ratingScale}
                     </Badge>
                   )}
                 </div>
 
                 {domainNote && (
                   <div className="bg-background rounded-md p-2 text-sm">
                     <RichTextDisplay content={domainNote} />
                   </div>
                 )}
 
                 <div className="pl-3 border-l-2 border-muted space-y-2">
                   {domain.questions.map((question) => {
                     const rating = ratingsMap.get(question.id);
                     const note = questionNotesMap.get(question.id);
 
                     return (
                       <div key={question.id} className="space-y-1">
                         <div className="flex items-center justify-between">
                           <span className="text-sm text-muted-foreground">{question.question_text}</span>
                           {rating !== undefined && (
                             <div className="flex items-center gap-1">
                               {Array.from({ length: ratingScale }).map((_, i) => (
                                 <Star
                                   key={i}
                                   className={`h-3 w-3 ${
                                     i < rating ? "fill-primary text-primary" : "text-muted"
                                   }`}
                                 />
                               ))}
                             </div>
                           )}
                         </div>
                         {note && (
                           <div className="text-xs text-muted-foreground pl-2 border-l border-muted">
                             <RichTextDisplay content={note} className="text-xs" />
                           </div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </div>
             );
           })}
         </div>

          {/* Navigation to Full Assessment */}
          <Separator />
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <h4 className="font-medium text-sm">Want to dig deeper?</h4>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                    <span>Add personal reflections and action items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    <span>View your evolution over time</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <span>Access all resources attached by evaluator</span>
                  </div>
                </div>
              </div>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link to={`/capabilities/${snapshotData.snapshot.assessment_id}?snapshotId=${assignmentData.scoring_snapshot_id}`}>
                View Full Assessment
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
       </CardContent>
     </Card>
   );
 }