const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

exports.handler = async (event) => {
  const corsOk = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsOk, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...corsOk, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const authHeader =
      event.headers.authorization || event.headers.Authorization || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) {
      return {
        statusCode: 401,
        headers: { ...corsOk, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Authentication required" }),
      };
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return {
        statusCode: 503,
        headers: { ...corsOk, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Auth service not configured" }),
      };
    }

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authErr,
    } = await authClient.auth.getUser(bearer);

    if (authErr || !user?.email) {
      return {
        statusCode: 401,
        headers: { ...corsOk, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid session" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const recordId = body.recordId ?? body.job_id ?? null;
    const plan = body.plan || "single";

    const priceId = process.env.STRIPE_PRICE_RESPONSE || "price_19USD_single";

    if (!process.env.SITE_URL) {
      throw new Error("SITE_URL environment variable is not set");
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    const base = process.env.SITE_URL.replace(/\/$/, "");

    const metadata = {
      plan,
      plan_type: plan,
      supabase_user_id: user.id,
      user_id: user.id,
      product_type: "insurance_claim",
    };

    if (recordId != null && recordId !== "") {
      metadata.job_id = String(recordId);
      metadata.recordId = String(recordId);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: user.email,
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing`,
      client_reference_id: user.id,
      metadata,
    });

    return {
      statusCode: 200,
      headers: {
        ...corsOk,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: session.url, id: session.id }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        ...corsOk,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Failed to create checkout session",
        details: error.message,
      }),
    };
  }
};
