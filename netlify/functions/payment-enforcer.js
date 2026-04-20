/**
 * PAYMENT ENFORCEMENT (server-side)
 *
 * Canonical: getBillingSnapshot — paid === true only from user_entitlements.
 */

const { getSupabaseAdmin } = require("./_supabase");
const { getBillingSnapshot } = require("./_billing-snapshot");

function isPaymentWallBypassed() {
  return process.env.BYPASS_PAYMENT_WALL === "true";
}

/**
 * @param {string} userId
 * @param {string} email
 * @param {string|null} [documentId]
 */
async function verifyPayment(userId, email, documentId = null) {
  if (isPaymentWallBypassed()) {
    if (!userId && !email) {
      return {
        verified: false,
        error: "No user identifier provided",
      };
    }
    console.warn(
      "[BYPASS_PAYMENT_WALL] Payment verification skipped — for local/staging test only."
    );
    return {
      verified: true,
      documentId: documentId || null,
      paymentRecord: null,
      canGenerate: true,
      bypass: true,
    };
  }

  if (!userId) {
    return {
      verified: false,
      error: "Authentication required",
      needsPayment: true,
    };
  }

  const snap = await getBillingSnapshot(userId);

  if (snap.paid !== true) {
    return {
      verified: false,
      error: "Payment required for your account.",
      needsPayment: true,
      paid: false,
    };
  }

  const lim = snap.usage.limit;
  if (lim !== -1 && snap.usage.used >= lim) {
    return {
      verified: false,
      error: "Review usage limit reached for your plan.",
      needsPayment: true,
      code: "USAGE_EXCEEDED",
    };
  }

  return {
    verified: true,
    paymentRecord: null,
    documentId: null,
    canGenerate: true,
    plan_type: snap.plan_type,
  };
}

async function markPaymentUsed(documentId) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("claim_letters")
    .update({
      letter_generated: true,
      letter_generated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    console.error("Failed to mark payment as used:", error);
    return false;
  }

  return true;
}

async function canUpload(userId, email) {
  const verification = await verifyPayment(userId, email);

  if (!verification.verified) {
    return {
      allowed: false,
      reason: verification.error,
      needsPayment: verification.needsPayment,
    };
  }

  return {
    allowed: true,
    documentId: verification.documentId,
  };
}

async function canGenerateLetter(userId, documentId) {
  const supabase = getSupabaseAdmin();

  if (isPaymentWallBypassed()) {
    const { data, error } = await supabase
      .from("claim_letters")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return {
        allowed: false,
        reason: "Document not found or access denied",
      };
    }

    console.warn(
      "[BYPASS_PAYMENT_WALL] Generation allowed without paid status — test only."
    );
    return {
      allowed: true,
      document: data,
      bypass: true,
    };
  }

  const pv = await verifyPayment(userId, null);
  if (!pv.verified) {
    return {
      allowed: false,
      reason: pv.error,
      needsPayment: pv.needsPayment,
    };
  }

  const { data, error } = await supabase
    .from("claim_letters")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return {
      allowed: false,
      reason: "Document not found or access denied",
    };
  }

  if (data.letter_generated) {
    return {
      allowed: false,
      reason:
        "Letter already generated for this payment. Please purchase again for a new letter.",
      needsPayment: true,
    };
  }

  return {
    allowed: true,
    document: data,
  };
}

async function withPaymentEnforcement(event, handler) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { userId, email } = body;

    if (!userId && !email) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Authentication required",
          message: "Please login to continue",
        }),
      };
    }

    const verification = await verifyPayment(userId, email);

    if (!verification.verified) {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error:
            verification.code === "USAGE_EXCEEDED"
              ? "Usage limit exceeded"
              : "Payment required",
          message: verification.error,
          needsPayment: verification.needsPayment,
          redirectTo: "/pricing",
        }),
      };
    }

    return await handler(event, verification);
  } catch (error) {
    console.error("Payment enforcement error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Payment verification failed",
        message: error.message,
      }),
    };
  }
}

module.exports = {
  verifyPayment,
  markPaymentUsed,
  canUpload,
  canGenerateLetter,
  withPaymentEnforcement,
  isPaymentWallBypassed,
};
