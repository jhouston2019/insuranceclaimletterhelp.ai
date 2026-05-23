const { getSupabaseAdmin } = require("./_supabase");
const { createClient } = require("@supabase/supabase-js");
const { buildClaimJobPayload } = require("./_claim-job-persist");

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
    const bearer = (event.headers.authorization || event.headers.Authorization || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
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
    const {
      data: { user },
      error: authErr,
    } = await authClient.auth.getUser(bearer);
    if (authErr || !user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid session" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const stripeSessionId = body.stripe_session_id || body.stripeSessionId || null;

    if (!stripeSessionId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "stripe_session_id required" }),
      };
    }

    const admin = getSupabaseAdmin();

    let { data: job, error: jobErr } = await admin
      .from("claim_jobs")
      .select("id, user_id, paid")
      .eq("stripe_checkout_session_id", stripeSessionId)
      .maybeSingle();

    if (jobErr) {
      console.error("record-purchase lookup:", jobErr.message);
    }

    if (!job) {
      const { data: wRow } = await admin
        .from("wizard_checkout_sessions")
        .select("state, job_id")
        .eq("stripe_session_id", stripeSessionId)
        .maybeSingle();

      if (wRow?.job_id) {
        const { data: byId } = await admin
          .from("claim_jobs")
          .select("id, user_id, paid")
          .eq("id", wRow.job_id)
          .maybeSingle();
        job = byId;
      }

      if (!job && wRow?.state) {
        const insertPayload = buildClaimJobPayload(wRow.state, stripeSessionId, {
          userId: user.id,
          paid: true,
        });
        const { data: newJob, error: insertErr } = await admin
          .from("claim_jobs")
          .insert(insertPayload)
          .select("id, user_id, paid")
          .single();

        if (insertErr) {
          console.error("record-purchase insert:", insertErr.message);
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Failed to save deliverables to your account" }),
          };
        }
        job = newJob;

        await admin
          .from("wizard_checkout_sessions")
          .update({ job_id: job.id })
          .eq("stripe_session_id", stripeSessionId);
      }
    }

    if (!job) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Job not found for this session" }),
      };
    }

    const { error: updateErr } = await admin
      .from("claim_jobs")
      .update({
        user_id: user.id,
        paid: true,
        is_unlocked: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateErr) {
      console.error("record-purchase update:", updateErr.message);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to link purchase to account" }),
      };
    }

    try {
      await admin.from("processed_sessions").upsert(
        {
          stripe_checkout_session_id: stripeSessionId,
          user_id: user.id,
          job_id: job.id,
        },
        { onConflict: "stripe_checkout_session_id" }
      );
    } catch (e) {
      console.warn("processed_sessions upsert:", e.message);
    }

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
