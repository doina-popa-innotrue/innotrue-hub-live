import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTalentLmsSSO } from "@/hooks/useTalentLmsSSO";

export default function Academy() {
  const [talentLmsConnection, setTalentLmsConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { loginToTalentLms, isLoading: accessingTalentLms } = useTalentLmsSSO();

  useEffect(() => {
    async function fetchTalentLmsConnection() {
      if (!user) return;

      const { data, error } = await supabase
        .from("talentlms_users")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching TalentLMS connection:", error);
      } else {
        setTalentLmsConnection(data);
      }

      setLoading(false);
    }

    fetchTalentLmsConnection();
  }, [user]);

  const handleAccessTalentLms = () => {
    loginToTalentLms("");
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">InnoTrue Academy</h1>
        <p className="text-muted-foreground">Access your learning courses on InnoTrue Academy</p>
      </div>

      {talentLmsConnection ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Your InnoTrue Academy Connection
            </CardTitle>
            <CardDescription>You're connected to InnoTrue Academy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Username:</span>
                <span className="font-medium">{talentLmsConnection.talentlms_username}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-xs">{talentLmsConnection.talentlms_user_id}</span>
              </div>
            </div>

            <Button
              onClick={handleAccessTalentLms}
              disabled={accessingTalentLms}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {accessingTalentLms ? "Opening InnoTrue Academy..." : "Access InnoTrue Academy"}
            </Button>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Clicking the button above will generate a secure login link and open InnoTrue
                Academy in a new tab.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              InnoTrue Academy Not Connected
            </CardTitle>
            <CardDescription>
              Connect your account to access InnoTrue Academy courses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your InnoTrue Academy account hasn't been set up yet. Request a connection to get
                access to InnoTrue Academy courses.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => {
                toast.success("Connection request sent to administrators");
              }}
              className="w-full"
            >
              Request Academy Connection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
