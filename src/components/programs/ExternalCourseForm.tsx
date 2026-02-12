import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { CalendarIcon, Upload, X, Eye, EyeOff, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  provider: z.string().min(1, "Provider is required").max(100),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  status: z.enum(["planned", "in_progress", "completed"]),
  planned_date: z.date().optional(),
  due_date: z.date().optional(),
  notes: z.string().max(1000).optional(),
  is_private: z.boolean().default(false),
  is_public: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface ExternalCourseFormProps {
  initialData?: {
    id?: string;
    title: string;
    provider: string;
    url?: string;
    status: string;
    planned_date?: string;
    due_date?: string;
    notes?: string;
    certificate_path?: string;
    certificate_name?: string;
    is_private?: boolean;
    is_public?: boolean;
  };
  userId: string;
  onSubmit: (
    data: FormValues & {
      id?: string;
      certificate_path?: string;
      certificate_name?: string;
    },
  ) => Promise<void>;
  onCancel: () => void;
}

export function ExternalCourseForm({
  initialData,
  userId,
  onSubmit,
  onCancel,
}: ExternalCourseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePreview, setCertificatePreview] = useState<string | null>(
    initialData?.certificate_path || null,
  );
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      provider: initialData?.provider || "",
      url: initialData?.url || "",
      status: (initialData?.status as "planned" | "in_progress" | "completed") || "planned",
      planned_date: initialData?.planned_date ? new Date(initialData.planned_date) : undefined,
      due_date: initialData?.due_date ? new Date(initialData.due_date) : undefined,
      notes: initialData?.notes || "",
      is_private: initialData?.is_private ?? false,
      is_public: initialData?.is_public ?? false,
    },
  });

  const handleCertificateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a PDF or image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setCertificateFile(file);
    setCertificatePreview(URL.createObjectURL(file));
  };

  const removeCertificate = () => {
    setCertificateFile(null);
    setCertificatePreview(null);
  };

  const handleSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      let certificatePath = initialData?.certificate_path;
      let certificateName = initialData?.certificate_name;

      // Upload certificate if a new file is selected
      if (certificateFile) {
        setUploadingCertificate(true);
        const fileExt = certificateFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${userId}/certificates/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("external-course-certificates")
          .upload(filePath, certificateFile);

        if (uploadError) throw uploadError;

        certificatePath = filePath;
        certificateName = certificateFile.name;
        setUploadingCertificate(false);
      }

      await onSubmit({
        ...data,
        id: initialData?.id,
        certificate_path: certificatePath,
        certificate_name: certificateName,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Machine Learning Specialization" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="provider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Provider</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Coursera, Udemy, Microsoft" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course URL (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="planned_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Planned Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Due/Finish Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Any additional notes..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Certificate Upload */}
        <div className="space-y-2">
          <FormLabel>Certificate (Optional)</FormLabel>
          {certificatePreview ? (
            <div className="border rounded-md p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {certificateFile?.name || initialData?.certificate_name || "Certificate uploaded"}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={removeCertificate}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {certificatePreview.endsWith(".pdf") ? (
                <div className="text-sm text-muted-foreground">PDF Certificate</div>
              ) : (
                <img
                  src={certificatePreview}
                  alt="Certificate preview"
                  className="max-h-32 object-contain"
                />
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Upload certificate (PDF or image)</p>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleCertificateChange}
                  className="max-w-xs mx-auto"
                />
              </div>
            </div>
          )}
        </div>

        {/* Visibility Settings */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4" />
            Visibility Settings
          </div>

          <FormField
            control={form.control}
            name="is_private"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-background">
                <div className="space-y-0.5">
                  <FormLabel className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4" />
                    Private
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Only visible to you (and admins). Coaches/instructors won't see this.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      // If making private, ensure not public
                      if (checked) {
                        form.setValue("is_public", false);
                      }
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_public"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-background">
                <div className="space-y-0.5">
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Show on Public Profile
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Display on your public profile page visible to anyone on the internet.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      // If making public, ensure not private
                      if (checked) {
                        form.setValue("is_private", false);
                      }
                    }}
                    disabled={form.watch("is_private")}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || uploadingCertificate}>
            {uploadingCertificate
              ? "Uploading..."
              : isSubmitting
                ? "Saving..."
                : initialData?.id
                  ? "Update"
                  : "Add Course"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
