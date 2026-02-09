import { useState } from 'react';
import { useAdminCRUD } from '@/hooks/useAdminCRUD';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Sparkles, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from '@/components/admin';
import { useSkillCategories, useSkillCategoryLookup } from '@/hooks/useSkillCategories';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null; // Legacy field - keep for backwards compat
  category_id: string | null;
  created_at: string;
}

type FormData = {
  name: string;
  description: string;
  category_id: string;
};

const initialFormData: FormData = { name: '', description: '', category_id: '' };

export default function SkillsManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const { data: skillCategories = [], isLoading: categoriesLoading } = useSkillCategories({ activeOnly: false });
  const { lookup: categoryLookup } = useSkillCategoryLookup();

  const {
    data: skills = [],
    isLoading,
    formData,
    setFormData,
    editingItem,
    isDialogOpen,
    setIsDialogOpen,
    openCreate,
    openEdit,
    handleSubmit,
    handleDelete,
    isSubmitting,
  } = useAdminCRUD<Skill, FormData>({
    tableName: 'skills',
    queryKey: 'skills',
    entityName: 'Skill',
    orderBy: 'name',
    initialFormData,
    mapItemToForm: (skill) => ({
      name: skill.name,
      description: skill.description || '',
      category_id: skill.category_id || '',
    }),
  });

  const getCategoryName = (skill: Skill) => {
    if (skill.category_id && categoryLookup[skill.category_id]) {
      return categoryLookup[skill.category_id].name;
    }
    return skill.category || 'Uncategorized'; // Fallback to legacy field
  };

  const filteredSkills = skills.filter(skill => {
    const categoryName = getCategoryName(skill);
    return (
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (skill.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  // Group skills by category
  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    const categoryName = getCategoryName(skill);
    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const categoryNames = Object.keys(skillsByCategory).sort();

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Strategic Thinking"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={categoryPopoverOpen}
              className="w-full justify-between font-normal"
            >
              {formData.category_id && categoryLookup[formData.category_id]
                ? categoryLookup[formData.category_id].name
                : "Select a category..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search categories..." />
              <CommandList>
                <CommandEmpty>No category found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => {
                      setFormData({ ...formData, category_id: '' });
                      setCategoryPopoverOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !formData.category_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Uncategorized
                  </CommandItem>
                  {skillCategories.map((cat) => (
                    <CommandItem
                      key={cat.id}
                      value={cat.name}
                      onSelect={() => {
                        setFormData({ ...formData, category_id: cat.id });
                        setCategoryPopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          formData.category_id === cat.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex items-center gap-2">
                        {cat.color && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        {cat.name}
                        {!cat.is_active && (
                          <Badge variant="secondary" className="text-xs ml-1">inactive</Badge>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Manage categories in Programs → Skill Categories.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this skill..."
          rows={3}
        />
      </div>
      <AdminFormActions
        isEditing={!!editingItem}
        isSubmitting={isSubmitting}
        onCancel={() => setIsDialogOpen(false)}
      />
    </form>
  );

  if (isLoading || categoriesLoading) {
    return <AdminLoadingState />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Skills Management"
        description="Define skills that can be awarded to users upon module completion"
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={setIsDialogOpen}
        dialogTitle={editingItem ? 'Edit Skill' : 'Add New Skill'}
        dialogContent={formContent}
        createButtonLabel="Add Skill"
        actions={<Sparkles className="h-8 w-8 text-primary" />}
      />

      <Card>
        <CardHeader>
          <CardTitle>All Skills ({skills.length})</CardTitle>
          <CardDescription>
            Skills are awarded to users when they complete modules that have skills assigned.
          </CardDescription>
          <div className="pt-2">
            <Input
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {categoryNames.length === 0 ? (
            <AdminEmptyState
              icon={Sparkles}
              title="No skills defined yet"
              description="Click 'Add Skill' to create your first skill."
              actionLabel="Add Skill"
              onAction={openCreate}
            />
          ) : (
            <div className="space-y-6">
              {categoryNames.map((category) => (
                <div key={category}>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Badge variant="outline">{category}</Badge>
                    <span className="text-muted-foreground text-sm font-normal">
                      ({skillsByCategory[category].length} skills)
                    </span>
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skillsByCategory[category].map((skill) => (
                        <TableRow key={skill.id}>
                          <TableCell className="font-medium">{skill.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {skill.description || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(skill)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{skill.name}"? This will also remove it from any modules and users who have acquired it.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(skill.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
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
    </div>
  );
}
