import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ScheduledDate {
  id: string;
  date: string;
  title: string;
  capacity: number;
  enrolled_count: number;
}

interface ScheduledDatesManagerProps {
  scheduledDates: ScheduledDate[];
  onChange: (dates: ScheduledDate[]) => void;
}

export function ScheduledDatesManager({ scheduledDates, onChange }: ScheduledDatesManagerProps) {
  const addSchedule = () => {
    onChange([
      ...scheduledDates,
      {
        id: crypto.randomUUID(),
        date: '',
        title: '',
        capacity: 0,
        enrolled_count: 0,
      },
    ]);
  };

  const updateSchedule = (index: number, field: keyof ScheduledDate, value: any) => {
    const updated = [...scheduledDates];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeSchedule = (index: number) => {
    onChange(scheduledDates.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Scheduled Class Dates</Label>
        <Button type="button" variant="outline" size="sm" onClick={addSchedule}>
          <Plus className="mr-2 h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      <div className="space-y-3">
        {scheduledDates.map((schedule, index) => (
          <Card key={schedule.id}>
            <CardContent className="pt-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-1">
                  <Label htmlFor={`date-${index}`}>Date</Label>
                  <Input
                    id={`date-${index}`}
                    type="date"
                    value={schedule.date}
                    onChange={(e) => updateSchedule(index, 'date', e.target.value)}
                  />
                </div>

                <div className="md:col-span-1">
                  <Label htmlFor={`title-${index}`}>Class Title</Label>
                  <Input
                    id={`title-${index}`}
                    placeholder="e.g., Session 1"
                    value={schedule.title}
                    onChange={(e) => updateSchedule(index, 'title', e.target.value)}
                  />
                </div>

                <div className="md:col-span-1">
                  <Label htmlFor={`capacity-${index}`}>Max Capacity</Label>
                  <Input
                    id={`capacity-${index}`}
                    type="number"
                    min="0"
                    value={schedule.capacity}
                    onChange={(e) => updateSchedule(index, 'capacity', parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="md:col-span-1 flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Enrolled</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {schedule.enrolled_count || 0} / {schedule.capacity || 0}
                      </span>
                      {schedule.capacity > 0 && schedule.enrolled_count >= schedule.capacity && (
                        <Badge variant="destructive" className="text-xs">Full</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeSchedule(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {scheduledDates.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No scheduled dates. Click "Add Schedule" to create one.
          </div>
        )}
      </div>
    </div>
  );
}