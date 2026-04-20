const Stripe = require("stripe");
const { getBillingSnapshot } = require("./_billing-snapshot");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

exports.handler = async (event) => {
  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  try {
    const { sessionId, userId } = JSON.parse(event.body || "{}");

    const snap = await getBillingSnapshot(userId || null);
    if (snap.paid === true) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ state: "paid", redirect: "/app" }),
      };
    }

    if (sessionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") {
          return {
            statusCode: 200,
            headers: cors,
            body: JSON.stringify({
              state: "processing",
              redirect: "/success",
              retry_session: sessionId,
            }),
          };
        }
      } catch (_) {
        /* ignore */
      }
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ state: "none", redirect: "/pricing" }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ state: "unknown", redirect: "/pricing" }),
    };
  }
};
