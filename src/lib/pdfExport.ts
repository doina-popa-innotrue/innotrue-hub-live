import jsPDF from "jspdf";

// InnoTrue Hub logo as base64 (small version for PDF)
const INNOTRUE_LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAoCAYAAAAIeF9DAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0NDg4LCAyMDIwLzA3LzEwLTIyOjA2OjUzICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjIuMCAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDI0LTAxLTE1VDEwOjAwOjAwKzAwOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyNC0wMS0xNVQxMDowMDowMCswMDowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyNC0wMS0xNVQxMDowMDowMCswMDowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIj4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDowMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiIHN0RXZ0OndoZW49IjIwMjQtMDEtMTVUMTA6MDA6MDArMDA6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyMi4wIChXaW5kb3dzKSIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4B//79/Pv6+fj39vX08/Lx8O/u7ezr6uno5+bl5OPi4eDf3t3c29rZ2NfW1dTT0tHQz87NzMvKycjHxsXEw8LBwL++vby7urm4t7a1tLOysbCvrq2sq6qpqKempaSjoqGgn56dnJuamZiXlpWUk5KRkI+OjYyLiomIh4aFhIOCgYB/fn18e3p5eHd2dXRzcnFwb25tbGtqaWhnZmVkY2JhYF9eXVxbWllYV1ZVVFNSUVBPTk1MS0pJSEdGRURDQkFAPz49PDs6OTg3NjU0MzIxMC8uLSwrKikoJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAAAh+QQAAAAAACwAAAAAZAAoAAAG/8CbcEgsGo/IpHLJbDqf0Kh0Sq1ar9isdsvter/gsHhMLpvP6LR6zW673/C4fE6v2+/4vH7P7/v/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAwocSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2rcyLGjx48gQ4ocSbKkyZMoU6pcybKly5cwY8qcSbOmzZs4c+rcybOnz59AgwodSrSo0aNIkypdyrSp06dQo0qdSrWq1atYs2rdyrWr169gw4odS7as2bNo06pdy7at27dw48qdS7eu3bt48+rdy7ev37+AAwseTLiw4cOIEytezLix48eQI0ueTLmy5cuYM2vezLmz58+gQ4seTbq06dOoU6tezbq169ewY8ueTbu27du4c+vezbu379/AgwsfTry48ePIkytfzry58+fQo0ufTr269evYs2vfzr279+/gw4sfT768+fPo06tfz769+/fw48ufT7++/fv48+vfz7+///8ABijggAQWaOCBCCao4IIMNujggxBGKOGEFFZo4YUYZqjhhhx26OGHIIYo4ogklmjiiSimqOKKLLbo4oswxijjjDTWaOONOOao44489ujjj0AGKeSQRBZp5JFIJqnkkkw26eSTUEYp5ZRUVmnllVhmqeWWXHbp5ZdgsthEEAA7";

interface Program {
  name: string;
  category: string;
  status: string;
  progress: number;
  completedModules: number;
  totalModules: number;
  start_date?: string;
}

interface ExternalCourse {
  title: string;
  provider: string;
  status: string;
  planned_date?: string;
  due_date?: string;
  certificate_path?: string;
}

interface Skill {
  name: string;
  category?: string;
}

export const generateLearningTranscript = (
  userName: string,
  userEmail: string,
  programs: Program[],
  externalCourses: ExternalCourse[],
  skills: Skill[]
) => {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const lineHeight = 7;

  // Helper function to check if we need a new page
  const checkPageBreak = (neededSpace: number) => {
    if (yPosition + neededSpace > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Add logo at the top
  try {
    doc.addImage(INNOTRUE_LOGO_BASE64, "PNG", pageWidth / 2 - 25, yPosition - 10, 50, 20);
    yPosition += 20;
  } catch (e) {
    // If logo fails to load, continue without it
    console.warn("Could not add logo to PDF");
  }

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Learning Transcript", 105, yPosition, { align: "center" });
  yPosition += 15;

  // User Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${userName}`, 20, yPosition);
  yPosition += lineHeight;
  doc.text(`Email: ${userEmail}`, 20, yPosition);
  yPosition += lineHeight;
  doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
  yPosition += 15;

  // Programs Section
  checkPageBreak(30);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("InnoTrue Programs", 20, yPosition);
  yPosition += 10;

  if (programs.length === 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.text("No programs enrolled", 25, yPosition);
    yPosition += 10;
  } else {
    programs.forEach((program, index) => {
      checkPageBreak(25);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${index + 1}. ${program.name}`, 25, yPosition);
      yPosition += lineHeight;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`   Category: ${program.category}`, 25, yPosition);
      yPosition += lineHeight;
      doc.text(`   Status: ${program.status}`, 25, yPosition);
      yPosition += lineHeight;
      doc.text(`   Progress: ${Math.round(program.progress)}% (${program.completedModules}/${program.totalModules} modules)`, 25, yPosition);
      yPosition += lineHeight;
      if (program.start_date) {
        doc.text(`   Started: ${new Date(program.start_date).toLocaleDateString()}`, 25, yPosition);
        yPosition += lineHeight;
      }
      yPosition += 3;
    });
  }

  // External Courses Section
  yPosition += 5;
  checkPageBreak(30);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("External Courses", 20, yPosition);
  yPosition += 10;

  if (externalCourses.length === 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.text("No external courses tracked", 25, yPosition);
    yPosition += 10;
  } else {
    externalCourses.forEach((course, index) => {
      checkPageBreak(25);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${index + 1}. ${course.title}`, 25, yPosition);
      yPosition += lineHeight;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`   Provider: ${course.provider}`, 25, yPosition);
      yPosition += lineHeight;
      doc.text(`   Status: ${course.status}`, 25, yPosition);
      yPosition += lineHeight;
      if (course.planned_date) {
        doc.text(`   Start Date: ${new Date(course.planned_date).toLocaleDateString()}`, 25, yPosition);
        yPosition += lineHeight;
      }
      if (course.due_date) {
        doc.text(`   Due Date: ${new Date(course.due_date).toLocaleDateString()}`, 25, yPosition);
        yPosition += lineHeight;
      }
      if (course.certificate_path) {
        doc.setFont("helvetica", "italic");
        doc.text(`   ✓ Certificate uploaded`, 25, yPosition);
        doc.setFont("helvetica", "normal");
        yPosition += lineHeight;
      }
      yPosition += 3;
    });
  }

  // Skills Section
  if (skills.length > 0) {
    yPosition += 5;
    checkPageBreak(30);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Skills Acquired", 20, yPosition);
    yPosition += 10;

    // Group skills by category
    const skillsByCategory = skills.reduce((acc, skill) => {
      const category = skill.category || "Other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(skill.name);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(skillsByCategory).forEach(([category, skillNames]) => {
      checkPageBreak(15);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${category}:`, 25, yPosition);
      yPosition += lineHeight;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      skillNames.forEach(skillName => {
        checkPageBreak(7);
        doc.text(`   • ${skillName}`, 30, yPosition);
        yPosition += lineHeight;
      });
      yPosition += 3;
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      `Page ${i} of ${pageCount} - Generated by InnoTrue Hub`,
      105,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  doc.save(`learning-transcript-${new Date().toISOString().split("T")[0]}.pdf`);
};
