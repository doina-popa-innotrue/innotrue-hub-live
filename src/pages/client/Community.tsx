import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ExternalLink, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FeatureGate } from "@/components/FeatureGate";

export default function Community() {
  const [circleConnection, setCircleConnection] = useState<any>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accessingCircle, setAccessingCircle] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      // Fetch Circle connection
      const { data: connectionData, error: connectionError } = await supabase
        .from("circle_users")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (connectionError) {
        console.error("Error fetching Circle connection:", connectionError);
      } else {
        setCircleConnection(connectionData);
      }

      // Fetch pending request
      const { data: requestData, error: requestError } = await supabase
        .from("circle_interest_registrations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (requestError) {
        console.error("Error fetching Circle request:", requestError);
      } else {
        setPendingRequest(requestData);
      }

      setLoading(false);
    }

    fetchData();
  }, [user]);

  const handleAccessCircle = async () => {
    if (!circleConnection) return;

    setAccessingCircle(true);
    try {
      const { data, error } = await supabase.functions.invoke("circle-sso", {
        body: { userId: user?.id },
      });

      if (error) throw error;

      if (data?.loginUrl) {
        window.open(data.loginUrl, "_blank");
        toast.success("Opening InnoTrue Community...");
      } else {
        throw new Error("No login URL received");
      }
    } catch (error: any) {
      console.error("Error accessing InnoTrue Community:", error);
      toast.error("Failed to access InnoTrue Community. Please try again.");
    } finally {
      setAccessingCircle(false);
    }
  };

  const handleRequestConnection = async () => {
    if (!user) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("circle_interest_registrations")
        .insert({
          user_id: user.id,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      setPendingRequest(data);
      toast.success("Connection request sent to administrators");
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <FeatureGate featureKey="community">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">InnoTrue Community</h1>
          <p className="text-muted-foreground">
            Connect with other members in the InnoTrue Community
          </p>
        </div>

        {circleConnection ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your InnoTrue Community Connection
              </CardTitle>
              <CardDescription>You're connected to the InnoTrue Community</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{circleConnection.circle_email}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="font-mono text-xs">{circleConnection.circle_user_id}</span>
                </div>
              </div>

              <Button onClick={handleAccessCircle} disabled={accessingCircle} className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                {accessingCircle ? "Opening InnoTrue Community..." : "Access InnoTrue Community"}
              </Button>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Clicking the button above will generate a secure login link and open the InnoTrue
                  Community in a new tab.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : pendingRequest ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {pendingRequest.status === "pending" ? (
                  <Clock className="h-5 w-5 text-warning" />
                ) : pendingRequest.status === "approved" ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                Connection Request{" "}
                {pendingRequest.status === "pending"
                  ? "Pending"
                  : pendingRequest.status === "approved"
                    ? "Approved"
                    : "Status"}
              </CardTitle>
              <CardDescription>
                {pendingRequest.status === "pending"
                  ? "Your request is being reviewed by administrators"
                  : pendingRequest.status === "approved"
                    ? "Your request has been approved. Your connection will be set up shortly."
                    : `Request status: ${pendingRequest.status}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Submitted on {new Date(pendingRequest.created_at).toLocaleDateString()}. An
                  administrator will review your request and set up your connection.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                InnoTrue Community Not Connected
              </CardTitle>
              <CardDescription>
                Connect your account to access the InnoTrue Community
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your InnoTrue Community account hasn't been set up yet. Request a connection to
                  get access to the community.
                </AlertDescription>
              </Alert>

              <Button onClick={handleRequestConnection} disabled={submitting} className="w-full">
                {submitting ? "Submitting..." : "Request Community Connection"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </FeatureGate>
  );
}
