import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Building2, CheckCircle2, XCircle, Loader2, Shield, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted' | 'error'>('loading');
  const [invite, setInvite] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [accepting, setAccepting] = useState(false);
  
  // Consent dialog state for existing users
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      validateInvite();
    } else {
      setStatus('invalid');
      setErrorMessage('No invitation token provided');
    }
  }, [token]);

  // Check if current user is an existing platform user (has profile data)
  useEffect(() => {
    async function checkExistingUser() {
      if (!user) {
        setIsExistingUser(false);
        return;
      }

      try {
        // Check if user has any enrollments, goals, or other platform activity
        const { data: enrollments } = await supabase
          .from('client_enrollments')
          .select('id')
          .eq('client_user_id', user.id)
          .limit(1);

        const { data: goals } = await supabase
          .from('goals')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        const hasActivity = (enrollments && enrollments.length > 0) || (goals && goals.length > 0);
        setIsExistingUser(hasActivity);
      } catch (error) {
        console.error('Error checking existing user:', error);
        setIsExistingUser(false);
      }
    }

    checkExistingUser();
  }, [user]);

  const validateInvite = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_invites')
        .select(`
          id,
          email,
          role,
          expires_at,
          accepted_at,
          organizations (id, name)
        `)
        .eq('token', token)
        .single();

      if (error || !data) {
        setStatus('invalid');
        setErrorMessage('This invitation link is invalid or has expired');
        return;
      }

      if (data.accepted_at) {
        setStatus('invalid');
        setErrorMessage('This invitation has already been accepted');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setStatus('invalid');
        setErrorMessage('This invitation has expired');
        return;
      }

      setInvite(data);
      setStatus('valid');
    } catch (error) {
      console.error('Error validating invite:', error);
      setStatus('error');
      setErrorMessage('An error occurred while validating the invitation');
    }
  };

  const handleAcceptClick = () => {
    if (!user) {
      // Redirect to auth with return URL
      navigate(`/auth?redirect=/accept-invite?token=${token}`);
      return;
    }

    // If user is an existing platform user, show consent dialog first
    if (isExistingUser) {
      setShowConsentDialog(true);
    } else {
      // New user, proceed directly
      handleAcceptInvite();
    }
  };

  const handleAcceptInvite = async () => {
    if (!user) {
      navigate(`/auth?redirect=/accept-invite?token=${token}`);
      return;
    }

    setAccepting(true);
    setShowConsentDialog(false);

    try {
      const { data, error } = await supabase.functions.invoke('accept-org-invite', {
        body: { 
          invite_token: token,
          link_existing_account: isExistingUser,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStatus('accepted');
      toast({
        title: 'Welcome!',
        description: data?.message || 'You have successfully joined the organization',
      });

      // Redirect to org admin after a short delay
      setTimeout(() => {
        navigate('/org-admin');
      }, 2000);
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      setErrorMessage(error.message || 'Failed to accept invitation');
      setStatus('error');
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'invalid' || status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/')}
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>Welcome to {invite?.organizations?.name}!</CardTitle>
            <CardDescription>
              You have successfully joined the organization. Redirecting...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>
              You've been invited to join <strong>{invite?.organizations?.name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground mb-1">Invited email</div>
              <div className="font-medium">{invite?.email}</div>
            </div>

            {!user ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Please sign in or create an account with the email address above to accept this invitation.
                </p>
                <Button 
                  className="w-full"
                  onClick={() => navigate(`/auth?redirect=/accept-invite?token=${token}`)}
                >
                  Sign In to Accept
                </Button>
              </div>
            ) : user.email?.toLowerCase() !== invite?.email?.toLowerCase() ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive text-center">
                  You're signed in as <strong>{user.email}</strong>, but this invitation was sent to <strong>{invite?.email}</strong>.
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  Please sign out and sign in with the correct email address.
                </p>
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/auth')}
                >
                  Switch Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {isExistingUser && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Existing account detected.</strong> Accepting this invite will link your existing platform account to this organization.
                      </div>
                    </div>
                  </div>
                )}
                <Button 
                  className="w-full"
                  onClick={handleAcceptClick}
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Accept Invitation'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Consent Dialog for Existing Users */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Link Your Account</DialogTitle>
            <DialogDescription className="text-center">
              You have an existing account on this platform. By joining <strong>{invite?.organizations?.name}</strong>, you're linking your account to this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <p className="font-medium">What this means:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Your existing profile will be visible to organization administrators</li>
                <li>You can control what data the organization sees in your privacy settings</li>
                <li>Your personal development data remains private unless you choose to share it</li>
                <li>Leaving the organization won't delete your personal account or data</li>
              </ul>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border">
              <Checkbox 
                id="consent" 
                checked={consentChecked}
                onCheckedChange={(checked) => setConsentChecked(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="consent" className="text-sm font-medium cursor-pointer">
                  I understand and consent to linking my account
                </Label>
                <p className="text-xs text-muted-foreground">
                  You can manage your organization sharing preferences anytime in Settings.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowConsentDialog(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAcceptInvite}
              disabled={!consentChecked || accepting}
              className="w-full sm:w-auto"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                'Confirm & Join'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}