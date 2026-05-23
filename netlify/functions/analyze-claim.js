/**
 * Insurance claim dispute wizard — analysis (gpt-4o JSON).
 */

const OpenAI = require("openai");
const {
  corsHeaders,
  optionsResponse,
  optionalWizardAuth,
} = require("./_wizardAuth.js");
const { recordReviewUsageIncrement } = require("./_billing-snapshot");

const ANALYSIS_SYSTEM_PROMPT = `You are an expert insurance claim dispute analyst with
20 years of experience in property and casualty insurance,
claims adjusting, bad faith litigation support, and
policyholder advocacy.

Analyze the provided insurance denial or underpayment letter.

FIELD INSTRUCTIONS (do not echo these as values):
- claimType: type of claim, e.g. Property Damage, Auto, Health
- claimNumber, policyNumber, dateOfLoss, adjusterName, denialDate: extract from letter or null
- insurerName: name of the insurance company from the letter
- denialBasis: exact basis stated by the insurer — quote their language
- amountDisputed: dollar amount disputed or "Not specified"
- amountPaid: what insurer paid or "$0"
- responseDeadline: deadline from letter or "Not specified"
- riskLevel: one of low, moderate, high, critical
- riskRationale: one sentence explaining risk level
- plainEnglish: 3-4 sentence plain English explanation of what the insurer claims and why
- whatHappensIfIgnored: specific consequence if the insured does not respond
- proceduralDefects: specific procedural gaps in the denial (e.g. no engineer report, no moisture mapping, exclusion not cited)
- keyIssuesToAddress: specific items that must be addressed in the response
- winningAngles: strongest legal and procedural arguments for this claim type and denial
- policyProvisionsToInvoke: policy provisions to reference (coverage grant, loss settlement, appraisal clause, etc.)
- regulatoryDutiesToCite: regulatory duties to cite (UCSPA, reasonable investigation, written explanation, prompt payment, good faith)
- stateSpecificStatutes: ONLY if state is known and certain — NEVER fabricate statute numbers; empty array if unknown
- documentationNeeded: specific documents to gather before responding
- escalationLadder: ordered escalation steps appropriate to this claim
- availableStrategies: five strategy objects (dispute, partial, reinspection, appraisal, other) — set recommended true on exactly one
- recommendedStrategy: id of recommended strategy (dispute, partial, reinspection, appraisal, or other)
- recommendedStrategyRationale: why that strategy is recommended
- insurerContactInfo: phone, address (full mailing address from letter header), faxNumber, adjusterEmail — null if not found
- urgency: one of routine, elevated, urgent, critical

Return a JSON object with this exact structure (values below are EXAMPLES ONLY — replace with real extracted data):

{
  "claimType": "Property Damage",
  "claimNumber": "CLM-2024-847291",
  "policyNumber": "HO-9847261",
  "dateOfLoss": "2024-09-15",
  "adjusterName": "John Smith",
  "insurerName": "Acme Insurance Company",
  "denialDate": "2024-10-01",
  "denialBasis": "Wear and tear exclusion applied without supporting documentation",
  "amountDisputed": "$18,400",
  "amountPaid": "$0",
  "responseDeadline": "30 days from letter date",
  "riskLevel": "high",
  "riskRationale": "Large disputed amount with approaching deadline and weak denial support.",
  "plainEnglish": "The insurer denied the claim citing wear and tear. They paid nothing and gave 30 days to respond.",
  "whatHappensIfIgnored": "The insurer may treat the denial as final and pursue collection.",
  "proceduralDefects": [
    "No engineer report provided",
    "No itemized scope of damages provided"
  ],
  "keyIssuesToAddress": [
    "Obtain full inspection report and policy declarations page"
  ],
  "winningAngles": [
    "Insurer failed to conduct reasonable investigation",
    "Exclusion applied without supporting documentation"
  ],
  "policyProvisionsToInvoke": [
    "Coverage grant",
    "Loss settlement provision"
  ],
  "regulatoryDutiesToCite": [
    "Unfair Claims Settlement Practices Act",
    "Duty to conduct a reasonable investigation"
  ],
  "stateSpecificStatutes": [],
  "documentationNeeded": [
    "Complete policy",
    "Photos of damage",
    "Contractor estimate"
  ],
  "escalationLadder": [
    "Internal appeal to supervisor",
    "State Department of Insurance complaint",
    "Legal counsel consultation"
  ],
  "availableStrategies": [
    {
      "id": "dispute",
      "title": "Full Dispute",
      "subtitle": "Contest denial entirely",
      "description": "Use when you believe the denial is wrong on facts or procedure.",
      "recommended": true,
      "risk": "high",
      "outcome": "Formal dispute of the full denial"
    },
    {
      "id": "partial",
      "title": "Partial Dispute",
      "subtitle": "Accept in part, dispute in part",
      "description": "Use when some items are correct but others are underpaid or wrongly denied.",
      "recommended": false,
      "risk": "moderate",
      "outcome": "Corrected payment for disputed items only"
    },
    {
      "id": "reinspection",
      "title": "Demand Re-Inspection",
      "subtitle": "Request independent inspection",
      "description": "Use when the original inspection was incomplete, rushed, or missed damage.",
      "recommended": false,
      "risk": "low",
      "outcome": "New inspection scheduled"
    },
    {
      "id": "appraisal",
      "title": "Invoke Appraisal",
      "subtitle": "Trigger appraisal clause",
      "description": "Use when parties disagree on the value of the loss and policy has appraisal clause.",
      "recommended": false,
      "risk": "moderate",
      "outcome": "Appraisal panel determination"
    },
    {
      "id": "other",
      "title": "Other / Custom",
      "subtitle": "Describe your specific situation",
      "description": "Use when your situation requires a custom approach not covered above.",
      "recommended": false,
      "risk": "VARIES",
      "outcome": "Letter tailored to your described strategy"
    }
  ],
  "recommendedStrategy": "dispute",
  "recommendedStrategyRationale": "Denial lacks documentation and procedural support for a full dispute.",
  "insurerContactInfo": {
    "phone": "1-800-555-0100",
    "address": "123 Insurance Plaza, Dallas, TX 75201",
    "faxNumber": null,
    "adjusterEmail": null
  },
  "urgency": "urgent"
}

CRITICAL RULES:
- Never fabricate statute numbers or case law
- Never fabricate policy provisions not in the letter
- If state unknown: use principle-based references only
- Quote their exact denial language to build the rebuttal
- Identify every procedural gap and documentation deficiency
- Return ONLY the JSON object. No preamble. No markdown.
- NEVER echo schema descriptions or type labels as field values`;

function buildUserMessage(body, letterText) {
  return `Denial/underpayment letter:
${letterText}

Claim type: ${body.claimType || "Auto-detect"}
State: ${body.claimState || "Unknown"}
Policy number: ${body.policyNumber || "Not provided"}
Claim number: ${body.claimNumber || "Not provided"}
Date of loss: ${body.dateOfLoss || "Not provided"}
Adjuster name: ${body.adjusterName || "Not provided"}
Amount disputed: ${body.disputedAmount || "Not provided"}
Response deadline: ${body.responseDeadline || "Not provided"}`;
}

function fallbackAnalysis(note) {
  return {
    claimType: "Unknown",
    claimNumber: null,
    policyNumber: null,
    dateOfLoss: null,
    adjusterName: null,
    insurerName: "Unknown insurer",
    denialDate: null,
    denialBasis: "Unable to parse automatically — manual review required.",
    amountDisputed: "Not specified",
    amountPaid: "$0",
    responseDeadline: "Not specified",
    riskLevel: "high",
    riskRationale: "Analysis could not be completed reliably.",
    plainEnglish:
      note ||
      "The automated analysis did not return valid JSON. Please review the letter manually or try again with clearer text.",
    whatHappensIfIgnored:
      "Deadlines and appeal rights may be lost; the insurer may treat the determination as final.",
    proceduralDefects: [
      "Automated review incomplete — verify all insurer citations and inspection reports yourself.",
    ],
    keyIssuesToAddress: [
      "Obtain full claim file and policy declarations page.",
    ],
    winningAngles: [
      "Request written basis for each exclusion relied upon.",
    ],
    policyProvisionsToInvoke: ["Coverage grant", "Loss settlement provision"],
    regulatoryDutiesToCite: [
      "Duty to conduct a reasonable investigation",
      "Duty to provide written explanation of coverage position",
    ],
    stateSpecificStatutes: [],
    documentationNeeded: ["Complete policy", "All photos and estimates"],
    escalationLadder: [
      "Internal appeal to supervisor",
      "Appraisal clause invocation (if applicable)",
      "State Department of Insurance complaint",
      "Independent / public adjuster review",
      "Legal counsel consultation",
    ],
    availableStrategies: [
      {
        id: "dispute",
        title: "Full Dispute",
        subtitle: "Contest denial entirely",
        description: "Use when you believe the denial is wrong on facts or procedure.",
        recommended: true,
        risk: "high",
        outcome: "Formal dispute of the determination",
      },
      {
        id: "partial",
        title: "Partial Dispute",
        subtitle: "Accept in part, dispute in part",
        description: "Use when some items are correct but others are underpaid.",
        recommended: false,
        risk: "moderate",
        outcome: "Corrected payment for disputed items",
      },
      {
        id: "reinspection",
        title: "Demand Re-Inspection",
        subtitle: "Request independent inspection",
        description: "Use when the original inspection was incomplete.",
        recommended: false,
        risk: "low",
        outcome: "New inspection scheduled",
      },
      {
        id: "appraisal",
        title: "Invoke Appraisal",
        subtitle: "Trigger appraisal clause",
        description: "Use when parties disagree on the value of the loss.",
        recommended: false,
        risk: "moderate",
        outcome: "Appraisal panel determination",
      },
      {
        id: "other",
        title: "Other / Custom",
        subtitle: "Describe your specific situation",
        description: "Use when your situation requires a custom approach.",
        recommended: false,
        risk: "VARIES",
        outcome: "Letter tailored to your described strategy",
      },
    ],
    recommendedStrategy: "dispute",
    recommendedStrategyRationale: "Default while automated analysis is unavailable.",
    insurerContactInfo: { phone: null, address: null, faxNumber: null, adjusterEmail: null },
    urgency: "elevated",
  };
}

async function extractTextFromImage(openai, base64, mime) {
  const dataUrl = `data:${mime};base64,${base64}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract every word of text from this insurance claim or denial document image. Output plain text only, preserving paragraph breaks where obvious.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

async function runAnalysis(openai, userMessage) {
  return openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });
}

function validateAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") return false;
  const insurerName = String(analysis.insurerName || "");
  if (/string\s*[—\-]/i.test(insurerName) || /name of insurance/i.test(insurerName)) {
    return false;
  }
  const claimType = String(analysis.claimType || "");
  if (/string\s*[—\-]/i.test(claimType)) return false;
  const denialBasis = String(analysis.denialBasis || "").trim();
  if (!denialBasis || /string\s*[—\-]/i.test(denialBasis)) return false;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const auth = await optionalWizardAuth(event);

  let letterText = "";
  let usageLog = null;

  try {
    const body = JSON.parse(event.body || "{}");
    letterText = (body.text || "").trim();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!process.env.OPENAI_API_KEY) {
      const analysis = fallbackAnalysis("OpenAI API key not configured.");
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ analysis, confidence: "low", preview: auth.preview }),
      };
    }

    if (body.fileBase64 && body.fileType && body.fileType.startsWith("image/")) {
      const extracted = await extractTextFromImage(
        openai,
        body.fileBase64,
        body.fileType
      );
      letterText = [letterText, extracted].filter(Boolean).join("\n\n").trim();
    }

    if (!letterText || letterText.length < 20) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Letter text is required (paste text or upload a readable image).",
          preview: auth.preview,
        }),
      };
    }

    const userMessage = buildUserMessage(body, letterText);
    let completion = await runAnalysis(openai, userMessage);
    usageLog = completion.usage;
    let raw = completion.choices[0]?.message?.content || "{}";
    let analysis;
    let parseOk = false;

    try {
      analysis = JSON.parse(raw);
      if (validateAnalysis(analysis)) parseOk = true;
    } catch (_) {}

    if (!parseOk) {
      const retry = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `${userMessage}\n\nYour previous output was not valid JSON or contained schema placeholder text instead of real extracted values. Return ONLY one valid JSON object matching the schema with real data from the letter. No markdown.`,
          },
        ],
      });
      usageLog = retry.usage;
      raw = retry.choices[0]?.message?.content || "{}";
      try {
        analysis = JSON.parse(raw);
        if (!validateAnalysis(analysis)) {
          analysis = fallbackAnalysis("Model returned schema placeholders after retry.");
        }
      } catch {
        analysis = fallbackAnalysis("Model returned invalid JSON after retry.");
      }
    }

    if (analysis && Array.isArray(analysis.availableStrategies)) {
      const rec = (analysis.recommendedStrategy || "dispute").toLowerCase();
      analysis.availableStrategies = analysis.availableStrategies.map((s) => ({
        ...s,
        recommended: s.id === rec,
      }));
    }

    const confidence =
      analysis && analysis.riskLevel && analysis.insurerName !== "Unknown insurer"
        ? "high"
        : "medium";

    console.log(
      JSON.stringify({
        fn: "analyze-claim",
        usage: usageLog,
      })
    );

    if (!auth.preview && auth.user?.id) {
      const userId = auth.user.id;
      if (typeof userId === "string") {
        try {
          await recordReviewUsageIncrement(userId);
        } catch (usageErr) {
          console.warn("recordReviewUsageIncrement:", usageErr);
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ analysis, confidence, preview: auth.preview }),
    };
  } catch (err) {
    console.error("analyze-claim:", err);
    const analysis = fallbackAnalysis(String(err.message || err));
    console.log(
      JSON.stringify({
        fn: "analyze-claim",
        usage: usageLog,
        error: String(err.message),
      })
    );
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ analysis, confidence: "low", preview: auth.preview }),
    };
  }
};
