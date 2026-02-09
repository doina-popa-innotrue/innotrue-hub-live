import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Edit2, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import FeedbackPdfExport from './FeedbackPdfExport';
import { format } from 'date-fns';
import FeedbackAttachments from './FeedbackAttachments';
import FeedbackAttachmentForm from './FeedbackAttachmentForm';
import StructuredFeedbackForm from './StructuredFeedbackForm';

interface FeedbackTemplate {
  id: string;
  name: string;
  description: string | null;
  structure: StructureField[];
}

interface StructureField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'rating' | 'select' | 'checkbox';
  label: string;
  description?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

interface Feedback {
  id: string;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  coach_id: string;
  template_type_id: string | null;
  structured_responses: Record<string, unknown>;
  status: 'draft' | 'published';
  profiles?: {
    name: string;
  };
}

interface ModuleFeedbackProps {
  moduleProgressId: string;
  isCoachOrInstructor?: boolean;
}

export default function ModuleFeedback({ moduleProgressId, isCoachOrInstructor = false }: ModuleFeedbackProps) {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [structuredResponses, setStructuredResponses] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [myFeedback, setMyFeedback] = useState<Feedback | null>(null);
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<'draft' | 'published'>('draft');
  const [refreshAttachments, setRefreshAttachments] = useState(0);

  useEffect(() => {
    fetchFeedback();
    if (isCoachOrInstructor) {
      fetchTemplates();
    }
  }, [moduleProgressId, isCoachOrInstructor]);

  async function fetchTemplates() {
    try {
      const { data, error } = await supabase
        .from('feedback_template_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates((data || []).map(t => ({
        ...t,
        structure: (t.structure as unknown as StructureField[]) || [],
      })));
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }

  async function fetchFeedback() {
    try {
      const { data, error } = await supabase
        .from('coach_module_feedback')
        .select('*')
        .eq('module_progress_id', moduleProgressId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch coach names separately
      const feedbackWithNames: Feedback[] = await Promise.all(
        (data || []).map(async (f) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', f.coach_id)
            .single();
          return {
            ...f,
            structured_responses: (f.structured_responses as Record<string, unknown>) || {},
            status: (f.status as 'draft' | 'published') || 'draft',
            profiles: profile || undefined,
          };
        })
      );
      
      setFeedbackList(feedbackWithNames);
      
      // Find current user's feedback if they're a coach/instructor
      if (isCoachOrInstructor && user) {
        const mine = feedbackWithNames.find(f => f.coach_id === user.id);
        if (mine) {
          setMyFeedback(mine);
          setContent(mine.feedback || '');
          setSelectedTemplateId(mine.template_type_id);
          setStructuredResponses(mine.structured_responses || {});
          setFeedbackStatus(mine.status || 'draft');
        }
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(publishNow = false) {
    if (!user) return;

    // Validate - need either free text or structured responses
    const hasContent = content.trim() || Object.keys(structuredResponses).length > 0;
    if (!hasContent) {
      toast.error('Please provide feedback content');
      return;
    }

    const newStatus = publishNow ? 'published' : feedbackStatus;

    setSubmitting(true);
    try {
      if (myFeedback) {
        const { error } = await supabase
          .from('coach_module_feedback')
          .update({ 
            feedback: content.trim() || null,
            template_type_id: selectedTemplateId,
            structured_responses: structuredResponses as unknown as Record<string, never>,
            status: newStatus,
          })
          .eq('id', myFeedback.id);

        if (error) throw error;
        toast.success(publishNow ? 'Feedback published to client' : 'Feedback saved as draft');
      } else {
        const { error } = await supabase
          .from('coach_module_feedback')
          .insert([{
            coach_id: user.id,
            module_progress_id: moduleProgressId,
            feedback: content.trim() || null,
            template_type_id: selectedTemplateId,
            structured_responses: structuredResponses as unknown as Record<string, never>,
            status: newStatus,
          }]);

        if (error) throw error;
        toast.success(publishNow ? 'Feedback published to client' : 'Feedback saved as draft');
      }

      setFeedbackStatus(newStatus);
      setIsEditing(false);
      fetchFeedback();
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast.error('Failed to save feedback');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePublish() {
    if (!myFeedback) return;

    const newStatus = myFeedback.status === 'published' ? 'draft' : 'published';

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('coach_module_feedback')
        .update({ status: newStatus })
        .eq('id', myFeedback.id);

      if (error) throw error;
      toast.success(newStatus === 'published' ? 'Feedback published to client' : 'Feedback unpublished');
      fetchFeedback();
    } catch (error) {
      console.error('Error toggling publish status:', error);
      toast.error('Failed to update status');
    } finally {
      setSubmitting(false);
    }
  }

  function handleTemplateChange(templateId: string | null) {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setStructuredResponses({});
    }
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // Coach/Instructor view - can add/edit their own feedback
  if (isCoachOrInstructor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Your Feedback
          </CardTitle>
          <CardDescription>
            Provide feedback on this client's module progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              {/* Template selector */}
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Feedback Template (optional)</Label>
                  <Select 
                    value={selectedTemplateId || 'none'} 
                    onValueChange={(v) => handleTemplateChange(v === 'none' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template (free text only)</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate?.description && (
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                </div>
              )}

              {/* Structured feedback fields */}
              {selectedTemplate && (
                <>
                  <Separator />
                  <StructuredFeedbackForm
                    structure={selectedTemplate.structure as Parameters<typeof StructuredFeedbackForm>[0]['structure']}
                    responses={structuredResponses}
                    onChange={setStructuredResponses}
                  />
                  <Separator />
                </>
              )}

              {/* Free text feedback */}
              <div className="space-y-2">
                <Label>{selectedTemplate ? 'Additional Comments' : 'Feedback'}</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your feedback, suggestions, or encouragement..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => handleSubmit(false)} variant="outline" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save as Draft
                </Button>
                <Button onClick={() => handleSubmit(true)} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {myFeedback?.status === 'published' ? 'Update & Publish' : 'Save & Publish'}
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="ghost" disabled={submitting}>
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Draft feedback is only visible to you. Published feedback is visible to the client.
              </p>
            </div>
          ) : myFeedback ? (
            <div className="space-y-4">
              {/* Display structured responses */}
              {myFeedback.template_type_id && selectedTemplate && (
                <div className="space-y-3">
                  <StructuredFeedbackForm
                    structure={selectedTemplate.structure as Parameters<typeof StructuredFeedbackForm>[0]['structure']}
                    responses={myFeedback.structured_responses}
                    onChange={() => {}}
                    disabled
                  />
                  {myFeedback.feedback && <Separator />}
                </div>
              )}
              
              {/* Display free text */}
              {myFeedback.feedback && (
                <p className="whitespace-pre-wrap">{myFeedback.feedback}</p>
              )}
              
              <div className="flex items-center gap-2">
                <Badge variant={myFeedback.status === 'published' ? 'default' : 'secondary'}>
                  {myFeedback.status === 'published' ? 'Published' : 'Draft'}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Last updated: {format(new Date(myFeedback.updated_at), 'PPp')}
                </p>
              </div>

              {/* Attachments */}
              <FeedbackAttachments
                feedbackId={myFeedback.id} 
                canEdit 
                key={refreshAttachments}
              />

              {/* Add attachment form */}
              {showAttachmentForm ? (
                <FeedbackAttachmentForm
                  feedbackId={myFeedback.id}
                  onSuccess={() => {
                    setShowAttachmentForm(false);
                    setRefreshAttachments(r => r + 1);
                  }}
                  onCancel={() => setShowAttachmentForm(false)}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Feedback
                  </Button>
                  <Button 
                    onClick={handleTogglePublish} 
                    variant={myFeedback.status === 'published' ? 'secondary' : 'default'}
                    size="sm"
                    disabled={submitting}
                  >
                    {myFeedback.status === 'published' ? 'Unpublish' : 'Publish to Client'}
                  </Button>
                  <Button onClick={() => setShowAttachmentForm(true)} variant="outline" size="sm">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Add Attachment
                  </Button>
                  {/* PDF Export hidden for strategic reasons - FeedbackPdfExport feedbackId={myFeedback.id} */}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">You haven't provided feedback yet.</p>
              <Button onClick={() => setIsEditing(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Feedback
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Client view - read-only feedback from coaches/instructors
  // Only show published feedback to clients
  const publishedFeedback = feedbackList.filter(f => f.status === 'published');
  
  if (publishedFeedback.length === 0) {
    return null; // Don't show anything if no published feedback
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Coach/Instructor Feedback
        </CardTitle>
        <CardDescription>
          Feedback from your coaches and instructors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {publishedFeedback.map((feedback) => {
          const template = templates.find(t => t.id === feedback.template_type_id);
          
          return (
            <div key={feedback.id} className="border-l-2 border-primary pl-4 py-2">
              {/* Structured responses */}
              {template && Object.keys(feedback.structured_responses).length > 0 && (
                <div className="mb-3">
                  <StructuredFeedbackForm
                    structure={template.structure as Parameters<typeof StructuredFeedbackForm>[0]['structure']}
                    responses={feedback.structured_responses}
                    onChange={() => {}}
                    disabled
                  />
                </div>
              )}
              
              {/* Free text */}
              {feedback.feedback && (
                <p className="whitespace-pre-wrap">{feedback.feedback}</p>
              )}
              
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  From {feedback.profiles?.name || 'Coach'} • {format(new Date(feedback.updated_at), 'PPp')}
                </p>
                {/* PDF Export hidden for strategic reasons - FeedbackPdfExport feedbackId={feedback.id} variant="ghost" size="sm" */}
              </div>

              {/* Attachments */}
              <FeedbackAttachments feedbackId={feedback.id} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
