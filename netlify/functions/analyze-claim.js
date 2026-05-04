/**
 * Insurance claim dispute wizard — analysis (gpt-4o JSON).
 */

const OpenAI = require("openai");
const {
  corsHeaders,
  optionsResponse,
  verifyWizardAuth,
} = require("./_wizardAuth.js");
const { recordReviewUsageIncrement } = require("./_billing-snapshot");

const ANALYSIS_SYSTEM_PROMPT = `You are an expert insurance claim dispute analyst with
20 years of experience in property and casualty insurance,
claims adjusting, bad faith litigation support, and
policyholder advocacy.

Analyze the provided insurance denial or underpayment
letter and return a JSON object with this exact structure:

{
  "claimType": "string — e.g. Property Damage, Auto, Health",
  "claimNumber": "string or null",
  "policyNumber": "string or null",
  "dateOfLoss": "string or null",
  "adjusterName": "string or null",
  "insurerName": "string — name of insurance company",
  "denialDate": "string or null",
  "denialBasis": "string — exact basis stated by insurer",
  "amountDisputed": "string — dollar amount or 'Not specified'",
  "amountPaid": "string — what insurer paid or '$0'",
  "responseDeadline": "string — deadline or 'Not specified'",
  "riskLevel": "low | moderate | high | critical",
  "riskRationale": "string — one sentence",
  "plainEnglish": "string — 3-4 sentence plain English
    explanation of what the insurer claims and why",
  "whatHappensIfIgnored": "string — specific consequence",
  "proceduralDefects": [
    "specific procedural gaps found in the denial —
    e.g. 'No engineer report provided',
    'No moisture mapping or uplift testing performed',
    'Specific exclusion subsection not cited',
    'No itemized scope of damages provided',
    'Wear and tear exclusion applied without supporting
    documentation'"
  ],
  "keyIssuesToAddress": [
    "specific items that must be addressed in response"
  ],
  "winningAngles": [
    "strongest legal and procedural arguments available
    based on claim type and denial language —
    Property: scope omission, depreciation misapplication,
    concurrent causation, matching statute violation;
    Auto: CCC valuation errors, comparable misalignment;
    Health: medical necessity, ERISA procedural defects;
    Business Interruption: revenue baseline errors"
  ],
  "policyProvisionsToInvoke": [
    "policy provisions to reference —
    e.g. 'Coverage grant',
    'Loss settlement provision',
    'Appraisal clause',
    'Duties after loss — insured compliance',
    'Replacement cost provisions'"
  ],
  "regulatoryDutiesToCite": [
    "regulatory duties to cite —
    e.g. 'Unfair Claims Settlement Practices Act',
    'Failure to Conduct Reasonable Investigation',
    'Failure to Provide Written Explanation of Coverage
    Position',
    'Prompt Payment Requirements',
    'Good Faith and Fair Dealing obligation'"
  ],
  "stateSpecificStatutes": [
    "ONLY include if state is known and you are certain.
    NEVER fabricate statute numbers.
    If state unknown: return empty array."
  ],
  "documentationNeeded": [
    "specific documents to gather before responding"
  ],
  "escalationLadder": [
    "Internal appeal to supervisor",
    "Appraisal clause invocation (if applicable)",
    "State Department of Insurance complaint",
    "Independent / public adjuster review",
    "Legal counsel consultation"
  ],
  "availableStrategies": [
    {
      "id": "dispute",
      "title": "Full Dispute",
      "subtitle": "Contest denial entirely",
      "description": "Use when you believe the denial is
        wrong on facts or procedure.",
      "recommended": false,
      "risk": "high",
      "outcome": "string"
    },
    {
      "id": "partial",
      "title": "Partial Dispute",
      "subtitle": "Accept in part, dispute in part",
      "description": "Use when some items are correct but
        others are underpaid or wrongly denied.",
      "recommended": false,
      "risk": "moderate",
      "outcome": "string"
    },
    {
      "id": "reinspection",
      "title": "Demand Re-Inspection",
      "subtitle": "Request independent inspection",
      "description": "Use when the original inspection
        was incomplete, rushed, or missed damage.",
      "recommended": false,
      "risk": "low",
      "outcome": "string"
    },
    {
      "id": "appraisal",
      "title": "Invoke Appraisal",
      "subtitle": "Trigger appraisal clause",
      "description": "Use when parties disagree on the
        value of the loss and policy has appraisal clause.",
      "recommended": false,
      "risk": "moderate",
      "outcome": "string"
    },
    {
      "id": "other",
      "title": "Other / Custom",
      "subtitle": "Describe your specific situation",
      "description": "Use when your situation requires
        a custom approach not covered above.",
      "recommended": false,
      "risk": "VARIES",
      "outcome": "Letter tailored to your described strategy"
    }
  ],
  "recommendedStrategy": "dispute | partial | reinspection
    | appraisal | other",
  "recommendedStrategyRationale": "string — why recommended",
  "insurerContactInfo": {
    "phone": "string or null",
    "address": "Complete insurer mailing address from
      the denial letter header — include street, city,
      state, ZIP. This is where the policyholder sends
      their response. null if not found.",
    "faxNumber": "string or null",
    "adjusterEmail": "string or null"
  },
  "urgency": "routine | elevated | urgent | critical"
}

CRITICAL RULES:
- Never fabricate statute numbers or case law
- Never fabricate policy provisions not in the letter
- If state unknown: use principle-based references only
- Quote their exact denial language to build the rebuttal
- Identify every procedural gap and documentation deficiency
- Return ONLY the JSON object. No preamble. No markdown.`;

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
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });
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

  const auth = await verifyWizardAuth(event);
  if (!auth.ok) return auth.response;

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
        body: JSON.stringify({ analysis, confidence: "low" }),
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
        }),
      };
    }

    const userMessage = buildUserMessage(body, letterText);
    let completion = await runAnalysis(openai, userMessage);
    usageLog = completion.usage;
    let raw = completion.choices[0]?.message?.content || "{}";
    let analysis;

    try {
      analysis = JSON.parse(raw);
    } catch {
      const retry = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `${userMessage}\n\nYour previous output was not valid JSON. Return ONLY one valid JSON object matching the schema. No markdown.`,
          },
        ],
      });
      usageLog = retry.usage;
      raw = retry.choices[0]?.message?.content || "{}";
      try {
        analysis = JSON.parse(raw);
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

    const userId = auth.user?.id;
    if (userId && typeof userId === "string") {
      try {
        await recordReviewUsageIncrement(userId);
      } catch (usageErr) {
        console.warn("recordReviewUsageIncrement:", usageErr);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ analysis, confidence }),
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
      body: JSON.stringify({ analysis, confidence: "low" }),
    };
  }
};
