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
import DOMPurify from 'dompurify';

interface PlatformTerms {
  id: string;
  version: number;
  title: string;
  content_html: string;
  is_current: boolean;
  is_blocking_on_update: boolean;
  effective_from: string;
}

interface PlatformTermsAcceptanceGateProps {
  children: React.ReactNode;
}

export function PlatformTermsAcceptanceGate({ children }: PlatformTermsAcceptanceGateProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentTerms, setCurrentTerms] = useState<PlatformTerms | null>(null);
  const [userAcceptance, setUserAcceptance] = useState<any>(null);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    checkTermsAcceptance();
  }, [user?.id]);

  async function checkTermsAcceptance() {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch current platform terms
      const { data: terms, error: termsError } = await supabase
        .from('platform_terms')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();

      if (termsError) throw termsError;

      if (!terms) {
        // No platform terms defined, allow access
        setLoading(false);
        return;
      }

      setCurrentTerms(terms);

      // Check if user has accepted current terms
      const { data: acceptance, error: acceptanceError } = await supabase
        .from('user_platform_terms_acceptance')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform_terms_id', terms.id)
        .maybeSingle();

      if (acceptanceError) throw acceptanceError;

      setUserAcceptance(acceptance);

      if (!acceptance) {
        // User hasn't accepted current terms
        // Check if user has accepted ANY previous version
        const { data: anyAcceptance } = await supabase
          .from('user_platform_terms_acceptance')
          .select('*')
          .eq('user_id', user.id)
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
    } catch (error: any) {
      console.error('Error checking platform terms acceptance:', error);
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
        .from('user_platform_terms_acceptance')
        .insert({
          user_id: user.id,
          platform_terms_id: currentTerms.id,
          ip_address: null,
          user_agent: navigator.userAgent,
          content_hash: contentHash
        });

      if (error) throw error;

      toast.success('Platform terms accepted');
      setShowBlockingModal(false);
      setShowUpdateBanner(false);
      setUserAcceptance({ accepted: true });
    } catch (error: any) {
      console.error('Error accepting platform terms:', error);
      toast.error('Failed to accept terms');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Blocking modal for first access or blocking updates
  if (showBlockingModal && currentTerms) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 pb-24 bg-background relative z-[60]">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{currentTerms.title}</CardTitle>
            <CardDescription>
              Please review and accept the following terms to continue using InnoTrue Hub
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <div 
                className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-4 [&>h1]:mt-6 [&>h1]:mb-3 [&>h2]:mt-5 [&>h2]:mb-2 [&>h3]:mt-4 [&>h3]:mb-2 [&>ul]:mb-4 [&>ol]:mb-4"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTerms.content_html) }} 
              />
            </ScrollArea>
            
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <Checkbox
                id="agree-platform-terms"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
              />
              <label htmlFor="agree-platform-terms" className="text-sm cursor-pointer">
                I have read and agree to the Terms & Conditions above
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
        <PlatformTermsUpdateBanner 
          terms={currentTerms} 
          onAccept={acceptTerms}
          accepting={accepting}
        />
      )}
      {children}
    </>
  );
}

interface PlatformTermsUpdateBannerProps {
  terms: PlatformTerms;
  onAccept: () => void;
  accepting: boolean;
}

function PlatformTermsUpdateBanner({ terms, onAccept, accepting }: PlatformTermsUpdateBannerProps) {
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
              Updated platform terms and conditions (Version {terms.version})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              <div 
                className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-4 [&>h1]:mt-6 [&>h1]:mb-3 [&>h2]:mt-5 [&>h2]:mb-2 [&>h3]:mt-4 [&>h3]:mb-2 [&>ul]:mb-4 [&>ol]:mb-4"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(terms.content_html) }} 
              />
            </ScrollArea>
            
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <Checkbox
                id="agree-updated-platform-terms"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
              />
              <label htmlFor="agree-updated-platform-terms" className="text-sm cursor-pointer">
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
    <div className="fixed top-0 left-0 right-0 z-40 p-4 bg-primary/10 border-b border-primary/20 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <div>
          <p className="font-medium text-sm">Updated Platform Terms Available</p>
          <p className="text-xs text-muted-foreground">
            The platform terms and conditions have been updated. Please review and accept.
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
