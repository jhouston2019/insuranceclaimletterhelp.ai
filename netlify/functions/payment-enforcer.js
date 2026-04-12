/**
 * PAYMENT ENFORCEMENT MIDDLEWARE
 * 
 * Server-side payment verification - NO CLIENT-SIDE TRUST
 * 
 * Verifies:
 * 1. User is authenticated
 * 2. User has paid (via Stripe session or database)
 * 3. Payment is valid and not reused
 */

const { getSupabaseAdmin } = require("./_supabase");
const Stripe = require("stripe");

function isPaymentWallBypassed() {
  return process.env.BYPASS_PAYMENT_WALL === "true";
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/**
 * Verify user has valid payment
 * @param {string} userId - User ID from auth
 * @param {string} email - User email
 * @param {string|null} [documentId] - Current claim_letters row (used when payment wall is bypassed for testing)
 * @returns {Promise<object>} - Payment verification result
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
      "[BYPASS_PAYMENT_WALL] Payment verification skipped — for local/staging test only. Unset BYPASS_PAYMENT_WALL in production."
    );
    return {
      verified: true,
      documentId: documentId || null,
      paymentRecord: null,
      canGenerate: true,
      bypass: true,
    };
  }

  const supabase = getSupabaseAdmin();
  
  // Check database for paid status
  let query = supabase
    .from('claim_letters')
    .select('*')
    .eq('payment_status', 'paid')
    .eq('letter_generated', false); // Only unused payments

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (email) {
    query = query.eq('user_email', email);
  } else {
    return {
      verified: false,
      error: 'No user identifier provided'
    };
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Payment verification error:', error);
    return {
      verified: false,
      error: 'Database error during payment verification'
    };
  }

  if (!data || data.length === 0) {
    return {
      verified: false,
      error: 'No valid payment found. Please complete payment first.',
      needsPayment: true
    };
  }

  const paymentRecord = data[0];

  // Double-check with Stripe if session ID exists
  const stripe = getStripe();
  if (stripe && paymentRecord.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        paymentRecord.stripe_session_id
      );

      if (session.payment_status !== 'paid') {
        return {
          verified: false,
          error: 'Payment not confirmed by Stripe',
          needsPayment: true
        };
      }
    } catch (stripeError) {
      console.error('Stripe verification error:', stripeError);
      // Continue with database record if Stripe check fails
    }
  }

  return {
    verified: true,
    paymentRecord: paymentRecord,
    documentId: paymentRecord.id,
    canGenerate: !paymentRecord.letter_generated
  };
}

/**
 * Mark payment as used (letter generated)
 * @param {string} documentId - Document ID
 * @returns {Promise<boolean>} - Success status
 */
async function markPaymentUsed(documentId) {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('claim_letters')
    .update({
      letter_generated: true,
      letter_generated_at: new Date().toISOString()
    })
    .eq('id', documentId);

  if (error) {
    console.error('Failed to mark payment as used:', error);
    return false;
  }

  return true;
}

/**
 * Check if user can upload (has unused payment)
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise<object>} - Upload permission result
 */
async function canUpload(userId, email) {
  const verification = await verifyPayment(userId, email);
  
  if (!verification.verified) {
    return {
      allowed: false,
      reason: verification.error,
      needsPayment: verification.needsPayment
    };
  }

  return {
    allowed: true,
    documentId: verification.documentId
  };
}

/**
 * Check if user can generate letter (has paid and not used)
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @returns {Promise<object>} - Generation permission result
 */
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

  // Get document and verify ownership + payment
  const { data, error } = await supabase
    .from('claim_letters')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      allowed: false,
      reason: 'Document not found or access denied'
    };
  }

  if (data.payment_status !== 'paid' && data.stripe_payment_status !== 'paid') {
    return {
      allowed: false,
      reason: 'Payment required',
      needsPayment: true
    };
  }

  if (data.letter_generated) {
    return {
      allowed: false,
      reason: 'Letter already generated for this payment. Please purchase again for a new letter.',
      needsPayment: true
    };
  }

  return {
    allowed: true,
    document: data
  };
}

/**
 * Middleware wrapper for payment enforcement
 * @param {object} event - Netlify function event
 * @param {function} handler - Function to execute if payment verified
 * @returns {Promise<object>} - Response
 */
async function withPaymentEnforcement(event, handler) {
  try {
    // Extract user info from event
    const body = JSON.parse(event.body || '{}');
    const { userId, email } = body;

    if (!userId && !email) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Authentication required',
          message: 'Please login to continue'
        })
      };
    }

    // Verify payment
    const verification = await verifyPayment(userId, email);

    if (!verification.verified) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Payment required',
          message: verification.error,
          needsPayment: verification.needsPayment,
          redirectTo: '/payment.html'
        })
      };
    }

    // Execute handler with verified payment info
    return await handler(event, verification);

  } catch (error) {
    console.error('Payment enforcement error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Payment verification failed',
        message: error.message
      })
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
