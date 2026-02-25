// generate-certificate-pdf — Generates a branded PDF certificate for an issued badge
// Auth required: user must own the badge, or be admin/primary instructor

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/error-response.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const { client_badge_id } = await req.json();

    if (!client_badge_id) {
      return errorResponse.badRequest("Missing required field: client_badge_id", cors);
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("Missing Authorization header", cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return errorResponse.unauthorized("Invalid or expired token", cors);
    }

    // Use service role for data access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch badge with related data
    const { data: badge, error: badgeError } = await adminClient
      .from("client_badges")
      .select(`
        id,
        user_id,
        status,
        issued_at,
        expires_at,
        issued_by,
        program_badges (
          id,
          name,
          description,
          image_path,
          programs (
            id,
            name
          )
        )
      `)
      .eq("id", client_badge_id)
      .eq("status", "issued")
      .maybeSingle();

    if (badgeError || !badge) {
      return errorResponse.notFound("Badge not found or not issued", cors);
    }

    // Authorization check: user owns badge, or is admin, or is primary instructor
    let authorized = badge.user_id === user.id;

    if (!authorized) {
      // Check admin role
      const { data: adminRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      authorized = !!adminRole;
    }

    if (!authorized) {
      // Check primary instructor
      const programId = (badge.program_badges as any)?.programs?.id;
      if (programId) {
        const { data: instructorRole } = await adminClient
          .from("program_instructors")
          .select("id")
          .eq("instructor_id", user.id)
          .eq("program_id", programId)
          .eq("is_primary", true)
          .maybeSingle();
        authorized = !!instructorRole;
      }
    }

    if (!authorized) {
      return errorResponse.forbidden("You do not have permission to download this certificate", cors);
    }

    // Fetch recipient name
    const { data: profile } = await adminClient
      .from("profiles")
      .select("name")
      .eq("id", badge.user_id)
      .maybeSingle();

    // Fetch issuer name if available
    let issuerName = "InnoTrue";
    if (badge.issued_by) {
      const { data: issuerProfile } = await adminClient
        .from("profiles")
        .select("name")
        .eq("id", badge.issued_by)
        .maybeSingle();
      if (issuerProfile?.name) {
        issuerName = issuerProfile.name;
      }
    }

    const recipientName = profile?.name || "Unknown";
    const programName = (badge.program_badges as any)?.programs?.name || "Unknown Program";
    const badgeName = (badge.program_badges as any)?.name || "Completion Badge";
    const badgeDescription = (badge.program_badges as any)?.description || "";
    const issuedAt = badge.issued_at ? new Date(badge.issued_at) : new Date();
    const expiresAt = badge.expires_at ? new Date(badge.expires_at) : null;
    const verificationUrl = `https://app.innotrue.com/verify/badge/${badge.id}`;

    // ─── Generate PDF ─────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();

    // A4 landscape: 842 x 595 points
    const page = pdfDoc.addPage([842, 595]);
    const { width, height } = page.getSize();

    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    // Colors
    const primaryColor = rgb(0.388, 0.400, 0.945);    // InnoTrue purple (#6366f1)
    const darkColor = rgb(0.133, 0.133, 0.200);       // Dark text
    const mutedColor = rgb(0.420, 0.447, 0.502);       // Muted text
    const goldColor = rgb(0.855, 0.647, 0.125);        // Gold accent
    const borderColor = rgb(0.800, 0.812, 0.855);      // Light border

    // ─── Decorative border ──────────────────────────────────────
    const borderWidth = 3;
    const margin = 30;
    page.drawRectangle({
      x: margin,
      y: margin,
      width: width - 2 * margin,
      height: height - 2 * margin,
      borderColor: primaryColor,
      borderWidth,
    });

    // Inner border (decorative)
    page.drawRectangle({
      x: margin + 8,
      y: margin + 8,
      width: width - 2 * (margin + 8),
      height: height - 2 * (margin + 8),
      borderColor: borderColor,
      borderWidth: 1,
    });

    // ─── Header ─────────────────────────────────────────────────
    const orgText = "INNOTRUE";
    const orgWidth = helveticaBold.widthOfTextAtSize(orgText, 18);
    page.drawText(orgText, {
      x: (width - orgWidth) / 2,
      y: height - 75,
      size: 18,
      font: helveticaBold,
      color: primaryColor,
    });

    // ─── Title ──────────────────────────────────────────────────
    const titleText = "Certificate of Completion";
    const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 32);
    page.drawText(titleText, {
      x: (width - titleWidth) / 2,
      y: height - 130,
      size: 32,
      font: helveticaBold,
      color: darkColor,
    });

    // ─── Decorative line ────────────────────────────────────────
    page.drawLine({
      start: { x: width / 2 - 100, y: height - 145 },
      end: { x: width / 2 + 100, y: height - 145 },
      thickness: 2,
      color: goldColor,
    });

    // ─── "This certifies that" ──────────────────────────────────
    const preText = "This certifies that";
    const preWidth = timesItalic.widthOfTextAtSize(preText, 14);
    page.drawText(preText, {
      x: (width - preWidth) / 2,
      y: height - 180,
      size: 14,
      font: timesItalic,
      color: mutedColor,
    });

    // ─── Recipient Name (large, centered) ───────────────────────
    const nameSize = recipientName.length > 30 ? 28 : 36;
    const nameWidth = helveticaBold.widthOfTextAtSize(recipientName, nameSize);
    page.drawText(recipientName, {
      x: (width - nameWidth) / 2,
      y: height - 225,
      size: nameSize,
      font: helveticaBold,
      color: darkColor,
    });

    // ─── Decorative line under name ────────────────────────────
    page.drawLine({
      start: { x: width / 2 - 150, y: height - 240 },
      end: { x: width / 2 + 150, y: height - 240 },
      thickness: 1,
      color: borderColor,
    });

    // ─── "has successfully completed" ───────────────────────────
    const midText = "has successfully completed";
    const midWidth = timesItalic.widthOfTextAtSize(midText, 14);
    page.drawText(midText, {
      x: (width - midWidth) / 2,
      y: height - 270,
      size: 14,
      font: timesItalic,
      color: mutedColor,
    });

    // ─── Program Name ───────────────────────────────────────────
    const progSize = programName.length > 40 ? 20 : 24;
    const progWidth = helveticaBold.widthOfTextAtSize(programName, progSize);
    page.drawText(programName, {
      x: (width - progWidth) / 2,
      y: height - 305,
      size: progSize,
      font: helveticaBold,
      color: primaryColor,
    });

    // ─── Badge Name (if different from program) ─────────────────
    if (badgeName !== programName) {
      const badgeTextSize = 14;
      const badgeTextWidth = helvetica.widthOfTextAtSize(badgeName, badgeTextSize);
      page.drawText(badgeName, {
        x: (width - badgeTextWidth) / 2,
        y: height - 330,
        size: badgeTextSize,
        font: helvetica,
        color: mutedColor,
      });
    }

    // ─── Badge Description (if present, max ~80 chars) ──────────
    if (badgeDescription) {
      const descTruncated = badgeDescription.length > 100
        ? badgeDescription.slice(0, 97) + "..."
        : badgeDescription;
      const descSize = 11;
      const descWidth = helvetica.widthOfTextAtSize(descTruncated, descSize);
      page.drawText(descTruncated, {
        x: (width - descWidth) / 2,
        y: height - 355,
        size: descSize,
        font: helvetica,
        color: mutedColor,
      });
    }

    // ─── Bottom section: Date, Issuer, Verification ─────────────
    const bottomY = 110;

    // Issue date (left)
    const dateLabel = "Date Issued";
    const dateValue = issuedAt.toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    page.drawText(dateLabel, {
      x: margin + 60,
      y: bottomY + 30,
      size: 10,
      font: helvetica,
      color: mutedColor,
    });
    page.drawText(dateValue, {
      x: margin + 60,
      y: bottomY + 15,
      size: 12,
      font: helveticaBold,
      color: darkColor,
    });

    // Expiry date (if set, center-left)
    if (expiresAt) {
      const expiryLabel = "Valid Until";
      const expiryValue = expiresAt.toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
      page.drawText(expiryLabel, {
        x: width / 2 - 60,
        y: bottomY + 30,
        size: 10,
        font: helvetica,
        color: mutedColor,
      });
      page.drawText(expiryValue, {
        x: width / 2 - 60,
        y: bottomY + 15,
        size: 12,
        font: helveticaBold,
        color: darkColor,
      });
    }

    // Issued by (right)
    const issuerLabel = "Issued By";
    const issuerLabelWidth = helvetica.widthOfTextAtSize(issuerLabel, 10);
    const issuerValueWidth = helveticaBold.widthOfTextAtSize(issuerName, 12);
    page.drawText(issuerLabel, {
      x: width - margin - 60 - issuerLabelWidth,
      y: bottomY + 30,
      size: 10,
      font: helvetica,
      color: mutedColor,
    });
    page.drawText(issuerName, {
      x: width - margin - 60 - issuerValueWidth,
      y: bottomY + 15,
      size: 12,
      font: helveticaBold,
      color: darkColor,
    });

    // ─── Verification URL (bottom center) ───────────────────────
    const verifyLabel = "Verify at:";
    const verifyText = verificationUrl;
    const verifyLabelWidth = helvetica.widthOfTextAtSize(verifyLabel, 8);
    const verifyTextWidth = helvetica.widthOfTextAtSize(verifyText, 8);
    const totalVerifyWidth = verifyLabelWidth + 4 + verifyTextWidth;
    const verifyStartX = (width - totalVerifyWidth) / 2;

    page.drawText(verifyLabel, {
      x: verifyStartX,
      y: margin + 15,
      size: 8,
      font: helvetica,
      color: mutedColor,
    });
    page.drawText(verifyText, {
      x: verifyStartX + verifyLabelWidth + 4,
      y: margin + 15,
      size: 8,
      font: helvetica,
      color: primaryColor,
    });

    // ─── Serialize PDF ──────────────────────────────────────────
    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${badge.id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return errorResponse.serverError("generate-certificate-pdf", err, cors);
  }
});
