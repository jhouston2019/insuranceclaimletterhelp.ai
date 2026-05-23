/**
 * Validates Stripe checkout is paid, persists deliverables to claim_jobs,
 * and links the job to the signed-in user when possible.
 */

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("./_supabase");
const { buildClaimJobPayload } = require("./_claim-job-persist");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const corsOk = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function resolveUserId(event, stripeSession) {
  let userId =
    stripeSession.metadata?.supabase_user_id ||
    stripeSession.metadata?.user_id ||
    stripeSession.client_reference_id ||
    null;

  const bearer = (event.headers.authorization || event.headers.Authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!bearer) return userId;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return userId;

  try {
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await authClient.auth.getUser(bearer);
    if (user?.id) return user.id;
  } catch (_) {}

  return userId;
}

exports.handler = async (event) => {
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

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsOk, "Content-Type": "application/json" },
      body: JSON.stringify({ paid: false, message: "Invalid JSON" }),
    };
  }

  const sessionId = body.session_id || body.sessionId;
  if (!sessionId || !String(sessionId).trim()) {
    return {
      statusCode: 200,
      headers: { ...corsOk, "Content-Type": "application/json" },
      body: JSON.stringify({ paid: false }),
    };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 503,
      headers: { ...corsOk, "Content-Type": "application/json" },
      body: JSON.stringify({ paid: false, message: "Payments not configured" }),
    };
  }

  try {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    if (stripeSession.payment_status !== "paid") {
      return {
        statusCode: 200,
        headers: { ...corsOk, "Content-Type": "application/json" },
        body: JSON.stringify({ paid: false }),
      };
    }

    const admin = getSupabaseAdmin();
    const userIdToLink = await resolveUserId(event, stripeSession);

    const { data: row, error } = await admin
      .from("wizard_checkout_sessions")
      .select("id, state, job_id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (error || !row) {
      console.error("verify-session: wizard row missing", error?.message);
      return {
        statusCode: 200,
        headers: { ...corsOk, "Content-Type": "application/json" },
        body: JSON.stringify({ paid: false }),
      };
    }

    const ws = row.state || {};
    let jobId = row.job_id;

    if (!jobId) {
      const { data: existingJob } = await admin
        .from("claim_jobs")
        .select("id")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();

      if (existingJob?.id) {
        jobId = existingJob.id;
      } else {
        const insertPayload = buildClaimJobPayload(ws, sessionId, {
          userId: userIdToLink,
          paid: true,
        });
        const { data: newJob, error: insertErr } = await admin
          .from("claim_jobs")
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertErr) {
          console.error("verify-session: claim_jobs insert failed", insertErr.message);
        } else if (newJob?.id) {
          jobId = newJob.id;
        }
      }

      if (jobId) {
        await admin
          .from("wizard_checkout_sessions")
          .update({ job_id: jobId })
          .eq("stripe_session_id", sessionId);
      }
    }

    if (jobId) {
      const updatePayload = buildClaimJobPayload(ws, sessionId, {
        userId: userIdToLink,
        paid: true,
      });
      updatePayload.updated_at = new Date().toISOString();

      const { error: updateErr } = await admin
        .from("claim_jobs")
        .update(updatePayload)
        .eq("id", jobId);

      if (updateErr) {
        console.error("verify-session: claim_jobs update failed", updateErr.message);
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsOk, "Content-Type": "application/json" },
      body: JSON.stringify({
        paid: true,
        wizardState: ws,
        jobId: jobId || null,
      }),
    };
  } catch (e) {
    console.error("verify-session:", e.message || e);
    return {
      statusCode: 200,
      headers: { ...corsOk, "Content-Type": "application/json" },
      body: JSON.stringify({ paid: false }),
    };
  }
};
