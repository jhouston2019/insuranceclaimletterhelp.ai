/**
 * Build claim_jobs payloads using only columns known to exist in production.
 */

const { filledLetterFromJob, packLetterFull } = require("./_letter-placeholders");

function payerNameFromWizard(ws) {
  if (!ws || typeof ws !== "object") return "";
  if (ws.payerName) return String(ws.payerName).trim();
  if (ws.adjusterName) return String(ws.adjusterName).trim();
  const a = ws.analysis;
  if (a && typeof a === "object" && a.insurerName) {
    const n = String(a.insurerName).trim();
    if (n && !/string\s*[—\-]/i.test(n)) return n;
  }
  return "";
}

function buildClaimJobPayload(ws, sessionId, options = {}) {
  const { userId = null, paid = false } = options;
  const payload = {
    paid: paid === true,
    is_unlocked: paid === true,
  };

  if (sessionId) payload.stripe_checkout_session_id = sessionId;
  if (userId) payload.user_id = userId;

  if (ws?.letterRaw) {
    payload.letter_html = paid
      ? filledLetterFromJob(
          {
            letter_html: ws.letterRaw,
            letter_full: ws.analysis
              ? packLetterFull(ws.analysis, ws)
              : null,
            payer_name: payerNameFromWizard(ws) || null,
          },
          ws
        )
      : ws.letterRaw;
  }

  if (ws?.analysis) {
    payload.letter_full = packLetterFull(ws.analysis, ws);
  }
  if (ws?.strategy) payload.selected_strategy = ws.strategy;
  if (ws?.claimType) payload.claim_type = ws.claimType;

  const payer = payerNameFromWizard(ws);
  if (payer) payload.payer_name = payer;

  return payload;
}

module.exports = {
  buildClaimJobPayload,
  payerNameFromWizard,
};
