const { getSupabaseAdmin } = require("./_supabase");
const { createClient } = require("@supabase/supabase-js");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Verify JWT — userId derived from token only, never from body
    const authHeader =
      event.headers.authorization || event.headers.Authorization || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Authentication required" }),
      };
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return {
        statusCode: 503,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Auth service not configured" }),
      };
    }

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authErr } =
      await authClient.auth.getUser(bearer);
    if (authErr || !user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid session" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const stripeSessionId = body.stripe_session_id
      || body.stripeSessionId
      || null;

    if (!stripeSessionId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "stripe_session_id required" }),
      };
    }

    const admin = getSupabaseAdmin();

    // Find claim_jobs row by stripe_session_id or stripe_checkout_session_id
    const { data: job, error: jobErr } = await admin
      .from("claim_jobs")
      .select("id, user_id, paid")
      .or(
        `stripe_session_id.eq.${stripeSessionId},` +
        `stripe_checkout_session_id.eq.${stripeSessionId}`
      )
      .maybeSingle();

    if (jobErr || !job) {
      console.error("record-purchase: job not found", jobErr?.message);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Job not found for this session" }),
      };
    }

    // Link user_id to the job — idempotent
    const { error: updateErr } = await admin
      .from("claim_jobs")
      .update({
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateErr) {
      console.error("record-purchase: update failed", updateErr.message);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to link purchase to account" }),
      };
    }

    // Insert into processed_sessions for idempotency
    await admin
      .from("processed_sessions")
      .upsert({
        stripe_session_id: stripeSessionId,
        user_id: user.id,
        job_id: job.id,
      }, { onConflict: "stripe_session_id" })
      .catch((e) => console.warn("processed_sessions upsert:", e.message));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, job_id: job.id }),
    };

  } catch (e) {
    console.error("record-purchase:", e.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
