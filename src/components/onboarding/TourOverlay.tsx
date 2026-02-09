import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TourStep } from '@/hooks/useOnboardingTour';

interface TourOverlayProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

export function TourOverlay({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
}: TourOverlayProps) {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const element = document.querySelector(step.target) as HTMLElement;
    setTargetElement(element);

    if (element) {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      // Highlight the target element
      element.style.position = 'relative';
      element.style.zIndex = '10001';
      element.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5)';
      element.style.borderRadius = '8px';

      // Calculate tooltip position - for mobile, center at bottom
      let top = rect.top + scrollTop;
      let left = rect.left + scrollLeft;

      if (isMobile) {
        // On mobile, position card at bottom center
        top = window.innerHeight - 280 + scrollTop;
        left = 16;
      } else {
        switch (step.placement) {
          case 'bottom':
            top = rect.bottom + scrollTop + 16;
            left = rect.left + scrollLeft;
            break;
          case 'top':
            top = rect.top + scrollTop - 200;
            left = rect.left + scrollLeft;
            break;
          case 'left':
            top = rect.top + scrollTop;
            left = rect.left + scrollLeft - 320;
            break;
          case 'right':
            top = rect.top + scrollTop;
            left = rect.right + scrollLeft + 16;
            break;
          default:
            top = rect.bottom + scrollTop + 16;
        }

        // Ensure card stays within viewport
        const cardWidth = 320;
        const maxLeft = window.innerWidth - cardWidth - 16;
        left = Math.max(16, Math.min(left, maxLeft));
      }

      setPosition({ top, left });

      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return () => {
      if (element) {
        element.style.position = '';
        element.style.zIndex = '';
        element.style.boxShadow = '';
        element.style.borderRadius = '';
      }
    };
  }, [step, isMobile]);

  return (
    <>
      {/* Overlay backdrop - always clickable to skip on mobile */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm" 
        style={{ zIndex: 10000 }} 
        onClick={isMobile ? onSkip : undefined}
      />

      {/* Tour card */}
      <Card
        className={`fixed shadow-lg border-2 border-primary bg-background ${
          isMobile ? 'left-4 right-4 w-auto' : 'w-80'
        }`}
        style={{
          top: isMobile ? 'auto' : `${position.top}px`,
          bottom: isMobile ? '16px' : 'auto',
          left: isMobile ? '16px' : `${position.left}px`,
          right: isMobile ? '16px' : 'auto',
          zIndex: 10002,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{step.title}</CardTitle>
              <CardDescription className="text-xs mt-1">
                Step {currentStep + 1} of {totalSteps}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2 -mt-2"
              onClick={onSkip}
              aria-label="Close tour"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground">{step.content}</p>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={currentStep === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSkip}
            className="flex-1"
          >
            Skip
          </Button>
          <Button size="sm" onClick={onNext} className="flex-1">
            {currentStep === totalSteps - 1 ? (
              'Finish'
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}