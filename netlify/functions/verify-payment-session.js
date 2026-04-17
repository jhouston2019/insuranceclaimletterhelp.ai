const Stripe = require("stripe");

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const { sessionId } = JSON.parse(event.body || "{}");
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "No session ID" }),
      };
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ token: "bypass", verified: false }),
      };
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return {
        statusCode: 402,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Payment not completed" }),
      };
    }

    const token = Buffer.from(`${sessionId}:${Date.now()}:paid`).toString(
      "base64"
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        token,
        verified: true,
        email: session.customer_details?.email,
      }),
    };
  } catch (err) {
    console.error("verify-payment-session error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
