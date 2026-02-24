import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

// Simple in-memory rate limiting (per admin, per minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // max requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Input validation
function validateUserId(userId: unknown): string | null {
  if (typeof userId !== 'string' || !userId) {
    return null;
  }
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return null;
  }
  return userId;
}

function validateAction(action: unknown): 'delete' | 'disable' | 'enable' {
  if (action === 'disable' || action === 'enable') {
    return action;
  }
  return 'delete'; // Default action
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse.unauthorized('Missing authorization header', cors);
    }

    // Verify the caller is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return errorResponse.unauthorized('Unauthorized', cors);
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('Unauthorized access attempt by user:', user.id);
      return errorResponse.forbidden('Unauthorized: Admin access required', cors);
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      console.warn(`Rate limit exceeded for admin ${user.id}`);
      return errorResponse.rateLimit(undefined, cors);
    }

    // Get the request body and validate
    const body = await req.json();
    const userId = validateUserId(body?.userId);
    const action = validateAction(body?.action);

    if (!userId) {
      return errorResponse.badRequest('Invalid or missing userId. Must be a valid UUID.', cors);
    }

    // Prevent admin from deleting/disabling themselves
    if (userId === user.id) {
      return errorResponse.badRequest('You cannot perform this action on your own account', cors);
    }

    // Handle different actions
    if (action === 'disable') {
      console.log(`Admin ${user.id} disabling user ${userId}`);

      const { error: disableError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: '876000h' }
      );

      if (disableError) {
        console.error('Error disabling user:', disableError);
        throw disableError;
      }

      // Belt+suspenders: also update profiles.is_disabled (trigger on auth.users handles this too)
      await supabaseAdmin.from('profiles').update({ is_disabled: true }).eq('id', userId);

      console.log(`Successfully disabled user ${userId}`);
      return successResponse.ok({ success: true, message: 'User disabled successfully' }, cors);
    } else if (action === 'enable') {
      console.log(`Admin ${user.id} enabling user ${userId}`);

      const { error: enableError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: 'none' }
      );

      if (enableError) {
        console.error('Error enabling user:', enableError);
        throw enableError;
      }

      // Belt+suspenders: also update profiles.is_disabled (trigger on auth.users handles this too)
      await supabaseAdmin.from('profiles').update({ is_disabled: false }).eq('id', userId);

      console.log(`Successfully enabled user ${userId}`);
      return successResponse.ok({ success: true, message: 'User enabled successfully' }, cors);
    } else {
      console.log(`Admin ${user.id} deleting user ${userId}`);

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        throw deleteError;
      }

      console.log(`Successfully deleted user ${userId}`);
      return successResponse.ok({ success: true, message: 'User deleted successfully' }, cors);
    }
  } catch (error: unknown) {
    return errorResponse.serverError('delete-user', error, cors);
  }
});
