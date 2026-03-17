# CITATION DATABASE GUIDE
**How to Add and Maintain State Insurance Codes**

---

## OVERVIEW

The citation verification system relies on an authoritative database of state insurance codes, federal regulations, and NAIC model laws. This guide explains how to add new citations and maintain the database.

---

## CURRENT COVERAGE

### States Implemented (5)
- ✅ California (CA) - 3 citations
- ✅ Texas (TX) - 2 citations
- ✅ Florida (FL) - 2 citations
- ✅ New York (NY) - 2 citations
- ✅ Illinois (IL) - 1 citation

### Federal Regulations (3)
- ✅ ERISA § 503
- ✅ 29 CFR § 2560.503-1
- ✅ ACA § 2719

### NAIC Model Laws (1)
- ✅ NAIC Model Law #900 (Unfair Claims Settlement Practices)

---

## ADDING A NEW STATE

### Step 1: Research State Insurance Code

**Resources:**
- State legislature website (e.g., leginfo.legislature.ca.gov for California)
- State insurance department website
- NAIC resources
- Legal databases (Westlaw, LexisNexis)

**Key Provisions to Find:**
1. **Unfair Claims Settlement Practices**
   - Usually titled "Unfair Claims Settlement Practices Act"
   - Defines what insurers cannot do
   - Example: CA Insurance Code § 790.03

2. **Prompt Payment Requirements**
   - Timeframes for acknowledgment and decision
   - Example: TX Insurance Code § 542.003

3. **Claims Procedure Regulations**
   - Investigation requirements
   - Communication requirements
   - Example: CA Code of Regulations § 2695.7

### Step 2: Verify Citation Accuracy

**Checklist:**
- [ ] Citation format is correct (state code § section number)
- [ ] URL links to official government source
- [ ] Text summary is accurate
- [ ] Timeframes are correct
- [ ] Applicability is verified

**Example Verification:**

```javascript
// CORRECT
"CA_INS_790.03": {
  title: "Unfair Claims Settlement Practices",
  citation: "California Insurance Code § 790.03",
  summary: "Defines unfair claims practices including misrepresentation, failure to acknowledge claims promptly, failure to investigate, and unreasonable delays",
  url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=INS&sectionNum=790.03",
  applicableTo: ["denial", "delay", "underpayment", "bad_faith"],
  timeframe: "15 days to acknowledge, 40 days to accept or deny"
}

// INCORRECT - Missing URL, vague summary
"CA_INS_790.03": {
  title: "Unfair Practices",
  citation: "CA Code 790.03",
  summary: "Defines unfair practices",
  applicableTo: ["all"]
}
```

### Step 3: Add to Database

**File:** `netlify/functions/citation-verification-system.js`

**Location:** `STATE_INSURANCE_CODES` object

**Template:**

```javascript
// Add new state
PA: {
  state: "Pennsylvania",
  codes: {
    "PA_STAT_40_1171.5": {
      title: "[Full Title from Statute]",
      citation: "[Exact Citation Format]",
      summary: "[Concise summary of what this law does]",
      text: "[Optional: First sentence of actual law text]",
      url: "[Official government URL]",
      applicableTo: ["[claim_type]", "[phase]", "[issue_type]"],
      timeframe: "[If applicable: X days to acknowledge, Y days to decide]"
    }
  }
}
```

**Example: Adding Pennsylvania**

```javascript
PA: {
  state: "Pennsylvania",
  codes: {
    "PA_STAT_40_1171.5": {
      title: "Unfair Claim Settlement Practices",
      citation: "40 Pa. Stat. § 1171.5",
      summary: "Defines unfair claim settlement practices including misrepresentation, failure to investigate, and unreasonable delays",
      text: "The following are defined as unfair claim settlement practices...",
      url: "https://www.legis.state.pa.us/cfdocs/legis/LI/consCheck.cfm?txtType=HTM&ttl=40",
      applicableTo: ["denial", "delay", "bad_faith"],
      timeframe: "Reasonable time for acknowledgment and decision"
    },
    
    "PA_INS_REG_146.5": {
      title: "Standards for Prompt Investigation",
      citation: "31 Pa. Code § 146.5",
      summary: "Requires prompt and thorough investigation of claims",
      url: "https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/031/chapter146/s146.5.html",
      applicableTo: ["denial", "insufficient_investigation"]
    }
  }
}
```

### Step 4: Test New Citations

**Create Test:**

```javascript
// In tests/quality-systems.test.js

it('should verify valid Pennsylvania citation', () => {
  const result = verifyCitation(
    '40 Pa. Stat. § 1171.5',
    'PA',
    'property_homeowners'
  );
  
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.accurate, true);
  console.log('✅ PA citation verified');
});
```

**Run Test:**

```bash
node tests/quality-systems.test.js
```

### Step 5: Deploy Update

```bash
git add netlify/functions/citation-verification-system.js
git commit -m "Add Pennsylvania insurance code citations"
git push origin main
```

---

## CITATION FORMATS BY STATE

### Common Formats

**Format 1: Insurance Code**
- California: `California Insurance Code § 790.03`
- Texas: `Texas Insurance Code § 542.003`
- Florida: `Florida Statutes § 627.70131`

**Format 2: Statutes**
- Pennsylvania: `40 Pa. Stat. § 1171.5`
- Illinois: `215 ILCS 5/154.6`
- New York: `New York Insurance Law § 3420`

**Format 3: Regulations**
- California: `California Code of Regulations § 2695.7`
- New York: `11 NYCRR § 216.4`

### Citation Key Components

```javascript
{
  code: "STATE_ABBREV_TYPE_NUMBER",  // Unique identifier
  title: "Official Title",             // From statute
  citation: "Full Citation Format",    // As it appears in law
  summary: "1-2 sentence summary",     // What it does
  text: "First sentence of law",       // Optional
  url: "Official government URL",      // Must be .gov or official
  applicableTo: ["array", "of", "contexts"], // When to use
  timeframe: "X days to Y"             // If applicable
}
```

---

## APPLICABILITY TAGS

### Claim Types
- `property_homeowners`
- `property_renters`
- `auto_collision`
- `auto_comprehensive`
- `health_medical`
- `health_prescription`
- `all_claims` (applies to all)

### Phases
- `information_request`
- `denial`
- `partial_payment`
- `appeal`
- `initial_claim`

### Issue Types
- `delay` - Insurer not responding promptly
- `denial` - Claim denied
- `underpayment` - Claim paid but amount too low
- `bad_faith` - Insurer acting in bad faith
- `no_response` - No acknowledgment received
- `insufficient_investigation` - Investigation inadequate

---

## QUALITY STANDARDS

### Required Fields

**Minimum:**
- code (unique identifier)
- title
- citation
- summary
- url
- applicableTo (at least 1 tag)

**Recommended:**
- text (first sentence of law)
- timeframe (if law specifies)

### URL Requirements

**Must:**
- Link to official government source (.gov, .state.xx.us, etc.)
- Link directly to statute section (not general page)
- Be publicly accessible (no paywall)

**Must Not:**
- Link to third-party sites (legal blogs, Wikipedia)
- Link to paywalled databases (Westlaw, LexisNexis)
- Link to expired or archived pages

### Summary Requirements

**Must:**
- Be 1-2 sentences maximum
- Accurately describe what the law does
- Use plain language (not legalese)
- Focus on insurer obligations

**Example Good Summary:**
"Requires insurers to acknowledge claims within 15 days and accept or deny within 40 days"

**Example Bad Summary:**
"Establishes certain requirements and procedures"

---

## VERIFICATION PROCESS

### Before Adding Citation

1. **Verify Law Exists**
   - Check official government website
   - Confirm section number is correct
   - Verify law is currently in effect

2. **Verify Applicability**
   - Confirm law applies to insurance claims
   - Identify which claim types it covers
   - Note any exceptions or limitations

3. **Verify Timeframes**
   - Check if law specifies timeframes
   - Note if timeframes vary by claim type
   - Verify current timeframes (laws can change)

4. **Test Citation**
   - Add to database
   - Create test case
   - Run verification
   - Check extraction works

### After Adding Citation

1. **Run Test Suite**
   ```bash
   node tests/quality-systems.test.js
   ```

2. **Test in Generation**
   ```bash
   # Generate letter for that state
   # Verify citation appears correctly
   # Verify format is exact
   ```

3. **Verify in Database**
   ```sql
   SELECT * FROM citation_verifications 
   WHERE citations::text LIKE '%[new citation]%'
   LIMIT 5;
   ```

---

## MAINTENANCE SCHEDULE

### Quarterly Review (Every 3 Months)

**Tasks:**
- [ ] Review all citations for accuracy
- [ ] Check for law changes or updates
- [ ] Verify URLs still work
- [ ] Update timeframes if changed
- [ ] Add new relevant provisions

**Process:**
1. Visit each state's legislative website
2. Search for insurance code updates
3. Check effective dates of new laws
4. Update database if needed
5. Run full test suite
6. Deploy updates

### Annual Comprehensive Audit

**Tasks:**
- [ ] Full citation database review
- [ ] Add 5-10 new states
- [ ] Update federal regulations
- [ ] Review NAIC model law changes
- [ ] Verify all URLs active
- [ ] Update all summaries for accuracy

---

## EXPANSION ROADMAP

### Priority 1: Top 10 States (Next 30 Days)

1. Pennsylvania
2. Ohio
3. Georgia
4. North Carolina
5. Michigan

**Covers:** 50%+ of US population

### Priority 2: Next 10 States (Next 60 Days)

6. New Jersey
7. Virginia
8. Washington
9. Arizona
10. Massachusetts

**Covers:** 70%+ of US population

### Priority 3: Remaining States (Next 90 Days)

11-50. All remaining states

**Covers:** 100% of US population

---

## CITATION QUALITY METRICS

### Target Metrics

- **Coverage:** 50 states + federal
- **Accuracy:** 100% verified
- **Applicability:** 95%+ relevant to claim type
- **URL Validity:** 100% active links
- **Update Frequency:** Quarterly review

### Current Metrics

```sql
-- Get citation coverage
SELECT 
  COUNT(DISTINCT state_code) as states_covered,
  COUNT(*) as total_citations,
  AVG(accuracy_rate) as avg_accuracy
FROM citation_verifications;
```

---

## BEST PRACTICES

### DO:
✅ Use official government sources only  
✅ Verify citation format exactly  
✅ Include specific timeframes when available  
✅ Tag with specific applicability  
✅ Test thoroughly before deploying  
✅ Document source and verification date  

### DON'T:
❌ Copy from third-party websites  
❌ Paraphrase or modify citation text  
❌ Use outdated or archived laws  
❌ Tag as "all_claims" unless truly universal  
❌ Include citations without verification  
❌ Use vague or generic summaries  

---

## TROUBLESHOOTING

### Issue: Citation not being extracted

**Cause:** Citation format doesn't match regex patterns

**Solution:**
```javascript
// Add new pattern to extractCitations()
const newPattern = /[State]\s+[Format]\s+§\s*(\d+)/gi;
```

### Issue: Citation marked as inapplicable

**Cause:** `applicableTo` tags don't match claim type

**Solution:**
```javascript
// Update applicableTo array
applicableTo: ["property_homeowners", "property_renters", "denial"]
```

### Issue: URL broken

**Cause:** Government website restructured

**Solution:**
1. Search for new URL on government site
2. Update URL in database
3. Verify new URL works
4. Test citation extraction

---

## CONTACT

For questions about citation database:
- Review this guide
- Check `citation-verification-system.js` inline documentation
- Consult legal resources
- Contact development team

---

**Guide Version:** 1.0  
**Last Updated:** March 17, 2026  
**Next Review:** June 17, 2026
