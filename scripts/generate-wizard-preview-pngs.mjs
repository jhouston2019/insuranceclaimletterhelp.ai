/**
 * Renders PNG mockups of claim-defense wizard steps (SVG → sharp).
 * Output is 2400×1600 (2× logical 1200×800) for sharp display when sized to 1200×800 on the site.
 * Run: node scripts/generate-wizard-preview-pngs.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "images");

const NAVY = "#0f1e35";
const GRAY = "#f3f4f6";
const BORDER = "#d1d5db";
const WHITE = "#ffffff";
const MUTED = "#6b7280";

/** Raster size (retina); coordinates stay in 0–1200 × 0–800 via viewBox */
const OUT_W = 2400;
const OUT_H = 1600;
const VB_W = 1200;
const VB_H = 800;

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function topNav() {
  return `
  <rect width="1200" height="52" fill="${NAVY}"/>
  <text x="28" y="34" fill="#ffffff" font-family="Georgia, Times New Roman, serif" font-size="21" font-weight="700">Insurance Claim Defense</text>
  <text x="748" y="32" fill="#e5e7eb" font-family="system-ui, Segoe UI, sans-serif" font-size="13">Home   Pricing   Sign in   Purchase access</text>`;
}

function progress(activeStep) {
  const labels = ["1. Input", "2. Analysis", "3. Strategy", "4. Letter"];
  const gap = 10;
  const w = (1200 - 48 - 3 * gap) / 4;
  let x = 24;
  let svg = "";
  for (let i = 0; i < 4; i++) {
    const on = i + 1 === activeStep;
    svg += `<rect x="${x}" y="64" width="${w}" height="42" rx="8" fill="${on ? "#eef2ff" : WHITE}" stroke="${on ? NAVY : BORDER}" stroke-width="${on ? 2 : 1}"/>`;
    svg += `<text x="${x + w / 2}" y="91" text-anchor="middle" fill="${on ? NAVY : MUTED}" font-family="system-ui, sans-serif" font-size="12" font-weight="${on ? "700" : "400"}">${labels[i]}</text>`;
    x += w + gap;
  }
  return svg;
}

function wrapSvg(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 ${VB_W} ${VB_H}">
<rect width="${VB_W}" height="${VB_H}" fill="${GRAY}"/>
${inner}
</svg>`;
}

function letterTextRows(lines, startY, dy, fontSize) {
  return lines
    .map(
      (line, i) =>
        `<text x="48" y="${startY + i * dy}" fill="#1a1a1a" font-family="Georgia, Times New Roman, serif" font-size="${fontSize}">${esc(line)}</text>`
    )
    .join("\n");
}

async function toPng(name, svg) {
  const buf = Buffer.from(svg, "utf8");
  await sharp(buf).png({ compressionLevel: 7, effort: 10 }).toFile(join(OUT, name));
}

const sampleLetter = `RE: NOTICE OF CLAIM DETERMINATION — CLM-2024-847291

Dear Policyholder,

We have completed our investigation of your property damage claim. After review of the engineer report and policy language, we are denying coverage for interior water damage as wear and tear / long-term seepage not sudden and accidental.

Your policy requires prompt notice and documentation of loss. Based on the information provided, payment for disputed interior repairs is denied at this time.

Sincerely,
Claims Department`;

const step1 = wrapSvg(`
${topNav()}
${progress(1)}
<rect x="20" y="124" width="1160" height="656" rx="10" fill="${WHITE}" stroke="${BORDER}" stroke-width="1"/>
<text x="44" y="162" fill="#111" font-family="Georgia, serif" font-size="22" font-weight="700">Claim input</text>
<text x="44" y="186" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="12">Paste your denial or underpayment letter, or upload a PDF, image, or text file.</text>
<text x="44" y="212" fill="#111" font-family="system-ui, sans-serif" font-size="11" font-weight="600">Paste your denial letter here</text>
<rect x="44" y="220" width="1112" height="120" rx="8" fill="#fff" stroke="${BORDER}"/>
<text x="56" y="242" fill="#374151" font-family="Consolas, Courier New, monospace" font-size="9">${esc(sampleLetter.split("\n").slice(0, 5).join(" "))}</text>
<text x="56" y="258" fill="#374151" font-family="Consolas, Courier New, monospace" font-size="9">...</text>
<rect x="44" y="352" width="1112" height="44" rx="8" fill="#fafafa" stroke="${BORDER}" stroke-dasharray="6 4"/>
<text x="580" y="378" text-anchor="middle" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="11">Click or drag PDF, JPG, PNG, or TXT</text>
<text x="44" y="418" fill="#111" font-family="system-ui, sans-serif" font-size="10" font-weight="600">Claim type</text>
<rect x="44" y="424" width="520" height="30" rx="6" fill="#fff" stroke="${BORDER}"/>
<text x="56" y="444" fill="#111" font-family="system-ui, sans-serif" font-size="11">Property Damage (Wind/Hail/Water)</text>
<text x="600" y="418" fill="#111" font-family="system-ui, sans-serif" font-size="10" font-weight="600">State</text>
<rect x="600" y="424" width="556" height="30" rx="6" fill="#fff" stroke="${BORDER}"/>
<text x="612" y="444" fill="#111" font-family="system-ui, sans-serif" font-size="11">Georgia</text>
<text x="44" y="478" fill="#111" font-family="system-ui, sans-serif" font-size="10" font-weight="600">Policy number</text>
<rect x="44" y="484" width="520" height="28" rx="6" fill="#fff" stroke="${BORDER}"/>
<text x="56" y="502" fill="#111" font-family="system-ui, sans-serif" font-size="11">HO-9847261</text>
<text x="600" y="478" fill="#111" font-family="system-ui, sans-serif" font-size="10" font-weight="600">Claim number</text>
<rect x="600" y="484" width="556" height="28" rx="6" fill="#fff" stroke="${BORDER}"/>
<text x="612" y="502" fill="#111" font-family="system-ui, sans-serif" font-size="11">CLM-2024-847291</text>
<text x="44" y="532" fill="#111" font-family="system-ui, sans-serif" font-size="10" font-weight="600">Date of loss</text>
<rect x="44" y="538" width="520" height="28" rx="6" fill="#fff" stroke="${BORDER}"/>
<text x="56" y="556" fill="#111" font-family="system-ui, sans-serif" font-size="11">2024-09-15</text>
<text x="600" y="532" fill="#111" font-family="system-ui, sans-serif" font-size="10" font-weight="600">Adjuster name</text>
<rect x="600" y="538" width="556" height="28" rx="6" fill="#fff" stroke="${BORDER}"/>
<text x="612" y="556" fill="#111" font-family="system-ui, sans-serif" font-size="11">John Smith</text>
<text x="44" y="586" fill="#111" font-family="system-ui, sans-serif" font-size="10" font-weight="600">Disputed amount</text>
<rect x="44" y="592" width="520" height="28" rx="6" fill="#fff" stroke="${BORDER}"/>
<text x="56" y="610" fill="#111" font-family="system-ui, sans-serif" font-size="11">$18,400</text>
<text x="600" y="586" fill="#111" font-family="system-ui, sans-serif" font-size="10" font-weight="600">Response deadline</text>
<rect x="600" y="592" width="556" height="28" rx="6" fill="#fff" stroke="${BORDER}"/>
<text x="612" y="610" fill="#111" font-family="system-ui, sans-serif" font-size="11">2024-10-30</text>
<rect x="44" y="636" width="180" height="36" rx="8" fill="#e5e7eb"/>
<text x="134" y="659" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="12" font-weight="600">Load demo denial letter</text>
<rect x="236" y="636" width="200" height="36" rx="8" fill="${NAVY}"/>
<text x="336" y="659" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="12" font-weight="700">Analyze My Claim</text>
`);

const step2 = wrapSvg(`
${topNav()}
${progress(2)}
<rect x="20" y="124" width="1160" height="656" rx="10" fill="${WHITE}" stroke="${BORDER}" stroke-width="1"/>
<rect x="20" y="124" width="1160" height="72" rx="10" fill="${NAVY}"/>
<text x="36" y="156" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="11">Analysis</text>
<text x="36" y="182" fill="#fff" font-family="Georgia, serif" font-size="18" font-weight="700">Property Damage · Highland Mutual Insurance Company</text>
<rect x="1020" y="140" width="140" height="32" rx="16" fill="#f59e0b"/>
<text x="1090" y="161" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="11" font-weight="700">MODERATE</text>
<rect x="36" y="212" width="260" height="64" rx="8" fill="#fff" stroke="${BORDER}"/>
<text x="48" y="232" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="11">Claim Type</text>
<text x="48" y="256" fill="#111" font-family="system-ui, sans-serif" font-size="14" font-weight="700">Property Damage</text>
<rect x="312" y="212" width="260" height="64" rx="8" fill="#fff" stroke="${BORDER}"/>
<text x="324" y="232" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="11">Amount Disputed</text>
<text x="324" y="256" fill="#dc2626" font-family="system-ui, sans-serif" font-size="14" font-weight="700">$5,000</text>
<rect x="588" y="212" width="260" height="64" rx="8" fill="#fff" stroke="${BORDER}"/>
<text x="600" y="232" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="11">Response Deadline</text>
<text x="600" y="256" fill="#111" font-family="system-ui, sans-serif" font-size="14" font-weight="700">Nov 15, 2024</text>
<rect x="864" y="212" width="300" height="64" rx="8" fill="#fff" stroke="${BORDER}"/>
<text x="876" y="232" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="11">Risk Level</text>
<text x="876" y="256" fill="#111" font-family="system-ui, sans-serif" font-size="14" font-weight="700">moderate</text>
<text x="36" y="308" fill="#111" font-family="Georgia, serif" font-size="15" font-weight="700">What the insurer is claiming</text>
<text x="36" y="334" fill="#374151" font-family="system-ui, sans-serif" font-size="11">The carrier characterizes the loss as long-term maintenance and applies wear-and-tear without itemized scope or engineer findings.</text>
<rect x="36" y="352" width="1108" height="72" rx="8" fill="#fffbeb" stroke="#fbbf24"/>
<text x="48" y="376" fill="#92400e" font-family="system-ui, sans-serif" font-size="11" font-weight="700">These gaps weaken the insurer's position</text>
<text x="56" y="398" fill="#92400e" font-family="system-ui, sans-serif" font-size="10">• No moisture mapping or line-item scope tied to policy language</text>
<text x="56" y="414" fill="#92400e" font-family="system-ui, sans-serif" font-size="10">• Denial cites wear/tear without contemporaneous documentation</text>
<text x="36" y="448" fill="#111" font-family="Georgia, serif" font-size="15" font-weight="700">Strongest dispute angles</text>
<text x="48" y="472" fill="#111" font-family="system-ui, sans-serif" font-size="10">✓ Procedural defects in investigation completeness</text>
<text x="48" y="488" fill="#111" font-family="system-ui, sans-serif" font-size="10">✓ Misapplication of exclusion vs. documented sudden event</text>
<text x="48" y="504" fill="#111" font-family="system-ui, sans-serif" font-size="10">✓ Regulatory duties: reasonable investigation &amp; written explanation</text>
<rect x="36" y="536" width="240" height="36" rx="8" fill="#e5e7eb"/>
<text x="156" y="559" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="12" font-weight="600">← Back</text>
<rect x="288" y="536" width="320" height="36" rx="8" fill="${NAVY}"/>
<text x="448" y="559" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="12" font-weight="700">Choose Your Response Strategy →</text>
<rect x="36" y="584" width="260" height="32" rx="6" fill="#e5e7eb"/>
<text x="166" y="604" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="11">Download Analysis PDF</text>
<rect x="308" y="584" width="280" height="32" rx="6" fill="#e5e7eb"/>
<text x="448" y="604" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="11">Download Analysis Word</text>
`);

const step3 = wrapSvg(`
${topNav()}
${progress(3)}
<rect x="20" y="124" width="1160" height="656" rx="10" fill="${WHITE}" stroke="${BORDER}" stroke-width="1"/>
<text x="44" y="162" fill="#111" font-family="Georgia, serif" font-size="22" font-weight="700">Response strategy</text>
<text x="44" y="186" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="12">Select one approach. The recommended option reflects your claim analysis.</text>
<rect x="44" y="204" width="340" height="120" rx="10" fill="#fff" stroke="${BORDER}" stroke-width="2"/>
<text x="60" y="232" fill="#111" font-family="system-ui, sans-serif" font-size="13" font-weight="700">Full Dispute</text>
<text x="60" y="252" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="10">Systematic rebuttal</text>
<text x="60" y="280" fill="#374151" font-family="system-ui, sans-serif" font-size="9">Demand corrected payment with regulatory pressure.</text>
<rect x="404" y="204" width="340" height="120" rx="10" fill="#eef2ff" stroke="${NAVY}" stroke-width="2"/>
<rect x="416" y="212" width="110" height="18" rx="4" fill="#fbbf24"/>
<text x="471" y="225" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="8" font-weight="700">RECOMMENDED</text>
<text x="420" y="248" fill="#111" font-family="system-ui, sans-serif" font-size="13" font-weight="700">Partial Dispute</text>
<text x="420" y="268" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="10">Split agreed vs. disputed line items</text>
<text x="420" y="298" fill="#374151" font-family="system-ui, sans-serif" font-size="9">Target supplemental payment for documented omissions.</text>
<rect x="764" y="204" width="340" height="120" rx="10" fill="#fff" stroke="${BORDER}" stroke-width="2"/>
<text x="780" y="232" fill="#111" font-family="system-ui, sans-serif" font-size="13" font-weight="700">Demand Re-Inspection</text>
<text x="780" y="252" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="10">Challenge inspection quality</text>
<rect x="44" y="336" width="340" height="120" rx="10" fill="#fff" stroke="${BORDER}" stroke-width="2"/>
<text x="60" y="364" fill="#111" font-family="system-ui, sans-serif" font-size="13" font-weight="700">Invoke Appraisal</text>
<text x="60" y="384" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="10">Formal appraisal clause</text>
<rect x="404" y="336" width="340" height="120" rx="10" fill="#fff" stroke="${BORDER}" stroke-width="2"/>
<text x="420" y="364" fill="#111" font-family="system-ui, sans-serif" font-size="13" font-weight="700">Other / Custom</text>
<text x="420" y="384" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="10">Tailored approach</text>
<rect x="44" y="472" width="1112" height="100" rx="8" fill="#f9fafb" stroke="${BORDER}"/>
<text x="56" y="496" fill="#111" font-family="system-ui, sans-serif" font-size="11" font-weight="700">Why this strategy:</text>
<text x="56" y="516" fill="#374151" font-family="system-ui, sans-serif" font-size="10">Partial dispute fits when the carrier paid some items but omitted documented scope — preserves credibility while pressing for the disputed balance.</text>
<text x="56" y="540" fill="#374151" font-family="system-ui, sans-serif" font-size="10">Regulatory basis: unfair claims practices, duty of good faith investigation, written explanation of coverage position.</text>
<rect x="44" y="596" width="240" height="36" rx="8" fill="#e5e7eb"/>
<text x="164" y="619" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="12" font-weight="600">← Back</text>
<rect x="296" y="596" width="280" height="36" rx="8" fill="${NAVY}"/>
<text x="436" y="619" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="12" font-weight="700">Generate My Dispute Letter →</text>
`);

/** ~26 lines @ dy 11.25 → ends ~468; keeps room for Fill + actions inside 800px canvas */
const step4LetterLines = [
  "[INSURED NAME]  |  [ADDRESS]  |  [CITY, STATE ZIP]",
  "[DATE]  •  Highland Mutual — Claims — [INSURER ADDRESS]",
  "",
  "Re: CLM-2024-847291 | Policy HO-9847261 | Date of loss 2024-09-15",
  "Dear Claims Department,",
  "",
  "SECTION I — BACKGROUND:",
  "Within 24 hours of the 9/15/24 storm I reported interior intrusion, sent photos,",
  "mitigation invoices, drying logs, and a contractor line-item estimate for",
  "[DISPUTED AMOUNT]. Partial exterior payment issued; interior denied in [DATE] letter.",
  "",
  "SECTION II — YOUR DETERMINATION:",
  "Drywall, insulation, flooring, and trim denied under Section III (wear/tear).",
  "The denial does not map those exclusions to room-by-room engineer findings.",
  "",
  "SECTION III — FORMAL DISPUTE (PARTIAL / SCOPE):",
  "(A) Sudden wind-driven entry is not reconciled with blanket wear/tear for every",
  "interior line. (B) Paid exterior wind damage and omitted interior tie to same peril.",
  "(C) Produce the investigation file, photos, and notes actually relied upon.",
  "",
  "SECTION IV — REQUESTED RELIEF (15 business days):",
  "Rescind or amend the denial; provide written bases with file citations; confirm",
  "re-inspection and appraisal rights. I reserve all rights under policy and law.",
  "",
  "Respectfully,",
  "[INSURED NAME]  •  [PHONE]  •  [EMAIL]",
];

const step4LetterSvg = letterTextRows(step4LetterLines, 182, 11.25, "9.5");

const step4 = wrapSvg(`
${topNav()}
${progress(4)}
<rect x="20" y="124" width="1160" height="656" rx="10" fill="${WHITE}" stroke="${BORDER}" stroke-width="1"/>
<text x="36" y="152" fill="#111" font-family="Georgia, serif" font-size="15" font-weight="700">Your Insurance Dispute Letter — Property Damage | Highland Mutual | partial</text>
<rect x="1050" y="132" width="110" height="26" rx="6" fill="#e5e7eb"/>
<text x="1105" y="149" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="10">Edit letter</text>
<rect x="36" y="164" width="1128" height="318" rx="8" fill="#fff" stroke="${BORDER}"/>
${step4LetterSvg}
<text x="36" y="498" fill="#111" font-family="Georgia, serif" font-size="13" font-weight="700">Fill placeholders</text>
<text x="36" y="516" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="9">Complete your details. [DATE] defaults to today.</text>
<rect x="36" y="524" width="340" height="24" rx="6" fill="#fff" stroke="${BORDER}"/><text x="48" y="540" fill="#111" font-family="system-ui, sans-serif" font-size="9">Jane Policyholder</text>
<rect x="392" y="524" width="340" height="24" rx="6" fill="#fff" stroke="${BORDER}"/><text x="404" y="540" fill="#111" font-family="system-ui, sans-serif" font-size="9">123 Oak Street</text>
<rect x="748" y="524" width="340" height="24" rx="6" fill="#fff" stroke="${BORDER}"/><text x="760" y="540" fill="#111" font-family="system-ui, sans-serif" font-size="9">Atlanta, GA 30309</text>
<rect x="36" y="556" width="340" height="24" rx="6" fill="#fff" stroke="${BORDER}"/><text x="48" y="572" fill="#111" font-family="system-ui, sans-serif" font-size="9">404-555-0199</text>
<rect x="392" y="556" width="340" height="24" rx="6" fill="#fff" stroke="${BORDER}"/><text x="404" y="572" fill="#111" font-family="system-ui, sans-serif" font-size="9">jane@email.com</text>
<rect x="36" y="588" width="168" height="28" rx="8" fill="${NAVY}"/>
<text x="120" y="606" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="10" font-weight="700">Fill placeholders</text>
<rect x="214" y="588" width="118" height="28" rx="8" fill="#e5e7eb"/>
<text x="273" y="606" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="10">← Back to strategy</text>
<rect x="342" y="588" width="100" height="28" rx="8" fill="#e5e7eb"/>
<text x="392" y="606" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="10">Copy letter</text>
<rect x="452" y="588" width="108" height="28" rx="8" fill="#e5e7eb"/>
<text x="506" y="606" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="10">Download PDF</text>
<rect x="570" y="588" width="118" height="28" rx="8" fill="#e5e7eb"/>
<text x="629" y="606" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="10">Download Word</text>
<rect x="698" y="588" width="92" height="28" rx="8" fill="#e5e7eb"/>
<text x="744" y="606" text-anchor="middle" fill="#111" font-family="system-ui, sans-serif" font-size="10">Start over</text>
<rect x="36" y="624" width="1112" height="34" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
<text x="48" y="640" fill="#475569" font-family="system-ui, sans-serif" font-size="8.5">Starting point only — complex denials / bad faith / claims over $25k: have a licensed public adjuster or attorney review before sending.</text>
<text x="48" y="652" fill="#475569" font-family="system-ui, sans-serif" font-size="8.5">Not legal advice; no attorney-client relationship.</text>
`);

mkdirSync(OUT, { recursive: true });

await toPng("wizard-step1.png", step1);
await toPng("wizard-step2.png", step2);
await toPng("wizard-step3.png", step3);
await toPng("wizard-step4.png", step4);

console.log("Wrote:", join(OUT, "wizard-step1.png"));
console.log("Wrote:", join(OUT, "wizard-step2.png"));
console.log("Wrote:", join(OUT, "wizard-step3.png"));
console.log("Wrote:", join(OUT, "wizard-step4.png"));
