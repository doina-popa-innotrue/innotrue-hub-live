import { Link } from "react-router-dom";

interface PrivacyPolicyLinkProps {
  className?: string;
  showIcon?: boolean;
}

export function PrivacyPolicyLink({ className, showIcon = false }: PrivacyPolicyLinkProps) {
  return (
    <Link
      to="/privacy-policy"
      className={`text-primary hover:underline inline-flex items-center gap-1 ${className || ""}`}
    >
      Privacy Policy
    </Link>
  );
}

export function CookiePolicyLink({ className }: { className?: string }) {
  return (
    <Link
      to="/cookie-policy"
      className={`text-primary hover:underline inline-flex items-center gap-1 ${className || ""}`}
    >
      Cookie Policy
    </Link>
  );
}

export function TermsOfServiceLink({ className, showIcon = false }: PrivacyPolicyLinkProps) {
  return (
    <a
      href="https://innotrue.com/terms"
      target="_blank"
      rel="noopener noreferrer"
      className={`text-primary hover:underline inline-flex items-center gap-1 ${className || ""}`}
    >
      Terms of Service
    </a>
  );
}

export function GDPRFooter() {
  return (
    <div className="text-xs text-muted-foreground text-center space-x-2">
      <PrivacyPolicyLink />
      <span>•</span>
      <CookiePolicyLink />
      <span>•</span>
      <TermsOfServiceLink />
      <span>•</span>
      <Link to="/account" className="text-primary hover:underline">
        Manage Data
      </Link>
    </div>
  );
}
