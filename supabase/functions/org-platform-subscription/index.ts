import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

// Origin-aware CORS for financial operations
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

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-PLATFORM-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
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
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request
    const { organizationId, tierId, billingPeriod = 'annual' } = await req.json();
    if (!organizationId) throw new Error("Organization ID is required");
    if (!tierId) throw new Error("Tier ID is required");
    logStep("Request parsed", { organizationId, tierId, billingPeriod });

    // Verify user is org admin
    const { data: membership, error: memberError } = await supabaseClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (memberError || !membership) {
      throw new Error("You are not a member of this organization");
    }
    if (!['org_admin'].includes(membership.role)) {
      throw new Error("Only org admins can manage subscriptions");
    }
    logStep("User verified as org admin");

    // Get tier details
    const { data: tier, error: tierError } = await supabaseClient
      .from('org_platform_tiers')
      .select('*')
      .eq('id', tierId)
      .eq('is_active', true)
      .single();

    if (tierError || !tier) {
      throw new Error("Invalid platform tier");
    }
    logStep("Tier found", { name: tier.name });

    // Get organization details
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('name, slug')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      throw new Error("Organization not found");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get or create Stripe customer
    let stripeCustomerId: string;
    
    const { data: existingSub } = await supabaseClient
      .from('org_platform_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('organization_id', organizationId)
      .single();

    if (existingSub?.stripe_subscription_id) {
      // Already has an active subscription - redirect to portal
      throw new Error("Organization already has an active subscription. Use the customer portal to manage it.");
    }

    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id;
      logStep("Found existing Stripe customer", { stripeCustomerId });
    } else {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        logStep("Found Stripe customer by email", { stripeCustomerId });
      } else {
        const newCustomer = await stripe.customers.create({
          email: user.email,
          name: org.name,
          metadata: {
            organization_id: organizationId,
            organization_slug: org.slug,
          },
        });
        stripeCustomerId = newCustomer.id;
        logStep("Created new Stripe customer", { stripeCustomerId });
      }
    }

    // Get or create Stripe price
    const isAnnual = billingPeriod === 'annual';
    let priceId = isAnnual ? tier.stripe_annual_price_id : tier.stripe_monthly_price_id;
    const feeCents = isAnnual ? tier.annual_fee_cents : tier.monthly_fee_cents;

    if (!feeCents) {
      throw new Error(`${billingPeriod} billing is not available for this tier`);
    }

    if (!priceId) {
      // Create product and price in Stripe
      const product = await stripe.products.create({
        name: `Platform: ${tier.name} (${isAnnual ? 'Annual' : 'Monthly'})`,
        description: tier.description || `${tier.name} platform access`,
        metadata: {
          tier_id: tier.id,
          tier_slug: tier.slug,
          billing_period: billingPeriod,
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: feeCents,
        currency: tier.currency,
        recurring: {
          interval: isAnnual ? 'year' : 'month',
        },
      });

      priceId = price.id;

      // Update tier with Stripe price ID
      const updateField = isAnnual ? 'stripe_annual_price_id' : 'stripe_monthly_price_id';
      await supabaseClient
        .from('org_platform_tiers')
        .update({ [updateField]: priceId })
        .eq('id', tierId);

      logStep("Created Stripe product and price", { productId: product.id, priceId });
    }

    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://app.innotrue.com";

    // Create checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      success_url: `${origin}/org-admin/billing?subscription=success`,
      cancel_url: `${origin}/org-admin/billing?subscription=canceled`,
      metadata: {
        type: 'org_platform_subscription',
        organization_id: organizationId,
        tier_id: tierId,
        billing_period: billingPeriod,
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Upsert subscription record as pending
    await supabaseClient
      .from('org_platform_subscriptions')
      .upsert({
        organization_id: organizationId,
        tier_id: tierId,
        stripe_customer_id: stripeCustomerId,
        billing_email: user.email,
        billing_period: billingPeriod,
        status: 'pending',
      }, {
        onConflict: 'organization_id',
      });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
