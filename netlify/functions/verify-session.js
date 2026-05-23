/**
 * Validates a Stripe Checkout session is paid and returns persisted wizard_state.
 */

const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase");
const { filledLetterFromJob } = require("./_letter-placeholders");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const corsOk = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const jobId = row.job_id;
    if (jobId) {
      const updatePayload = {
        paid: true,
        is_unlocked: true,
        stripe_session_id: sessionId,
        updated_at: new Date().toISOString(),
      };

      const ws = row.state || {};
      if (ws.letterRaw) {
        updatePayload.letter_html = filledLetterFromJob(
          {
            letter_html: ws.letterRaw,
            letter_full: ws.analysis
              ? typeof ws.analysis === "string"
                ? ws.analysis
                : JSON.stringify(ws.analysis)
              : null,
            claim_number: ws.claimNumber || ws.fillClaimNumber || null,
            policy_number: ws.policyNumber || ws.fillPolicyNumber || null,
            payer_name: ws.payerName || ws.adjusterName || null,
          },
          ws
        );
      }
      if (ws.analysis) {
        updatePayload.letter_full = typeof ws.analysis === "string"
          ? ws.analysis
          : JSON.stringify(ws.analysis);
      }
      if (ws.strategy) updatePayload.selected_strategy = ws.strategy;

      const { error: updateErr } = await admin
        .from("claim_jobs")
        .update(updatePayload)
        .eq("id", jobId);

      if (updateErr) {
        console.error("verify-session: claim_jobs update failed", updateErr.message);
      }
    }

    let customerEmail = null;
    try {
      customerEmail = stripeSession.customer_details?.email
        || stripeSession.customer_email
        || null;
    } catch (_) {}

    if (customerEmail && jobId) {
      await admin
        .from("claim_jobs")
        .update({ customer_email: customerEmail })
        .eq("id", jobId);
    }

    return {
      statusCode: 200,
      headers: { ...corsOk, "Content-Type": "application/json" },
      body: JSON.stringify({
        paid: true,
        wizardState: row.state ?? {},
        jobId: jobId,
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
