/**
 * SOURCE OF TRUTH: payment is confirmed only when Stripe session.payment_status === "paid"
 * AND user is resolved + ownership validated (JWT user === resolved user, stripe_customer_id consistent).
 */

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("./_supabase");
const {
  checkRateLimit,
  getRateLimitKey,
  getRateLimitForAction,
} = require("./rate-limiter");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function json(cors, statusCode, body) {
  return {
    statusCode,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(
      cors,
      405,
      { status: "invalid", sessionId: null, userId: null, message: "Method not allowed" }
    );
  }

  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  if (!authHeader || !String(authHeader).trim()) {
    return json(cors, 401, {
      status: "invalid",
      message: "Missing auth",
    });
  }

  const clientIp =
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown";

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(cors, 200, {
      status: "invalid",
      sessionId: null,
      userId: null,
      message: "Invalid JSON",
    });
  }

  const { sessionId } = body;
  if (!sessionId) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_INVALID",
        reason: "missing_session_id",
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 200, {
      status: "invalid",
      sessionId: null,
      userId: null,
      message: "sessionId required",
    });
  }

  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_INVALID",
        reason: "missing_authorization",
        sessionId,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 401, {
      status: "invalid",
      message: "Missing auth",
    });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return json(cors, 503, {
      status: "failed",
      sessionId,
      userId: null,
      message: "Auth not configured",
    });
  }

  const authClient = createClient(url, anonKey);
  const {
    data: { user: authUser },
    error: authErr,
  } = await authClient.auth.getUser(bearer);

  if (authErr || !authUser) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_INVALID",
        reason: "invalid_token",
        sessionId,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 401, {
      status: "invalid",
      message: "Invalid session",
    });
  }

  const authUid = authUser.id;

  const rl = checkRateLimit(
    getRateLimitKey(clientIp, authUid, "verify_payment"),
    getRateLimitForAction("verify_payment")
  );
  if (!rl.allowed) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_FAILED",
        reason: "rate_limited",
        sessionId,
        userId: authUid,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 429, {
      status: "failed",
      sessionId,
      userId: authUid,
      message: "Too many attempts",
      retryAfter: rl.retryAfter,
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_FAILED",
        reason: "stripe_not_configured",
        sessionId,
        userId: authUid,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 200, {
      status: "failed",
      sessionId,
      userId: null,
      message: "Stripe not configured",
    });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("processed_sessions")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (existing?.status === "failed") {
    console.log(
      JSON.stringify({
        event: "PAYMENT_FAILED",
        reason: "processed_sessions_failed",
        sessionId,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 200, {
      status: "failed",
      sessionId,
      userId: authUid,
      message: "Payment processing previously failed",
    });
  }

  if (existing?.status === "completed") {
    if (existing.user_id !== authUid) {
      console.log(
        JSON.stringify({
          event: "PAYMENT_INVALID",
          reason: "completed_session_wrong_user",
          sessionId,
          ts: new Date().toISOString(),
        })
      );
      return json(cors, 200, {
        status: "invalid",
        sessionId,
        userId: authUid,
        message: "Session already finalized for another account",
      });
    }
    console.log(
      JSON.stringify({
        event: "verify_payment_completed",
        source: "verify_payment",
        session_id: sessionId,
        user_id: existing.user_id,
        idempotent: true,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 200, {
      status: "paid",
      sessionId,
      userId: existing.user_id,
      success: true,
      idempotent: true,
    });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer"],
    });
  } catch (e) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_FAILED",
        reason: "stripe_retrieve_error",
        sessionId,
        userId: authUid,
        error: e.message,
        ts: new Date().toISOString(),
      })
    );
    await supabase.from("processed_sessions").upsert(
      {
        stripe_checkout_session_id: sessionId,
        status: "failed",
        user_id: authUid,
        completed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_checkout_session_id" }
    );
    return json(cors, 200, {
      status: "failed",
      sessionId,
      userId: authUid,
      message: "Session lookup failed",
    });
  }

  if (!session || !session.id) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_INVALID",
        reason: "invalid_stripe_session",
        sessionId,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 200, {
      status: "invalid",
      sessionId,
      userId: authUid,
      message: "Invalid session",
    });
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;

  const { data: userEnt } = await supabase
    .from("user_entitlements")
    .select("stripe_customer_id")
    .eq("user_id", authUid)
    .maybeSingle();

  if (!userEnt || !userEnt.stripe_customer_id) {
    return json(cors, 401, {
      status: "invalid",
      message: "Unauthorized",
      sessionId: session.id,
      userId: authUid,
    });
  }

  if (stripeCustomerId !== userEnt.stripe_customer_id) {
    return json(cors, 403, {
      status: "invalid",
      message: "Session does not belong to user",
      sessionId: session.id,
      userId: authUid,
    });
  }

  if (session.payment_status !== "paid") {
    console.log(
      JSON.stringify({
        event: "PAYMENT_PENDING_TIMEOUT",
        phase: "stripe_not_paid",
        session_id: sessionId,
        payment_status: session.payment_status,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 200, {
      status: "pending",
      sessionId: session.id,
      userId: authUid,
      payment_status: session.payment_status,
    });
  }

  const metaUid = session.metadata?.supabase_user_id || null;
  const planType =
    session.metadata?.plan_type || session.metadata?.plan || "single";

  let targetUid = null;
  let resolveSource = null;

  if (metaUid) {
    if (metaUid !== authUid) {
      console.log(
        JSON.stringify({
          event: "PAYMENT_INVALID",
          reason: "metadata_user_mismatch",
          sessionId: session.id,
          authUid,
          metaUid,
          ts: new Date().toISOString(),
        })
      );
      return json(cors, 200, {
        status: "invalid",
        sessionId: session.id,
        userId: authUid,
        message: "Session ownership mismatch",
      });
    }
    targetUid = metaUid;
    resolveSource = "metadata_supabase_user_id";
  } else if (stripeCustomerId) {
    const { data: entRow } = await supabase
      .from("user_entitlements")
      .select("user_id, stripe_customer_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (entRow?.user_id) {
      targetUid = entRow.user_id;
      resolveSource = "user_entitlements.stripe_customer_id";
    }
  }

  if (!targetUid) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_PENDING_TIMEOUT",
        reason: "user_not_resolved",
        session_id: session.id,
        userId: authUid,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 200, {
      status: "pending",
      sessionId: session.id,
      userId: authUid,
      message: "Account not linked to checkout — retry after session step",
    });
  }

  if (targetUid !== authUid) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_INVALID",
        reason: "resolved_user_mismatch",
        sessionId: session.id,
        targetUid,
        authUid,
        ts: new Date().toISOString(),
      })
    );
    return json(cors, 200, {
      status: "invalid",
      sessionId: session.id,
      userId: authUid,
      message: "Session ownership mismatch",
    });
  }

  if (!stripeCustomerId) {
    console.log(
      JSON.stringify({
        event: "PAYMENT_FAILED",
        reason: "missing_stripe_customer",
        sessionId: session.id,
        ts: new Date().toISOString(),
      })
    );
    await supabase.from("processed_sessions").upsert(
      {
        stripe_checkout_session_id: sessionId,
        status: "failed",
        user_id: authUid,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_checkout_session_id" }
    );
    return json(cors, 200, {
      status: "failed",
      sessionId: session.id,
      userId: authUid,
      message: "No Stripe customer on session",
    });
  }

  await supabase.from("user_entitlements").upsert(
    {
      user_id: authUid,
      stripe_customer_id: stripeCustomerId,
      plan_type: planType,
      paid: true,
      active: true,
      last_checkout_session_id: sessionId,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  await supabase.from("processed_sessions").upsert(
    {
      stripe_checkout_session_id: sessionId,
      status: "completed",
      user_id: authUid,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" }
  );

  console.log(
    JSON.stringify({
      event: "verify_payment_completed",
      source: "verify_payment",
      session_id: sessionId,
      user_id: authUid,
      resolveSource,
      ts: new Date().toISOString(),
    })
  );

  console.log(
    JSON.stringify({
      event: "PAYMENT_FLOW_COMPLETE",
      session_id: sessionId,
      user_id: authUid,
      source: "verify_payment",
      status: "paid",
      ts: new Date().toISOString(),
    })
  );

  return json(cors, 200, {
    status: "paid",
    sessionId: session.id,
    userId: authUid,
    plan_type: planType,
    success: true,
  });
};
