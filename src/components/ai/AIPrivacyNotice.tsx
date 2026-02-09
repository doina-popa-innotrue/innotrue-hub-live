import { Shield, Lock, Server } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AIPrivacyNotice() {
  return (
    <Alert className="bg-muted/50 border-muted">
      <Shield className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <p className="font-medium">Your Privacy is Protected</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Your data is <strong>never used to train AI models</strong>. We use enterprise API agreements that explicitly prohibit training on user data.</span>
          </li>
          <li className="flex items-start gap-2">
            <Server className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Data is <strong>processed in real-time only</strong> and not stored by AI providers. All your information remains securely in your account.</span>
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}
