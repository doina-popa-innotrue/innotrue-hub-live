import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Pencil, Trash2, Calendar, Award } from "lucide-react";
import { format } from "date-fns";

interface ExternalCourseCardProps {
  course: {
    id: string;
    title: string;
    provider: string;
    url?: string;
    status: string;
    planned_date?: string;
    due_date?: string;
    notes?: string;
    certificate_path?: string;
    certificate_name?: string;
  };
  onEdit: (course: any) => void;
  onDelete: (id: string) => void;
}

const statusColors = {
  planned: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
};

const statusLabels = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
};

export function ExternalCourseCard({ course, onEdit, onDelete }: ExternalCourseCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{course.title}</h3>
              {course.url && (
                <a
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{course.provider}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(course)} className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(course.id)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge className={statusColors[course.status as keyof typeof statusColors]}>
          {statusLabels[course.status as keyof typeof statusLabels]}
        </Badge>

        {(course.planned_date || course.due_date) && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {course.planned_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Start: {format(new Date(course.planned_date), "MMM d, yyyy")}</span>
              </div>
            )}
            {course.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Due: {format(new Date(course.due_date), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        )}

        {course.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2">{course.notes}</p>
        )}

        {course.certificate_path && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Award className="h-4 w-4" />
            <span>Certificate uploaded</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
