const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

exports.handler = async (event) => {
  try {
    const sig =
      event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body || "");

    let evt;
    try {
      evt = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    // Canonical unlock: Stripe-signed webhook ONLY sets paid/active entitlements (+ processed_sessions).
    // verify-payment validates session vs JWT and polls until this row appears (no entitlement writes).
    if (evt.type === "checkout.session.completed") {
      const session = evt.data.object;
      const recordId = session.metadata?.recordId || null;
      const stripeCustomerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id || null;
      const metaUid =
        session.metadata?.supabase_user_id ||
        session.metadata?.user_id ||
        null;
      const plan =
        session.metadata?.plan_type ||
        session.metadata?.plan ||
        "single";

      const supabase = getSupabaseAdmin();

      let userId = metaUid || null;

      if (!userId && stripeCustomerId && session.payment_status === "paid") {
        const { data: ent } = await supabase
          .from("user_entitlements")
          .select("user_id")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();
        userId = ent?.user_id || null;
      }

      if (userId && session.payment_status === "paid" && stripeCustomerId) {
        await supabase.from("user_entitlements").upsert(
          {
            user_id: userId,
            stripe_customer_id: stripeCustomerId,
            plan_type: plan,
            paid: true,
            active: true,
            last_checkout_session_id: session.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        await supabase.from("processed_sessions").upsert(
          {
            stripe_checkout_session_id: session.id,
            status: "completed",
            user_id: userId,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_checkout_session_id" }
        );

        console.log(
          JSON.stringify({
            event: "webhook_completed",
            session_id: session.id,
            user_id: userId,
            source: "stripe_webhook",
            ts: new Date().toISOString(),
          })
        );

        console.log(
          JSON.stringify({
            event: "PAYMENT_FLOW_COMPLETE",
            session_id: session.id,
            user_id: userId,
            source: "webhook",
            status: "paid",
            ts: new Date().toISOString(),
          })
        );
      } else {
        console.log(
          JSON.stringify({
            event: "webhook_skipped_no_user",
            session_id: session.id,
            payment_status: session.payment_status,
            ts: new Date().toISOString(),
          })
        );
      }

      if (recordId) {
        const { error } = await supabase
          .from("claim_letters")
          .update({
            stripe_session_id: session.id,
            stripe_payment_status: session.payment_status,
            payment_status: "paid",
            letter_generated: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recordId);

        if (error) {
          console.error("Failed to update claim_letters record:", error);
        }
      }
    }

    if (
      evt.type === "customer.subscription.created" ||
      evt.type === "customer.subscription.updated"
    ) {
      const subscription = evt.data.object;
      const customerId = subscription.customer;
      const supabase = getSupabaseAdmin();

      await supabase.from("subscriptions").upsert(
        {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          plan_type: subscription.metadata?.plan_type || "STANDARD",
          current_period_start: new Date(
            subscription.current_period_start * 1000
          ).toISOString(),
          current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
        },
        { onConflict: "stripe_subscription_id" }
      );
    }

    if (evt.type === "customer.subscription.deleted") {
      const subscription = evt.data.object;
      const supabase = getSupabaseAdmin();
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", subscription.id);
    }

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
