import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileQuestion, FolderTree, ArrowRight } from "lucide-react";

interface Props {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  templateCount: number;
  onClick: () => void;
}

export function FamilyCard({ name, description, questionCount, templateCount, onClick }: Props) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {description || "Start this guided path to achieve your goals"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileQuestion className="h-4 w-4" />
            {questionCount} question{questionCount !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-1">
            <FolderTree className="h-4 w-4" />
            {templateCount} template{templateCount !== 1 ? "s" : ""}
          </div>
        </div>
        <Button onClick={onClick} className="w-full">
          Start Path
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
