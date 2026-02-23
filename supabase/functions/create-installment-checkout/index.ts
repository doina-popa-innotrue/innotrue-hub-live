import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-INSTALLMENT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("No authorization header provided", cors);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);
    if (userError) {
      return errorResponse.unauthorized(
        `Authentication error: ${userError.message}`,
        cors,
      );
    }
    const user = userData.user;
    if (!user?.email) {
      return errorResponse.unauthorized("User not authenticated", cors);
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request
    const { packageId, installmentMonths } = await req.json();
    if (!packageId) {
      return errorResponse.badRequest("Package ID is required", cors);
    }
    if (
      !installmentMonths ||
      typeof installmentMonths !== "number" ||
      installmentMonths < 2
    ) {
      return errorResponse.badRequest(
        "installmentMonths must be a number >= 2",
        cors,
      );
    }
    logStep("Request parsed", { packageId, installmentMonths });

    // Get package details
    const { data: packageData, error: packageError } = await supabaseClient
      .from("credit_topup_packages")
      .select("*")
      .eq("id", packageId)
      .eq("is_active", true)
      .single();

    if (packageError || !packageData) {
      return errorResponse.notFound("Invalid or inactive credit package", cors);
    }
    logStep("Package found", {
      name: packageData.name,
      priceCents: packageData.price_cents,
      creditValue: packageData.credit_value,
    });

    // Calculate per-installment amount (round up to avoid underpayment)
    const installmentAmountCents = Math.ceil(
      packageData.price_cents / installmentMonths,
    );
    const totalCharged = installmentAmountCents * installmentMonths;
    logStep("Installment calculation", {
      totalPackagePrice: packageData.price_cents,
      installments: installmentMonths,
      perInstallment: installmentAmountCents,
      totalCharged,
    });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    let stripeCustomerId: string | undefined;

    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { stripeCustomerId });
    }

    // Create a recurring price for this installment plan
    // Product: reuse or create for this package
    let productId: string;
    const existingProducts = await stripe.products.search({
      query: `metadata['package_id']:'${packageData.id}' AND metadata['type']:'installment'`,
      limit: 1,
    });

    if (existingProducts.data.length > 0) {
      productId = existingProducts.data[0].id;
      logStep("Found existing installment product", { productId });
    } else {
      const product = await stripe.products.create({
        name: `Installment Plan: ${packageData.name}`,
        description: `${packageData.credit_value} credits — paid in ${installmentMonths} monthly installments`,
        metadata: {
          package_id: packageData.id,
          package_slug: packageData.slug,
          credit_value: String(packageData.credit_value),
          type: "installment",
        },
      });
      productId = product.id;
      logStep("Created installment product", { productId });
    }

    // Create a recurring price for this specific installment amount
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: installmentAmountCents,
      currency: packageData.currency,
      recurring: {
        interval: "month",
        interval_count: 1,
      },
      metadata: {
        installment_months: String(installmentMonths),
        total_amount_cents: String(packageData.price_cents),
      },
    });
    logStep("Created recurring price", { priceId: price.id });

    // Calculate cancel_at (auto-cancel after N months from now)
    const cancelAt = Math.floor(Date.now() / 1000) + installmentMonths * 30 * 24 * 60 * 60;

    // Calculate credit expiry
    const expiresAt = packageData.validity_months
      ? new Date(
          Date.now() + packageData.validity_months * 30 * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

    const origin =
      req.headers.get("origin") ||
      Deno.env.get("SITE_URL") ||
      "https://app.innotrue.com";

    // Create Stripe Checkout Session in subscription mode
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : user.email,
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      subscription_data: {
        cancel_at: cancelAt,
        metadata: {
          type: "credit_installment",
          user_id: user.id,
          package_id: packageData.id,
          package_slug: packageData.slug,
          credit_value: String(packageData.credit_value),
          total_amount_cents: String(packageData.price_cents),
          installment_count: String(installmentMonths),
          installment_amount_cents: String(installmentAmountCents),
          expires_at: expiresAt || "",
        },
      },
      success_url: `${origin}/credits?success=true&session_id={CHECKOUT_SESSION_ID}&installment=true`,
      cancel_url: `${origin}/credits?canceled=true`,
      metadata: {
        type: "credit_installment",
        user_id: user.id,
        package_id: packageData.id,
        credit_value: String(packageData.credit_value),
        installment_count: String(installmentMonths),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, mode: "subscription" });

    // Create pending purchase record (will be updated on webhook)
    await supabaseClient.from("user_credit_purchases").insert({
      user_id: user.id,
      package_id: packageId,
      credits_purchased: packageData.credit_value,
      amount_cents: packageData.price_cents,
      currency: packageData.currency,
      stripe_checkout_session_id: session.id,
      expires_at: expiresAt,
      status: "pending",
    });

    return successResponse.ok(
      {
        url: session.url,
        installmentMonths,
        perInstallment: installmentAmountCents,
        totalCharged,
      },
      cors,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return errorResponse.serverErrorWithMessage(errorMessage, cors);
  }
});
