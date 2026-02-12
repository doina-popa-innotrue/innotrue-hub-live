import { useState, type FC, type SVGProps } from "react";
import {
  Rocket,
  MessageCircle,
  Clock,
  Wrench,
  Sparkles,
  Bell,
  Star,
  Heart,
  Zap,
  Gift,
  Calendar,
  CheckCircle,
  AlertCircle,
  Info,
  HelpCircle,
  Megaphone,
  PartyPopper,
  Trophy,
  Target,
  Flag,
  Lightbulb,
  BookOpen,
  GraduationCap,
  Users,
  Building,
  Mail,
  Send,
  Bookmark,
  Award,
  Crown,
  Flame,
  TrendingUp,
  BarChart,
  PieChart,
  Activity,
  Globe,
  Lock,
  Unlock,
  Shield,
  Key,
  Plus,
  Minus,
  X,
  Check,
  ArrowRight,
  RefreshCw,
  Settings,
  Cog,
  Wrench as ToolIcon,
  Hammer,
  Newspaper,
  type LucideProps,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type IconComponent = FC<LucideProps>;

// Icon map for dynamic rendering
const iconMap: Record<string, IconComponent> = {
  Rocket,
  MessageCircle,
  Clock,
  Wrench,
  Sparkles,
  Bell,
  Star,
  Heart,
  Zap,
  Gift,
  Calendar,
  CheckCircle,
  AlertCircle,
  Info,
  HelpCircle,
  Megaphone,
  PartyPopper,
  Trophy,
  Target,
  Flag,
  Lightbulb,
  BookOpen,
  GraduationCap,
  Users,
  Building,
  Mail,
  Send,
  Bookmark,
  Award,
  Crown,
  Flame,
  TrendingUp,
  BarChart,
  PieChart,
  Activity,
  Globe,
  Lock,
  Unlock,
  Shield,
  Key,
  Plus,
  Minus,
  X,
  Check,
  ArrowRight,
  RefreshCw,
  Settings,
  Cog,
  Tool: ToolIcon,
  Hammer,
  Newspaper,
};

const commonIcons = Object.keys(iconMap);

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
  allowClear?: boolean;
  clearLabel?: string;
}

export function IconPicker({
  value,
  onChange,
  label = "Icon",
  allowClear = false,
  clearLabel = "Use default",
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = search
    ? commonIcons.filter((icon) => icon.toLowerCase().includes(search.toLowerCase()))
    : commonIcons;

  const IconComponent = value ? iconMap[value] : null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start gap-2"
          >
            {IconComponent ? (
              <>
                <IconComponent className="h-4 w-4" />
                <span>{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select an icon...</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b space-y-2">
            <Input
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
            {allowClear && value && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setSearch("");
                }}
              >
                <X className="h-4 w-4 mr-2" />
                {clearLabel}
              </Button>
            )}
          </div>
          <ScrollArea className="h-64">
            <div className="grid grid-cols-6 gap-1 p-2">
              {filteredIcons.map((iconName) => {
                const Icon = iconMap[iconName];
                if (!Icon) return null;

                return (
                  <Button
                    key={iconName}
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-10 w-10",
                      value === iconName && "bg-primary text-primary-foreground",
                    )}
                    onClick={() => {
                      onChange(iconName);
                      setOpen(false);
                      setSearch("");
                    }}
                    title={iconName}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                );
              })}
            </div>
            {filteredIcons.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">No icons found</div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Helper to render an icon by name
export function DynamicIcon({ name, className = "" }: { name: string; className?: string }) {
  const Icon = iconMap[name];
  if (!Icon) return <Info className={className} />;
  return <Icon className={className} />;
}
