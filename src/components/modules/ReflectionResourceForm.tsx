import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Upload, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

interface ReflectionResourceFormProps {
  reflectionId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ReflectionResourceForm({
  reflectionId,
  onSuccess,
  onCancel,
}: ReflectionResourceFormProps) {
  const { user } = useAuth();
  const [resourceType, setResourceType] = useState<'file' | 'image' | 'link'>('link');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Auto-detect resource type based on file
      if (droppedFile.type.startsWith('image/')) {
        setResourceType('image');
      } else {
        setResourceType('file');
      }
      
      setFile(droppedFile);
      
      // Auto-populate title from filename if empty
      if (!title) {
        const fileName = droppedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(fileName);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setUploading(true);
    try {
      let filePath = null;
      let fileSize = null;
      let mimeType = null;
      let finalUrl = url;

      // Handle file upload
      if ((resourceType === 'file' || resourceType === 'image') && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('module-reflection-resources')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        filePath = fileName;
        fileSize = file.size;
        mimeType = file.type;

        const { data: { publicUrl } } = supabase.storage
          .from('module-reflection-resources')
          .getPublicUrl(fileName);
        
        finalUrl = publicUrl;
      }

      // Insert resource record
      const { error: insertError } = await supabase
        .from('module_reflection_resources')
        .insert({
          module_reflection_id: reflectionId,
          user_id: user.id,
          resource_type: resourceType,
          title: title.trim(),
          description: description.trim() || null,
          url: finalUrl || null,
          file_path: filePath,
          file_size: fileSize,
          mime_type: mimeType,
        });

      if (insertError) throw insertError;

      toast.success('Resource added successfully');
      onSuccess();
    } catch (error) {
      console.error('Error adding resource:', error);
      toast.error('Failed to add resource');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Resource Type</Label>
        <RadioGroup value={resourceType} onValueChange={(value: any) => setResourceType(value)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="link" id="link" />
            <Label htmlFor="link" className="font-normal cursor-pointer">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Link
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="image" id="image" />
            <Label htmlFor="image" className="font-normal cursor-pointer">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="file" id="file" />
            <Label htmlFor="file" className="font-normal cursor-pointer">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                File
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resource title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      {resourceType === 'link' && (
        <div className="space-y-2">
          <Label htmlFor="url">URL *</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
          />
        </div>
      )}

      {(resourceType === 'file' || resourceType === 'image') && (
        <div className="space-y-2">
          <Label htmlFor="file">
            {resourceType === 'image' ? 'Upload Image' : 'Upload File'} *
          </Label>
          
          {/* Drag and drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              {isDragging ? 'Drop file here' : 'Drag and drop file here'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              or click to browse
            </p>
            <Input
              id="file"
              type="file"
              accept={resourceType === 'image' ? 'image/*' : '*'}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="max-w-xs mx-auto cursor-pointer"
              required={!file}
            />
          </div>
          
          {file && (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
              >
                Remove
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={uploading}>
          {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Resource
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
