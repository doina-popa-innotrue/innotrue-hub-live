import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Shield, Building2, BookOpen, Globe, Eye, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface TermsAcceptance {
  id: string;
  accepted_at: string;
  retention_expires_at: string | null;
  content_hash: string;
  type: 'platform' | 'program' | 'organization';
  terms: {
    id: string;
    title: string;
    version: number;
    content_html: string;
    effective_from: string;
  };
  context?: {
    name: string;
    id: string;
  };
}

export default function TermsHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [acceptances, setAcceptances] = useState<TermsAcceptance[]>([]);
  const [previewTerms, setPreviewTerms] = useState<TermsAcceptance | null>(null);

  useEffect(() => {
    if (user) {
      loadTermsHistory();
    }
  }, [user]);

  async function loadTermsHistory() {
    if (!user) return;

    try {
      const allAcceptances: TermsAcceptance[] = [];

      // Load platform terms acceptances (no retention_expires_at - purged with account)
      const { data: platformAcceptances } = await supabase
        .from('user_platform_terms_acceptance')
        .select(`
          id,
          accepted_at,
          content_hash,
          platform_terms:platform_terms_id (
            id,
            title,
            version,
            content_html,
            effective_from
          )
        `)
        .eq('user_id', user.id)
        .order('accepted_at', { ascending: false });

      if (platformAcceptances) {
        for (const acc of platformAcceptances) {
          if (acc.platform_terms) {
            allAcceptances.push({
              id: acc.id,
              accepted_at: acc.accepted_at,
              retention_expires_at: null, // Platform terms retained indefinitely with account
              content_hash: acc.content_hash,
              type: 'platform',
              terms: acc.platform_terms as any,
            });
          }
        }
      }

      // Load program terms acceptances
      const { data: programAcceptances } = await supabase
        .from('user_program_terms_acceptance')
        .select(`
          id,
          accepted_at,
          retention_expires_at,
          content_hash,
          program_terms:program_terms_id (
            id,
            title,
            version,
            content_html,
            effective_from,
            program:program_id (
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('accepted_at', { ascending: false });

      if (programAcceptances) {
        for (const acc of programAcceptances) {
          if (acc.program_terms) {
            const terms = acc.program_terms as any;
            allAcceptances.push({
              id: acc.id,
              accepted_at: acc.accepted_at,
              retention_expires_at: acc.retention_expires_at,
              content_hash: acc.content_hash,
              type: 'program',
              terms: {
                id: terms.id,
                title: terms.title,
                version: terms.version,
                content_html: terms.content_html,
                effective_from: terms.effective_from,
              },
              context: terms.program ? {
                id: terms.program.id,
                name: terms.program.name,
              } : undefined,
            });
          }
        }
      }

      // Load organization terms acceptances
      const { data: orgAcceptances } = await supabase
        .from('user_organization_terms_acceptance' as any)
        .select(`
          id,
          accepted_at,
          retention_expires_at,
          content_hash,
          organization_terms:organization_terms_id (
            id,
            title,
            version,
            content_html,
            effective_from,
            organization:organization_id (
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('accepted_at', { ascending: false });

      if (orgAcceptances) {
        for (const acc of orgAcceptances as any[]) {
          if (acc.organization_terms) {
            const terms = acc.organization_terms;
            allAcceptances.push({
              id: acc.id,
              accepted_at: acc.accepted_at,
              retention_expires_at: acc.retention_expires_at,
              content_hash: acc.content_hash,
              type: 'organization',
              terms: {
                id: terms.id,
                title: terms.title,
                version: terms.version,
                content_html: terms.content_html,
                effective_from: terms.effective_from,
              },
              context: terms.organization ? {
                id: terms.organization.id,
                name: terms.organization.name,
              } : undefined,
            });
          }
        }
      }

      // Sort all by acceptance date
      allAcceptances.sort((a, b) => 
        new Date(b.accepted_at).getTime() - new Date(a.accepted_at).getTime()
      );

      setAcceptances(allAcceptances);
    } catch (error) {
      console.error('Error loading terms history:', error);
    } finally {
      setLoading(false);
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'platform':
        return <Globe className="h-4 w-4" />;
      case 'program':
        return <BookOpen className="h-4 w-4" />;
      case 'organization':
        return <Building2 className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  }

  function getTypeBadgeVariant(type: string) {
    switch (type) {
      case 'platform':
        return 'default';
      case 'program':
        return 'secondary';
      case 'organization':
        return 'outline';
      default:
        return 'default';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groupedAcceptances = {
    platform: acceptances.filter(a => a.type === 'platform'),
    program: acceptances.filter(a => a.type === 'program'),
    organization: acceptances.filter(a => a.type === 'organization'),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Terms & Conditions History</h1>
        <p className="text-muted-foreground">
          View all terms and conditions you've accepted across the platform
        </p>
      </div>

      {acceptances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No terms acceptances on record</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={['platform', 'program', 'organization']} className="space-y-4">
          {/* Platform Terms */}
          {groupedAcceptances.platform.length > 0 && (
            <AccordionItem value="platform" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Platform Terms</span>
                  <Badge variant="secondary">{groupedAcceptances.platform.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {groupedAcceptances.platform.map((acc) => (
                    <TermsAcceptanceCard
                      key={acc.id}
                      acceptance={acc}
                      onPreview={() => setPreviewTerms(acc)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Program Terms */}
          {groupedAcceptances.program.length > 0 && (
            <AccordionItem value="program" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Program Terms</span>
                  <Badge variant="secondary">{groupedAcceptances.program.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {groupedAcceptances.program.map((acc) => (
                    <TermsAcceptanceCard
                      key={acc.id}
                      acceptance={acc}
                      onPreview={() => setPreviewTerms(acc)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Organization Terms */}
          {groupedAcceptances.organization.length > 0 && (
            <AccordionItem value="organization" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Organization Terms</span>
                  <Badge variant="secondary">{groupedAcceptances.organization.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {groupedAcceptances.organization.map((acc) => (
                    <TermsAcceptanceCard
                      key={acc.id}
                      acceptance={acc}
                      onPreview={() => setPreviewTerms(acc)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewTerms} onOpenChange={() => setPreviewTerms(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{previewTerms?.terms.title}</DialogTitle>
            <DialogDescription>
              Version {previewTerms?.terms.version} • 
              Accepted on {previewTerms && format(new Date(previewTerms.accepted_at), 'PPP')}
              {previewTerms?.context && ` • ${previewTerms.context.name}`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 w-full rounded-md border p-4">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(previewTerms?.terms.content_html || ''),
              }}
            />
          </ScrollArea>

          <div className="shrink-0 pt-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Content hash: {previewTerms?.content_hash?.slice(0, 16)}...</span>
              {previewTerms?.retention_expires_at && (
                <span>
                  Retained until: {format(new Date(previewTerms.retention_expires_at), 'PPP')}
                </span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TermsAcceptanceCardProps {
  acceptance: TermsAcceptance;
  onPreview: () => void;
}

function TermsAcceptanceCard({ acceptance, onPreview }: TermsAcceptanceCardProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-md bg-primary/10 text-primary">
          {acceptance.type === 'platform' && <Globe className="h-4 w-4" />}
          {acceptance.type === 'program' && <BookOpen className="h-4 w-4" />}
          {acceptance.type === 'organization' && <Building2 className="h-4 w-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{acceptance.terms.title}</p>
            <Badge variant="outline" className="text-xs">v{acceptance.terms.version}</Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {acceptance.context && (
              <span>{acceptance.context.name}</span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(acceptance.accepted_at), 'PP')}
            </span>
            {acceptance.retention_expires_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Expires {format(new Date(acceptance.retention_expires_at), 'yyyy')}
              </span>
            )}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onPreview}>
        <Eye className="h-4 w-4 mr-2" />
        View
      </Button>
    </div>
  );
}
