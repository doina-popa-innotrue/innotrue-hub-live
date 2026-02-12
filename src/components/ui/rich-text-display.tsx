import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

/**
 * Safely renders HTML content with DOMPurify sanitization.
 * Use this to display rich text content that was created with the RichTextEditor.
 */
export function RichTextDisplay({ content, className }: RichTextDisplayProps) {
  if (!content || content === "<p></p>") {
    return null;
  }

  // Sanitize HTML to prevent XSS attacks
  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    ADD_ATTR: ["target"],
  });

  // Add target="_blank" and rel="noopener noreferrer" to all links for security
  const processedContent = sanitizedContent.replace(
    /<a /g,
    '<a target="_blank" rel="noopener noreferrer" ',
  );

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "[&_a]:text-primary [&_a]:underline",
        "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
        "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic",
        "[&_ul]:list-disc [&_ul]:pl-6",
        "[&_ol]:list-decimal [&_ol]:pl-6",
        "[&_p]:my-1",
        "[&_p:first-child]:mt-0",
        "[&_p:last-child]:mb-0",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}
