import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FAQSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
}

export function FAQSearch({
  searchQuery,
  onSearchChange,
  placeholder = "Search FAQ...",
  resultCount,
  totalCount,
}: FAQSearchProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {searchQuery && resultCount !== undefined && totalCount !== undefined && (
        <p className="text-sm text-muted-foreground">
          Showing {resultCount} of {totalCount} questions matching "{searchQuery}"
        </p>
      )}
    </div>
  );
}
