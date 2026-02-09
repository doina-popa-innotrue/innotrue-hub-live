import jsPDF from 'jspdf';
import { format } from 'date-fns';

// InnoTrue Hub logo as base64 (small version for PDF)
const INNOTRUE_LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAoCAYAAAAIeF9DAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0NDg4LCAyMDIwLzA3LzEwLTIyOjA2OjUzICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjIuMCAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDI0LTAxLTE1VDEwOjAwOjAwKzAwOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyNC0wMS0xNVQxMDowMDowMCswMDowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyNC0wMS0xNVQxMDowMDowMCswMDowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIj4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDowMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiIHN0RXZ0OndoZW49IjIwMjQtMDEtMTVUMTA6MDA6MDArMDA6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyMi4wIChXaW5kb3dzKSIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4B//79/Pv6+fj39vX08/Lx8O/u7ezr6uno5+bl5OPi4eDf3t3c29rZ2NfW1dTT0tHQz87NzMvKycjHxsXEw8LBwL++vby7urm4t7a1tLOysbCvrq2sq6qpqKempaSjoqGgn56dnJuamZiXlpWUk5KRkI+OjYyLiomIh4aFhIOCgYB/fn18e3p5eHd2dXRzcnFwb25tbGtqaWhnZmVkY2JhYF9eXVxbWllYV1ZVVFNSUVBPTk1MS0pJSEdGRURDQkFAPz49PDs6OTg3NjU0MzIxMC8uLSwrKikoJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAAAh+QQAAAAAACwAAAAAZAAoAAAG/8CbcEgsGo/IpHLJbDqf0Kh0Sq1ar9isdsvter/gsHhMLpvP6LR6zW673/C4fE6v2+/4vH7P7/v/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAwocSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2rcyLGjx48gQ4ocSbKkyZMoU6pcybKly5cwY8qcSbOmzZs4c+rcybOnz59AgwodSrSo0aNIkypdyrSp06dQo0qdSrWq1atYs2rdyrWr169gw4odS7as2bNo06pdy7at27dw48qdS7eu3bt48+rdy7ev37+AAwseTLiw4cOIEytezLix48eQI0ueTLmy5cuYM2vezLmz58+gQ4seTbq06dOoU6tezbq169ewY8ueTbu27du4c+vezbu379/AgwsfTry48ePIkytfzry58+fQo0ufTr269evYs2vfzr279+/gw4sfT768+fPo06tfz769+/fw48ufT7++/fv48+vfz7+///8ABijggAQWaOCBCCao4IIMNujggxBGKOGEFFZo4YUYZqjhhhx26OGHIIYo4ogklmjiiSimqOKKLLbo4oswxijjjDTWaOONOOao44489ujjj0AGKeSQRBZp5JFIJqnkkkw26eSTUEYp5ZRUVmnllVhmqeWWXHbp5ZdgsthEEAA7";

// Helper function to strip HTML tags from text
function stripHtml(html: string): string {
  if (!html) return '';
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export interface FeedbackData {
  id: string;
  clientName: string;
  clientEmail?: string;
  moduleName: string;
  programName: string;
  coachName: string;
  feedback: string | null;
  structuredResponses: Record<string, unknown>;
  templateFields?: Array<{
    id: string;
    label: string;
    type: string;
  }>;
  createdAt: string;
  updatedAt: string;
  attachments?: Array<{
    title: string;
    description?: string;
    type: string;
  }>;
}

export function generateFeedbackPdf(data: FeedbackData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;
  const lineHeight = 7;
  const marginLeft = 20;
  const contentWidth = pageWidth - 40;

  // Helper to check page breaks
  const checkPageBreak = (neededSpace: number) => {
    if (yPosition + neededSpace > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Add logo
  try {
    doc.addImage(INNOTRUE_LOGO_BASE64, "PNG", pageWidth / 2 - 25, yPosition - 10, 50, 20);
    yPosition += 20;
  } catch (e) {
    console.warn("Could not add logo to PDF");
  }

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Module Feedback Report", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(marginLeft, yPosition, pageWidth - marginLeft, yPosition);
  yPosition += 10;

  // Info section
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const infoRows = [
    { label: "Client", value: data.clientName },
    { label: "Email", value: data.clientEmail || "Not provided" },
    { label: "Program", value: data.programName },
    { label: "Module", value: data.moduleName },
    { label: "Coach/Instructor", value: data.coachName },
    { label: "Date", value: format(new Date(data.updatedAt), "PPP") },
  ];

  infoRows.forEach(({ label, value }) => {
    checkPageBreak(lineHeight);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, marginLeft, yPosition);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginLeft + 45, yPosition);
    yPosition += lineHeight;
  });

  yPosition += 5;
  doc.line(marginLeft, yPosition, pageWidth - marginLeft, yPosition);
  yPosition += 15;

  // Structured responses (if any)
  if (data.templateFields && data.templateFields.length > 0 && Object.keys(data.structuredResponses).length > 0) {
    checkPageBreak(15);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Structured Feedback", marginLeft, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    data.templateFields.forEach((field) => {
      const value = data.structuredResponses[field.id];
      if (value !== undefined && value !== null && value !== "") {
        checkPageBreak(20);
        
        // Field label
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 50, 50);
        doc.text(field.label, marginLeft, yPosition);
        yPosition += 6;

        // Field value
        doc.setFont("helvetica", "normal");
        doc.setTextColor(70, 70, 70);
        
        let displayValue = String(value);
        if (field.type === "rating") {
          displayValue = `${value}/10`;
        } else if (field.type === "checkbox") {
          displayValue = value ? "Yes" : "No";
        } else {
          // Strip HTML from text values (from rich text editor)
          displayValue = stripHtml(displayValue);
        }

        const splitValue = doc.splitTextToSize(displayValue, contentWidth);
        doc.text(splitValue, marginLeft + 5, yPosition);
        yPosition += splitValue.length * 5 + 5;
      }
    });

    yPosition += 5;
  }

  // Free text feedback
  if (data.feedback && data.feedback.trim()) {
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Additional Comments", marginLeft, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    // Strip HTML from feedback content
    const cleanFeedback = stripHtml(data.feedback);
    const splitFeedback = doc.splitTextToSize(cleanFeedback, contentWidth);
    
    splitFeedback.forEach((line: string) => {
      checkPageBreak(lineHeight);
      doc.text(line, marginLeft, yPosition);
      yPosition += lineHeight;
    });
    yPosition += 5;
  }

  // Attachments list
  if (data.attachments && data.attachments.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Attachments", marginLeft, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    data.attachments.forEach((attachment, index) => {
      checkPageBreak(15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 50, 50);
      doc.text(`${index + 1}. ${attachment.title}`, marginLeft, yPosition);
      yPosition += 5;
      
      if (attachment.description) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const splitDesc = doc.splitTextToSize(attachment.description, contentWidth - 10);
        doc.text(splitDesc, marginLeft + 5, yPosition);
        yPosition += splitDesc.length * 4 + 3;
      }
      
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text(`Type: ${attachment.type}`, marginLeft + 5, yPosition);
      yPosition += 7;
    });
  }

  // Footer
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} • Generated by InnoTrue Hub on ${format(new Date(), "PP")}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Save
  const safeClientName = data.clientName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const safeModuleName = data.moduleName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const fileName = `feedback-${safeClientName}-${safeModuleName}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
