import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isValidEmail, validatePassword, validateName, isValidUUID, isValidEnum } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  roles?: string[];
  plan_id?: string;
  isPlaceholder?: boolean;
  realEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with the caller's JWT to verify they're an admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the calling user
    const { data: { user: callerUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is an admin
    const { data: callerRoles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isAdmin = callerRoles?.some(r => r.role === "admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, password, name, roles, plan_id, isPlaceholder, realEmail }: CreateUserRequest = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Email, password, and name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength (skip for placeholder users with generated passwords)
    if (!isPlaceholder) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return new Response(
          JSON.stringify({ error: passwordError }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate name
    const validatedName = validateName(name);
    if (!validatedName) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid name (max 200 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate optional plan_id if provided
    if (plan_id && !isValidUUID(plan_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid plan ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate roles if provided
    const VALID_ROLES = ["admin", "client", "coach", "instructor"] as const;
    if (roles && roles.length > 0) {
      const invalidRole = roles.find(r => !isValidEnum(r, VALID_ROLES));
      if (invalidRole) {
        return new Response(
          JSON.stringify({ error: `Invalid role: ${invalidRole}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate realEmail if provided
    if (realEmail && !isValidEmail(realEmail)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid real email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client for user creation
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user via admin API (this does NOT affect the current session)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: { name: validatedName, isPlaceholder: isPlaceholder || false }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = userData.user.id;

    // Update profile with plan and real_email if provided
    const profileUpdate: Record<string, unknown> = {};
    if (plan_id) {
      profileUpdate.plan_id = plan_id;
    }
    if (isPlaceholder && realEmail) {
      profileUpdate.real_email = realEmail;
    }
    
    if (Object.keys(profileUpdate).length > 0) {
      await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", newUserId);
    }

    // Assign roles if provided
    if (roles && roles.length > 0) {
      const roleInserts = roles.map(role => ({
        user_id: newUserId,
        role
      }));
      
      const { error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .insert(roleInserts);

      if (rolesError) {
        console.error("Error assigning roles:", rolesError);
        // User was created, just log the roles error
      }
    }

    console.log(`Admin ${callerUser.email} created ${isPlaceholder ? 'placeholder ' : ''}user ${email}${realEmail ? ` (real: ${realEmail})` : ''}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUserId,
          email: userData.user.email,
          isPlaceholder: isPlaceholder || false
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in create-admin-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
