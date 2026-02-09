import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ItemType = "reflection" | "note" | "resource" | "action_item";
type ResourceMode = "url" | "file" | "library";

interface CreateClientDevelopmentItemRequest {
  forUserId: string;
  moduleProgressId: string;
  snapshotId: string | null;
  questionId: string | null;
  domainId: string | null;
  goalId: string | null;
  milestoneId: string | null;
  itemType: ItemType;
  title: string | null;
  content: string | null;
  resourceUrl: string | null;
  dueDate: string | null;
  // New fields for file/library resources
  filePath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  libraryResourceId: string | null;
  resourceMode: ResourceMode | null;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function normalizeText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function normalizeUrl(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) return t.slice(0, max);
  // basic URL validation
  try {
    const url = new URL(t);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await userClient.auth.getUser();
    const callingUser = userData.user;
    if (!callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Partial<CreateClientDevelopmentItemRequest>;

    const forUserId = typeof body.forUserId === "string" ? body.forUserId : "";
    const moduleProgressId = typeof body.moduleProgressId === "string" ? body.moduleProgressId : "";

    if (!isUuid(forUserId) || !isUuid(moduleProgressId)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemType = body.itemType;
    if (!itemType || !["reflection", "note", "resource", "action_item"].includes(itemType)) {
      return new Response(JSON.stringify({ error: "Invalid itemType" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = normalizeText(body.title, 200);
    const content = normalizeText(body.content, 5000);
    const resourceUrl = normalizeUrl(body.resourceUrl, 1000);
    const dueDate = normalizeText(body.dueDate, 32);

    // Authorization: must have instructor/coach role
    const { data: roles, error: rolesError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    if (rolesError) {
      console.error("role lookup error", rolesError);
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasTeachingRole = roles?.some((r) => r.role === "instructor" || r.role === "coach" || r.role === "admin");
    if (!hasTeachingRole) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Load module progress + client
    const { data: mp, error: mpError } = await admin
      .from("module_progress")
      .select("id, module_id, enrollment_id, client_enrollments(client_user_id, program_id)")
      .eq("id", moduleProgressId)
      .single();

    if (mpError || !mp) {
      console.error("module_progress lookup error", mpError);
      return new Response(JSON.stringify({ error: "Invalid moduleProgressId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enrollment = (mp as any).client_enrollments;
    const clientUserId = enrollment?.client_user_id as string | undefined;
    const programId = enrollment?.program_id as string | undefined;

    if (!clientUserId || clientUserId !== forUserId) {
      return new Response(JSON.stringify({ error: "Client mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify instructor/coach assignment to module or program
    const moduleId = (mp as any).module_id as string;

    const [moduleInstructor, moduleCoach, programInstructor, programCoach] = await Promise.all([
      admin
        .from("module_instructors")
        .select("id")
        .eq("module_id", moduleId)
        .eq("instructor_id", callingUser.id)
        .maybeSingle(),
      admin
        .from("module_coaches")
        .select("id")
        .eq("module_id", moduleId)
        .eq("coach_id", callingUser.id)
        .maybeSingle(),
      programId
        ? admin
            .from("program_instructors")
            .select("id")
            .eq("program_id", programId)
            .eq("instructor_id", callingUser.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      programId
        ? admin
            .from("program_coaches")
            .select("id")
            .eq("program_id", programId)
            .eq("coach_id", callingUser.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const isAssigned =
      !!moduleInstructor.data || !!moduleCoach.data || !!programInstructor.data || !!programCoach.data ||
      roles?.some((r) => r.role === "admin");

    if (!isAssigned) {
      return new Response(JSON.stringify({ error: "Not assigned to this client/module" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse file/library resource fields
    const filePath = normalizeText(body.filePath, 500);
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : null;
    const mimeType = normalizeText(body.mimeType, 100);
    const libraryResourceId = typeof body.libraryResourceId === "string" && isUuid(body.libraryResourceId) 
      ? body.libraryResourceId 
      : null;
    const resourceMode = body.resourceMode || "url";

    // Create the item
    const itemData: any = {
      user_id: forUserId,
      author_id: callingUser.id,
      item_type: itemType,
      title,
      content,
    };

    if (itemType === "resource") {
      if (resourceMode === "file" && filePath) {
        itemData.file_path = filePath;
        itemData.file_size = fileSize;
        itemData.mime_type = mimeType;
        itemData.resource_type = mimeType?.startsWith("image/") ? "image" : "file";
      } else if (resourceMode === "library" && libraryResourceId) {
        itemData.library_resource_id = libraryResourceId;
        itemData.resource_type = "library";
      } else {
        itemData.resource_url = resourceUrl;
        itemData.resource_type = "link";
      }
    }

    if (itemType === "action_item") {
      itemData.status = "pending";
      itemData.due_date = dueDate;
    }

    const { data: item, error: itemError } = await admin
      .from("development_items")
      .insert(itemData)
      .select()
      .single();

    if (itemError || !item) {
      console.error("development_items insert error", itemError);
      return new Response(JSON.stringify({ error: "Failed to create item" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Link to snapshot
    const snapshotId = typeof body.snapshotId === "string" && isUuid(body.snapshotId) ? body.snapshotId : null;
    if (snapshotId) {
      const { error } = await admin.from("development_item_snapshot_links").insert({
        development_item_id: item.id,
        snapshot_id: snapshotId,
      });
      if (error) console.error("snapshot link error", error);
    }

    // Link to module progress
    const { error: moduleLinkError } = await admin.from("development_item_module_links").insert({
      development_item_id: item.id,
      module_progress_id: moduleProgressId,
    });
    if (moduleLinkError) console.error("module link error", moduleLinkError);

    // Optional links
    const questionId = typeof body.questionId === "string" && isUuid(body.questionId) ? body.questionId : null;
    if (questionId && snapshotId) {
      const { error } = await admin.from("development_item_question_links").insert({
        development_item_id: item.id,
        question_id: questionId,
        snapshot_id: snapshotId,
      });
      if (error) console.error("question link error", error);
    }

    const domainId = typeof body.domainId === "string" && isUuid(body.domainId) ? body.domainId : null;
    if (domainId && snapshotId && !questionId) {
      const { error } = await admin.from("development_item_domain_links").insert({
        development_item_id: item.id,
        domain_id: domainId,
        snapshot_id: snapshotId,
      });
      if (error) console.error("domain link error", error);
    }

    const goalId = typeof body.goalId === "string" && isUuid(body.goalId) ? body.goalId : null;
    if (goalId) {
      const { error } = await admin.from("development_item_goal_links").insert({
        development_item_id: item.id,
        goal_id: goalId,
      });
      if (error) console.error("goal link error", error);
    }

    const milestoneId = typeof body.milestoneId === "string" && isUuid(body.milestoneId) ? body.milestoneId : null;
    if (milestoneId) {
      const { error } = await admin.from("development_item_milestone_links").insert({
        development_item_id: item.id,
        milestone_id: milestoneId,
      });
      if (error) console.error("milestone link error", error);
    }

    return new Response(JSON.stringify({ item }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-client-development-item error", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
