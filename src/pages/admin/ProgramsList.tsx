import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { Plus, Copy, Check, Upload, X, ImageIcon, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { validateFile, acceptStringForBucket } from "@/lib/fileValidation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProgramIdCell({ programId }: { programId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(programId);
    setCopied(true);
    toast.success("Program ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors max-w-[120px]"
          >
            <span className="truncate">{programId.slice(0, 8)}...</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Copy className="h-3 w-3 shrink-0" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-xs">
          <p>{programId}</p>
          <p className="text-muted-foreground mt-1">Click to copy</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface Program {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  moduleCount: number;
}

interface ProgramCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

export default function ProgramsList() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [scheduledDates, setScheduledDates] = useState<
    Array<{ id: string; date: string; title: string; capacity: number; enrolled_count: number }>
  >([]);
  const [creating, setCreating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Category management state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProgramCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ key: "", name: "", description: "" });

  // Fetch categories
  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: ["program-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as ProgramCategory[];
    },
  });

  async function fetchPrograms() {
    const { data: programsData } = await supabase
      .from("programs")
      .select("*")
      .order("created_at", { ascending: false });

    if (programsData) {
      const enriched = await Promise.all(
        programsData.map(async (program) => {
          const { count } = await supabase
            .from("program_modules")
            .select("id", { count: "exact", head: true })
            .eq("program_id", program.id);

          return { ...program, moduleCount: count || 0 };
        }),
      );

      setPrograms(enriched as Program[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchPrograms();
  }, []);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, "program-logos");
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const slug = name.toLowerCase().replace(/\s+/g, "-");

      const { data: newProgram, error } = await supabase
        .from("programs")
        .insert({
          slug,
          name,
          description,
          category: category as "cta" | "leadership" | "executive" | "ai" | "deep-dive",
          is_active: true,
          scheduled_dates: scheduledDates,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload logo if selected
      if (logoFile && newProgram) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${newProgram.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("program-logos")
          .upload(filePath, logoFile);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("program-logos").getPublicUrl(filePath);

          await supabase.from("programs").update({ logo_url: publicUrl }).eq("id", newProgram.id);
        }
      }

      toast.success("Program created successfully!");
      setOpen(false);
      setName("");
      setDescription("");
      setCategory("leadership");
      setScheduledDates([]);
      clearLogo();
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function cloneProgram(program: Program) {
    try {
      const newName = `Copy of ${program.name}`;
      const newSlug = newName.toLowerCase().replace(/\s+/g, "-");

      // Clone the program
      const { data: newProgram, error: programError } = await supabase
        .from("programs")
        .insert([
          {
            slug: newSlug,
            name: newName,
            description: program.description,
            category: program.category as "cta" | "leadership" | "executive" | "ai" | "deep-dive",
            is_active: program.is_active,
          },
        ])
        .select()
        .single();

      if (programError) throw programError;

      // Get all modules from the original program
      const { data: modules, error: modulesError } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", program.id)
        .order("order_index");

      if (modulesError) throw modulesError;

      // Clone all modules
      if (modules && modules.length > 0) {
        const newModules = modules.map((module) => ({
          program_id: newProgram.id,
          title: module.title,
          description: module.description,
          module_type: module.module_type,
          order_index: module.order_index,
          estimated_minutes: module.estimated_minutes,
          links: module.links,
        }));

        const { error: insertError } = await supabase.from("program_modules").insert(newModules);

        if (insertError) throw insertError;
      }

      toast.success(
        `Program cloned successfully! Created "${newName}" with ${modules?.length || 0} modules.`,
      );
      fetchPrograms();
    } catch (error: any) {
      toast.error(`Failed to clone program: ${error.message}`);
    }
  }

  async function toggleProgramActive(programId: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from("programs")
        .update({ is_active: !currentState })
        .eq("id", programId);

      if (error) throw error;

      toast.success(`Program ${!currentState ? "activated" : "deactivated"}`);
      fetchPrograms();
    } catch (error: any) {
      toast.error(`Failed to update program: ${error.message}`);
    }
  }

  async function handleSaveCategory() {
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("program_categories")
          .update({
            key: categoryForm.key,
            name: categoryForm.name,
            description: categoryForm.description || null,
          })
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast.success("Category updated");
      } else {
        const maxOrder = Math.max(...categories.map((c) => c.display_order), 0);
        const { error } = await supabase.from("program_categories").insert({
          key: categoryForm.key,
          name: categoryForm.name,
          description: categoryForm.description || null,
          display_order: maxOrder + 1,
        });
        if (error) throw error;
        toast.success("Category created");
      }
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ key: "", name: "", description: "" });
      refetchCategories();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm("Are you sure? Programs using this category will keep their current value."))
      return;
    try {
      const { error } = await supabase.from("program_categories").delete().eq("id", categoryId);
      if (error) throw error;
      toast.success("Category deleted");
      refetchCategories();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  function openCategoryDialog(cat?: ProgramCategory) {
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({ key: cat.key, name: cat.name, description: cat.description || "" });
    } else {
      setEditingCategory(null);
      setCategoryForm({ key: "", name: "", description: "" });
    }
    setCategoryDialogOpen(true);
  }

  const getCategoryName = (key: string) => {
    const cat = categories.find((c) => c.key === key);
    return cat?.name || key;
  };

  if (loading) return <PageLoadingState />;

  return (
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Programs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Tabs defaultValue="programs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="programs">
          <div className="mb-6 flex items-center justify-between">
            <div />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Program
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Program</DialogTitle>
                  <DialogDescription>Add a new training program to the system</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProgram} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Program Logo (Optional)</Label>
                    <div className="flex items-center gap-4">
                      {logoPreview ? (
                        <div className="relative">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="h-16 w-16 object-contain rounded-lg border"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                            onClick={clearLogo}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="h-16 w-16 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          <ImageIcon className="h-5 w-5" />
                          <span className="text-xs">Upload</span>
                        </button>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept={acceptStringForBucket("program-logos")}
                        className="hidden"
                        onChange={handleLogoSelect}
                      />
                      <p className="text-xs text-muted-foreground">Max 2MB, square recommended</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Program Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.key} value={cat.key}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Scheduled Class Dates (Optional)</Label>
                    <div className="space-y-2">
                      {scheduledDates.map((schedule, index) => (
                        <div key={schedule.id} className="flex gap-2">
                          <Input
                            type="date"
                            value={schedule.date}
                            onChange={(e) => {
                              const updated = [...scheduledDates];
                              updated[index].date = e.target.value;
                              setScheduledDates(updated);
                            }}
                          />
                          <Input
                            placeholder="Class title (e.g., Session 1)"
                            value={schedule.title}
                            onChange={(e) => {
                              const updated = [...scheduledDates];
                              updated[index].title = e.target.value;
                              setScheduledDates(updated);
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Capacity"
                            min="0"
                            value={schedule.capacity || 0}
                            onChange={(e) => {
                              const updated = [...scheduledDates];
                              updated[index].capacity = parseInt(e.target.value) || 0;
                              setScheduledDates(updated);
                            }}
                            className="w-32"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setScheduledDates(scheduledDates.filter((_, i) => i !== index));
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setScheduledDates([
                            ...scheduledDates,
                            {
                              id: crypto.randomUUID(),
                              date: "",
                              title: "",
                              capacity: 0,
                              enrolled_count: 0,
                            },
                          ]);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Scheduled Date
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" disabled={creating} className="w-full">
                    {creating ? "Creating..." : "Create Program"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Programs</CardTitle>
              <CardDescription>Manage programs and their modules</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Modules</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell>
                        <ProgramIdCell programId={program.id} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={program.logo_url || undefined} alt={program.name} />
                            <AvatarFallback className="text-xs">
                              {program.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{program.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryName(program.category)}</Badge>
                      </TableCell>
                      <TableCell>{program.moduleCount}</TableCell>
                      <TableCell>
                        <Badge variant={program.is_active ? "default" : "secondary"}>
                          {program.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={program.is_active}
                          onCheckedChange={() => toggleProgramActive(program.id, program.is_active)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/programs/${program.id}`)}
                          >
                            Manage
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cloneProgram(program)}
                            title="Clone program"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Program Categories</CardTitle>
                <CardDescription>Manage program categories</CardDescription>
              </div>
              <Button onClick={() => openCategoryDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                New Category
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-mono text-sm">{cat.key}</TableCell>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {cat.description || "—"}
                      </TableCell>
                      <TableCell>{cat.display_order}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCategoryDialog(cat)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Key (e.g., leadership)</Label>
              <Input
                value={categoryForm.key}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    key: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                  })
                }
                placeholder="leadership"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Leadership"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Category description"
              />
            </div>
            <Button onClick={handleSaveCategory} className="w-full">
              {editingCategory ? "Update" : "Create"} Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
