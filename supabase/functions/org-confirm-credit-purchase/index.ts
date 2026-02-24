import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-CONFIRM-CREDIT-PURCHASE] ${step}${detailsStr}`);
};

/**
 * Get default purchase credit expiry from system_settings.
 * Single source of truth — no hardcoded durations.
 */
async function getDefaultPurchaseExpiry(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'purchased_credit_expiry_months')
    .single();
  const months = parseInt(data?.value || '120', 10);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
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

    // Parse request - session_id from Stripe redirect
    const { sessionId, organizationId } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') throw new Error("Session ID is required");
    if (!organizationId || typeof organizationId !== 'string') throw new Error("Organization ID is required");
    logStep("Request parsed", { sessionId, organizationId });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    logStep("Session retrieved", { status: session.status, paymentStatus: session.payment_status });

    if (session.payment_status !== 'paid') {
      return successResponse.ok({
        success: false,
        error: 'Payment not completed',
        status: session.payment_status
      }, cors);
    }

    // Check metadata
    const metadata = session.metadata || {};
    if (metadata.type !== 'org_credit_purchase') {
      throw new Error("Invalid session type");
    }
    if (metadata.organization_id !== organizationId) {
      throw new Error("Organization mismatch");
    }

    const creditValue = parseInt(metadata.credit_value || '0');
    const expiresAtFromMeta = metadata.expires_at || null;
    const packageId = metadata.package_id;
    const purchasedBy = metadata.purchased_by;

    logStep("Metadata parsed", { creditValue, packageId, expiresAtFromMeta });

    // IDEMPOTENCY: Check for existing completed purchase by session ID first
    const { data: existingPurchase } = await supabaseClient
      .from('org_credit_purchases')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingPurchase) {
      logStep("Purchase already completed (idempotent return)", { purchaseId: existingPurchase.id });
      
      const { data: balance } = await supabaseClient
        .from('org_credit_balances')
        .select('available_credits')
        .eq('organization_id', organizationId)
        .single();

      return successResponse.ok({
        success: true,
        alreadyProcessed: true,
        creditsAdded: existingPurchase.credits_purchased,
        currentBalance: balance?.available_credits || 0,
      }, cors);
    }

    // Find pending purchase by session ID
    const { data: pendingPurchase } = await supabaseClient
      .from('org_credit_purchases')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .eq('status', 'pending')
      .maybeSingle();

    const paymentIntent = session.payment_intent as Stripe.PaymentIntent;

    if (pendingPurchase) {
      // Update to completed atomically - only if still pending
      const { error: updateError } = await supabaseClient
        .from('org_credit_purchases')
        .update({
          status: 'completed',
          stripe_payment_intent_id: paymentIntent?.id,
        })
        .eq('id', pendingPurchase.id)
        .eq('status', 'pending');

      if (updateError) {
        // Check if already completed (race condition)
        const { data: recheckPurchase } = await supabaseClient
          .from('org_credit_purchases')
          .select('*')
          .eq('id', pendingPurchase.id)
          .single();

        if (recheckPurchase?.status === 'completed') {
          logStep("Purchase completed by concurrent request", { purchaseId: pendingPurchase.id });
          const { data: balance } = await supabaseClient
            .from('org_credit_balances')
            .select('available_credits')
            .eq('organization_id', organizationId)
            .single();

          return successResponse.ok({
            success: true,
            alreadyProcessed: true,
            creditsAdded: recheckPurchase.credits_purchased,
            currentBalance: balance?.available_credits || 0,
          }, cors);
        }
        throw updateError;
      }

      logStep("Purchase marked as completed", { purchaseId: pendingPurchase.id });

      // Use expires_at from Stripe metadata (set by org-purchase-credits from package.validity_months)
      // Fall back to system setting (single source of truth for purchased credit expiry)
      const expiresAt = expiresAtFromMeta || await getDefaultPurchaseExpiry(supabaseClient);

      // Add credits using the consolidated grant_credit_batch function
      const { data: batchId, error: creditError } = await supabaseClient.rpc('grant_credit_batch', {
        p_owner_type: 'org',
        p_owner_id: organizationId,
        p_amount: pendingPurchase.credits_purchased,
        p_expires_at: expiresAt,
        p_source_type: 'purchase',
        p_feature_key: null,
        p_source_reference_id: pendingPurchase.id,
        p_description: `Credit package purchase: ${pendingPurchase.credits_purchased} credits`,
      });

      if (creditError) {
        logStep("Error adding credits", { error: creditError.message });
        throw new Error(`Failed to add credits: ${creditError.message}`);
      }

      logStep("Credits added successfully via grant_credit_batch", { batchId });

      return successResponse.ok({
        success: true,
        creditsAdded: pendingPurchase.credits_purchased,
        batchId,
      }, cors);
    } else {
      // No pending purchase found - create one and add credits
      // This handles cases where the pending record wasn't created
      logStep("No pending purchase found, creating new record");

      // Use upsert with session ID to prevent duplicates
      const { data: newPurchase, error: insertError } = await supabaseClient
        .from('org_credit_purchases')
        .upsert({
          organization_id: organizationId,
          package_id: packageId,
          credits_purchased: creditValue,
          amount_cents: session.amount_total || 0,
          currency: session.currency || 'eur',
          stripe_checkout_session_id: sessionId,
          stripe_payment_intent_id: paymentIntent?.id,
          expires_at: expiresAtFromMeta,
          status: 'completed',
          purchased_by: purchasedBy || user.id,
        }, {
          onConflict: 'stripe_checkout_session_id',
        })
        .select()
        .single();

      if (insertError) {
        logStep("Error creating purchase record", { error: insertError.message });
        throw new Error(`Failed to create purchase record: ${insertError.message}`);
      }

      // Use expires_at from Stripe metadata (set by org-purchase-credits from package.validity_months)
      // Fall back to system setting (single source of truth for purchased credit expiry)
      const purchaseExpiresAt = expiresAtFromMeta || await getDefaultPurchaseExpiry(supabaseClient);

      // Add credits using the consolidated grant_credit_batch function
      const { data: batchId, error: creditError } = await supabaseClient.rpc('grant_credit_batch', {
        p_owner_type: 'org',
        p_owner_id: organizationId,
        p_amount: creditValue,
        p_expires_at: purchaseExpiresAt,
        p_source_type: 'purchase',
        p_feature_key: null,
        p_source_reference_id: newPurchase.id,
        p_description: `Credit package purchase: ${creditValue} credits`,
      });

      if (creditError) {
        logStep("Error adding credits", { error: creditError.message });
        throw new Error(`Failed to add credits: ${creditError.message}`);
      }

      logStep("Credits added successfully via grant_credit_batch", { batchId });

      return successResponse.ok({
        success: true,
        creditsAdded: creditValue,
        batchId,
      }, cors);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return errorResponse.serverError("org-confirm-credit-purchase", error, cors);
  }
});
