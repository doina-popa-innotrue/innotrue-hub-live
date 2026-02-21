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

    const body = await req.json();
    const mode = body.mode || "subscription";

    // Support both: planPriceId (DB row ID) or legacy priceId (Stripe price ID)
    const planPriceId = body.planPriceId;
    const legacyPriceId = body.priceId;

    if (!planPriceId && !legacyPriceId) {
      return errorResponse.badRequest("planPriceId or priceId is required", cors);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    let stripePriceId: string;
    let planId: string | null = null;

    if (planPriceId) {
      // New flow: look up plan_prices row by DB ID, auto-create Stripe product/price if needed
      const { data: priceRow, error: priceError } = await supabaseClient
        .from("plan_prices")
        .select("id, plan_id, billing_interval, price_cents, stripe_price_id, plans!inner(key, name, description)")
        .eq("id", planPriceId)
        .maybeSingle();

      if (priceError || !priceRow) {
        return errorResponse.badRequest("Invalid plan price ID", cors);
      }

      planId = priceRow.plan_id;
      const plan = (priceRow as any).plans;

      if (priceRow.stripe_price_id) {
        // Already has a Stripe price — use it directly
        stripePriceId = priceRow.stripe_price_id;
        logStep("Using existing Stripe price", { stripePriceId });
      } else {
        // Auto-create Stripe product and price
        logStep("No Stripe price ID found, creating product and price", {
          plan: plan.key,
          interval: priceRow.billing_interval,
        });

        // Check if a product already exists for this plan (by metadata)
        const existingProducts = await stripe.products.search({
          query: `metadata["plan_key"]:"${plan.key}"`,
        });

        let productId: string;
        if (existingProducts.data.length > 0) {
          productId = existingProducts.data[0].id;
          logStep("Found existing Stripe product", { productId });
        } else {
          const product = await stripe.products.create({
            name: `InnoTrue Hub — ${plan.name}`,
            description: plan.description || `${plan.name} subscription plan`,
            metadata: {
              plan_key: plan.key,
              plan_id: planId,
            },
          });
          productId = product.id;
          logStep("Created Stripe product", { productId });
        }

        // Create the recurring price
        const intervalMap: Record<string, "month" | "year" | "week" | "day"> = {
          month: "month",
          year: "year",
          week: "week",
          day: "day",
        };
        const stripeInterval = intervalMap[priceRow.billing_interval];
        if (!stripeInterval) {
          return errorResponse.badRequest(`Unsupported billing interval: ${priceRow.billing_interval}`, cors);
        }

        const price = await stripe.prices.create({
          product: productId,
          unit_amount: priceRow.price_cents,
          currency: "eur",
          recurring: { interval: stripeInterval },
          metadata: {
            plan_key: plan.key,
            plan_id: planId,
            billing_interval: priceRow.billing_interval,
          },
        });

        stripePriceId = price.id;
        logStep("Created Stripe price", { stripePriceId, amount: priceRow.price_cents });

        // Store back to DB so it's reused next time
        await supabaseClient
          .from("plan_prices")
          .update({ stripe_price_id: stripePriceId })
          .eq("id", priceRow.id);

        logStep("Stored stripe_price_id in plan_prices", { planPriceId: priceRow.id });
      }
    } else {
      // Legacy flow: priceId is already a Stripe price ID
      stripePriceId = legacyPriceId;
      const { data: priceRow } = await supabaseClient
        .from("plan_prices")
        .select("plan_id")
        .eq("stripe_price_id", stripePriceId)
        .maybeSingle();
      planId = priceRow?.plan_id ?? null;
      logStep("Legacy flow: using provided Stripe price ID", { stripePriceId, planId });
    }

    logStep("Resolved plan", { planId, stripePriceId });

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
          price: stripePriceId,
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
