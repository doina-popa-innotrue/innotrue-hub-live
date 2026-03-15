import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all program data and generates a Markdown export of the full structure.
 * Triggered from Admin → Program Detail → "Export Structure" button.
 */
export async function exportProgramStructure(programId: string) {
  // Fetch all data in parallel
  const [
    { data: program },
    { data: modules },
    { data: cohorts },
    { data: tierPlans },
  ] = await Promise.all([
    supabase.from("programs").select("*").eq("id", programId).single(),
    supabase
      .from("program_modules")
      .select("*, content_packages(id, title, package_type)")
      .eq("program_id", programId)
      .order("order_index"),
    supabase
      .from("program_cohorts")
      .select("*")
      .eq("program_id", programId)
      .order("start_date"),
    supabase
      .from("program_tier_plans")
      .select("*, program_plans(display_name)")
      .eq("program_id", programId)
      .order("tier_name"),
  ]);

  if (!program) throw new Error("Program not found");

  const moduleIds = (modules ?? []).map((m) => m.id);
  const assessmentIds = (modules ?? [])
    .map((m) => m.capability_assessment_id)
    .filter(Boolean) as string[];

  // Fetch module-level details in parallel
  const [
    { data: sections },
    { data: skills },
    { data: scenarios },
    { data: resources },
    { data: assessments },
    { data: domains },
  ] = await Promise.all([
    moduleIds.length
      ? supabase
          .from("module_sections")
          .select("*")
          .in("module_id", moduleIds)
          .order("order_index")
      : Promise.resolve({ data: [] }),
    moduleIds.length
      ? supabase
          .from("module_skills")
          .select("*, skills(name, category)")
          .in("module_id", moduleIds)
      : Promise.resolve({ data: [] }),
    moduleIds.length
      ? supabase
          .from("module_scenarios")
          .select("*, scenario_templates(title, description)")
          .in("module_id", moduleIds)
          .order("order_index")
      : Promise.resolve({ data: [] }),
    moduleIds.length
      ? supabase
          .from("module_resource_assignments")
          .select("*, resource_library(title, resource_type)")
          .in("module_id", moduleIds)
          .order("order_index")
      : Promise.resolve({ data: [] }),
    assessmentIds.length
      ? supabase
          .from("capability_assessments")
          .select("id, name, description, rating_scale, assessment_mode")
          .in("id", assessmentIds)
      : Promise.resolve({ data: [] }),
    assessmentIds.length
      ? supabase
          .from("capability_domains")
          .select("*")
          .in("assessment_id", assessmentIds)
          .order("order_index")
      : Promise.resolve({ data: [] }),
  ]);

  // Index by module_id for quick lookup
  const sectionsByModule = groupBy(sections ?? [], "module_id");
  const skillsByModule = groupBy(skills ?? [], "module_id");
  const scenariosByModule = groupBy(scenarios ?? [], "module_id");
  const resourcesByModule = groupBy(resources ?? [], "module_id");
  const assessmentMap = Object.fromEntries(
    (assessments ?? []).map((a) => [a.id, a])
  );
  const domainsByAssessment = groupBy(domains ?? [], "assessment_id");

  // Build the Markdown
  const lines: string[] = [];
  const now = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  lines.push(`# ${program.name}`);
  if (program.code) lines.push(`**Code:** ${program.code}`);
  lines.push(`**Status:** ${program.is_active ? (program.is_published ? "Published" : "Draft") : "Archived"}`);
  if (program.description) {
    lines.push("");
    lines.push(stripHtml(program.description));
  }
  lines.push("");
  lines.push(`*Exported on ${now}*`);
  lines.push("");

  // --- Tier Plans ---
  if ((tierPlans ?? []).length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Tier Plans");
    lines.push("");
    for (const tp of tierPlans!) {
      const planName =
        (tp as any).program_plans?.display_name ?? tp.program_plan_id;
      const cost = tp.credit_cost != null ? ` (${tp.credit_cost} credits)` : "";
      lines.push(`- **${tp.tier_name}** — ${planName}${cost}`);
    }
    lines.push("");
  }

  // --- Cohorts ---
  if ((cohorts ?? []).length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Cohorts");
    lines.push("");
    for (const c of cohorts!) {
      const dates = [c.start_date, c.end_date].filter(Boolean).join(" → ");
      const cap = c.capacity ? ` | Capacity: ${c.capacity}` : "";
      lines.push(`- **${c.name}** — ${c.status}${dates ? ` | ${dates}` : ""}${cap}`);
      if (c.description) lines.push(`  ${stripHtml(c.description)}`);
    }
    lines.push("");
  }

  // --- Modules ---
  lines.push("---");
  lines.push("");
  lines.push("## Modules");
  lines.push("");

  for (const [i, mod] of (modules ?? []).entries()) {
    const num = i + 1;
    const active = mod.is_active === false ? " *(inactive)*" : "";
    lines.push(`### ${num}. ${mod.title}${active}`);
    if (mod.code) lines.push(`**Code:** ${mod.code}`);
    lines.push(`**Type:** ${mod.module_type}${mod.learning_mode ? ` | Mode: ${mod.learning_mode}` : ""}`);
    if (mod.estimated_minutes)
      lines.push(`**Estimated time:** ${mod.estimated_minutes} min`);
    if (mod.is_individualized) lines.push(`**Individualized:** Yes`);
    if (mod.tier_required) lines.push(`**Tier required:** ${mod.tier_required}`);
    if (mod.unlock_after_days)
      lines.push(`**Unlocks after:** ${mod.unlock_after_days} days`);
    if (mod.available_from_date)
      lines.push(`**Available from:** ${mod.available_from_date}`);
    if (mod.description) {
      lines.push("");
      lines.push(stripHtml(mod.description));
    }

    // Content package
    if (mod.content_packages) {
      const cp = mod.content_packages as any;
      lines.push("");
      lines.push(`**Content package:** ${cp.title} (${cp.package_type})`);
    }

    // Sections
    const modSections = sectionsByModule[mod.id] ?? [];
    if (modSections.length > 0) {
      lines.push("");
      lines.push("#### Sections");
      for (const s of modSections) {
        lines.push(`${s.order_index}. **${s.title ?? "(untitled)"}** — ${s.section_type}`);
      }
    }

    // Skills
    const modSkills = skillsByModule[mod.id] ?? [];
    if (modSkills.length > 0) {
      lines.push("");
      lines.push("#### Skills");
      for (const s of modSkills) {
        const skill = (s as any).skills;
        if (skill) {
          lines.push(`- ${skill.name}${skill.category ? ` (${skill.category})` : ""}`);
        }
      }
    }

    // Resources
    const modResources = resourcesByModule[mod.id] ?? [];
    if (modResources.length > 0) {
      lines.push("");
      lines.push("#### Resources");
      for (const r of modResources) {
        const res = (r as any).resource_library;
        const req = r.is_required ? " *(required)*" : "";
        if (res) {
          lines.push(`- ${res.title} (${res.resource_type})${req}`);
        }
      }
    }

    // Scenarios
    const modScenarios = scenariosByModule[mod.id] ?? [];
    if (modScenarios.length > 0) {
      lines.push("");
      lines.push("#### Scenarios");
      for (const s of modScenarios) {
        const tmpl = (s as any).scenario_templates;
        const cert = s.is_required_for_certification
          ? " *(required for certification)*"
          : "";
        if (tmpl) {
          lines.push(`- **${tmpl.title}**${cert}`);
          if (tmpl.description) lines.push(`  ${stripHtml(tmpl.description)}`);
        }
      }
    }

    // Capability assessment
    if (mod.capability_assessment_id && assessmentMap[mod.capability_assessment_id]) {
      const a = assessmentMap[mod.capability_assessment_id];
      lines.push("");
      lines.push("#### Capability Assessment");
      lines.push(`**${a.name}** — ${a.assessment_mode} | Rating scale: ${a.rating_scale}`);
      if (a.description) lines.push(`${stripHtml(a.description)}`);

      const aDomains = domainsByAssessment[a.id] ?? [];
      if (aDomains.length > 0) {
        lines.push("");
        lines.push("**Domains:**");
        for (const d of aDomains) {
          lines.push(`- ${d.name}${d.description ? ` — ${stripHtml(d.description)}` : ""}`);
        }
      }
    }

    lines.push("");
  }

  // Generate and download
  const markdown = lines.join("\n");
  const filename = `${slugify(program.name)}-structure.md`;
  downloadFile(markdown, filename, "text/markdown;charset=utf-8");
}

// --- Helpers ---

function groupBy<T extends Record<string, any>>(arr: T[], key: string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = item[key];
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function stripHtml(html: string): string {
  // Convert common HTML to markdown-ish text
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "  - ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
