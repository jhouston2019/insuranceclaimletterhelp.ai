/**
 * Returns a letter with placeholders filled using saved job data + wizard checkout state.
 */

const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("./_supabase");
const { filledLetterFromJob } = require("./_letter-placeholders");

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
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
    const bearer = (event.headers.authorization || event.headers.Authorization || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!bearer) {
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: "Authentication required" }),
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

    const body = JSON.parse(event.body || "{}");
    const jobId = body.job_id || body.jobId;
    if (!jobId) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: "job_id required" }),
      };
    }

    const admin = getSupabaseAdmin();
    const { data: job, error: jobErr } = await admin
      .from("claim_jobs")
      .select(
        "id, user_id, letter_html, letter_full, payer_name, claim_type, created_at, stripe_session_id, stripe_checkout_session_id"
      )
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobErr || !job) {
      return {
        statusCode: 404,
        headers: cors,
        body: JSON.stringify({ error: "Job not found" }),
      };
    }

    let wizardState = {};
    const sessionId =
      job.stripe_checkout_session_id || job.stripe_session_id || null;

    if (sessionId) {
      const { data: row } = await admin
        .from("wizard_checkout_sessions")
        .select("state")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();
      if (row?.state) wizardState = row.state;
    }

    if (!Object.keys(wizardState).length) {
      try {
        const { data: rowByJob, error: byJobErr } = await admin
          .from("wizard_checkout_sessions")
          .select("state")
          .eq("job_id", jobId)
          .maybeSingle();
        if (!byJobErr && rowByJob?.state) wizardState = rowByJob.state;
      } catch (_) {}
    }

    const letter = filledLetterFromJob(job, wizardState);

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ letter }),
    };
  } catch (e) {
    console.error("get-filled-letter:", e.message || e);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
