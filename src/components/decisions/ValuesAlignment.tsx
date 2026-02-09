import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Value {
  id: string;
  value_name: string;
  alignment_score: number | null;
  notes: string | null;
}

interface ValuesAlignmentProps {
  decisionId: string;
}

export function ValuesAlignment({ decisionId }: ValuesAlignmentProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<Value[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValueName, setNewValueName] = useState("");

  useEffect(() => {
    fetchValues();
  }, [decisionId]);

  async function fetchValues() {
    try {
      const { data, error } = await supabase
        .from("decision_values")
        .select("*")
        .eq("decision_id", decisionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setValues(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading values",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function addValue() {
    if (!newValueName.trim()) return;

    try {
      const { data, error } = await supabase
        .from("decision_values")
        .insert([
          {
            decision_id: decisionId,
            value_name: newValueName,
            alignment_score: 5,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setValues([...values, data]);
      setNewValueName("");
      toast({
        title: "Value added",
        description: "Your value has been added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error adding value",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function updateValue(id: string, updates: Partial<Value>) {
    try {
      const { error } = await supabase
        .from("decision_values")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setValues(values.map((v) => (v.id === id ? { ...v, ...updates } : v)));
    } catch (error: any) {
      toast({
        title: "Error updating value",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function deleteValue(id: string) {
    try {
      const { error } = await supabase
        .from("decision_values")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setValues(values.filter((v) => v.id !== id));
      toast({
        title: "Value deleted",
        description: "The value has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting value",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  const averageAlignment =
    values.length > 0
      ? Math.round(
          values.reduce((sum, v) => sum + (v.alignment_score || 0), 0) / values.length
        )
      : 0;

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading values...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Personal Values Alignment</h3>
          <p className="text-sm text-muted-foreground">
            How does this decision align with what matters most to you?
          </p>
        </div>
        {values.length > 0 && (
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">{averageAlignment}</div>
            <div className="text-xs text-muted-foreground">Avg Alignment</div>
          </div>
        )}
      </div>

      {/* Add new value */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Add a personal value (e.g., Family, Integrity, Growth)..."
          value={newValueName}
          onChange={(e) => setNewValueName(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addValue()}
          className="flex-1"
        />
        <Button onClick={addValue} disabled={!newValueName.trim()} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 sm:mr-0 mr-2" />
          <span className="sm:hidden">Add Value</span>
        </Button>
      </div>

      {/* Values list */}
      <div className="space-y-4">
        {values.map((value) => (
          <Card key={value.id}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-base font-semibold">{value.value_name}</Label>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Alignment Score</Label>
                      <span className="text-lg font-bold text-primary">
                        {value.alignment_score || 5}/10
                      </span>
                    </div>
                    <Slider
                      value={[value.alignment_score || 5]}
                      onValueChange={([score]) =>
                        updateValue(value.id, { alignment_score: score })
                      }
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Not aligned</span>
                      <span>Perfectly aligned</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`notes-${value.id}`} className="text-sm">
                      Notes
                    </Label>
                    <Textarea
                      id={`notes-${value.id}`}
                      value={value.notes || ""}
                      onChange={(e) => updateValue(value.id, { notes: e.target.value })}
                      placeholder="Why does this matter? How does the decision support or conflict with this value?"
                      rows={2}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteValue(value.id)}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {values.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No values added yet.</p>
            <p className="text-sm mt-1">
              Add your personal values to see how this decision aligns with what matters to you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
