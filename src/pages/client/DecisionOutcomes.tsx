import { DecisionOutcomeTracker } from "@/components/decisions/DecisionOutcomeTracker";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { CapabilityGate } from "@/components/decisions/CapabilityGate";

export default function DecisionOutcomes() {
  const navigate = useNavigate();

  return (
    <CapabilityGate capability="outcome_tracking">
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate("/decisions")} className="cursor-pointer">
                Decisions
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Outcomes</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 className="text-3xl font-bold">Decision Outcome Tracker</h1>
          <p className="text-muted-foreground">
            Monitor your decision accuracy and learn from outcomes
          </p>
        </div>

        <DecisionOutcomeTracker />
      </div>
    </CapabilityGate>
  );
}