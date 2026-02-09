import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-CREDIT-TOPUP] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request
    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') throw new Error("Session ID is required");
    logStep("Request parsed", { sessionId });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    logStep("Session retrieved", { status: session.status, paymentStatus: session.payment_status });

    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment not completed',
        status: session.payment_status 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check metadata
    const metadata = session.metadata || {};
    if (metadata.type !== 'user_credit_topup') {
      throw new Error("Invalid session type");
    }
    if (metadata.user_id !== user.id) {
      throw new Error("User mismatch");
    }

    const creditValue = parseInt(metadata.credit_value || '0');
    const packageId = metadata.package_id;

    logStep("Metadata parsed", { creditValue, packageId });

    // IDEMPOTENCY: Check for existing completed purchase by session ID first
    const { data: existingPurchase } = await supabaseClient
      .from('user_credit_purchases')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingPurchase) {
      logStep("Purchase already completed (idempotent return)", { purchaseId: existingPurchase.id });
      
      const { data: balance } = await supabaseClient
        .from('user_credit_balances')
        .select('available_credits')
        .eq('user_id', user.id)
        .single();

      return new Response(JSON.stringify({ 
        success: true, 
        alreadyProcessed: true,
        creditsAdded: existingPurchase.credits_purchased,
        currentBalance: balance?.available_credits || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Find pending purchase by session ID
    const { data: pendingPurchase } = await supabaseClient
      .from('user_credit_purchases')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .eq('status', 'pending')
      .maybeSingle();

    const paymentIntent = session.payment_intent as Stripe.PaymentIntent;

    if (pendingPurchase) {
      // Update to completed atomically
      const { error: updateError } = await supabaseClient
        .from('user_credit_purchases')
        .update({
          status: 'completed',
          stripe_payment_intent_id: paymentIntent?.id,
        })
        .eq('id', pendingPurchase.id)
        .eq('status', 'pending'); // Only update if still pending

      if (updateError) {
        // Check if already completed (race condition)
        const { data: recheckPurchase } = await supabaseClient
          .from('user_credit_purchases')
          .select('*')
          .eq('id', pendingPurchase.id)
          .single();

        if (recheckPurchase?.status === 'completed') {
          logStep("Purchase completed by concurrent request", { purchaseId: pendingPurchase.id });
          const { data: balance } = await supabaseClient
            .from('user_credit_balances')
            .select('available_credits')
            .eq('user_id', user.id)
            .single();

          return new Response(JSON.stringify({ 
            success: true, 
            alreadyProcessed: true,
            creditsAdded: recheckPurchase.credits_purchased,
            currentBalance: balance?.available_credits || 0,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        throw updateError;
      }

      logStep("Purchase marked as completed", { purchaseId: pendingPurchase.id });

      // Calculate expiry date (12 months from now for purchased credits)
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 12);

      // Add credits using the consolidated grant_credit_batch function
      const { data: batchId, error: creditError } = await supabaseClient.rpc('grant_credit_batch', {
        p_owner_type: 'user',
        p_owner_id: user.id,
        p_amount: pendingPurchase.credits_purchased,
        p_expires_at: expiresAt.toISOString(),
        p_source_type: 'topup',
        p_feature_key: null,
        p_source_reference_id: pendingPurchase.id,
        p_notes: `Credit top-up: ${pendingPurchase.credits_purchased} credits`,
      });

      if (creditError) {
        logStep("Error adding credits", { error: creditError.message });
        throw new Error(`Failed to add credits: ${creditError.message}`);
      }

      logStep("Credits added successfully via grant_credit_batch", { batchId });

      return new Response(JSON.stringify({ 
        success: true, 
        creditsAdded: pendingPurchase.credits_purchased,
        batchId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // No pending purchase found - create one and add credits
      logStep("No pending purchase found, creating new record");

      const expiresAt = metadata.expires_at || null;

      // Use upsert with session ID to prevent duplicates
      const { data: newPurchase, error: insertError } = await supabaseClient
        .from('user_credit_purchases')
        .upsert({
          user_id: user.id,
          package_id: packageId,
          credits_purchased: creditValue,
          amount_cents: session.amount_total || 0,
          currency: session.currency || 'eur',
          stripe_checkout_session_id: sessionId,
          stripe_payment_intent_id: paymentIntent?.id,
          expires_at: expiresAt,
          status: 'completed',
        }, {
          onConflict: 'stripe_checkout_session_id',
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create purchase record: ${insertError.message}`);
      }

      // Calculate expiry date (12 months from now for purchased credits)
      const purchaseExpiresAt = new Date();
      purchaseExpiresAt.setMonth(purchaseExpiresAt.getMonth() + 12);

      // Add credits using the consolidated grant_credit_batch function
      const { data: batchId, error: creditError } = await supabaseClient.rpc('grant_credit_batch', {
        p_owner_type: 'user',
        p_owner_id: user.id,
        p_amount: creditValue,
        p_expires_at: purchaseExpiresAt.toISOString(),
        p_source_type: 'topup',
        p_feature_key: null,
        p_source_reference_id: newPurchase.id,
        p_notes: `Credit top-up: ${creditValue} credits`,
      });

      if (creditError) {
        throw new Error(`Failed to add credits: ${creditError.message}`);
      }

      logStep("Credits added successfully via grant_credit_batch", { batchId });

      return new Response(JSON.stringify({ 
        success: true, 
        creditsAdded: creditValue,
        batchId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
