/**
 * POST { sessionId?, userEmail? } — queue / log receipt send (SendGrid when configured).
 */

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

  let sgMail = null;
  try {
    sgMail = require("@sendgrid/mail");
  } catch (_) {
    /* optional */
  }

  try {
    const { sessionId, userEmail } = JSON.parse(event.body || "{}");

    console.log(
      JSON.stringify({
        event: "SEND_RECEIPT_QUEUED",
        sessionId: sessionId || null,
        hasEmail: Boolean(userEmail),
        ts: new Date().toISOString(),
      })
    );

    const key = process.env.SENDGRID_API_KEY;
    const from = process.env.SUPPORT_EMAIL || "noreply@example.com";
    const to = userEmail;

    if (sgMail && key && to) {
      sgMail.setApiKey(key);
      await sgMail.send({
        to,
        from,
        subject: "Your Insurance Claim Response Pro receipt",
        text: `Thank you for your purchase.${sessionId ? ` Reference: ${sessionId}` : ""}`,
      });
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, sent: Boolean(sgMail && key && to) }),
    };
  } catch (e) {
    console.error("send-receipt:", e);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, sent: false, note: e.message }),
    };
  }
};
