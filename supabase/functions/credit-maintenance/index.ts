import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    // Validate request authorization
    const authHeader = req.headers.get('Authorization');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const providedToken = authHeader?.replace('Bearer ', '');
    if (providedToken !== supabaseAnonKey && providedToken !== supabaseServiceKey) {
      console.error('Unauthorized: Invalid or missing authorization token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for action type
    let action = 'all';
    try {
      const body = await req.json();
      action = body.action || 'all';
    } catch {
      // Default to 'all' if no body
    }

    console.log(`Starting credit maintenance with action: ${action}`);

    const results: Record<string, any> = {};

    // 1. Expire old credit batches
    if (action === 'all' || action === 'expire') {
      console.log('Running credit batch expiration...');
      
      const { data: expireResult, error: expireError } = await supabase.rpc('expire_credit_batches');
      
      if (expireError) {
        console.error('Error expiring batches:', expireError);
        results.expire = { success: false, error: expireError.message };
      } else {
        console.log(`Expired ${expireResult} credit batches`);
        results.expire = { success: true, expiredCount: expireResult };
      }
    }

    // 2. Process rollovers for batches expiring soon
    if (action === 'all' || action === 'rollover') {
      console.log('Processing credit rollovers...');
      
      // Get user and org subscriptions that support rollover
      const { data: subscriptions, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          user_id,
          plan_id,
          plans:plan_id (
            name,
            credit_allowance
          )
        `)
        .eq('status', 'active');

      if (subError) {
        console.error('Error fetching subscriptions for rollover:', subError);
        results.rollover = { success: false, error: subError.message };
      } else {
        let rolloversProcessed = 0;
        let totalRolledOver = 0;

        for (const sub of subscriptions || []) {
          const plan = sub.plans as any;
          if (!plan) continue;

          // Calculate max rollover (50% of monthly allowance by default)
          const maxRollover = Math.floor((plan.credit_allowance || 0) * 0.5);
          
          if (maxRollover <= 0) continue;

          try {
            const { data: rolloverResult, error: rolloverError } = await supabase.rpc('process_credit_rollover', {
              p_owner_type: 'user',
              p_owner_id: sub.user_id,
              p_max_rollover: maxRollover,
            });

            if (rolloverError) {
              console.error(`Rollover error for user ${sub.user_id}:`, rolloverError);
            } else if (rolloverResult && rolloverResult > 0) {
              console.log(`Rolled over ${rolloverResult} credits for user ${sub.user_id}`);
              rolloversProcessed++;
              totalRolledOver += rolloverResult;
            }
          } catch (error: any) {
            console.error(`Error processing rollover for user ${sub.user_id}:`, error);
          }
        }

        // Process org rollovers
        const { data: orgSubs, error: orgSubError } = await supabase
          .from('organization_subscriptions')
          .select(`
            organization_id,
            plan_id,
            plans:plan_id (
              name,
              credit_allowance
            )
          `)
          .eq('status', 'active');

        if (!orgSubError) {
          for (const orgSub of orgSubs || []) {
            const plan = orgSub.plans as any;
            if (!plan) continue;

            const maxRollover = Math.floor((plan.credit_allowance || 0) * 0.5);
            if (maxRollover <= 0) continue;

            try {
              const { data: rolloverResult, error: rolloverError } = await supabase.rpc('process_credit_rollover', {
                p_owner_type: 'org',
                p_owner_id: orgSub.organization_id,
                p_max_rollover: maxRollover,
              });

              if (rolloverError) {
                console.error(`Rollover error for org ${orgSub.organization_id}:`, rolloverError);
              } else if (rolloverResult && rolloverResult > 0) {
                console.log(`Rolled over ${rolloverResult} credits for org ${orgSub.organization_id}`);
                rolloversProcessed++;
                totalRolledOver += rolloverResult;
              }
            } catch (error: any) {
              console.error(`Error processing rollover for org ${orgSub.organization_id}:`, error);
            }
          }
        }

        results.rollover = {
          success: true,
          rolloversProcessed,
          totalRolledOver,
        };
      }
    }

    // 3. Clean up zero-balance batches (optional maintenance)
    if (action === 'all' || action === 'cleanup') {
      console.log('Cleaning up zero-balance batches...');
      
      // Get count of expired or depleted batches older than 90 days
      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - 90);

      const { count, error: cleanupCountError } = await supabase
        .from('credit_batches')
        .select('*', { count: 'exact', head: true })
        .eq('remaining_amount', 0)
        .lt('created_at', cleanupDate.toISOString());

      if (cleanupCountError) {
        console.error('Error counting cleanup batches:', cleanupCountError);
        results.cleanup = { success: false, error: cleanupCountError.message };
      } else {
        // We don't actually delete, just report how many could be archived
        results.cleanup = {
          success: true,
          archivableBatches: count || 0,
          message: 'Batches older than 90 days with zero balance can be archived',
        };
      }
    }

    // 4. Generate summary statistics
    if (action === 'all' || action === 'stats') {
      console.log('Generating credit statistics...');
      
      const { data: stats, error: statsError } = await supabase
        .from('credit_batches')
        .select('owner_type, status, remaining_amount, original_amount')
        .in('status', ['active', 'partial']);

      if (statsError) {
        console.error('Error fetching stats:', statsError);
        results.stats = { success: false, error: statsError.message };
      } else {
        const userStats = {
          activeBatches: 0,
          totalRemaining: 0,
          totalOriginal: 0,
        };
        const orgStats = {
          activeBatches: 0,
          totalRemaining: 0,
          totalOriginal: 0,
        };

        for (const batch of stats || []) {
          const target = batch.owner_type === 'user' ? userStats : orgStats;
          target.activeBatches++;
          target.totalRemaining += batch.remaining_amount || 0;
          target.totalOriginal += batch.original_amount || 0;
        }

        results.stats = {
          success: true,
          users: userStats,
          organizations: orgStats,
          utilizationRate: userStats.totalOriginal > 0 
            ? Math.round((1 - userStats.totalRemaining / userStats.totalOriginal) * 100) 
            : 0,
        };
      }
    }

    console.log('Credit maintenance complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json", ...cors } }
    );

  } catch (error: any) {
    console.error('Error in credit-maintenance:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json", ...cors }
      }
    );
  }
});
