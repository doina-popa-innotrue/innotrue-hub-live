import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronRight } from "lucide-react";
import { ExternalCourseCard } from "@/components/programs/ExternalCourseCard";
import { ExternalCourseForm } from "@/components/programs/ExternalCourseForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { FeatureGate } from "@/components/FeatureGate";

interface ExternalCourse {
  id: string;
  title: string;
  provider: string;
  status: string;
  url?: string | null;
  planned_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  certificate_path?: string | null;
  certificate_name?: string | null;
}

export default function ExternalCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<ExternalCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<ExternalCourse | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<ExternalCourse | null>(null);

  useEffect(() => {
    if (!user) return;
    loadCourses();
  }, [user]);

  const loadCourses = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("external_courses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error loading courses:", error);
      toast({ title: "Failed to load courses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCourse(null);
    setIsFormOpen(true);
  };

  const handleEdit = (course: ExternalCourse) => {
    setEditingCourse(course);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingCourse) return;

    try {
      // Delete certificate from storage if exists
      if (deletingCourse.certificate_path) {
        await supabase.storage
          .from("external-course-certificates")
          .remove([deletingCourse.certificate_path]);
      }

      const { error } = await supabase
        .from("external_courses")
        .delete()
        .eq("id", deletingCourse.id);

      if (error) throw error;

      toast({ title: "Course deleted successfully" });
      loadCourses();
    } catch (error) {
      console.error("Error deleting course:", error);
      toast({ title: "Failed to delete course", variant: "destructive" });
    } finally {
      setDeletingCourse(null);
    }
  };

  const handleSubmit = async (data: any) => {
    if (!user) return;

    try {
      if (editingCourse) {
        const { error } = await supabase
          .from("external_courses")
          .update(data)
          .eq("id", editingCourse.id);

        if (error) throw error;
        toast({ title: "Course updated successfully" });
      } else {
        const { error } = await supabase
          .from("external_courses")
          .insert({ ...data, user_id: user.id });

        if (error) throw error;
        toast({ title: "Course added successfully" });
      }

      setIsFormOpen(false);
      loadCourses();
    } catch (error) {
      console.error("Error saving course:", error);
      toast({ title: "Failed to save course", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading external courses...</div>
      </div>
    );
  }

  return (
    <FeatureGate featureKey="external_courses">
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate("/programs")} className="cursor-pointer">
              My Programs
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>External Courses</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">External Courses</h1>
          <p className="text-muted-foreground">
            Track courses from other platforms like Coursera, Udemy, LinkedIn Learning, and more
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add External Course
        </Button>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No External Courses Yet</CardTitle>
            <CardDescription>
              Start tracking your learning from other platforms by adding your first external course
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <ExternalCourseCard
              key={course.id}
              course={course}
              onEdit={handleEdit}
              onDelete={(id) => {
                const courseToDelete = courses.find(c => c.id === id);
                if (courseToDelete) setDeletingCourse(courseToDelete);
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Edit" : "Add"} External Course</DialogTitle>
            <DialogDescription>
              {editingCourse ? "Update" : "Add"} details about a course you're taking on another platform
            </DialogDescription>
          </DialogHeader>
          {user && (
            <ExternalCourseForm
              initialData={editingCourse || undefined}
              userId={user.id}
              onSubmit={handleSubmit}
              onCancel={() => setIsFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCourse} onOpenChange={() => setDeletingCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete External Course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingCourse?.title}" from your external courses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </FeatureGate>
  );
}
