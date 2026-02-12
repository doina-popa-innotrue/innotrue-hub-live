import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { TourOverlay } from "./TourOverlay";
import { adminTourSteps, instructorTourSteps, clientTourSteps } from "@/data/tourSteps";

export function OnboardingTour() {
  const { userRole, userRoles } = useAuth();

  // Determine which tour to show based on primary role
  const getTourConfig = () => {
    if (userRole === "admin") {
      return { id: "admin-tour", steps: adminTourSteps };
    } else if (userRole === "instructor" || userRole === "coach") {
      return { id: "instructor-tour", steps: instructorTourSteps };
    } else {
      return { id: "client-tour", steps: clientTourSteps };
    }
  };

  const tourConfig = getTourConfig();
  const tour = useOnboardingTour(tourConfig.id, tourConfig.steps);

  if (!tour.isActive || !tour.currentStepData) {
    return null;
  }

  return (
    <TourOverlay
      step={tour.currentStepData}
      currentStep={tour.currentStep}
      totalSteps={tour.totalSteps}
      onNext={tour.nextStep}
      onPrevious={tour.previousStep}
      onSkip={tour.skipTour}
    />
  );
}
