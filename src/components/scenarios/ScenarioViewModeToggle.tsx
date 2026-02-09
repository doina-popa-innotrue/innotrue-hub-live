import { Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScenarioViewModeToggleProps {
  isPreviewMode: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function ScenarioViewModeToggle({ 
  isPreviewMode, 
  onToggle,
  disabled 
}: ScenarioViewModeToggleProps) {
  return (
    <Button
      variant={isPreviewMode ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "transition-colors",
        isPreviewMode && "bg-primary/90"
      )}
    >
      {isPreviewMode ? (
        <>
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit Mode
        </>
      ) : (
        <>
          <Eye className="h-4 w-4 mr-1.5" />
          Preview
        </>
      )}
    </Button>
  );
}
