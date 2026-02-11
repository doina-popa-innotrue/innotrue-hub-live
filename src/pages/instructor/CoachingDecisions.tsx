import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Share2, User } from "lucide-react";

interface SharedDecision {
  id: string;
  title: string;
  description: string | null;
  status: string;
  importance: string | null;
  urgency: string | null;
  confidence_level: number | null;
  user_id: string;
  profiles: {
    name: string;
  };
}

export default function CoachingDecisions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  if (!user) return null;
  const [decisions, setDecisions] = useState<SharedDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      fetchSharedDecisions();
    }
  }, [user]);

  async function fetchSharedDecisions() {
    try {
      // First get client IDs for this coach
      const { data: coachClients, error: coachError } = await supabase
        .from("client_coaches")
        .select("client_id")
        .eq("coach_id", user?.id!);

      if (coachError) throw coachError;

      const clientIds = coachClients?.map((cc) => cc.client_id) || [];

      if (clientIds.length === 0) {
        setDecisions([]);
        setLoading(false);
        return;
      }

      // Get decisions shared by these clients
      const { data, error } = await supabase
        .from("decisions")
        .select(`
          *,
          profiles!decisions_user_id_fkey (name)
        `)
        .eq("shared_with_coach", true)
        .in("user_id", clientIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDecisions(data as any || []);
    } catch (error: any) {
      toast({
        title: "Error fetching shared decisions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredDecisions = decisions.filter((decision) =>
    decision.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function getImportanceBadgeColor(importance: string | null) {
    switch (importance) {
      case "critical":
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  }

  if (loading) {
    return <div className="p-6">Loading shared decisions...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Shared Decisions</h1>
        <p className="text-muted-foreground mt-1">
          Decisions your clients have shared with you for guidance
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search decisions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <Badge variant="outline">{filteredDecisions.length} shared</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDecisions.map((decision) => (
          <Card
            key={decision.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate(`/coaching/decisions/${decision.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg line-clamp-2">{decision.title}</CardTitle>
                <Share2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{decision.profiles.name}</span>
              </div>

              {decision.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{decision.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">
                  {decision.status.replace("_", " ")}
                </Badge>
                {decision.importance && (
                  <Badge variant={getImportanceBadgeColor(decision.importance) as any} className="capitalize">
                    {decision.importance}
                  </Badge>
                )}
                {decision.urgency && (
                  <Badge variant="secondary" className="capitalize">
                    {decision.urgency} urgency
                  </Badge>
                )}
              </div>

              {decision.confidence_level !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confidence:</span>
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${decision.confidence_level}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{decision.confidence_level}%</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredDecisions.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <p>No shared decisions to display</p>
            <p className="text-sm mt-1">
              Your clients haven't shared any decisions with you yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
