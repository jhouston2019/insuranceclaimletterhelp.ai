const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("./_supabase");
const { packLetterFull } = require("./_letter-placeholders");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

exports.handler = async (event) => {
  const corsOk = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

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

  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return {
        statusCode: 503,
        headers: { ...corsOk, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Auth service not configured" }),
      };
    }

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId = null;
    let userEmail = null;
    const authHeader =
      event.headers.authorization || event.headers.Authorization || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (bearer) {
      const {
        data: { user },
        error: authErr,
      } = await authClient.auth.getUser(bearer);
      if (!authErr && user?.id) {
        userId = user.id;
        if (user.email) userEmail = user.email;
      }
    }

    const body = JSON.parse(event.body || "{}");
    const recordId = body.recordId ?? body.job_id ?? null;
    const plan = body.plan || "single";
    const wizardState = body.wizardState;

    const priceId = process.env.STRIPE_PRICE_RESPONSE || "price_19USD_single";

    if (!process.env.SITE_URL) {
      throw new Error("SITE_URL environment variable is not set");
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    const base = process.env.SITE_URL.replace(/\/$/, "");

    const metadata = {
      plan,
      plan_type: plan,
      product_type: "insurance_claim",
    };
    if (userId) {
      metadata.user_id = userId;
      metadata.supabase_user_id = userId;
    }

    if (recordId != null && recordId !== "") {
      metadata.job_id = String(recordId);
      metadata.recordId = String(recordId);
    }

    const successUrlDefault = `${base}/success?session_id={CHECKOUT_SESSION_ID}`;
    const successUrlWizard = `${base}/claim-defense.html?session_id={CHECKOUT_SESSION_ID}`;
    const successUrl =
      wizardState != null ? successUrlWizard : successUrlDefault;
    const cancelUrl =
      wizardState != null ? `${base}/claim-defense.html` : `${base}/pricing`;

    /** @type {import('stripe').Stripe.Checkout.SessionCreateParams} */
    const sessionParams = {
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    };

    if (userEmail) {
      sessionParams.customer_email = userEmail;
      sessionParams.client_reference_id = userId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (wizardState != null && typeof wizardState === "object") {
      const admin = getSupabaseAdmin();

      // Insert claim_jobs row to persist the letter
      const claimJobPayload = {
        stripe_checkout_session_id: session.id,
        paid: false,
        is_unlocked: false,
      };
      if (userId) claimJobPayload.user_id = userId;
      if (userEmail) claimJobPayload.customer_email = userEmail;

      // Extract letter fields from wizardState
      if (wizardState.letterRaw) {
        claimJobPayload.letter_html = wizardState.letterRaw;
      }
      if (wizardState.analysis) {
        claimJobPayload.letter_full = packLetterFull(wizardState.analysis, wizardState);
        claimJobPayload.preview_text = wizardState.analysis.plainEnglish
          || wizardState.analysis.summary
          || "";
      }
      if (wizardState.strategy) {
        claimJobPayload.selected_strategy = wizardState.strategy;
      }
      if (wizardState.claimType) {
        claimJobPayload.claim_type = wizardState.claimType;
      }
      if (wizardState.policyNumber) {
        claimJobPayload.policy_number = wizardState.policyNumber;
      }
      if (wizardState.claimNumber) {
        claimJobPayload.claim_number = wizardState.claimNumber;
      }
      if (wizardState.payerName || wizardState.adjusterName) {
        claimJobPayload.payer_name = wizardState.payerName
          || wizardState.adjusterName || "";
      }

      const { data: jobRow, error: jobErr } = await admin
        .from("claim_jobs")
        .insert(claimJobPayload)
        .select("id")
        .single();

      if (jobErr) {
        console.error("claim_jobs insert:", jobErr);
        // Non-fatal — continue with checkout
      }

      const jobId = jobRow?.id ?? null;

      // Insert wizard_checkout_sessions with job_id reference
      const { error: insErr } = await admin
        .from("wizard_checkout_sessions")
        .insert({
          stripe_session_id: session.id,
          state: wizardState,
          job_id: jobId,
        });
      if (insErr) {
        console.error("wizard_checkout_sessions insert:", insErr);
        return {
          statusCode: 500,
          headers: {
            ...corsOk,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            error: "Could not start checkout (state save failed)",
            details: insErr.message,
          }),
        };
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...corsOk,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: session.url, id: session.id }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        ...corsOk,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Failed to create checkout session",
        details: error.message,
      }),
    };
  }
};
