import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UsersRound, ChevronRight } from "lucide-react";

interface GroupMembership {
  id: string;
  group_id: string;
  group_name: string;
  group_description: string | null;
  role: string;
}

interface MyGroupsSectionProps {
  groups: GroupMembership[];
}

export function MyGroupsSection({ groups }: MyGroupsSectionProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <UsersRound className="h-5 w-5" />
          My Groups
        </h2>
        <Button variant="ghost" size="sm" onClick={() => navigate("/groups")}>
          View All
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {groups.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={UsersRound}
              title="No active groups"
              description="You'll see your groups here once you're added to one"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.slice(0, 6).map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/groups/${group.group_id}`)}
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <UsersRound className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{group.group_name}</p>
                    {group.group_description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {group.group_description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs capitalize shrink-0">
                    {group.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
