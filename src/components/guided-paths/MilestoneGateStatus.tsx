import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MilestoneGate, GateStatus } from "@/hooks/useMilestoneGates";

interface GateStatusResult {
  gateId: string;
  status: GateStatus;
  currentScore: number | null;
  override: { reason: string } | null;
}

interface Props {
  gates: MilestoneGate[];
  statuses: GateStatusResult[];
}

const STATUS_CONFIG: Record<
  GateStatus,
  { emoji: string; color: string; label: string }
> = {
  met: {
    emoji: "🟢",
    color: "bg-green-100 text-green-700 border-green-200",
    label: "Met",
  },
  close: {
    emoji: "🟡",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    label: "Close",
  },
  unmet: {
    emoji: "🔴",
    color: "bg-red-100 text-red-700 border-red-200",
    label: "Not met",
  },
  unknown: {
    emoji: "⚪",
    color: "bg-muted text-muted-foreground",
    label: "No data",
  },
  overridden: {
    emoji: "🟢",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    label: "Waived",
  },
};

/**
 * Renders traffic-light gate indicators for a milestone.
 * Gates are advisory — coaching is human-judgment-based.
 */
export function MilestoneGateStatus({ gates, statuses }: Props) {
  if (gates.length === 0) return null;

  const statusMap = new Map(statuses.map((s) => [s.gateId, s]));

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1.5">
        {gates.map((gate) => {
          const status = statusMap.get(gate.id);
          const gateStatus: GateStatus = status?.status || "unknown";
          const config = STATUS_CONFIG[gateStatus];

          const tooltipContent = buildTooltip(gate, status);

          return (
            <Tooltip key={gate.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`text-xs cursor-help ${config.color}`}
                >
                  <span className="mr-1">{config.emoji}</span>
                  {gate.gate_label || gate.domain_name || gate.dimension_name || "Gate"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{tooltipContent}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function buildTooltip(
  gate: MilestoneGate,
  status: GateStatusResult | undefined,
): string {
  const label = gate.gate_label || gate.domain_name || gate.dimension_name || "Gate";
  const minStr = `Min: ${gate.min_score}`;

  if (!status || status.status === "unknown") {
    return `${label} — ${minStr}. No assessment data yet.`;
  }

  if (status.status === "overridden") {
    return `${label} — Waived. ${status.override?.reason || ""}`;
  }

  const currentStr =
    status.currentScore != null ? `Current: ${status.currentScore.toFixed(1)}` : "";

  return `${label} — ${minStr}. ${currentStr}. Advisory only.`;
}
