import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface UpdateClientDevelopmentItemRequest {
  itemId: string;
  title: string | null;
  content: string | null;
  resourceUrl: string | null;
  dueDate: string | null;
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
  try {
    const url = new URL(t);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("No authorization header", cors);
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
      return errorResponse.unauthorized("Unauthorized", cors);
    }

    const body = (await req.json()) as Partial<UpdateClientDevelopmentItemRequest>;

    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    if (!isUuid(itemId)) {
      return errorResponse.badRequest("Invalid itemId", cors);
    }

    // Authorization: must have instructor/coach/admin role
    const { data: roles, error: rolesError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    if (rolesError) {
      console.error("role lookup error", rolesError);
      return errorResponse.forbidden("Access denied", cors);
    }

    const hasTeachingRole = roles?.some(
      (r) => r.role === "instructor" || r.role === "coach" || r.role === "admin",
    );
    if (!hasTeachingRole) {
      return errorResponse.forbidden("Access denied", cors);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Load the existing item to verify ownership/authorship
    const { data: existingItem, error: itemLookupError } = await admin
      .from("development_items")
      .select("id, user_id, author_id, item_type")
      .eq("id", itemId)
      .single();

    if (itemLookupError || !existingItem) {
      console.error("item lookup error", itemLookupError);
      return errorResponse.notFound("Item not found", cors);
    }

    // Verify: caller must be the author, OR have admin role
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (existingItem.author_id !== callingUser.id && !isAdmin) {
      return errorResponse.forbidden("Not authorized to edit this item", cors);
    }

    // Build update data
    const title = normalizeText(body.title, 200);
    const content = normalizeText(body.content, 5000);
    const dueDate = normalizeText(body.dueDate, 32);

    const updateData: Record<string, unknown> = {
      title,
      content,
      updated_at: new Date().toISOString(),
    };

    if (existingItem.item_type === "resource") {
      updateData.resource_url = normalizeUrl(body.resourceUrl, 1000);
    }

    if (existingItem.item_type === "action_item") {
      updateData.due_date = dueDate;
    }

    const { data: updatedItem, error: updateError } = await admin
      .from("development_items")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single();

    if (updateError || !updatedItem) {
      console.error("development_items update error", updateError);
      return errorResponse.serverErrorWithMessage("Failed to update item", cors);
    }

    return successResponse.ok({ item: updatedItem }, cors);
  } catch (e) {
    return errorResponse.serverError("update-client-development-item", e, cors);
  }
});
