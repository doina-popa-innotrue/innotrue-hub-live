import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * Stripe Webhook Handler
 *
 * Handles subscription lifecycle events from Stripe:
 *   - checkout.session.completed  → activate subscription (set plan_id or org subscription) or grant installment credits
 *   - customer.subscription.updated → handle plan changes, renewals
 *   - customer.subscription.deleted → downgrade to free plan or mark installment defaulted
 *   - invoice.paid                 → mark installment payment received, keep access
 *   - invoice.payment_failed       → mark installment payment outstanding, lock access
 *
 * Setup:
 *   1. In Stripe Dashboard → Developers → Webhooks → Add endpoint
 *   2. URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 *   3. Events: checkout.session.completed, customer.subscription.updated,
 *              customer.subscription.deleted, invoice.paid, invoice.payment_failed
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

      case "invoice.paid":
        await handleInvoicePaid(stripe, supabase, event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(supabase, stripe, event.data.object as Stripe.Invoice);
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
  } else if (metadata.type === "credit_installment" && session.mode === "subscription") {
    await handleInstallmentCheckoutCompleted(stripe, supabase, session, metadata);
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
  } else if (metadata.type === "credit_installment") {
    await handleInstallmentSubscriptionDeleted(supabase, subscription, metadata);
  }
}

/**
 * checkout.session.completed for credit_installment
 *
 * When a client completes the installment checkout:
 *   1. Grant FULL credits to the user's wallet immediately
 *   2. Create a payment_schedules record to track installments
 *   3. Mark the first instalment as paid
 *
 * The enrollment itself is handled by the client-side flow
 * (pendingEnrollment in sessionStorage → resumePendingEnrollment).
 */
async function handleInstallmentCheckoutCompleted(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const userId = metadata.user_id;
  const packageId = metadata.package_id;
  const creditValue = parseInt(metadata.credit_value || "0", 10);
  const totalAmountCents = parseInt(metadata.total_amount_cents || "0", 10);
  const installmentCount = parseInt(metadata.installment_count || "0", 10);
  const installmentAmountCents = parseInt(metadata.installment_amount_cents || "0", 10);
  const expiresAt = metadata.expires_at || null;
  const subscriptionId = session.subscription as string;

  if (!userId || !packageId || creditValue <= 0 || !subscriptionId) {
    logStep("Missing required metadata for installment checkout", { userId, packageId, creditValue, subscriptionId });
    return;
  }

  logStep("Processing installment checkout", {
    userId, packageId, creditValue, installmentCount, subscriptionId,
  });

  // 1. Grant FULL credits to user wallet via grant_credit_batch RPC
  const { error: grantError } = await supabase.rpc("grant_credit_batch", {
    p_user_id: userId,
    p_amount: creditValue,
    p_source_type: "purchase",
    p_description: `Installment purchase: ${creditValue} credits (${installmentCount} monthly payments)`,
    p_expires_at: expiresAt || null,
  });

  if (grantError) {
    logStep("Error granting installment credits", { userId, creditValue, error: grantError.message });
    // Don't return — still create the schedule so we can track the payments
  } else {
    logStep("Installment credits granted", { userId, creditValue });
  }

  // 2. Update user_credit_purchases status
  await supabase
    .from("user_credit_purchases")
    .update({ status: "completed", stripe_payment_intent_id: session.payment_intent as string || null })
    .eq("stripe_checkout_session_id", session.id);

  // 3. Get Stripe customer ID
  let stripeCustomerId = session.customer as string || null;

  // 4. Calculate next payment date (1 month from now)
  const nextPaymentDate = new Date();
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

  // 5. Create payment_schedules record (installments_paid = 1 since first payment is immediate)
  const { error: scheduleError } = await supabase
    .from("payment_schedules")
    .insert({
      user_id: userId,
      enrollment_id: null, // Nullable — will be linked after enrollment completes
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: stripeCustomerId,
      total_amount_cents: totalAmountCents || (installmentAmountCents * installmentCount),
      currency: "eur",
      installment_count: installmentCount,
      installment_amount_cents: installmentAmountCents,
      installments_paid: 1,
      amount_paid_cents: installmentAmountCents,
      next_payment_date: nextPaymentDate.toISOString(),
      credits_granted: creditValue,
      credit_package_id: packageId,
      status: installmentCount <= 1 ? "completed" : "active",
      completed_at: installmentCount <= 1 ? new Date().toISOString() : null,
      metadata: {
        checkout_session_id: session.id,
        package_slug: metadata.package_slug || null,
      },
    });

  if (scheduleError) {
    logStep("Error creating payment schedule", { userId, error: scheduleError.message });
  } else {
    logStep("Payment schedule created", { userId, subscriptionId, installmentsRemaining: installmentCount - 1 });
  }
}

/**
 * invoice.paid
 *
 * Fires when a Stripe invoice is paid (including the first one during checkout).
 * For installment subscriptions: updates the payment schedule and keeps access active.
 * For regular subscriptions: no special handling needed (subscription.updated covers it).
 */
async function handleInvoicePaid(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice,
) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    logStep("invoice.paid: no subscription, skipping (one-time payment)");
    return;
  }

  // Check if this is an installment subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata || {};

  if (metadata.type !== "credit_installment") {
    logStep("invoice.paid: not an installment subscription, skipping", { subscriptionId });
    return;
  }

  logStep("Installment invoice paid", {
    invoiceId: invoice.id,
    subscriptionId,
    amount: invoice.amount_paid,
    userId: metadata.user_id,
  });

  // Skip the first invoice (already handled in checkout.session.completed)
  // The billing_reason for the first invoice is "subscription_create"
  if ((invoice as Record<string, unknown>).billing_reason === "subscription_create") {
    logStep("First invoice (subscription_create), already handled at checkout");
    return;
  }

  // Calculate next payment date
  const nextPeriodEnd = invoice.lines?.data?.[0]?.period?.end;
  const nextPaymentDate = nextPeriodEnd
    ? new Date(nextPeriodEnd * 1000).toISOString()
    : null;

  // Update payment schedule via RPC
  const { data: result } = await supabase.rpc("update_installment_payment_status", {
    p_stripe_subscription_id: subscriptionId,
    p_new_status: "paid",
    p_installment_amount_cents: invoice.amount_paid,
    p_next_payment_date: nextPaymentDate,
  });

  if (result?.success) {
    logStep("Installment payment recorded", {
      installmentsPaid: result.installments_paid,
      installmentCount: result.installment_count,
      enrollmentId: result.enrollment_id,
    });
  } else {
    logStep("Error updating installment payment", { result });
  }
}

/**
 * invoice.payment_failed
 *
 * Logs the failure. For installment subscriptions: sets payment_status to 'outstanding'
 * which locks program access via usePlanAccess.
 * Stripe handles dunning (retry emails) automatically.
 */
async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  invoice: Stripe.Invoice,
) {
  logStep("Payment failed", {
    invoiceId: invoice.id,
    customer: invoice.customer,
    amount: invoice.amount_due,
    attempt: invoice.attempt_count,
  });

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Check if this is an installment subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata || {};

  if (metadata.type !== "credit_installment") return;

  logStep("Installment payment failed — locking access", {
    subscriptionId,
    userId: metadata.user_id,
    attempt: invoice.attempt_count,
  });

  // Set payment_status to 'outstanding' — usePlanAccess will lock content
  const { data: result } = await supabase.rpc("update_installment_payment_status", {
    p_stripe_subscription_id: subscriptionId,
    p_new_status: "outstanding",
  });

  if (result?.success) {
    logStep("Enrollment locked due to failed payment", { enrollmentId: result.enrollment_id });
  } else {
    logStep("Error locking enrollment", { result });
  }
}

/**
 * Handle installment subscription deleted/cancelled.
 * If all installments are paid → mark completed (normal end).
 * If not all paid → mark as overdue/defaulted.
 */
async function handleInstallmentSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  metadata: Record<string, string>,
) {
  const subscriptionId = subscription.id;
  logStep("Installment subscription deleted", { subscriptionId, userId: metadata.user_id });

  // Check the payment schedule status
  const { data: schedule } = await supabase
    .from("payment_schedules")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!schedule) {
    logStep("No payment schedule found for cancelled installment sub", { subscriptionId });
    return;
  }

  if (schedule.installments_paid >= schedule.installment_count) {
    // All paid — this is a normal end (cancel_at was reached)
    logStep("Installment plan completed normally", {
      subscriptionId,
      installmentsPaid: schedule.installments_paid,
    });

    await supabase
      .from("payment_schedules")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", schedule.id);
  } else {
    // Not all paid — default
    logStep("Installment plan defaulted", {
      subscriptionId,
      installmentsPaid: schedule.installments_paid,
      installmentCount: schedule.installment_count,
    });

    await supabase
      .from("payment_schedules")
      .update({ status: "defaulted", cancelled_at: new Date().toISOString() })
      .eq("id", schedule.id);

    // Lock the enrollment
    await supabase.rpc("update_installment_payment_status", {
      p_stripe_subscription_id: subscriptionId,
      p_new_status: "overdue",
    });
  }
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
