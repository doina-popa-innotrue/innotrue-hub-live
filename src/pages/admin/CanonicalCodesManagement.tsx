import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Search, Copy, Check, BookOpen, Package } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CanonicalCodeEntry {
  canonicalCode: string;
  modules: {
    id: string;
    title: string;
    programId: string;
    programName: string;
    moduleType: string;
    talentLmsCourseId: string | null;
  }[];
}

interface ContentPackageEntry {
  packageId: string;
  packageTitle: string;
  packageType: string;
  modules: {
    id: string;
    title: string;
    programId: string;
    programName: string;
    moduleType: string;
  }[];
}

interface Program {
  id: string;
  name: string;
}

export default function CanonicalCodesManagement() {
  const [entries, setEntries] = useState<CanonicalCodeEntry[]>([]);
  const [contentPackageEntries, setContentPackageEntries] = useState<ContentPackageEntry[]>([]);
  const [allModules, setAllModules] = useState<any[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all modules with their programs and content_package_id
      const { data: modulesData, error: modulesError } = await supabase
        .from("program_modules")
        .select(
          `
          id,
          title,
          canonical_code,
          module_type,
          links,
          program_id,
          content_package_id,
          programs!inner (
            id,
            name
          )
        `,
        )
        .eq("is_active", true)
        .order("title");

      if (modulesError) throw modulesError;

      // Fetch all programs for filter
      const { data: programsData } = await supabase
        .from("programs")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setPrograms(programsData || []);
      setAllModules(modulesData || []);

      // Group by canonical_code
      const codeMap = new Map<string, CanonicalCodeEntry["modules"]>();

      for (const module of modulesData || []) {
        const code = module.canonical_code;
        if (code) {
          // Extract TalentLMS course ID if present
          const links = module.links as Array<{ type: string; url: string }> | null;
          const talentLmsLink = links?.find((l) => l.type === "talentlms");
          const match = talentLmsLink?.url.match(/id:(\d+)/);
          const talentLmsCourseId = match?.[1] || null;

          const entry = {
            id: module.id,
            title: module.title,
            programId: module.programs.id,
            programName: module.programs.name,
            moduleType: module.module_type,
            talentLmsCourseId,
          };

          if (!codeMap.has(code)) {
            codeMap.set(code, []);
          }
          codeMap.get(code)!.push(entry);
        }
      }

      // Convert to array and sort by code
      const entriesArray: CanonicalCodeEntry[] = Array.from(codeMap.entries())
        .map(([code, modules]) => ({
          canonicalCode: code,
          modules: modules.sort((a, b) => a.programName.localeCompare(b.programName)),
        }))
        .sort((a, b) => a.canonicalCode.localeCompare(b.canonicalCode));

      setEntries(entriesArray);

      // ── CT3: Group by content_package_id ──
      const cpIds = [
        ...new Set(
          (modulesData || [])
            .map((m: any) => m.content_package_id)
            .filter(Boolean) as string[],
        ),
      ];

      if (cpIds.length > 0) {
        // Fetch content package details
        const { data: packagesData } = await supabase
          .from("content_packages")
          .select("id, title, package_type")
          .in("id", cpIds);

        const packagesById = new Map(
          (packagesData || []).map((p: any) => [p.id, p]),
        );

        const cpMap = new Map<string, ContentPackageEntry>();

        for (const module of modulesData || []) {
          const cpId = module.content_package_id;
          if (!cpId) continue;

          const pkg = packagesById.get(cpId);
          if (!pkg) continue;

          if (!cpMap.has(cpId)) {
            cpMap.set(cpId, {
              packageId: cpId,
              packageTitle: pkg.title,
              packageType: pkg.package_type,
              modules: [],
            });
          }

          cpMap.get(cpId)!.modules.push({
            id: module.id,
            title: module.title,
            programId: module.programs.id,
            programName: module.programs.name,
            moduleType: module.module_type,
          });
        }

        // Only show packages used by 2+ modules (shared across programs)
        const cpEntries = Array.from(cpMap.values())
          .sort((a, b) => a.packageTitle.localeCompare(b.packageTitle));

        setContentPackageEntries(cpEntries);
      }
    } catch (error) {
      console.error("Error fetching canonical codes:", error);
      toast.error("Failed to load canonical codes");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.canonicalCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.modules.some(
        (m) =>
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.programName.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesProgram =
      programFilter === "all" || entry.modules.some((m) => m.programId === programFilter);

    return matchesSearch && matchesProgram;
  });

  // Get unlinked modules (modules without canonical codes)
  const unlinkedModules = allModules.filter((m) => !m.canonical_code);
  const filteredUnlinkedModules = unlinkedModules.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.programs.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProgram = programFilter === "all" || m.program_id === programFilter;

    return matchesSearch && matchesProgram;
  });

  // Filter content package entries
  const filteredContentPackageEntries = contentPackageEntries.filter((entry) => {
    const matchesSearch =
      entry.packageTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.modules.some(
        (m) =>
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.programName.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesProgram =
      programFilter === "all" || entry.modules.some((m) => m.programId === programFilter);

    return matchesSearch && matchesProgram;
  });

  // Count shared packages (used in 2+ programs)
  const sharedPackageCount = contentPackageEntries.filter((e) => {
    const uniquePrograms = new Set(e.modules.map((m) => m.programId));
    return uniquePrograms.size > 1;
  }).length;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Cross-Program Linking</h1>
          <p className="text-muted-foreground">
            View module linkages and shared content across programs
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Canonical Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Linked Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {entries.reduce((sum, e) => sum + e.modules.length, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Shared Content Packages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sharedPackageCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unlinked Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unlinkedModules.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search codes, modules, packages, or programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {program.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Content — Tabs */}
      <Tabs defaultValue="canonical-codes" className="w-full">
        <TabsList>
          <TabsTrigger value="canonical-codes" className="gap-2">
            <Link2 className="h-4 w-4" />
            Canonical Codes
          </TabsTrigger>
          <TabsTrigger value="content-packages" className="gap-2">
            <Package className="h-4 w-4" />
            Content Packages
          </TabsTrigger>
          <TabsTrigger value="unlinked" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Unlinked
          </TabsTrigger>
        </TabsList>

        {/* Canonical Codes Tab */}
        <TabsContent value="canonical-codes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Linked Modules by Canonical Code
              </CardTitle>
              <CardDescription>
                Modules with the same canonical code are treated as equivalent for cross-program
                completion tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery || programFilter !== "all"
                    ? "No canonical codes match your filters"
                    : "No canonical codes have been assigned yet"}
                </p>
              ) : (
                <div className="space-y-6">
                  {filteredEntries.map((entry) => (
                    <div key={entry.canonicalCode} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {entry.canonicalCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(entry.canonicalCode)}
                          >
                            {copiedCode === entry.canonicalCode ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <Badge variant="secondary">
                          {entry.modules.length} module{entry.modules.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Module</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>TalentLMS ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entry.modules.map((module) => (
                            <TableRow key={module.id}>
                              <TableCell className="font-medium">{module.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{module.moduleType}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {module.programName}
                              </TableCell>
                              <TableCell>
                                {module.talentLmsCourseId ? (
                                  <code className="bg-muted px-1 rounded text-xs">
                                    {module.talentLmsCourseId}
                                  </code>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Packages Tab */}
        <TabsContent value="content-packages" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Shared Content Packages
              </CardTitle>
              <CardDescription>
                Content packages assigned to modules across programs. Completing content in one
                program auto-completes it in others.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredContentPackageEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery || programFilter !== "all"
                    ? "No content packages match your filters"
                    : "No content packages have been assigned to modules yet"}
                </p>
              ) : (
                <div className="space-y-6">
                  {filteredContentPackageEntries.map((entry) => {
                    const uniquePrograms = new Set(entry.modules.map((m) => m.programId));
                    return (
                      <div key={entry.packageId} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{entry.packageTitle}</span>
                            <Badge
                              variant={entry.packageType === "xapi" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {entry.packageType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {uniquePrograms.size > 1 && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                Shared across {uniquePrograms.size} programs
                              </Badge>
                            )}
                            <Badge variant="secondary">
                              {entry.modules.length} module{entry.modules.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Module</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Program</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.modules.map((module) => (
                              <TableRow key={module.id}>
                                <TableCell className="font-medium">{module.title}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{module.moduleType}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {module.programName}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unlinked Modules Tab */}
        <TabsContent value="unlinked" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Modules Without Canonical Codes
              </CardTitle>
              <CardDescription>
                These modules are not linked to any other modules across programs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredUnlinkedModules.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery || programFilter !== "all"
                    ? "No unlinked modules match your filters"
                    : "All modules have canonical codes assigned!"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Program</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnlinkedModules.map((module) => (
                      <TableRow key={module.id}>
                        <TableCell className="font-medium">{module.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{module.module_type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {module.programs.name}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
