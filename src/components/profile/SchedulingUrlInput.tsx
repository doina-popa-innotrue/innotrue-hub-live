import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Calendar } from 'lucide-react';

interface SchedulingUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SchedulingUrlInput({ value, onChange, disabled }: SchedulingUrlInputProps) {
  const isValidUrl = (url: string) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const hasValue = value && value.trim().length > 0;
  const isValid = isValidUrl(value);

  return (
    <div className="space-y-2">
      <Label htmlFor="scheduling-url" className="flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Scheduling Link
      </Label>
      <p className="text-sm text-muted-foreground">
        Add your Calendly, Cal.com, or other scheduling link for easy booking
      </p>
      <div className="flex items-center gap-2">
        <Input
          id="scheduling-url"
          type="url"
          placeholder="https://cal.com/your-name/meeting"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={!isValid ? 'border-destructive' : ''}
        />
        {hasValue && isValid && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {!isValid && (
        <p className="text-xs text-destructive">Please enter a valid URL</p>
      )}
    </div>
  );
}
