/**
 * Replace instructional letter placeholders using analysis + insured details.
 */

function parseAnalysis(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function cleanInsurerName(name, fallback = "") {
  const n = String(name || "").trim();
  if (!n || /string\s*[—\-]/i.test(n)) return String(fallback || "").trim();
  return n;
}

function extractWizardFill(ws) {
  if (!ws || typeof ws !== "object") return {};
  return {
    fillName: ws.fillName || "",
    fillAddress: ws.fillAddress || "",
    fillCity: ws.fillCity || "",
    fillPhone: ws.fillPhone || "",
    fillEmail: ws.fillEmail || "",
    fillClaimNumber: ws.fillClaimNumber || "",
    fillPolicyNumber: ws.fillPolicyNumber || "",
    fillDateOfLoss: ws.fillDateOfLoss || "",
    fillDisputedAmount: ws.fillDisputedAmount || "",
    fillInsurerAddress: ws.fillInsurerAddress || "",
    fillAdjusterName: ws.fillAdjusterName || "",
  };
}

function packLetterFull(analysis, wizardState = {}) {
  const base =
    typeof analysis === "string" ? parseAnalysis(analysis) : { ...(analysis || {}) };
  const { _wizardFill, ...rest } = base;
  const fill = extractWizardFill(wizardState);
  const hasFill = Object.values(fill).some((v) => String(v || "").trim());
  return JSON.stringify(hasFill ? { ...rest, _wizardFill: fill } : rest);
}

function wizardFillFromJob(job) {
  const parsed = parseAnalysis(job?.letter_full);
  return parsed._wizardFill || {};
}

function buildFillValues(analysis, extras = {}) {
  const a = analysis || {};
  const contact = a.insurerContactInfo || {};
  return {
    name: extras.fillName || extras.name || "",
    address: extras.fillAddress || extras.address || "",
    city: extras.fillCity || extras.city || "",
    phone: extras.fillPhone || extras.phone || "",
    email: extras.fillEmail || extras.email || "",
    claimNumber:
      extras.fillClaimNumber ||
      extras.claimNumber ||
      a.claimNumber ||
      "",
    policyNumber:
      extras.fillPolicyNumber ||
      extras.policyNumber ||
      a.policyNumber ||
      "",
    dateOfLoss:
      extras.fillDateOfLoss || extras.dateOfLoss || a.dateOfLoss || "",
    disputedAmount:
      extras.fillDisputedAmount ||
      extras.disputedAmount ||
      a.amountDisputed ||
      "",
    insurerAddress:
      extras.fillInsurerAddress ||
      extras.insurerAddress ||
      a.insurerAddress ||
      contact.address ||
      "",
    adjusterName:
      extras.fillAdjusterName || extras.adjusterName || a.adjusterName || "",
    insurerName: cleanInsurerName(
      a.insurerName || extras.insurerName,
      extras.payerName || ""
    ),
    today:
      extras.today ||
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
  };
}

function buildFillValuesFromJob(job, wizardState = {}) {
  const parsed = parseAnalysis(job?.letter_full);
  const { _wizardFill, ...analysis } = parsed;
  const wf = { ...(_wizardFill || {}), ...extractWizardFill(wizardState) };
  return buildFillValues(analysis, {
    ...wf,
    claimNumber:
      wf.fillClaimNumber ||
      wizardState.claimNumber ||
      wizardState.fillClaimNumber ||
      analysis.claimNumber ||
      "",
    policyNumber:
      wf.fillPolicyNumber ||
      wizardState.policyNumber ||
      wizardState.fillPolicyNumber ||
      analysis.policyNumber ||
      "",
    payerName: job?.payer_name || "",
  });
}

function applyLetterPlaceholders(text, values) {
  if (!text || !values) return text || "";
  let html = String(text);
  const v = values;

  const exact = [
    ["[INSURED NAME]", v.name],
    ["[PRINTED NAME]", v.name],
    ["[YOUR NAME]", v.name],
    ["[INSURED SIGNATURE]", "________________________"],
    ["[ADDRESS]", v.address],
    ["[CITY, STATE ZIP]", v.city],
    ["[PHONE]", v.phone],
    ["[EMAIL]", v.email],
    ["[CLAIM NUMBER]", v.claimNumber],
    ["[POLICY NUMBER]", v.policyNumber],
    ["[DATE OF LOSS]", v.dateOfLoss],
    ["[DISPUTED AMOUNT]", v.disputedAmount],
    ["[INSURER ADDRESS]", v.insurerAddress],
    ["[ADJUSTER NAME]", v.adjusterName],
    ["[DATE]", v.today],
  ];

  for (const [ph, val] of exact) {
    if (!val) continue;
    html = html.replace(
      new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      val
    );
  }

  const patterns = [
    [/\[Insurer Name from analysis\]/gi, v.insurerName],
    [/\[INSURED NAME[^\]]*\]/gi, v.name],
    [/\[CLAIM NUMBER[^\]]*\]/gi, v.claimNumber],
    [/\[POLICY NUMBER[^\]]*\]/gi, v.policyNumber],
    [/\[DATE OF LOSS[^\]]*\]/gi, v.dateOfLoss],
    [/\[DISPUTED AMOUNT[^\]]*\]/gi, v.disputedAmount],
    [/\[INSURER ADDRESS[^\]]*\]/gi, v.insurerAddress],
    [/\[ADJUSTER NAME[^\]]*\]/gi, v.adjusterName],
    [/\[ADDRESS[^\]]*\]/gi, v.address],
    [/\[CITY, STATE ZIP[^\]]*\]/gi, v.city],
    [/\[PHONE[^\]]*\]/gi, v.phone],
    [/\[EMAIL[^\]]*\]/gi, v.email],
    [/\[PRINTED NAME[^\]]*\]/gi, v.name],
    [/\[DATE[^\]]*\]/gi, v.today],
  ];

  for (const [re, val] of patterns) {
    if (!val) continue;
    html = html.replace(re, val);
  }

  if (v.claimNumber) {
    html = html.replace(
      /Claim Number:\s*\[[^\]]+\]/gi,
      "Claim Number: " + v.claimNumber
    );
  }
  if (v.policyNumber) {
    html = html.replace(
      /Policy Number:\s*\[[^\]]+\]/gi,
      "Policy Number: " + v.policyNumber
    );
  }
  if (v.dateOfLoss) {
    html = html.replace(
      /Date of Loss:\s*\[[^\]]+\]/gi,
      "Date of Loss: " + v.dateOfLoss
    );
  }

  return html;
}

function filledLetterFromJob(job, wizardState = {}) {
  const raw = job?.letter_html || "";
  if (!raw.trim()) return "";
  return applyLetterPlaceholders(raw, buildFillValuesFromJob(job, wizardState));
}

module.exports = {
  parseAnalysis,
  cleanInsurerName,
  extractWizardFill,
  packLetterFull,
  wizardFillFromJob,
  buildFillValues,
  buildFillValuesFromJob,
  applyLetterPlaceholders,
  filledLetterFromJob,
};
