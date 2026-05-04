const { createClient } = require("@supabase/supabase-js");
const { getBillingSnapshot } = require("./_billing-snapshot");

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

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: cors,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const authHeader =
      event.headers.authorization || event.headers.Authorization || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (bearer.toLowerCase() === "bypass") {
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: "Invalid token" }),
      };
    }
    if (!bearer) {
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: "Missing authorization" }),
      };
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return {
        statusCode: 503,
        headers: cors,
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

    if (authErr || !user) {
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: "Invalid session" }),
      };
    }

    // Never trust JSON body userId (IDOR). Billing is always for the JWT subject.
    try {
      JSON.parse(event.body || "{}");
    } catch (_) {}

    const userId = user.id;

    const snap = await getBillingSnapshot(userId);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        plan_type: snap.plan_type,
        active: snap.active,
        paid: snap.paid,
        renewal_date: snap.renewalDate,
        usage: snap.usage,
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
