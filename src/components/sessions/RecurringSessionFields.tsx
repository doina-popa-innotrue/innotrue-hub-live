import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Repeat } from "lucide-react";
import { RecurrencePattern } from "@/lib/recurringDates";

export interface RecurringSessionData {
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | string;
  recurrence_end_date: string;
  recurrence_end_type?: "count" | "date";
  recurrence_count?: number;
}

interface RecurringSessionFieldsProps {
  data: RecurringSessionData;
  onChange: (data: Partial<RecurringSessionData>) => void;
  maxRecurrenceLimit: number;
  showEndTypeToggle?: boolean;
}

/**
 * Reusable form fields for configuring recurring sessions.
 * Can be used in group sessions, module sessions, cohort sessions, etc.
 */
export function RecurringSessionFields({
  data,
  onChange,
  maxRecurrenceLimit,
  showEndTypeToggle = false,
}: RecurringSessionFieldsProps) {
  return (
    <div className="space-y-4 pt-2 border-t">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_recurring"
          checked={data.is_recurring}
          onCheckedChange={(checked) => onChange({ is_recurring: !!checked })}
        />
        <Label htmlFor="is_recurring" className="flex items-center gap-2 cursor-pointer">
          <Repeat className="h-4 w-4" />
          Make this a recurring session
        </Label>
      </div>

      {data.is_recurring && (
        <div className="grid grid-cols-2 gap-4 pl-6">
          <div className="space-y-2">
            <Label>Repeat</Label>
            <Select
              value={data.recurrence_pattern}
              onValueChange={(value) => onChange({ recurrence_pattern: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pattern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showEndTypeToggle && data.recurrence_end_type === "count" ? (
            <div className="space-y-2">
              <Label>Number of occurrences</Label>
              <Input
                type="number"
                min={2}
                max={maxRecurrenceLimit}
                value={data.recurrence_count || 4}
                onChange={(e) => onChange({ recurrence_count: parseInt(e.target.value) || 4 })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Until (optional)</Label>
              <Input
                type="date"
                value={data.recurrence_end_date}
                onChange={(e) => onChange({ recurrence_end_date: e.target.value })}
              />
            </div>
          )}

          {showEndTypeToggle && (
            <div className="col-span-2">
              <Select
                value={data.recurrence_end_type || "count"}
                onValueChange={(value: "count" | "date") =>
                  onChange({ recurrence_end_type: value })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">End after X occurrences</SelectItem>
                  <SelectItem value="date">End by date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="col-span-2 text-xs text-muted-foreground">
            Up to {maxRecurrenceLimit} sessions will be created automatically.
          </p>
        </div>
      )}
    </div>
  );
}
