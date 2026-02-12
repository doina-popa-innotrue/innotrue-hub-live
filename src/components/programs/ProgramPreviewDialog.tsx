import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, GraduationCap, User, Layers, CheckCircle, Percent } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Module {
  id: string;
  title: string;
  module_type: string;
  estimated_minutes: number | null;
  description: string | null;
  tier_required: string | null;
}

interface Skill {
  name: string;
  category: string | null;
}

interface Instructor {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface CrossProgramModule {
  moduleId: string;
  moduleTitle: string;
  completedInProgram: string;
  completedAt: string | null;
  completionSource: "internal" | "talentlms";
}

interface ProgramPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: {
    id: string;
    name: string;
    description: string;
    category: string;
    tiers?: string[];
  } | null;
  modules: Module[];
  skills: Skill[];
  instructors: Instructor[];
  coaches: Instructor[];
  crossCompletions?: {
    totalModules: number;
    completedElsewhere: CrossProgramModule[];
    suggestedDiscountPercent: number;
  };
}

export function ProgramPreviewDialog({
  open,
  onOpenChange,
  program,
  modules,
  skills,
  instructors,
  coaches,
  crossCompletions,
}: ProgramPreviewDialogProps) {
  if (!program) return null;

  const totalMinutes = modules.reduce((sum, m) => sum + (m.estimated_minutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const programTiers = program.tiers || [];

  const completedModuleIds = new Set(
    crossCompletions?.completedElsewhere.map((c) => c.moduleId) || [],
  );
  const getCompletionInfo = (moduleId: string) =>
    crossCompletions?.completedElsewhere.find((c) => c.moduleId === moduleId);

  const getModuleTypeColor = (type: string) => {
    switch (type) {
      case "session":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "assignment":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "reflection":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "resource":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTierColor = (tier: string) => {
    const lowerTier = tier.toLowerCase();
    const tierIndex = programTiers.findIndex((t) => t.toLowerCase() === lowerTier);
    if (tierIndex === 0) return "bg-primary/10 text-primary border-primary/20";
    if (tierIndex === 1) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-purple-500/10 text-purple-600 border-purple-500/20";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{program.name}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
          <div className="space-y-6">
            {/* Cross-Completion Banner */}
            {crossCompletions && crossCompletions.completedElsewhere.length > 0 && (
              <Alert className="border-green-500/30 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-700 dark:text-green-400">
                  You've Already Completed Some Content!
                </AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-300">
                  <p className="mb-2">
                    {crossCompletions.completedElsewhere.length} of {crossCompletions.totalModules}{" "}
                    modules have been completed in other programs.
                  </p>
                  {crossCompletions.suggestedDiscountPercent > 0 && (
                    <p className="flex items-center gap-2 font-medium">
                      <Percent className="h-4 w-4" />
                      Suggested discount: {crossCompletions.suggestedDiscountPercent}% based on
                      prior learning
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Description */}
            <div className="text-muted-foreground">
              <RichTextDisplay content={program.description} />
            </div>

            {/* Estimated Time */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                Estimated Time: {totalHours > 0 && `${totalHours}h `}
                {remainingMinutes > 0 && `${remainingMinutes}m`}
              </span>
            </div>

            {/* Available Tiers */}
            {programTiers.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Available Tiers
                </h3>
                <div className="flex flex-wrap gap-2">
                  {programTiers.map((tier, index) => (
                    <Badge key={index} variant="outline" className={getTierColor(tier)}>
                      {tier}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Covered */}
            {skills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Skills You'll Gain
                </h3>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Instructors and Coaches */}
            {(instructors.length > 0 || coaches.length > 0) && (
              <div className="space-y-4">
                {instructors.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Instructors
                    </h3>
                    <div className="space-y-2">
                      {instructors.map((instructor) => (
                        <div key={instructor.id} className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {instructor.avatar_url ? (
                              <img
                                src={instructor.avatar_url}
                                alt={instructor.name}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <User className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <span>{instructor.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {coaches.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Coaches
                    </h3>
                    <div className="space-y-2">
                      {coaches.map((coach) => (
                        <div key={coach.id} className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {coach.avatar_url ? (
                              <img
                                src={coach.avatar_url}
                                alt={coach.name}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <User className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <span>{coach.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Module List */}
            <div>
              <h3 className="font-semibold mb-3">
                Program Curriculum ({modules.length} modules)
                {crossCompletions && crossCompletions.completedElsewhere.length > 0 && (
                  <span className="text-sm font-normal text-green-600 dark:text-green-400 ml-2">
                    ({crossCompletions.completedElsewhere.length} completed elsewhere)
                  </span>
                )}
              </h3>
              <div className="space-y-3">
                <TooltipProvider>
                  {modules.map((module, index) => {
                    const isCompleted = completedModuleIds.has(module.id);
                    const completionInfo = getCompletionInfo(module.id);

                    return (
                      <div
                        key={module.id}
                        className={`border rounded-lg p-4 transition-colors ${
                          isCompleted
                            ? "border-green-500/30 bg-green-500/5"
                            : "hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-medium text-muted-foreground">
                                Module {index + 1}
                              </span>
                              <Badge className={getModuleTypeColor(module.module_type)}>
                                {module.module_type}
                              </Badge>
                              {module.tier_required && (
                                <Badge
                                  variant="outline"
                                  className={getTierColor(module.tier_required)}
                                >
                                  {module.tier_required}
                                </Badge>
                              )}
                              {isCompleted && completionInfo && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 cursor-help"
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Completed
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Completed in: {completionInfo.completedInProgram}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <h4 className="font-medium mb-1">{module.title}</h4>
                            {module.description && (
                              <div className="text-sm text-muted-foreground line-clamp-2">
                                <RichTextDisplay content={module.description} />
                              </div>
                            )}
                          </div>
                          {module.estimated_minutes && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap">
                              <Clock className="h-3 w-3" />
                              <span>{module.estimated_minutes}m</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </TooltipProvider>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
