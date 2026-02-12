import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Registration {
  id: string;
  user_id: string;
  assessment_id: string;
  status: "pending" | "contacted" | "completed" | "declined";
  notes: string | null;
  created_at: string;
  profiles: { name: string } | null;
  auth_users: { email: string } | null;
  psychometric_assessments: { name: string; provider: string | null } | null;
}

export default function AssessmentInterestRegistrations() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchRegistrations();

    const channel = supabase
      .channel("assessment-interest-registrations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assessment_interest_registrations",
        },
        () => {
          fetchRegistrations();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchRegistrations() {
    const { data, error } = await supabase
      .from("assessment_interest_registrations")
      .select(
        `
        *,
        psychometric_assessments (name, provider)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching registrations:", error);
      toast({ title: "Error loading registrations", variant: "destructive" });
    } else {
      const registrationsWithDetails = await Promise.all(
        (data || []).map(async (reg: any) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("id", reg.user_id)
            .single();

          return {
            ...reg,
            profiles: profileData ? { name: profileData.name } : null,
            auth_users: profileData ? { email: profileData.username || "" } : null,
          };
        }),
      );
      setRegistrations(registrationsWithDetails as Registration[]);
    }
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from("assessment_interest_registrations")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast({ title: "Error updating status", variant: "destructive" });
    } else {
      toast({ description: "Status updated successfully" });
      fetchRegistrations();
    }
  }

  const filteredRegistrations =
    statusFilter === "all"
      ? registrations
      : registrations.filter((reg) => reg.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "contacted":
        return (
          <Badge variant="secondary">
            <Mail className="h-3 w-3 mr-1" />
            Contacted
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Assessment Interest Registrations</h1>
        <p className="text-muted-foreground mt-2">
          Manage client interest in psychometric assessments
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Registrations</CardTitle>
              <CardDescription>
                {filteredRegistrations.length} registration(s) total
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No registrations found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{reg.profiles?.name}</div>
                        <div className="text-sm text-muted-foreground">{reg.auth_users?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{reg.psychometric_assessments?.name}</TableCell>
                    <TableCell>{reg.psychometric_assessments?.provider || "N/A"}</TableCell>
                    <TableCell>{format(new Date(reg.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{getStatusBadge(reg.status)}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm text-muted-foreground">
                        {reg.notes || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={reg.status}
                        onValueChange={(value) => updateStatus(reg.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
