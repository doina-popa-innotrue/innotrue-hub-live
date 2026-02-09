import { useState } from "react";
import { Coins, ArrowRight, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceCatalog } from "@/components/credits/ServiceCatalog";
import { useCreditBatches } from "@/hooks/useCreditBatches";
import { useCreditServices } from "@/hooks/useCreditService";
import { FeatureGate } from "@/components/FeatureGate";

export default function Services() {
  const navigate = useNavigate();
  const { summary, isLoading: creditsLoading } = useCreditBatches();
  const { data: services } = useCreditServices();

  // Get unique categories
  const categories = Array.from(
    new Set(services?.map((s) => s.category).filter(Boolean) || [])
  ) as string[];

  const balance = summary?.total_available ?? 0;

  return (
    <FeatureGate featureKey="services">
    <div className="container max-w-4xl py-6 space-y-6">
      <SEOHead
        title="Services | InnoTrue Hub"
        description="Browse available services and their credit costs"
      />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-muted-foreground">
            Browse available services and their credit costs
          </p>
        </div>

        <Card className="shrink-0">
          <CardContent className="flex items-center gap-4 py-4 px-5">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Balance</p>
              <p className="text-2xl font-bold">
                {creditsLoading ? "..." : balance.toLocaleString()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/credits")}
            >
              Top Up
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {categories.length > 1 ? (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Services</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">
            <ServiceCatalog showBalance={false} />
          </TabsContent>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat}>
              <ServiceCatalog category={cat} showBalance={false} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <ServiceCatalog showBalance={false} />
      )}

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">How Credit Services Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Credit services are activities that consume credits from your balance.
            Each service has a credit cost displayed next to it.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Track Discounts:</strong> Some services may have discounted
              rates based on your enrolled tracks.
            </li>
            <li>
              <strong>Feature Access:</strong> Certain services may require
              specific feature access through your plan or program.
            </li>
            <li>
              <strong>Credits Never Expire:</strong> Purchased credits don't
              expire, so you can use them whenever you're ready.
            </li>
          </ul>
          <div className="pt-2">
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => navigate("/credits")}
            >
              Learn more about credits
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </FeatureGate>
  );
}
