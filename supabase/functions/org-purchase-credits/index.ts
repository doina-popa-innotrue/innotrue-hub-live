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
  console.log(`[ORG-PURCHASE-CREDITS] ${step}${detailsStr}`);
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
    const { organizationId, packageId } = await req.json();
    if (!organizationId) throw new Error("Organization ID is required");
    if (!packageId) throw new Error("Package ID is required");
    logStep("Request parsed", { organizationId, packageId });

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
    if (!['org_admin', 'org_manager'].includes(membership.role)) {
      throw new Error("Only org admins can purchase credits");
    }
    logStep("User verified as org admin", { role: membership.role });

    // Get package details
    const { data: packageData, error: packageError } = await supabaseClient
      .from('org_credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (packageError || !packageData) {
      throw new Error("Invalid credit package");
    }
    logStep("Package found", { name: packageData.name, priceCents: packageData.price_cents });

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

    // Check for existing Stripe customer or create one
    let stripeCustomerId: string;
    
    // Check if org has a subscription with a customer ID
    const { data: subscription } = await supabaseClient
      .from('org_platform_subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .single();

    if (subscription?.stripe_customer_id) {
      stripeCustomerId = subscription.stripe_customer_id;
      logStep("Found existing Stripe customer", { stripeCustomerId });
    } else {
      // Check by email
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        logStep("Found Stripe customer by email", { stripeCustomerId });
      } else {
        // Create new customer
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

    // Create or get Stripe price for this package
    let priceId = packageData.stripe_price_id;
    
    if (!priceId) {
      // Create product and price in Stripe
      const product = await stripe.products.create({
        name: `Credit Package: ${packageData.name}`,
        description: packageData.description || `${packageData.credit_value} credits for your organization`,
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
        .from('org_credit_packages')
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
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      success_url: `${origin}/org-admin/billing?success=true&package=${packageData.slug}`,
      cancel_url: `${origin}/org-admin/billing?canceled=true`,
      metadata: {
        type: 'org_credit_purchase',
        organization_id: organizationId,
        package_id: packageId,
        credit_value: String(packageData.credit_value),
        expires_at: expiresAt || '',
        purchased_by: user.id,
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Create pending purchase record
    const { data: purchase, error: purchaseError } = await supabaseClient
      .from('org_credit_purchases')
      .insert({
        organization_id: organizationId,
        package_id: packageId,
        credits_purchased: packageData.credit_value,
        amount_cents: packageData.price_cents,
        currency: packageData.currency,
        stripe_checkout_session_id: session.id,
        expires_at: expiresAt,
        status: 'pending',
        purchased_by: user.id,
      })
      .select()
      .single();

    if (purchaseError) {
      logStep("Warning: Could not create purchase record", { error: purchaseError.message });
    } else {
      logStep("Pending purchase record created", { purchaseId: purchase.id });
    }

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
