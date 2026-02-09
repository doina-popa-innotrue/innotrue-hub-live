import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface StructureField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'rating' | 'select' | 'checkbox' | 'richtext';
  label: string;
  description?: string;
  required?: boolean;
  options?: string[]; // For select type
  min?: number; // For rating/number
  max?: number; // For rating/number
}

interface StructuredFeedbackFormProps {
  structure: StructureField[];
  responses: Record<string, unknown>;
  onChange: (responses: Record<string, unknown>) => void;
  disabled?: boolean;
}

export default function StructuredFeedbackForm({ 
  structure, 
  responses, 
  onChange, 
  disabled = false 
}: StructuredFeedbackFormProps) {
  
  function handleChange(fieldId: string, value: unknown) {
    onChange({ ...responses, [fieldId]: value });
  }

  function renderField(field: StructureField) {
    const value = responses[field.id];

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={field.description}
            disabled={disabled}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={field.description}
            rows={3}
            disabled={disabled}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => handleChange(field.id, e.target.value ? Number(e.target.value) : null)}
            min={field.min}
            max={field.max}
            disabled={disabled}
          />
        );

      case 'rating':
        const min = field.min ?? 1;
        const max = field.max ?? 5;
        const currentRating = (value as number) ?? min;
        return (
          <div className="space-y-2">
            <Slider
              value={[currentRating]}
              onValueChange={([v]) => handleChange(field.id, v)}
              min={min}
              max={max}
              step={1}
              disabled={disabled}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{min}</span>
              <span className="font-medium text-foreground">{currentRating}</span>
              <span>{max}</span>
            </div>
          </div>
        );

      case 'select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={(v) => handleChange(field.id, v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => handleChange(field.id, checked)}
              disabled={disabled}
            />
            <label htmlFor={field.id} className="text-sm text-muted-foreground">
              {field.description || 'Yes'}
            </label>
          </div>
        );

      case 'richtext':
        return (
          <RichTextEditor
            value={(value as string) || ''}
            onChange={(content) => handleChange(field.id, content)}
            placeholder={field.description}
            disabled={disabled}
          />
        );

      default:
        return null;
    }
  }

  if (!structure || structure.length === 0) return null;

  return (
    <div className="space-y-4">
      {structure.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && field.type !== 'checkbox' && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          {renderField(field)}
        </div>
      ))}
    </div>
  );
}
