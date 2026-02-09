import { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Clock } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday', shortLabel: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
  { value: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
  { value: 'friday', label: 'Friday', shortLabel: 'Fri' },
  { value: 'saturday', label: 'Saturday', shortLabel: 'Sat' },
  { value: 'sunday', label: 'Sunday', shortLabel: 'Sun' },
];

// Generate 30-minute time slots
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = min.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Format time for display (12-hour format)
const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Legacy format (for migration)
interface LegacyMeetingTimePreference {
  day: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
}

// New format with time ranges
export interface TimeRange {
  start: string; // "HH:MM" format
  end: string;   // "HH:MM" format
}

export interface MeetingTimePreference {
  day: string;
  timeSlot?: string; // Legacy compatibility
  ranges?: TimeRange[];
}

// Convert legacy slot to time range
const legacySlotToRange = (slot: string): TimeRange => {
  switch (slot) {
    case 'morning':
      return { start: '06:00', end: '12:00' };
    case 'afternoon':
      return { start: '12:00', end: '17:00' };
    case 'evening':
      return { start: '17:00', end: '21:00' };
    default:
      return { start: '09:00', end: '17:00' };
  }
};

// Migrate legacy data to new format
const migratePreferences = (prefs: MeetingTimePreference[]): Map<string, TimeRange[]> => {
  const dayRanges = new Map<string, TimeRange[]>();
  
  for (const pref of prefs) {
    const existing = dayRanges.get(pref.day) || [];
    
    if (pref.ranges && pref.ranges.length > 0) {
      // Already new format
      existing.push(...pref.ranges);
    } else if (pref.timeSlot) {
      // Legacy format - convert
      existing.push(legacySlotToRange(pref.timeSlot));
    }
    
    dayRanges.set(pref.day, existing);
  }
  
  // Merge overlapping ranges for each day
  for (const [day, ranges] of dayRanges.entries()) {
    dayRanges.set(day, mergeOverlappingRanges(ranges));
  }
  
  return dayRanges;
};

// Merge overlapping time ranges
const mergeOverlappingRanges = (ranges: TimeRange[]): TimeRange[] => {
  if (ranges.length <= 1) return ranges;
  
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  const merged: TimeRange[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    
    if (current.start <= last.end) {
      // Overlapping - extend the end if necessary
      last.end = current.end > last.end ? current.end : last.end;
    } else {
      merged.push(current);
    }
  }
  
  return merged;
};

// Convert Map back to array format for storage
const mapToPreferences = (dayRanges: Map<string, TimeRange[]>): MeetingTimePreference[] => {
  const result: MeetingTimePreference[] = [];
  
  for (const [day, ranges] of dayRanges.entries()) {
    if (ranges.length > 0) {
      result.push({ day, ranges });
    }
  }
  
  return result;
};

interface MeetingTimesPreferenceProps {
  value: MeetingTimePreference[];
  onChange: (value: MeetingTimePreference[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function MeetingTimesPreference({ value, onChange, disabled, readOnly }: MeetingTimesPreferenceProps) {
  // Convert incoming value to Map for easier manipulation
  const dayRanges = migratePreferences(value);
  
  const [enabledDays, setEnabledDays] = useState<Set<string>>(() => {
    return new Set(dayRanges.keys());
  });

  const updateAndNotify = useCallback((newDayRanges: Map<string, TimeRange[]>) => {
    onChange(mapToPreferences(newDayRanges));
  }, [onChange]);

  const toggleDay = (day: string) => {
    if (disabled || readOnly) return;
    
    const newEnabled = new Set(enabledDays);
    const newDayRanges = new Map(dayRanges);
    
    if (newEnabled.has(day)) {
      newEnabled.delete(day);
      newDayRanges.delete(day);
    } else {
      newEnabled.add(day);
      // Add default range for new day
      newDayRanges.set(day, [{ start: '09:00', end: '17:00' }]);
    }
    
    setEnabledDays(newEnabled);
    updateAndNotify(newDayRanges);
  };

  const addRange = (day: string) => {
    if (disabled || readOnly) return;
    
    const newDayRanges = new Map(dayRanges);
    const existing = newDayRanges.get(day) || [];
    
    // Add a new range after the last one, or default
    const lastRange = existing[existing.length - 1];
    let newStart = '09:00';
    let newEnd = '17:00';
    
    if (lastRange) {
      // Start 1 hour after the last range ends
      const [hours] = lastRange.end.split(':').map(Number);
      const startHour = Math.min(hours + 1, 23);
      newStart = `${startHour.toString().padStart(2, '0')}:00`;
      newEnd = `${Math.min(startHour + 2, 23).toString().padStart(2, '0')}:00`;
    }
    
    existing.push({ start: newStart, end: newEnd });
    newDayRanges.set(day, existing);
    updateAndNotify(newDayRanges);
  };

  const removeRange = (day: string, index: number) => {
    if (disabled || readOnly) return;
    
    const newDayRanges = new Map(dayRanges);
    const existing = newDayRanges.get(day) || [];
    
    existing.splice(index, 1);
    
    if (existing.length === 0) {
      newDayRanges.delete(day);
      setEnabledDays(prev => {
        const newSet = new Set(prev);
        newSet.delete(day);
        return newSet;
      });
    } else {
      newDayRanges.set(day, existing);
    }
    
    updateAndNotify(newDayRanges);
  };

  const updateRange = (day: string, index: number, field: 'start' | 'end', value: string) => {
    if (disabled || readOnly) return;
    
    const newDayRanges = new Map(dayRanges);
    const existing = [...(newDayRanges.get(day) || [])];
    
    if (existing[index]) {
      existing[index] = { ...existing[index], [field]: value };
      
      // Ensure end is after start
      if (field === 'start' && existing[index].end <= value) {
        // Move end 2 hours after start
        const [hours, mins] = value.split(':').map(Number);
        const endHour = Math.min(hours + 2, 23);
        existing[index].end = `${endHour.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }
      
      newDayRanges.set(day, existing);
      updateAndNotify(newDayRanges);
    }
  };

  // Read-only display
  if (readOnly) {
    if (dayRanges.size === 0) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">No preferences set</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {DAYS_OF_WEEK.filter(day => dayRanges.has(day.value)).map(day => {
          const ranges = dayRanges.get(day.value) || [];
          return (
            <div key={day.value} className="flex items-start gap-2">
              <Badge variant="outline" className="min-w-[48px] justify-center">
                {day.shortLabel}
              </Badge>
              <div className="flex flex-wrap gap-1">
                {ranges.map((range, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatTime(range.start)} – {formatTime(range.end)}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Editable display
  return (
    <div className="space-y-4">
      <Label>Preferred Meeting Times</Label>
      <p className="text-sm text-muted-foreground">
        Toggle days when you're available and add time ranges
      </p>
      
      <div className="space-y-3">
        {DAYS_OF_WEEK.map(day => {
          const isEnabled = enabledDays.has(day.value);
          const ranges = dayRanges.get(day.value) || [];
          
          return (
            <div key={day.value} className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => toggleDay(day.value)}
                  disabled={disabled}
                />
                <span className="text-sm font-medium w-24">{day.label}</span>
                
                {isEnabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addRange(day.value)}
                    disabled={disabled}
                    className="h-7 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add time
                  </Button>
                )}
              </div>
              
              {isEnabled && ranges.length > 0 && (
                <div className="ml-12 space-y-2">
                  {ranges.map((range, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select
                        value={range.start}
                        onValueChange={(val) => updateRange(day.value, idx, 'start', val)}
                        disabled={disabled}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map(slot => (
                            <SelectItem key={slot} value={slot} className="text-xs">
                              {formatTime(slot)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <span className="text-muted-foreground text-sm">to</span>
                      
                      <Select
                        value={range.end}
                        onValueChange={(val) => updateRange(day.value, idx, 'end', val)}
                        disabled={disabled}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.filter(slot => slot > range.start).map(slot => (
                            <SelectItem key={slot} value={slot} className="text-xs">
                              {formatTime(slot)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRange(day.value, idx)}
                        disabled={disabled}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
