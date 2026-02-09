import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, CheckCircle, Star, Lock, Zap, ExternalLink, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAssessmentFeatureAccess } from "@/hooks/useAssessmentFeatureAccess";

import { RichTextDisplay } from "@/components/ui/rich-text-display";

type Assessment = {
  id: string;
  name: string;
  description: string | null;
  provider: string | null;
  category: string;
  feature_key: string | null;
  url: string | null;
  cost: number | null;
  hasInterest: boolean;
};

export default function ExploreAssessments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasAccessToFeature, isLoading: accessLoading } = useAssessmentFeatureAccess();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [notes, setNotes] = useState("");

  const { data: assessments, isLoading } = useQuery({
    queryKey: ["explore-assessments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: assessmentData, error: assessmentError } = await supabase
        .from("psychometric_assessments")
        .select("id, name, description, provider, category, feature_key, url, cost")
        .eq("is_active", true)
        .order("name");

      if (assessmentError) throw assessmentError;

      const { data: interestData, error: interestError } = await supabase
        .from("assessment_interest_registrations")
        .select("assessment_id")
        .eq("user_id", user.id);

      if (interestError) throw interestError;

      const interestSet = new Set(interestData?.map(i => i.assessment_id));

      return assessmentData.map(assessment => ({
        ...assessment,
        hasInterest: interestSet.has(assessment.id),
      })) as Assessment[];
    },
  });

  const expressInterestMutation = useMutation({
    mutationFn: async ({ assessmentId, notes }: { assessmentId: string; notes: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("assessment_interest_registrations")
        .insert({
          user_id: user.id,
          assessment_id: assessmentId,
          status: "pending",
          notes: notes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explore-assessments"] });
      toast({ description: "Interest registered successfully" });
      setSelectedAssessment(null);
      setNotes("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredAssessments = assessments?.filter((assessment) => {
    const matchesSearch = assessment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || assessment.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Explore Assessments</h1>
          <p className="text-muted-foreground mt-2">
            Discover psychometric assessments to enhance your self-awareness
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/assessments')}>
          My Assessments
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search assessments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="personality">Personality</SelectItem>
            <SelectItem value="aptitude">Aptitude</SelectItem>
            <SelectItem value="career">Career</SelectItem>
            <SelectItem value="emotional-intelligence">Emotional Intelligence</SelectItem>
            <SelectItem value="leadership">Leadership</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading || accessLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssessments?.map((assessment) => {
            const isLocked = !hasAccessToFeature(assessment.feature_key);
            
            return (
              <Card key={assessment.id} className={`relative ${isLocked ? 'opacity-75' : ''}`}>
                {isLocked && (
                  <div className="absolute -top-2 -left-2 z-10">
                    <Badge variant="secondary" className="shadow-lg">
                      <Lock className="h-3 w-3 mr-1" />
                      Upgrade Required
                    </Badge>
                  </div>
                )}
                {assessment.hasInterest && !isLocked && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <Badge className="bg-primary text-primary-foreground border-0 shadow-lg">
                      <Star className="h-3 w-3 mr-1" />
                      Interested
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{assessment.name}</CardTitle>
                  {assessment.provider && (
                    <p className="text-sm text-muted-foreground">
                      by {assessment.provider}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{assessment.category}</Badge>
                    {assessment.cost != null && (
                      <Badge variant="outline" className="gap-1">
                        <DollarSign className="h-3 w-3" />
                        {assessment.cost.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  {assessment.url && (
                    <a 
                      href={assessment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Learn More
                    </a>
                  )}
                </CardHeader>
                {assessment.description && (
                  <CardContent className="pt-0">
                    <RichTextDisplay content={assessment.description} className="text-sm text-muted-foreground" />
                  </CardContent>
                )}
                <CardFooter>
                  {isLocked ? (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => navigate('/subscription')}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Upgrade to Access
                    </Button>
                  ) : assessment.hasInterest ? (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Interest Registered
                    </Button>
                  ) : (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full" onClick={() => setSelectedAssessment(assessment)}>
                          Express Interest
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Express Interest</DialogTitle>
                          <DialogDescription>
                            Let us know you're interested in {assessment.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="notes">Additional Notes (Optional)</Label>
                            <Textarea
                              id="notes"
                              placeholder="Any specific questions or information you'd like to share..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              rows={4}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => {
                              if (selectedAssessment) {
                                expressInterestMutation.mutate({
                                  assessmentId: selectedAssessment.id,
                                  notes,
                                });
                              }
                            }}
                            disabled={expressInterestMutation.isPending}
                          >
                            {expressInterestMutation.isPending && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Submit Interest
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
