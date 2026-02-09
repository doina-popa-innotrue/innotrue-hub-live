import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function VerifySignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('No verification token provided.');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-signup', {
          body: { token }
        });

        if (error) {
          console.error('Verification error:', error);
          setStatus('error');
          setMessage(error.message || 'Failed to verify email. Please try again.');
          return;
        }

        if (data?.error) {
          setStatus('error');
          setMessage(data.error);
          return;
        }

        setStatus('success');
        setMessage(data?.message || 'Your email has been verified successfully!');
      } catch (err: any) {
        console.error('Verification error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    verifyToken();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
          <CardDescription>InnoTrue Hub</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying your email...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-center text-foreground">{message}</p>
              <Button onClick={() => navigate('/auth')} className="w-full">
                Go to Login
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-destructive" />
              <p className="text-center text-foreground">{message}</p>
              <Button onClick={() => navigate('/auth')} variant="outline" className="w-full">
                Back to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
