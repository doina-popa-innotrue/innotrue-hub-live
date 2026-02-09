import { Check, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ScenarioSaveIndicatorProps {
  status: SaveStatus;
  onManualSave: () => void;
  disabled?: boolean;
}

export function ScenarioSaveIndicator({ 
  status, 
  onManualSave, 
  disabled 
}: ScenarioSaveIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      <div className={cn(
        "flex items-center gap-1.5 text-sm transition-opacity",
        status === 'idle' && "opacity-0",
        status === 'saving' && "text-muted-foreground",
        status === 'saved' && "text-primary",
        status === 'error' && "text-destructive"
      )}>
        {status === 'saving' && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Saving...</span>
          </>
        )}
        {status === 'saved' && (
          <>
            <Check className="h-3.5 w-3.5" />
            <span>Saved</span>
          </>
        )}
        {status === 'error' && (
          <span>Save failed</span>
        )}
      </div>

      {/* Manual save button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onManualSave}
        disabled={disabled || status === 'saving'}
      >
        <Save className="h-4 w-4 mr-1.5" />
        Save
      </Button>
    </div>
  );
}
