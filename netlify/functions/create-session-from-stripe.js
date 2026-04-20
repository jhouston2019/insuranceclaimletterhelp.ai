/**
 * POST { sessionId }
 * Deterministic resolution: (1) metadata.supabase_user_id (2) user_entitlements.stripe_customer_id (3) create user.
 * No listUsers / no claim_letters / no email matching for identity.
 */

const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

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

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({ error: "Stripe not configured" }),
    };
  }

  try {
    const { sessionId } = JSON.parse(event.body || "{}");
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: "sessionId required" }),
      };
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer"],
    });

    const stripeCustomerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || null;

    if (!stripeCustomerId) {
      return {
        statusCode: 422,
        headers: cors,
        body: JSON.stringify({ error: "No Stripe customer on session" }),
      };
    }

    const meta = session.metadata || {};
    const email =
      session.customer_details?.email ||
      session.customer_email ||
      meta.email ||
      null;

    if (!email) {
      return {
        statusCode: 422,
        headers: cors,
        body: JSON.stringify({ error: "No email on Stripe session" }),
      };
    }

    const supabase = getSupabaseAdmin();

    let userId = meta.supabase_user_id || null;
    let resolveStep = null;

    if (userId) {
      resolveStep = "metadata_supabase_user_id";
    } else {
      const { data: ent } = await supabase
        .from("user_entitlements")
        .select("user_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();
      if (ent?.user_id) {
        userId = ent.user_id;
        resolveStep = "user_entitlements.stripe_customer_id";
      }
    }

    if (!userId) {
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            stripe_customer_id: stripeCustomerId,
            plan: meta.plan || meta.plan_type,
          },
        });
      if (createErr) {
        const { data: entRetry } = await supabase
          .from("user_entitlements")
          .select("user_id")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();
        if (entRetry?.user_id) {
          userId = entRetry.user_id;
          resolveStep = "stripe_customer_id_after_create_conflict";
        } else {
          console.error("createUser:", createErr);
          return {
            statusCode: 500,
            headers: cors,
            body: JSON.stringify({ error: createErr.message }),
          };
        }
      } else {
        userId = created.user.id;
        resolveStep = "admin_create_user";
      }
    }

    const { data: priorEnt } = await supabase
      .from("user_entitlements")
      .select("paid, last_checkout_session_id")
      .eq("user_id", userId)
      .maybeSingle();

    const sameSessionRetry =
      priorEnt?.last_checkout_session_id === sessionId;
    const keepPaid =
      sameSessionRetry && priorEnt?.paid === true;

    // Never grant paid on a new Stripe session until verify-payment (or webhook) runs.
    await supabase.from("user_entitlements").upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        plan_type: meta.plan_type || meta.plan || "single",
        paid: keepPaid,
        active: true,
        last_checkout_session_id: sessionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    const { data: linkData, error: linkErr } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: process.env.SITE_URL
            ? `${process.env.SITE_URL.replace(/\/$/, "")}/app`
            : "/app",
        },
      });

    if (linkErr) {
      console.error("generateLink:", linkErr);
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: linkErr.message }),
      };
    }

    const hashed =
      linkData?.properties?.hashed_token ||
      linkData?.properties?.email_otp;
    const actionLink = linkData?.properties?.action_link || null;

    console.log(
      JSON.stringify({
        event: "SESSION_FINALIZED",
        sessionId: session.id,
        userId,
        stripeCustomerId,
        resolveStep,
        ts: new Date().toISOString(),
      })
    );

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        ok: true,
        userId,
        email,
        token_hash: hashed,
        verify_type: "email",
        action_link: actionLink,
      }),
    };
  } catch (e) {
    console.error("create-session-from-stripe:", e);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
