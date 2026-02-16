import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Upload,
  FileText,
  Download,
  Trash2,
  Loader2,
  Lock,
  Unlock,
  UserPlus,
  X,
  Target,
  TrendingUp,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { validateFile, acceptStringForBucket } from "@/lib/fileValidation";
import { useAssessmentFeatureAccess } from "@/hooks/useAssessmentFeatureAccess";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

type UserAssessment = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  notes: string | null;
  uploaded_at: string;
  assessment_id: string | null;
};

type AssessmentShare = {
  id: string;
  user_assessment_id: string;
  shared_with_user_id: string;
  shared_by_user_id: string;
  shared_at: string;
  notes: string | null;
  shared_with_profile?: {
    name: string;
  };
};

type CapabilitySnapshot = {
  id: string;
  assessment_id: string;
  title: string | null;
  completed_at: string | null;
  shared_with_coach: boolean;
  assessment: {
    id: string;
    name: string;
    description: string | null;
  };
};

type GroupedCapabilityAssessment = {
  assessment_id: string;
  assessment_name: string;
  assessment_description: string | null;
  snapshots: CapabilitySnapshot[];
  latestSnapshot: CapabilitySnapshot;
  sharedCount: number;
};

type SelfAssessmentResponse = {
  id: string;
  assessment_id: string;
  completed_at: string;
  dimension_scores: Record<string, number>;
  assessment: {
    id: string;
    name: string;
    description: string | null;
  };
};

type GroupedSelfAssessment = {
  assessment_id: string;
  assessment_name: string;
  assessment_description: string | null;
  responses: SelfAssessmentResponse[];
  latestResponse: SelfAssessmentResponse;
};

export default function MyAssessments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAccessToFeature, isLoading: accessLoading } = useAssessmentFeatureAccess();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedAssessmentForShare, setSelectedAssessmentForShare] =
    useState<UserAssessment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    assessment_id: "",
    notes: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch psychometric uploads
  const { data: psychometricAssessments, isLoading: psychometricLoading } = useQuery({
    queryKey: ["my-assessments"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_assessments")
        .select("*")
        .eq("user_id", user.id)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as UserAssessment[];
    },
  });

  // Fetch capability snapshots
  const { data: capabilitySnapshots, isLoading: capabilityLoading } = useQuery({
    queryKey: ["my-capability-snapshots-results"],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          id,
          assessment_id,
          title,
          completed_at,
          shared_with_coach,
          capability_assessments:assessment_id (
            id,
            name,
            description
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((s) => ({
        ...s,
        assessment: s.capability_assessments,
      })) as CapabilitySnapshot[];
    },
    enabled: !!user,
  });

  // Fetch self-assessment responses (from assessment builder)
  const { data: selfAssessmentResponses, isLoading: selfAssessmentLoading } = useQuery({
    queryKey: ["my-self-assessment-responses"],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("assessment_responses")
        .select(
          `
          id,
          assessment_id,
          completed_at,
          dimension_scores,
          assessment_definitions:assessment_id (
            id,
            name,
            description
          )
        `,
        )
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((r) => ({
        ...r,
        assessment: r.assessment_definitions,
      })) as SelfAssessmentResponse[];
    },
    enabled: !!user,
  });

  // Get all shares for user's assessments
  const { data: assessmentShares } = useQuery({
    queryKey: ["assessment-shares"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: shares, error } = await supabase
        .from("user_assessment_shares")
        .select("*")
        .eq("shared_by_user_id", user.id);

      if (error) throw error;

      if (shares && shares.length > 0) {
        const userIds = [...new Set(shares.map((s) => s.shared_with_user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);

        return shares.map((share) => ({
          ...share,
          shared_with_profile: profiles?.find((p) => p.id === share.shared_with_user_id),
        })) as AssessmentShare[];
      }

      return [] as AssessmentShare[];
    },
  });

  // Get user's coaches
  const { data: coaches } = useQuery({
    queryKey: ["my-coaches"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: coachRelations, error } = await supabase
        .from("client_coaches")
        .select("coach_id")
        .eq("client_id", user.id);

      if (error) throw error;

      if (coachRelations && coachRelations.length > 0) {
        const coachIds = coachRelations.map((c) => c.coach_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", coachIds);

        return coachRelations.map((c) => ({
          coach_id: c.coach_id,
          coach_profile: profiles?.find((p) => p.id === c.coach_id),
        }));
      }

      return [];
    },
  });

  const { data: availableAssessments } = useQuery({
    queryKey: ["available-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psychometric_assessments")
        .select("id, name, feature_key")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const accessibleAssessments = availableAssessments?.filter((a) =>
    hasAccessToFeature(a.feature_key),
  );

  const getSharesForAssessment = (assessmentId: string) => {
    return assessmentShares?.filter((s) => s.user_assessment_id === assessmentId) || [];
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");

      const validation = validateFile(selectedFile, "psychometric-assessments");
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      setUploading(true);

      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("psychometric-assessments")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("user_assessments").insert({
        user_id: user.id,
        title: formData.title,
        file_name: selectedFile.name,
        file_path: fileName,
        assessment_id: formData.assessment_id || null,
        notes: formData.notes || null,
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-assessments"] });
      toast({ description: "Assessment uploaded successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const shareMutation = useMutation({
    mutationFn: async ({ assessmentId, coachId }: { assessmentId: string; coachId: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("user_assessment_shares").insert({
        user_assessment_id: assessmentId,
        shared_with_user_id: coachId,
        shared_by_user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-shares"] });
      toast({ description: "Assessment shared successfully" });
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast({ description: "Already shared with this person", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  const unshareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase.from("user_assessment_shares").delete().eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-shares"] });
      toast({ description: "Share removed" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (assessment: UserAssessment) => {
      const { error: storageError } = await supabase.storage
        .from("psychometric-assessments")
        .remove([assessment.file_path]);

      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from("user_assessments")
        .delete()
        .eq("id", assessment.id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessment-shares"] });
      toast({ description: "Assessment deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleDownload = async (assessment: UserAssessment) => {
    const { data, error } = await supabase.storage
      .from("psychometric-assessments")
      .download(assessment.file_path);

    if (error) {
      toast({ title: "Error", description: "Failed to download file", variant: "destructive" });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = assessment.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      assessment_id: "",
      notes: "",
    });
    setSelectedFile(null);
  };

  const openShareDialog = (assessment: UserAssessment) => {
    setSelectedAssessmentForShare(assessment);
    setShareDialogOpen(true);
  };

  // Group capability snapshots by assessment
  const groupedCapabilityAssessments: GroupedCapabilityAssessment[] = (() => {
    if (!capabilitySnapshots || capabilitySnapshots.length === 0) return [];

    const grouped = capabilitySnapshots.reduce(
      (acc, snapshot) => {
        const key = snapshot.assessment_id;
        if (!acc[key]) {
          acc[key] = {
            assessment_id: snapshot.assessment_id,
            assessment_name: snapshot.assessment?.name || "Unknown Assessment",
            assessment_description: snapshot.assessment?.description || null,
            snapshots: [],
            latestSnapshot: snapshot,
            sharedCount: 0,
          };
        }
        acc[key].snapshots.push(snapshot);
        if (snapshot.shared_with_coach) acc[key].sharedCount++;
        return acc;
      },
      {} as Record<string, GroupedCapabilityAssessment>,
    );

    return Object.values(grouped);
  })();

  // Group self-assessment responses by assessment
  const groupedSelfAssessments: GroupedSelfAssessment[] = (() => {
    if (!selfAssessmentResponses || selfAssessmentResponses.length === 0) return [];

    const grouped = selfAssessmentResponses.reduce(
      (acc, response) => {
        const key = response.assessment_id;
        if (!acc[key]) {
          acc[key] = {
            assessment_id: response.assessment_id,
            assessment_name: response.assessment?.name || "Unknown Assessment",
            assessment_description: response.assessment?.description || null,
            responses: [],
            latestResponse: response,
          };
        }
        acc[key].responses.push(response);
        return acc;
      },
      {} as Record<string, GroupedSelfAssessment>,
    );

    return Object.values(grouped);
  })();

  const isLoading = psychometricLoading || capabilityLoading || selfAssessmentLoading;
  const totalResults =
    (psychometricAssessments?.length || 0) +
    groupedCapabilityAssessments.length +
    groupedSelfAssessments.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Results</h1>
          <p className="text-muted-foreground mt-2">
            View all your assessment results in one place
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Psychometric
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Psychometric Assessment</DialogTitle>
              <DialogDescription>
                Upload a PDF of your psychometric assessment results
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., MBTI Results - January 2024"
                />
              </div>
              <div className="relative z-50">
                <Label htmlFor="assessment_id">Assessment Type (Optional)</Label>
                <Select
                  value={formData.assessment_id}
                  onValueChange={(value) => setFormData({ ...formData, assessment_id: value })}
                  disabled={accessLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an assessment type" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="none">None</SelectItem>
                    {accessibleAssessments?.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableAssessments &&
                  accessibleAssessments &&
                  availableAssessments.length > accessibleAssessments.length && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Some assessment types require a plan upgrade to access.
                    </p>
                  )}
              </div>
              <div>
                <Label htmlFor="file">File (PDF) *</Label>
                <Input
                  id="file"
                  type="file"
                  accept={acceptStringForBucket("psychometric-assessments")}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!selectedFile || !formData.title || uploading}
                >
                  {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Sharing</DialogTitle>
            <DialogDescription>
              Choose who can view "{selectedAssessmentForShare?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAssessmentForShare &&
              getSharesForAssessment(selectedAssessmentForShare.id).length > 0 && (
                <div className="space-y-2">
                  <Label>Currently shared with:</Label>
                  <div className="space-y-2">
                    {getSharesForAssessment(selectedAssessmentForShare.id).map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between p-2 rounded-md border"
                      >
                        <span className="text-sm">
                          {share.shared_with_profile?.name || "Unknown"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unshareMutation.mutate(share.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {coaches && coaches.length > 0 ? (
              <div className="space-y-2">
                <Label>Share with coach:</Label>
                <div className="space-y-2">
                  {coaches
                    .filter((c) => {
                      const existingShares = selectedAssessmentForShare
                        ? getSharesForAssessment(selectedAssessmentForShare.id)
                        : [];
                      return !existingShares.some((s) => s.shared_with_user_id === c.coach_id);
                    })
                    .map((coach) => (
                      <Button
                        key={coach.coach_id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          if (selectedAssessmentForShare) {
                            shareMutation.mutate({
                              assessmentId: selectedAssessmentForShare.id,
                              coachId: coach.coach_id,
                            });
                          }
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {coach.coach_profile?.name || "Coach"}
                      </Button>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You don't have any assigned coaches to share with.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : totalResults === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Assessment Results Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Complete a capability assessment or upload your psychometric results to see them here.
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => navigate("/capabilities")}>
                <Target className="h-4 w-4 mr-2" />
                Capability Assessments
              </Button>
              <Button variant="outline" onClick={() => navigate("/assessments/explore")}>
                <FileText className="h-4 w-4 mr-2" />
                Psychometric Assessments
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm py-2">
              All ({totalResults})
            </TabsTrigger>
            <TabsTrigger value="capability" className="text-xs sm:text-sm py-2">
              Capability ({groupedCapabilityAssessments.length})
            </TabsTrigger>
            <TabsTrigger value="self" className="text-xs sm:text-sm py-2">
              Self ({groupedSelfAssessments.length})
            </TabsTrigger>
            <TabsTrigger value="psychometric" className="text-xs sm:text-sm py-2">
              Psycho ({psychometricAssessments?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {/* Combined view - grouped capability assessments first, then self-assessments, then psychometric */}
            {groupedCapabilityAssessments.length > 0 && (
              <div className="space-y-3">
                {groupedCapabilityAssessments.map((group) => (
                  <Card
                    key={group.assessment_id}
                    className="hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/capabilities/${group.assessment_id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Target className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">{group.assessment_name}</CardTitle>
                            <Badge variant="outline">Capability</Badge>
                            <Badge variant="secondary">
                              {group.snapshots.length}{" "}
                              {group.snapshots.length === 1 ? "snapshot" : "snapshots"}
                            </Badge>
                            {group.sharedCount > 0 && (
                              <Badge variant="secondary">
                                <Unlock className="h-3 w-3 mr-1" />
                                {group.sharedCount} shared
                              </Badge>
                            )}
                          </div>
                          {group.assessment_description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {group.assessment_description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Last completed:{" "}
                            {group.latestSnapshot.completed_at
                              ? format(new Date(group.latestSnapshot.completed_at), "MMM d, yyyy")
                              : ""}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}

            {groupedSelfAssessments.length > 0 && (
              <div className="space-y-3">
                {groupedSelfAssessments.map((group) => (
                  <Card
                    key={group.assessment_id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ClipboardList className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">{group.assessment_name}</CardTitle>
                            <Badge variant="outline">Self-Assessment</Badge>
                            <Badge variant="secondary">
                              {group.responses.length}{" "}
                              {group.responses.length === 1 ? "response" : "responses"}
                            </Badge>
                          </div>
                          {group.assessment_description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {group.assessment_description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Last completed:{" "}
                            {group.latestResponse.completed_at
                              ? format(new Date(group.latestResponse.completed_at), "MMM d, yyyy")
                              : ""}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}

            {psychometricAssessments && psychometricAssessments.length > 0 && (
              <div className="space-y-3">
                {psychometricAssessments.map((assessment) => {
                  const shares = getSharesForAssessment(assessment.id);
                  const isShared = shares.length > 0;

                  return (
                    <Card key={assessment.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <FileText className="h-4 w-4 text-primary" />
                              <CardTitle className="text-base">{assessment.title}</CardTitle>
                              <Badge variant="outline">Psychometric</Badge>
                              {isShared ? (
                                <Badge variant="secondary">
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Shared ({shares.length})
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Private
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Uploaded {new Date(assessment.uploaded_at).toLocaleDateString()}
                            </p>
                            {assessment.notes && (
                              <CardDescription className="mt-1">{assessment.notes}</CardDescription>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(assessment);
                              }}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                openShareDialog(assessment);
                              }}
                              title="Manage Sharing"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(assessment);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="capability" className="space-y-4 mt-4">
            {groupedCapabilityAssessments.length > 0 ? (
              <div className="space-y-3">
                {groupedCapabilityAssessments.map((group) => (
                  <Card
                    key={group.assessment_id}
                    className="hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/capabilities/${group.assessment_id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Target className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">{group.assessment_name}</CardTitle>
                            <Badge variant="secondary">
                              {group.snapshots.length}{" "}
                              {group.snapshots.length === 1 ? "snapshot" : "snapshots"}
                            </Badge>
                            {group.sharedCount > 0 && (
                              <Badge variant="secondary">
                                <Unlock className="h-3 w-3 mr-1" />
                                {group.sharedCount} shared
                              </Badge>
                            )}
                          </div>
                          {group.assessment_description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {group.assessment_description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Last completed:{" "}
                            {group.latestSnapshot.completed_at
                              ? format(new Date(group.latestSnapshot.completed_at), "MMM d, yyyy")
                              : ""}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No capability assessments completed yet.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/capabilities")}
                  >
                    Start an Assessment
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="self" className="space-y-4 mt-4">
            {groupedSelfAssessments.length > 0 ? (
              <div className="space-y-3">
                {groupedSelfAssessments.map((group) => (
                  <Card
                    key={group.assessment_id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ClipboardList className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">{group.assessment_name}</CardTitle>
                            <Badge variant="secondary">
                              {group.responses.length}{" "}
                              {group.responses.length === 1 ? "response" : "responses"}
                            </Badge>
                          </div>
                          {group.assessment_description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {group.assessment_description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Last completed:{" "}
                            {group.latestResponse.completed_at
                              ? format(new Date(group.latestResponse.completed_at), "MMM d, yyyy")
                              : ""}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No self-assessments completed yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="psychometric" className="space-y-4 mt-4">
            {psychometricAssessments && psychometricAssessments.length > 0 ? (
              <div className="space-y-3">
                {psychometricAssessments.map((assessment) => {
                  const shares = getSharesForAssessment(assessment.id);
                  const isShared = shares.length > 0;

                  return (
                    <Card key={assessment.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" />
                              <CardTitle className="text-base">{assessment.title}</CardTitle>
                              {isShared ? (
                                <Badge variant="secondary">
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Shared ({shares.length})
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Private
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Uploaded {new Date(assessment.uploaded_at).toLocaleDateString()}
                            </p>
                            {assessment.notes && (
                              <CardDescription className="mt-1">{assessment.notes}</CardDescription>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(assessment)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openShareDialog(assessment)}
                              title="Manage Sharing"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(assessment)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No psychometric assessments uploaded yet.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/assessments/explore")}
                  >
                    Explore Assessments
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
