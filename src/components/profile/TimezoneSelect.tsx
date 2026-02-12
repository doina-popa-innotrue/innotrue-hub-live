import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Common timezones
const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris, Berlin, Rome, Madrid" },
  { value: "Europe/Athens", label: "Athens, Helsinki, Istanbul" },
  { value: "Europe/Moscow", label: "Moscow" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "Mumbai, New Delhi" },
  { value: "Asia/Bangkok", label: "Bangkok, Hanoi, Jakarta" },
  { value: "Asia/Hong_Kong", label: "Hong Kong, Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo, Seoul" },
  { value: "Australia/Sydney", label: "Sydney, Melbourne" },
  { value: "Pacific/Auckland", label: "Auckland" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Africa/Cairo", label: "Cairo" },
];

interface TimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimezoneSelect({ value, onChange, disabled }: TimezoneSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="timezone">Timezone</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="timezone">
          <SelectValue placeholder="Select your timezone" />
        </SelectTrigger>
        <SelectContent>
          {TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
