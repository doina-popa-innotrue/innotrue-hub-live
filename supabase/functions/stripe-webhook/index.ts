import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * Stripe Webhook Handler
 *
 * Handles subscription lifecycle events from Stripe:
 *   - checkout.session.completed  → activate subscription (set plan_id or org subscription)
 *   - customer.subscription.updated → handle plan changes, renewals
 *   - customer.subscription.deleted → downgrade to free plan
 *   - invoice.payment_failed       → log warning (Stripe handles dunning)
 *
 * Setup:
 *   1. In Stripe Dashboard → Developers → Webhooks → Add endpoint
 *   2. URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 *   3. Events: checkout.session.completed, customer.subscription.updated,
 *              customer.subscription.deleted, invoice.payment_failed
 *   4. Copy the signing secret (whsec_...) and set it:
 *      supabase secrets set STRIPE_WEBHOOK_SECRET='whsec_...' --project-ref <ref>
 */

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // Webhooks must be POST
  if (req.method !== "POST") {
    return errorResponse.badRequest("Method not allowed", cors);
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey) {
      return errorResponse.serverError("stripe-webhook", "STRIPE_SECRET_KEY is not set", cors);
    }
    if (!webhookSecret) {
      return errorResponse.serverError("stripe-webhook", "STRIPE_WEBHOOK_SECRET is not set", cors);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Verify webhook signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return errorResponse.unauthorized("Missing stripe-signature header", cors);
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logStep("Signature verification failed", { error: msg });
      return errorResponse.unauthorized(`Webhook signature verification failed: ${msg}`, cors);
    }

    logStep("Event received", { type: event.type, id: event.id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(stripe, supabase, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(stripe, supabase, event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return successResponse.ok({ received: true }, cors);
  } catch (error) {
    return errorResponse.serverError("stripe-webhook", error, cors);
  }
});

// ─── Event Handlers ─────────────────────────────────────────────

/**
 * checkout.session.completed
 *
 * Fires when a user completes Stripe Checkout.
 * Routes to the correct handler based on session metadata.type:
 *   - "user_subscription"         → update profiles.plan_id
 *   - "org_platform_subscription" → update org_platform_subscriptions
 *   - (credit purchases use confirm-on-return, not webhooks)
 */
async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
) {
  const metadata = session.metadata || {};
  logStep("Checkout completed", { type: metadata.type, sessionId: session.id });

  if (metadata.type === "user_subscription" && session.mode === "subscription") {
    await activateUserSubscription(stripe, supabase, session, metadata);
  } else if (metadata.type === "org_platform_subscription" && session.mode === "subscription") {
    await activateOrgSubscription(supabase, session, metadata);
  } else {
    logStep("Checkout session not a tracked subscription type, skipping", { mode: session.mode, type: metadata.type });
  }
}

/**
 * Activate a user subscription after checkout.
 * Sets profiles.plan_id to the plan matching the Stripe price.
 */
async function activateUserSubscription(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const userId = metadata.user_id;
  let planId = metadata.plan_id;

  if (!userId) {
    logStep("No user_id in metadata, cannot activate subscription");
    return;
  }

  // If plan_id is missing or "unknown", try to resolve from the subscription's price
  if (!planId || planId === "unknown") {
    planId = await resolvePlanIdFromSubscription(stripe, supabase, session.subscription as string);
  }

  if (!planId) {
    logStep("Could not resolve plan_id, skipping activation", { userId });
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ plan_id: planId })
    .eq("id", userId);

  if (error) {
    logStep("Error updating user plan", { userId, planId, error: error.message });
  } else {
    logStep("User plan activated", { userId, planId });
  }
}

/**
 * Activate an org platform subscription after checkout.
 * Updates org_platform_subscriptions with stripe_subscription_id and status.
 */
async function activateOrgSubscription(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const organizationId = metadata.organization_id;
  const tierId = metadata.tier_id;
  const subscriptionId = session.subscription as string;

  if (!organizationId) {
    logStep("No organization_id in metadata, cannot activate org subscription");
    return;
  }

  const { error } = await supabase
    .from("org_platform_subscriptions")
    .update({
      stripe_subscription_id: subscriptionId,
      status: "active",
    })
    .eq("organization_id", organizationId);

  if (error) {
    logStep("Error activating org subscription", { organizationId, error: error.message });
  } else {
    logStep("Org subscription activated", { organizationId, tierId, subscriptionId });
  }
}

/**
 * customer.subscription.updated
 *
 * Fires on plan changes (up/downgrade via Billing Portal), renewals, etc.
 * Resolves the new price → plan_id and updates the user's profile.
 */
async function handleSubscriptionUpdated(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
) {
  const metadata = subscription.metadata || {};
  logStep("Subscription updated", { subscriptionId: subscription.id, status: subscription.status, type: metadata.type });

  // Only handle active subscriptions (skip past_due, incomplete, etc.)
  if (subscription.status !== "active") {
    logStep("Subscription not active, skipping update", { status: subscription.status });
    return;
  }

  if (metadata.type === "user_subscription") {
    const userId = metadata.user_id;
    if (!userId) {
      logStep("No user_id in subscription metadata");
      return;
    }

    // Resolve the current plan from the subscription's price
    const planId = await resolvePlanIdFromSubscription(stripe, supabase, subscription.id);
    if (!planId) {
      logStep("Could not resolve plan_id from subscription price", { subscriptionId: subscription.id });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ plan_id: planId })
      .eq("id", userId);

    if (error) {
      logStep("Error updating user plan on subscription change", { userId, planId, error: error.message });
    } else {
      logStep("User plan updated from subscription change", { userId, planId });
    }
  } else if (metadata.type === "org_platform_subscription") {
    const organizationId = metadata.organization_id;
    if (!organizationId) return;

    // Update org subscription status
    await supabase
      .from("org_platform_subscriptions")
      .update({ status: subscription.status })
      .eq("organization_id", organizationId);

    logStep("Org subscription status updated", { organizationId, status: subscription.status });
  }
}

/**
 * customer.subscription.deleted
 *
 * Fires when a subscription is cancelled (end of billing period or immediate).
 * Downgrades the user to the free plan.
 */
async function handleSubscriptionDeleted(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
) {
  const metadata = subscription.metadata || {};
  logStep("Subscription deleted", { subscriptionId: subscription.id, type: metadata.type });

  if (metadata.type === "user_subscription") {
    const userId = metadata.user_id;
    if (!userId) {
      // Fallback: try to find user by Stripe customer email
      const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
      if (customer.email) {
        await downgradeUserByEmail(supabase, customer.email);
      }
      return;
    }

    await downgradeUserToFree(supabase, userId);
  } else if (metadata.type === "org_platform_subscription") {
    const organizationId = metadata.organization_id;
    if (!organizationId) return;

    await supabase
      .from("org_platform_subscriptions")
      .update({
        status: "canceled",
        stripe_subscription_id: null,
      })
      .eq("organization_id", organizationId);

    logStep("Org subscription canceled", { organizationId });
  }
}

/**
 * invoice.payment_failed
 *
 * Logs the failure. Stripe handles dunning (retry emails) automatically.
 * The subscription will eventually become past_due or canceled, which
 * triggers customer.subscription.updated / deleted.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  logStep("Payment failed", {
    invoiceId: invoice.id,
    customer: invoice.customer,
    amount: invoice.amount_due,
    attempt: invoice.attempt_count,
  });
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Look up plan_prices.stripe_price_id → plan_id from the subscription's
 * current price (first line item).
 */
async function resolvePlanIdFromSubscription(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  subscriptionId: string,
): Promise<string | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    const price = subscription.items.data[0]?.price;
    if (!price) {
      logStep("No price found on subscription", { subscriptionId });
      return null;
    }

    const { data: priceRow } = await supabase
      .from("plan_prices")
      .select("plan_id")
      .eq("stripe_price_id", price.id)
      .maybeSingle();

    if (priceRow?.plan_id) {
      logStep("Resolved plan from Stripe price", { stripePriceId: price.id, planId: priceRow.plan_id });
      return priceRow.plan_id;
    }

    logStep("No plan_prices row found for Stripe price", { stripePriceId: price.id });
    return null;
  } catch (err) {
    logStep("Error resolving plan from subscription", { subscriptionId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Downgrade a user to the free plan by user ID.
 */
async function downgradeUserToFree(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: freePlan } = await supabase
    .from("plans")
    .select("id")
    .eq("key", "free")
    .single();

  if (!freePlan) {
    logStep("Free plan not found, cannot downgrade user", { userId });
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ plan_id: freePlan.id })
    .eq("id", userId);

  if (error) {
    logStep("Error downgrading user to free plan", { userId, error: error.message });
  } else {
    logStep("User downgraded to free plan", { userId });
  }
}

/**
 * Fallback: downgrade a user to free by matching Stripe customer email
 * to profiles.username (which stores email).
 */
async function downgradeUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const { data: freePlan } = await supabase
    .from("plans")
    .select("id")
    .eq("key", "free")
    .single();

  if (!freePlan) {
    logStep("Free plan not found, cannot downgrade by email", { email });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", email)
    .maybeSingle();

  if (!profile) {
    logStep("No profile found for email, cannot downgrade", { email });
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ plan_id: freePlan.id })
    .eq("id", profile.id);

  if (error) {
    logStep("Error downgrading user by email", { email, error: error.message });
  } else {
    logStep("User downgraded to free plan by email", { email, userId: profile.id });
  }
}
