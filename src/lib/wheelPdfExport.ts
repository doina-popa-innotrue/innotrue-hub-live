import jsPDF from "jspdf";
import { WHEEL_OF_LIFE_CATEGORIES, WheelCategory } from "./wheelOfLifeCategories";

export async function generateWheelPdf(
  userName: string,
  ratings: Record<WheelCategory, number>,
  notes?: string,
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Title
  doc.setFontSize(24);
  doc.setTextColor(59, 130, 246); // Primary blue
  doc.text("Wheel of Life Assessment", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Results for ${userName}`, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 8;
  doc.text(
    `Generated on ${new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    pageWidth / 2,
    yPosition,
    { align: "center" },
  );
  yPosition += 20;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 15;

  // Calculate stats
  const values = Object.values(ratings);
  const average = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const highest = Math.max(...values);
  const lowest = Math.min(...values);

  // Summary box
  doc.setFillColor(249, 250, 251); // Light gray background
  doc.roundedRect(20, yPosition, pageWidth - 40, 25, 3, 3, "F");

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const summaryY = yPosition + 10;
  doc.text(`Average Score: ${average}/10`, 30, summaryY);
  doc.text(`Highest: ${highest}/10`, pageWidth / 2 - 20, summaryY);
  doc.text(`Lowest: ${lowest}/10`, pageWidth - 60, summaryY);
  yPosition += 35;

  // Categories header
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Your Ratings by Category", 20, yPosition);
  yPosition += 10;

  // Categories with scores
  doc.setFontSize(11);
  const categories = Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[];
  const leftColumn = categories.slice(0, 5);
  const rightColumn = categories.slice(5);

  leftColumn.forEach((cat, idx) => {
    const label = WHEEL_OF_LIFE_CATEGORIES[cat];
    const score = ratings[cat];
    const y = yPosition + idx * 12;

    // Category name
    doc.setTextColor(60, 60, 60);
    doc.text(label, 25, y);

    // Score bar background
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(70, y - 4, 30, 6, 1, 1, "F");

    // Score bar filled
    const fillWidth = (score / 10) * 30;
    if (score <= 4) {
      doc.setFillColor(239, 68, 68); // Red
    } else if (score <= 6) {
      doc.setFillColor(245, 158, 11); // Yellow/Orange
    } else {
      doc.setFillColor(34, 197, 94); // Green
    }
    doc.roundedRect(70, y - 4, fillWidth, 6, 1, 1, "F");

    // Score number
    doc.setTextColor(30, 30, 30);
    doc.text(`${score}`, 105, y);
  });

  rightColumn.forEach((cat, idx) => {
    const label = WHEEL_OF_LIFE_CATEGORIES[cat];
    const score = ratings[cat];
    const y = yPosition + idx * 12;
    const xOffset = pageWidth / 2 + 5;

    // Category name
    doc.setTextColor(60, 60, 60);
    doc.text(label, xOffset, y);

    // Score bar background
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(xOffset + 45, y - 4, 30, 6, 1, 1, "F");

    // Score bar filled
    const fillWidth = (score / 10) * 30;
    if (score <= 4) {
      doc.setFillColor(239, 68, 68);
    } else if (score <= 6) {
      doc.setFillColor(245, 158, 11);
    } else {
      doc.setFillColor(34, 197, 94);
    }
    doc.roundedRect(xOffset + 45, y - 4, fillWidth, 6, 1, 1, "F");

    // Score number
    doc.setTextColor(30, 30, 30);
    doc.text(`${score}`, xOffset + 80, y);
  });

  yPosition += 65;

  // Growth opportunities
  const sortedCategories = [...categories].sort((a, b) => ratings[a] - ratings[b]);
  const growthAreas = sortedCategories.slice(0, 3);
  const strengthAreas = sortedCategories.slice(-3).reverse();

  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Areas for Growth", 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  growthAreas.forEach((cat, idx) => {
    doc.text(`• ${WHEEL_OF_LIFE_CATEGORIES[cat]} (${ratings[cat]}/10)`, 25, yPosition + idx * 6);
  });
  yPosition += 25;

  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Your Strengths", 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  strengthAreas.forEach((cat, idx) => {
    doc.text(`• ${WHEEL_OF_LIFE_CATEGORIES[cat]} (${ratings[cat]}/10)`, 25, yPosition + idx * 6);
  });
  yPosition += 30;

  // Notes section
  if (notes && notes.trim()) {
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text("Your Notes", 20, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const splitNotes = doc.splitTextToSize(notes, pageWidth - 50);
    doc.text(splitNotes, 25, yPosition);
    yPosition += splitNotes.length * 5 + 15;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("InnoTrue Hub - Your Personal Development Partner", pageWidth / 2, footerY, {
    align: "center",
  });
  doc.text("www.innotruehub.com", pageWidth / 2, footerY + 5, { align: "center" });

  // Save
  const fileName = `wheel-of-life-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

export function generateWheelPdfBlob(
  userName: string,
  ratings: Record<WheelCategory, number>,
  notes?: string,
): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Title
  doc.setFontSize(24);
  doc.setTextColor(59, 130, 246);
  doc.text("Wheel of Life Assessment", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Results for ${userName}`, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 8;
  doc.text(
    `Generated on ${new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    pageWidth / 2,
    yPosition,
    { align: "center" },
  );
  yPosition += 20;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 15;

  // Summary
  const values = Object.values(ratings);
  const average = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const highest = Math.max(...values);
  const lowest = Math.min(...values);

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(20, yPosition, pageWidth - 40, 25, 3, 3, "F");

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const summaryY = yPosition + 10;
  doc.text(`Average Score: ${average}/10`, 30, summaryY);
  doc.text(`Highest: ${highest}/10`, pageWidth / 2 - 20, summaryY);
  doc.text(`Lowest: ${lowest}/10`, pageWidth - 60, summaryY);
  yPosition += 35;

  // Categories
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Your Ratings by Category", 20, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  const categories = Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[];

  categories.forEach((cat, idx) => {
    const label = WHEEL_OF_LIFE_CATEGORIES[cat];
    const score = ratings[cat];
    const y = yPosition + idx * 8;

    doc.setTextColor(60, 60, 60);
    doc.text(`${label}: ${score}/10`, 25, y);
  });

  yPosition += categories.length * 8 + 10;

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("InnoTrue Hub - Your Personal Development Partner", pageWidth / 2, footerY, {
    align: "center",
  });

  return doc.output("blob");
}
