import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the cleanup function
    const { data, error } = await supabaseClient.rpc('cleanup_old_notifications');

    if (error) {
      console.error('Cleanup error:', error);
      throw error;
    }

    console.log(`Cleaned up ${data} old notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_count: data,
        message: `Cleaned up ${data} old notifications` 
      }),
      { 
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in cleanup-notifications:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
