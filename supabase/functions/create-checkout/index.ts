import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return errorResponse.serverError("CREATE-CHECKOUT", "STRIPE_SECRET_KEY is not set", cors);
    }
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("No authorization header provided", cors);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      return errorResponse.unauthorized(`Authentication error: ${userError.message}`, cors);
    }
    const user = userData.user;
    if (!user?.email) {
      return errorResponse.unauthorized("User not authenticated or email not available", cors);
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { priceId, mode = "subscription" } = await req.json();
    if (!priceId) {
      return errorResponse.badRequest("Price ID is required", cors);
    }
    logStep("Request parsed", { priceId, mode });

    // Resolve plan_id from stripe_price_id so the webhook can update profiles.plan_id
    const { data: priceRow } = await supabaseClient
      .from("plan_prices")
      .select("plan_id")
      .eq("stripe_price_id", priceId)
      .maybeSingle();

    const planId = priceRow?.plan_id ?? null;
    logStep("Resolved plan", { planId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    }

    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://app.innotrue.com";

    // Create checkout session with billing address and tax ID collection
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode as "subscription" | "payment",
      // Collect full billing address (mandatory)
      billing_address_collection: "required",
      // Collect tax IDs (optional for customer)
      tax_id_collection: { enabled: true },
      // Update customer with billing address
      customer_update: customerId ? {
        address: "auto",
        name: "auto",
      } : undefined,
      metadata: {
        type: "user_subscription",
        user_id: user.id,
        plan_id: planId ?? "unknown",
      },
      subscription_data: mode === "subscription" ? {
        metadata: {
          type: "user_subscription",
          user_id: user.id,
          plan_id: planId ?? "unknown",
        },
      } : undefined,
      success_url: `${origin}/subscription?success=true`,
      cancel_url: `${origin}/subscription?canceled=true`,
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return successResponse.ok({ url: session.url }, cors);
  } catch (error) {
    logStep("ERROR in create-checkout", { message: error instanceof Error ? error.message : String(error) });
    return errorResponse.serverError("CREATE-CHECKOUT", error, cors);
  }
});
