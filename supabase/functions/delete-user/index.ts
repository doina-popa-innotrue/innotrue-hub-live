import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Origin-aware CORS for admin operations
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://app.innotrue.com',
    Deno.env.get('SITE_URL'),
  ].filter(Boolean);
  
  let allowedOrigin = 'https://app.innotrue.com';
  if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

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
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
      throw new Error('Missing authorization header');
    }

    // Verify the caller is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
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
      throw new Error('Unauthorized: Admin access required');
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      console.warn(`Rate limit exceeded for admin ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    // Get the request body and validate
    const body = await req.json();
    const userId = validateUserId(body?.userId);
    const action = validateAction(body?.action);
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing userId. Must be a valid UUID.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Prevent admin from deleting/disabling themselves
    if (userId === user.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot perform this action on your own account' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Handle different actions
    if (action === 'disable') {
      console.log(`Admin ${user.id} disabling user ${userId}`);
      
      // Disable user using admin API
      const { error: disableError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: '876000h' } // Ban for ~100 years (effectively permanent)
      );

      if (disableError) {
        console.error('Error disabling user:', disableError);
        throw disableError;
      }

      console.log(`Successfully disabled user ${userId}`);

      return new Response(
        JSON.stringify({ success: true, message: 'User disabled successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (action === 'enable') {
      console.log(`Admin ${user.id} enabling user ${userId}`);
      
      // Enable user by removing ban
      const { error: enableError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: 'none' }
      );

      if (enableError) {
        console.error('Error enabling user:', enableError);
        throw enableError;
      }

      console.log(`Successfully enabled user ${userId}`);

      return new Response(
        JSON.stringify({ success: true, message: 'User enabled successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Default action: delete user
      console.log(`Admin ${user.id} deleting user ${userId}`);

      // Delete the user using admin API
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        throw deleteError;
      }

      console.log(`Successfully deleted user ${userId}`);

      return new Response(
        JSON.stringify({ success: true, message: 'User deleted successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in delete-user function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: errorMessage === 'Unauthorized' || errorMessage.includes('Unauthorized') ? 403 : 500,
      }
    );
  }
});
