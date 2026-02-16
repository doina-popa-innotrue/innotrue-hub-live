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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Eye, Code, FileText, Image as ImageIcon, Link } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import DOMPurify from "dompurify";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  html_content: string;
  description: string | null;
  updated_at: string;
}

interface EmailAsset {
  id: string;
  name: string;
  file_url: string;
  is_system_logo: boolean;
}

export default function EmailTemplatesManagement() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [assets, setAssets] = useState<EmailAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [editMode, setEditMode] = useState<"visual" | "html">("visual");
  const [saving, setSaving] = useState(false);

  async function fetchTemplates() {
    const { data, error } = await supabase.from("email_templates").select("*").order("name");

    if (error) {
      toast.error("Failed to load email templates");
      console.error(error);
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  }

  async function fetchAssets() {
    const { data, error } = await supabase
      .from("email_template_assets")
      .select("id, name, file_url, is_system_logo")
      .order("is_system_logo", { ascending: false })
      .order("name");

    if (error) {
      console.error("Failed to load assets:", error);
    } else {
      setAssets((data || []) as EmailAsset[]);
    }
  }

  useEffect(() => {
    fetchTemplates();
    fetchAssets();
  }, []);

  function openEditDialog(template: EmailTemplate) {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setHtmlContent(template.html_content);
    setEditMode("visual");
    setEditOpen(true);
  }

  function openPreviewDialog(template: EmailTemplate) {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  }

  async function handleSave() {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject,
          html_content: htmlContent,
        })
        .eq("id", selectedTemplate.id);

      if (error) throw error;

      toast.success("Template saved successfully");
      setEditOpen(false);
      fetchTemplates();
    } catch (error: any) {
      toast.error(`Failed to save template: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function insertImageTag(asset: EmailAsset) {
    const imgTag = `<img src="${asset.file_url}" alt="${asset.name}" style="max-width: 100%; height: auto;" />`;
    setHtmlContent((prev) => prev + imgTag);
    toast.success(`Inserted ${asset.name} image`);
  }

  function insertSystemLogoVariable() {
    const logoTag = "{{systemLogo}}";
    setHtmlContent((prev) => prev + logoTag);
    toast.success("Inserted system logo variable");
  }

  // Replace template variables with example values for preview and sanitize HTML
  function getPreviewContent(content: string) {
    const systemLogo = assets.find((a) => a.is_system_logo);
    const logoImg = systemLogo
      ? `<img src="${systemLogo.file_url}" alt="System Logo" style="max-width: 200px; height: auto;" />`
      : '<span style="color: #999;">[System Logo Not Set]</span>';

    const replaced = content
      .replace(/\{\{userName\}\}/g, "John Doe")
      .replace(/\{\{passwordSetupLink\}\}/g, "https://example.com/auth?token=abc123")
      .replace(/\{\{systemLogo\}\}/g, logoImg);

    // Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(replaced, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "a",
        "h1",
        "h2",
        "h3",
        "h4",
        "ul",
        "ol",
        "li",
        "table",
        "tr",
        "td",
        "th",
        "thead",
        "tbody",
        "div",
        "span",
        "img",
        "hr",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class", "style", "src", "alt", "width", "height"],
    });
  }

  if (loading) {
    return <PageLoadingState />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Templates</h1>
        <p className="text-muted-foreground">Customize the content of system emails</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Edit email templates to customize the content sent to users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
                  <TableCell className="max-w-[300px] text-sm text-muted-foreground">
                    {template.description}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(template.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPreviewDialog(template)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(template)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No email templates found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Email Content</Label>
                <div className="flex gap-1">
                  <Button
                    variant={editMode === "visual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditMode("visual")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Visual
                  </Button>
                  <Button
                    variant={editMode === "html" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditMode("html")}
                  >
                    <Code className="mr-2 h-4 w-4" />
                    HTML
                  </Button>
                </div>
              </div>

              {editMode === "visual" ? (
                <RichTextEditor
                  value={htmlContent}
                  onChange={setHtmlContent}
                  placeholder="Write your email content here..."
                  className="min-h-[300px]"
                />
              ) : (
                <Textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Email HTML content"
                />
              )}
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div>
                <h4 className="font-medium mb-2">Available Variables</h4>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{"{{userName}}"}</Badge>
                  <Badge variant="outline">{"{{passwordSetupLink}}"}</Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={insertSystemLogoVariable}
                  >
                    {"{{systemLogo}}"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Click on a variable to insert it at the end of the content.
                </p>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Insert Image
                </h4>
                {assets.length > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Choose from Library
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <ScrollArea className="h-64">
                        <div className="space-y-2">
                          {assets.map((asset) => (
                            <button
                              key={asset.id}
                              onClick={() => insertImageTag(asset)}
                              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                            >
                              <div className="w-12 h-10 border rounded flex items-center justify-center bg-background overflow-hidden flex-shrink-0">
                                <img
                                  src={asset.file_url}
                                  alt={asset.name}
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{asset.name}</p>
                                {asset.is_system_logo && (
                                  <Badge variant="secondary" className="text-xs">
                                    System Logo
                                  </Badge>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No images uploaded.{" "}
                    <a href="/admin/email-assets" className="text-primary hover:underline">
                      Upload images
                    </a>{" "}
                    to use in templates.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Subject: {selectedTemplate?.subject.replace(/\{\{userName\}\}/g, "John Doe")}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="source">Source</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-4">
              <div
                className="border rounded-lg p-4 bg-white"
                dangerouslySetInnerHTML={{
                  __html: getPreviewContent(selectedTemplate?.html_content || ""),
                }}
              />
            </TabsContent>
            <TabsContent value="source" className="mt-4">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
                {selectedTemplate?.html_content}
              </pre>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
