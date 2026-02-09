import { useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Shield, AlertCircle } from 'lucide-react';
import DOMPurify from 'dompurify';
import CryptoJS from 'crypto-js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface OrganizationTerms {
  id: string;
  organization_id: string;
  version: number;
  title: string;
  content_html: string;
  is_current: boolean;
  is_blocking_on_first_access: boolean;
  is_blocking_on_update: boolean;
  effective_from: string;
}

interface OrganizationTermsAcceptanceGateProps {
  organizationId: string;
  children: ReactNode;
  onTermsLoaded?: (hasTerms: boolean, needsAcceptance: boolean) => void;
}

export function OrganizationTermsAcceptanceGate({ 
  organizationId, 
  children, 
  onTermsLoaded 
}: OrganizationTermsAcceptanceGateProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentTerms, setCurrentTerms] = useState<OrganizationTerms | null>(null);
  const [userAcceptance, setUserAcceptance] = useState<any>(null);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    checkTermsAcceptance();
  }, [organizationId, user?.id]);

  async function checkTermsAcceptance() {
    if (!user?.id || !organizationId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch current terms for this organization
      const { data: terms, error: termsError } = await supabase
        .from('organization_terms' as any)
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_current', true)
        .maybeSingle();

      if (termsError) throw termsError;

      if (!terms) {
        // No terms for this organization, allow access
        setLoading(false);
        onTermsLoaded?.(false, false);
        return;
      }

      const termsData = terms as unknown as OrganizationTerms;
      setCurrentTerms(termsData);

      // Check if user has accepted current terms
      const { data: acceptance, error: acceptanceError } = await supabase
        .from('user_organization_terms_acceptance' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_terms_id', termsData.id)
        .maybeSingle();

      if (acceptanceError) throw acceptanceError;

      setUserAcceptance(acceptance);

      if (!acceptance) {
        // User hasn't accepted current terms
        if (termsData.is_blocking_on_first_access) {
          // Check if user has accepted ANY previous version
          const { data: anyAcceptance } = await supabase
            .from('user_organization_terms_acceptance' as any)
            .select('*, organization_terms!inner(organization_id)')
            .eq('user_id', user.id)
            .eq('organization_terms.organization_id', organizationId)
            .limit(1);

          if (anyAcceptance && anyAcceptance.length > 0) {
            // User accepted previous version - check if update is blocking
            if (termsData.is_blocking_on_update) {
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
        .from('user_organization_terms_acceptance' as any)
        .insert({
          user_id: user.id,
          organization_terms_id: currentTerms.id,
          ip_address: null,
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
              Please review and accept the organization terms to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[40vh] w-full rounded-md border p-4">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(currentTerms.content_html),
                }}
              />
            </ScrollArea>

            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Checkbox
                id="agree-org"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <label
                htmlFor="agree-org"
                className="text-sm cursor-pointer leading-tight"
              >
                I have read and agree to the organization terms and conditions
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

  // Non-blocking update banner
  if (showUpdateBanner && currentTerms) {
    return (
      <>
        <OrganizationTermsUpdateBanner
          terms={currentTerms}
          onAccept={acceptTerms}
          accepting={accepting}
        />
        {children}
      </>
    );
  }

  return <>{children}</>;
}

interface OrganizationTermsUpdateBannerProps {
  terms: OrganizationTerms;
  onAccept: () => void;
  accepting: boolean;
}

function OrganizationTermsUpdateBanner({ 
  terms, 
  onAccept, 
  accepting 
}: OrganizationTermsUpdateBannerProps) {
  const [showModal, setShowModal] = useState(false);
  const [agreed, setAgreed] = useState(false);

  if (showModal) {
    return (
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{terms.title}</DialogTitle>
            <DialogDescription>
              Version {terms.version} • Effective from{' '}
              {new Date(terms.effective_from).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 w-full rounded-md border p-4">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(terms.content_html),
              }}
            />
          </ScrollArea>

          <div className="shrink-0 space-y-4 pt-3 border-t">
            <div className="flex items-start gap-3">
              <Checkbox
                id="agree-update-org"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <label
                htmlFor="agree-update-org"
                className="text-sm cursor-pointer leading-tight"
              >
                I have read and agree to the updated organization terms
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Review Later
              </Button>
              <Button onClick={onAccept} disabled={!agreed || accepting}>
                {accepting ? 'Processing...' : 'Accept Updated Terms'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Alert className="mb-4 border-primary/50 bg-primary/5">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Updated Organization Terms Available</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>The organization has updated their terms and conditions.</span>
        <Button size="sm" variant="outline" onClick={() => setShowModal(true)}>
          Review & Accept
        </Button>
      </AlertDescription>
    </Alert>
  );
}
