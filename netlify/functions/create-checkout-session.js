import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      recordId = null,
      plan = "single",
      supabase_user_id = null,
    } = body;

    const priceId = process.env.STRIPE_PRICE_RESPONSE || "price_19USD_single";

    if (!process.env.SITE_URL) {
      throw new Error("SITE_URL environment variable is not set");
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    const base = process.env.SITE_URL.replace(/\/$/, "");

    const metadata = { plan, plan_type: plan };
    if (recordId) metadata.recordId = String(recordId);
    if (supabase_user_id) metadata.supabase_user_id = String(supabase_user_id);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing`,
      client_reference_id: supabase_user_id || undefined,
      metadata,
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: JSON.stringify({ url: session.url, id: session.id }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to create checkout session",
        details: error.message,
      }),
    };
  }
}
