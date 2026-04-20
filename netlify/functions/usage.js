/**
 * GET/POST — usage from getBillingSnapshot (same counters as enforcement).
 */

const { getBillingSnapshot } = require("./_billing-snapshot");

exports.handler = async (event) => {
  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  try {
    let userId;
    if (event.httpMethod === "GET") {
      const qs = new URLSearchParams(event.queryStringParameters || {});
      userId = qs.get("userId");
    } else {
      const body = JSON.parse(event.body || "{}");
      userId = body.userId;
    }

    const snap = await getBillingSnapshot(userId || null);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        usage: snap.usage,
        plan_type: snap.plan_type,
        paid: snap.paid,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
