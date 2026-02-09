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
  console.log(`[PURCHASE-CREDIT-TOPUP] ${step}${detailsStr}`);
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
    const { packageId } = await req.json();
    if (!packageId) throw new Error("Package ID is required");
    logStep("Request parsed", { packageId });

    // Get package details
    const { data: packageData, error: packageError } = await supabaseClient
      .from('credit_topup_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (packageError || !packageData) {
      throw new Error("Invalid credit package");
    }
    logStep("Package found", { name: packageData.name, priceCents: packageData.price_cents });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let stripeCustomerId: string | undefined;
    
    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { stripeCustomerId });
    }

    // Create or get Stripe price for this package
    let priceId = packageData.stripe_price_id;
    
    if (!priceId) {
      // Create product and price in Stripe
      const product = await stripe.products.create({
        name: `Credit Top-Up: ${packageData.name}`,
        description: packageData.description || `${packageData.credit_value} credits`,
        metadata: {
          package_id: packageData.id,
          package_slug: packageData.slug,
          credit_value: String(packageData.credit_value),
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: packageData.price_cents,
        currency: packageData.currency,
      });

      priceId = price.id;

      // Update package with Stripe price ID
      await supabaseClient
        .from('credit_topup_packages')
        .update({ stripe_price_id: priceId })
        .eq('id', packageId);

      logStep("Created Stripe product and price", { productId: product.id, priceId });
    }

    // Calculate expiry date
    const expiresAt = packageData.validity_months
      ? new Date(Date.now() + packageData.validity_months * 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://app.innotrue.com";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      success_url: `${origin}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/credits?canceled=true`,
      metadata: {
        type: 'user_credit_topup',
        user_id: user.id,
        package_id: packageId,
        credit_value: String(packageData.credit_value),
        expires_at: expiresAt || '',
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Create pending purchase record
    await supabaseClient
      .from('user_credit_purchases')
      .insert({
        user_id: user.id,
        package_id: packageId,
        credits_purchased: packageData.credit_value,
        amount_cents: packageData.price_cents,
        currency: packageData.currency,
        stripe_checkout_session_id: session.id,
        expires_at: expiresAt,
        status: 'pending',
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
