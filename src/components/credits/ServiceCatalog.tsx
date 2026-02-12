import { Coins, Tag, Sparkles, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreditServices, useCreditService } from "@/hooks/useCreditService";
import { useCreditBatches } from "@/hooks/useCreditBatches";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ServiceCatalogProps {
  category?: string;
  onSelectService?: (serviceId: string, serviceName: string, cost: number) => void;
  selectedServiceId?: string;
  showBalance?: boolean;
}

export function ServiceCatalog({
  category,
  onSelectService,
  selectedServiceId,
  showBalance = true,
}: ServiceCatalogProps) {
  const { user } = useAuth();
  const { data: services, isLoading } = useCreditServices(category);
  const { summary, isLoading: isLoadingCredits } = useCreditBatches();
  const { getServiceCost } = useCreditService();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No services available in this category.</p>
        </CardContent>
      </Card>
    );
  }

  // Group services by category
  const groupedServices = services.reduce(
    (acc, service) => {
      const cat = service.category || "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(service);
      return acc;
    },
    {} as Record<string, typeof services>,
  );

  const balance = summary?.total_available ?? 0;

  return (
    <div className="space-y-6">
      {showBalance && user && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Coins className="h-5 w-5 text-primary" />
          <span className="font-medium">
            Your Balance: {isLoadingCredits ? "..." : balance.toLocaleString()} credits
          </span>
        </div>
      )}

      {Object.entries(groupedServices).map(([categoryName, categoryServices]) => (
        <div key={categoryName} className="space-y-3">
          {!category && (
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {categoryName}
            </h3>
          )}
          <div className="grid gap-3">
            {categoryServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isSelected={selectedServiceId === service.id}
                onSelect={onSelectService}
                userBalance={balance}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    description: string | null;
    credit_cost: number;
    feature_id: string | null;
    category: string | null;
  };
  isSelected?: boolean;
  onSelect?: (serviceId: string, serviceName: string, cost: number) => void;
  userBalance: number;
}

function ServiceCard({ service, isSelected, onSelect, userBalance }: ServiceCardProps) {
  const canAfford = userBalance >= service.credit_cost;
  const isSelectable = !!onSelect;

  return (
    <Card
      className={`transition-all ${
        isSelectable ? "cursor-pointer hover:border-primary/50" : ""
      } ${isSelected ? "border-primary ring-1 ring-primary" : ""} ${
        !canAfford && isSelectable ? "opacity-60" : ""
      }`}
      onClick={() => {
        if (isSelectable && canAfford) {
          onSelect(service.id, service.name, service.credit_cost);
        }
      }}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {service.name}
              {service.feature_id && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Gated
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Requires feature access</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardTitle>
            {service.description && (
              <CardDescription className="text-sm mt-1 line-clamp-2">
                {service.description}
              </CardDescription>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={canAfford ? "default" : "secondary"} className="font-mono text-sm">
              <Coins className="h-3.5 w-3.5 mr-1" />
              {service.credit_cost}
            </Badge>
            {service.category && (
              <Badge variant="outline" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                {service.category}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export function ServiceCostDisplay({
  serviceId,
  showDiscount = true,
}: {
  serviceId: string;
  showDiscount?: boolean;
}) {
  const { getServiceCost } = useCreditService();
  const { data: cost, isLoading } = getServiceCost(serviceId);

  if (isLoading) {
    return <Skeleton className="h-6 w-16 inline-block" />;
  }

  if (!cost?.found) {
    return null;
  }

  const hasDiscount =
    showDiscount && cost.has_track_discount && cost.effective_cost !== cost.base_cost;

  return (
    <span className="inline-flex items-center gap-1.5">
      <Coins className="h-4 w-4" />
      {hasDiscount ? (
        <>
          <span className="line-through text-muted-foreground">{cost.base_cost}</span>
          <span className="font-medium text-primary">{cost.effective_cost}</span>
          <Badge variant="secondary" className="text-xs">
            Discount
          </Badge>
        </>
      ) : (
        <span className="font-medium">{cost.effective_cost}</span>
      )}
      <span className="text-muted-foreground">credits</span>
    </span>
  );
}
