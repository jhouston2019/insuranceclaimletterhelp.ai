/**
 * POST — usage from getBillingSnapshot for the authenticated user only.
 * userId is always derived from the JWT (never from query/body — IDOR-safe).
 */

const { createClient } = require("@supabase/supabase-js");
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

    const snap = await getBillingSnapshot(user.id);
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
