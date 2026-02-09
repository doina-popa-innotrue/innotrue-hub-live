import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield } from 'lucide-react';
import CryptoJS from 'crypto-js';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

interface ProgramTerms {
  id: string;
  program_id: string;
  version: number;
  title: string;
  content_html: string;
  is_current: boolean;
  is_blocking_on_first_access: boolean;
  is_blocking_on_update: boolean;
  effective_from: string;
}

interface TermsAcceptanceGateProps {
  programId: string;
  children: React.ReactNode;
  onTermsLoaded?: (hasTerms: boolean, needsAcceptance: boolean) => void;
}

export function TermsAcceptanceGate({ programId, children, onTermsLoaded }: TermsAcceptanceGateProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentTerms, setCurrentTerms] = useState<ProgramTerms | null>(null);
  const [userAcceptance, setUserAcceptance] = useState<any>(null);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    checkTermsAcceptance();
  }, [programId, user?.id]);

  async function checkTermsAcceptance() {
    if (!user?.id || !programId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch current terms for this program
      const { data: terms, error: termsError } = await supabase
        .from('program_terms')
        .select('*')
        .eq('program_id', programId)
        .eq('is_current', true)
        .maybeSingle();

      if (termsError) throw termsError;

      if (!terms) {
        // No terms for this program, allow access
        setLoading(false);
        onTermsLoaded?.(false, false);
        return;
      }

      setCurrentTerms(terms);

      // Check if user has accepted current terms
      const { data: acceptance, error: acceptanceError } = await supabase
        .from('user_program_terms_acceptance')
        .select('*')
        .eq('user_id', user.id)
        .eq('program_terms_id', terms.id)
        .maybeSingle();

      if (acceptanceError) throw acceptanceError;

      setUserAcceptance(acceptance);

      if (!acceptance) {
        // User hasn't accepted current terms
        if (terms.is_blocking_on_first_access) {
          // Check if user has accepted ANY previous version
          const { data: anyAcceptance } = await supabase
            .from('user_program_terms_acceptance')
            .select('*, program_terms!inner(program_id)')
            .eq('user_id', user.id)
            .eq('program_terms.program_id', programId)
            .limit(1);

          if (anyAcceptance && anyAcceptance.length > 0) {
            // User accepted previous version - check if update is blocking
            if (terms.is_blocking_on_update) {
              setShowBlockingModal(true);
            } else {
              setShowUpdateBanner(true);
            }
          } else {
            // First time - always block
            setShowBlockingModal(true);
          }
        }
        onTermsLoaded?.(true, true);
      } else {
        onTermsLoaded?.(true, false);
      }
    } catch (error: any) {
      console.error('Error checking terms acceptance:', error);
      toast.error('Failed to check terms acceptance');
    } finally {
      setLoading(false);
    }
  }

  async function acceptTerms() {
    if (!user?.id || !currentTerms) return;

    setAccepting(true);
    try {
      const contentHash = CryptoJS.SHA256(currentTerms.content_html).toString();

      const { error } = await supabase
        .from('user_program_terms_acceptance')
        .insert({
          user_id: user.id,
          program_terms_id: currentTerms.id,
          ip_address: null, // Could be fetched from a service if needed
          user_agent: navigator.userAgent,
          content_hash: contentHash
        });

      if (error) throw error;

      toast.success('Terms accepted successfully');
      setShowBlockingModal(false);
      setShowUpdateBanner(false);
      setUserAcceptance({ accepted: true });
    } catch (error: any) {
      console.error('Error accepting terms:', error);
      toast.error('Failed to accept terms');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  // Blocking modal for first access or blocking updates
  if (showBlockingModal && currentTerms) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{currentTerms.title}</CardTitle>
            <CardDescription>
              Please review and accept the following terms to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              <RichTextDisplay content={currentTerms.content_html} />
            </ScrollArea>
            
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <Checkbox
                id="agree-terms"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
              />
              <label htmlFor="agree-terms" className="text-sm cursor-pointer">
                I have read and agree to the terms and conditions above
              </label>
            </div>

            <Button 
              onClick={acceptTerms} 
              disabled={!agreed || accepting}
              className="w-full"
            >
              {accepting ? 'Processing...' : 'Agree & Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Non-blocking update banner */}
      {showUpdateBanner && currentTerms && (
        <TermsUpdateBanner 
          terms={currentTerms} 
          onAccept={acceptTerms}
          accepting={accepting}
        />
      )}
      {children}
    </>
  );
}

interface TermsUpdateBannerProps {
  terms: ProgramTerms;
  onAccept: () => void;
  accepting: boolean;
}

function TermsUpdateBanner({ terms, onAccept, accepting }: TermsUpdateBannerProps) {
  const [showModal, setShowModal] = useState(false);
  const [agreed, setAgreed] = useState(false);

  if (showModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-2xl mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{terms.title}</CardTitle>
            <CardDescription>
              Updated terms and conditions (Version {terms.version})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              <RichTextDisplay content={terms.content_html} />
            </ScrollArea>
            
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <Checkbox
                id="agree-updated-terms"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
              />
              <label htmlFor="agree-updated-terms" className="text-sm cursor-pointer">
                I have read and agree to the updated terms and conditions
              </label>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setShowModal(false)}
                className="flex-1"
              >
                Review Later
              </Button>
              <Button 
                onClick={onAccept} 
                disabled={!agreed || accepting}
                className="flex-1"
              >
                {accepting ? 'Processing...' : 'Accept Updated Terms'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 border border-primary/20 bg-primary/5 rounded-lg flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <div>
          <p className="font-medium text-sm">Updated Terms Available</p>
          <p className="text-xs text-muted-foreground">
            The terms and conditions for this program have been updated. Please review and accept the new terms.
          </p>
        </div>
      </div>
      <Button 
        size="sm" 
        onClick={() => setShowModal(true)}
      >
        Review & Accept
      </Button>
    </div>
  );
}
