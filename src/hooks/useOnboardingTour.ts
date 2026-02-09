import { useState, useEffect } from 'react';

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function useOnboardingTour(tourId: string, steps: TourStep[]) {
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isActive, setIsActive] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Only check once per mount, not on every tourId change
    if (hasChecked) return;
    
    const completedTours = JSON.parse(localStorage.getItem('completedTours') || '[]');
    // Mark as checked regardless of whether we start the tour
    setHasChecked(true);
    
    if (!completedTours.includes(tourId)) {
      // Start tour after a short delay to let the page render
      const timer = setTimeout(() => {
        setIsActive(true);
        setCurrentStep(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [tourId, hasChecked]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    completeTour();
  };

  const completeTour = () => {
    const completedTours = JSON.parse(localStorage.getItem('completedTours') || '[]');
    if (!completedTours.includes(tourId)) {
      completedTours.push(tourId);
      localStorage.setItem('completedTours', JSON.stringify(completedTours));
    }
    setIsActive(false);
    setCurrentStep(-1);
  };

  const restartTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  return {
    currentStep,
    isActive,
    currentStepData: steps[currentStep],
    totalSteps: steps.length,
    nextStep,
    previousStep,
    skipTour,
    restartTour,
  };
}

export function resetAllTours() {
  localStorage.removeItem('completedTours');
}

export function resetTour(tourId: string) {
  const completedTours = JSON.parse(localStorage.getItem('completedTours') || '[]');
  const filtered = completedTours.filter((id: string) => id !== tourId);
  localStorage.setItem('completedTours', JSON.stringify(filtered));
}
