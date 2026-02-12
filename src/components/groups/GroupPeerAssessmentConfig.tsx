import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAdminGroupPeerAssessments } from "@/hooks/useGroupPeerAssessments";
import { Plus, Trash2, Loader2, ClipboardCheck } from "lucide-react";

interface GroupPeerAssessmentConfigProps {
  groupId: string;
}

export function GroupPeerAssessmentConfig({ groupId }: GroupPeerAssessmentConfigProps) {
  const { toast } = useToast();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");

  const { configs, isLoading, availableAssessments, addConfig, removeConfig, toggleActive } =
    useAdminGroupPeerAssessments(groupId);

  const handleAdd = async () => {
    if (!selectedAssessmentId) return;

    try {
      await addConfig.mutateAsync(selectedAssessmentId);
      toast({ title: "Peer assessment added" });
      setSelectedAssessmentId("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleRemove = async (configId: string) => {
    try {
      await removeConfig.mutateAsync(configId);
      toast({ title: "Peer assessment removed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleToggle = async (configId: string, isActive: boolean) => {
    try {
      await toggleActive.mutateAsync({ configId, isActive });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          <div>
            <CardTitle className="text-lg">Peer Assessments</CardTitle>
            <CardDescription>
              Configure which capability assessments group members can use to evaluate each other
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new assessment */}
        {availableAssessments && availableAssessments.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select an assessment to enable for peer review" />
              </SelectTrigger>
              <SelectContent>
                {availableAssessments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!selectedAssessmentId || addConfig.isPending}>
              {addConfig.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {/* Current configs */}
        {configs && configs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead className="w-24 text-center">Active</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{config.assessment?.name}</p>
                      {config.assessment?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {config.assessment.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={(checked) => handleToggle(config.id, checked)}
                      disabled={toggleActive.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(config.id)}
                      disabled={removeConfig.isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No peer assessments configured</p>
            <p className="text-xs">Add assessments above to enable peer evaluation</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
