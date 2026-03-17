# QUALITY METRICS GUIDE
**Understanding Quality Scores and Grades**

---

## OVERVIEW

The quality assurance system evaluates generated letters across 4 dimensions:
1. Generic Language (25% weight)
2. Specificity (30% weight)
3. Professionalism (25% weight)
4. Structure (20% weight)

**Overall Quality Score:** Weighted average (0-100)  
**Quality Grade:** A+ to F based on score  
**Target:** 85%+ overall quality

---

## COMPONENT SCORES

### 1. Generic Score (25% weight)

**What It Measures:**
Detection of generic AI language that weakens letters.

**Target:** 90%+ (minimal generic language)

**Detected Phrases (40+):**

**Vague Time:**
- ❌ "in a timely manner" → ✅ "within 10 days"
- ❌ "as soon as possible" → ✅ "by January 30, 2026"
- ❌ "at your earliest convenience" → ✅ "by February 15, 2026"

**Vague Amounts:**
- ❌ "appropriate compensation" → ✅ "$5,000.00"
- ❌ "fair settlement" → ✅ "$3,500.00"
- ❌ "reasonable amount" → ✅ "$2,000.00"

**Generic Requests:**
- ❌ "I request your attention to this matter" → ✅ "I request reconsideration of Claim #ABC-123"
- ❌ "please review" → ✅ "please review and respond by [date]"
- ❌ "I look forward to your response" → ✅ "Please respond by [date]"

**AI Hedging:**
- ❌ "it appears that" → ✅ [state fact directly]
- ❌ "I believe that" → ✅ [state fact directly]
- ❌ "in my opinion" → ✅ [state fact directly]

**Scoring:**
```javascript
genericScore = 100 - (totalSeverity / maxSeverity * 100)

// Severity weights:
// low: 1 point
// medium: 2 points
// high: 3 points
// critical: 4 points
```

**Example:**
- 3 low-severity phrases (3 points)
- 2 medium-severity phrases (4 points)
- 1 high-severity phrase (3 points)
- Total severity: 10 points
- Generic score: 100 - (10/50 * 100) = 80

---

### 2. Specificity Score (30% weight)

**What It Measures:**
Presence of specific, concrete details.

**Target:** 85%+

**Required Elements (5):**

**1. Dates (25 points)**
- Formats: MM/DD/YYYY, Month DD, YYYY, YYYY-MM-DD
- Examples: "January 15, 2026", "01/15/2026"
- Required: Yes

**2. Amounts (20 points)**
- Format: $X,XXX.XX
- Examples: "$5,000.00", "$1,234.56"
- Required: Yes

**3. Claim Numbers (20 points)**
- Formats: "Claim Number: ABC-123", "Claim #XYZ789"
- Examples: "Claim Number: ABC-123-456"
- Required: Yes

**4. Policy Numbers (15 points)**
- Formats: "Policy Number: POL-123", "Policy #ABC789"
- Examples: "Policy Number: POL-987-654"
- Required: Yes

**5. Deadlines (20 points)**
- Formats: "by [date]", "within X days", "no later than [date]"
- Examples: "by February 15, 2026", "within 10 business days"
- Required: Yes

**Scoring:**
```javascript
specificityScore = (totalPoints / maxPoints) * 100

// Example:
// Has dates: +25
// Has amounts: +20
// Has claim numbers: +20
// Missing policy numbers: 0
// Has deadlines: +20
// Total: 85/100 = 85%
```

---

### 3. Professionalism Score (25% weight)

**What It Measures:**
Absence of emotional and adversarial language.

**Target:** 95%+

**Emotional Language (12 phrases):**
- ❌ unfair, unreasonable, outrageous, ridiculous, absurd
- ❌ disappointed, frustrated, angry, upset, shocked
- ❌ appalled, disgusted

**Adversarial Language (16 phrases):**
- ❌ bad faith, deceptive, dishonest, lying, fraudulent
- ❌ illegal, violation of law
- ❌ sue, lawsuit, litigation, attorney, lawyer, legal action
- ❌ demand, insist, require you to

**Scoring:**
```javascript
professionalismScore = 100 - penalties

// Penalties:
// Emotional phrase: -5 points each
// Critical emotional: -10 points each
// Adversarial phrase: -10 points each
// Critical adversarial: -15 points each
```

**Example:**
- 1 emotional phrase ("disappointed"): -5
- 1 adversarial phrase ("demand"): -10
- Professionalism score: 100 - 15 = 85

---

### 4. Structure Score (20% weight)

**What It Measures:**
Proper business letter format.

**Target:** 75%+

**Required Elements (8):**

1. **Proper Header** - RE: or Subject: line
2. **Date** - Letter date in header
3. **Claim Reference** - Claim number mentioned
4. **Policy Reference** - Policy number mentioned
5. **Clear Request** - Specific action requested
6. **Deadline** - Response deadline specified
7. **Closing** - Professional closing (Sincerely, Respectfully)
8. **Contact Info** - Phone or email included

**Scoring:**
```javascript
structureScore = (passedChecks / totalChecks) * 100

// Example:
// 7 out of 8 elements present
// Structure score: 7/8 * 100 = 87.5%
```

---

## OVERALL QUALITY SCORE

### Calculation

```javascript
overallQualityScore = 
  (genericScore * 0.25) +
  (specificityScore * 0.30) +
  (professionalismScore * 0.25) +
  (structureScore * 0.20)
```

### Example Calculation

**Letter Scores:**
- Generic Score: 92 (good - few generic phrases)
- Specificity Score: 85 (good - all elements present)
- Professionalism Score: 95 (excellent - no emotional language)
- Structure Score: 88 (good - proper format)

**Calculation:**
```
Overall = (92 * 0.25) + (85 * 0.30) + (95 * 0.25) + (88 * 0.20)
        = 23 + 25.5 + 23.75 + 17.6
        = 89.85
        = 90 (rounded)
```

**Grade:** A- (90/100)

---

## QUALITY GRADES

### Grade Scale

| Score | Grade | Meaning |
|-------|-------|---------|
| 97-100 | A+ | Exceptional quality |
| 93-96 | A | Excellent quality |
| 90-92 | A- | Very good quality |
| 87-89 | B+ | Good quality |
| 83-86 | B | Above average |
| 80-82 | B- | Average |
| 77-79 | C+ | Below average |
| 73-76 | C | Needs improvement |
| 70-72 | C- | Significant issues |
| 60-69 | D | Poor quality |
| <60 | F | Unacceptable |

### Quality Gates

**Must Regenerate (Score <70):**
- Critical quality issues
- Multiple high-severity problems
- Missing required elements
- Emotional or adversarial language

**Should Regenerate (Score 70-84):**
- Below target quality
- Multiple medium-severity issues
- Some missing elements
- Generic language present

**Ready to Send (Score 85+):**
- Meets all quality targets
- No critical issues
- All required elements present
- Professional throughout

---

## INTERPRETING QUALITY REPORTS

### Example Report 1: High Quality

```json
{
  "overallQualityScore": 92,
  "qualityGrade": "A",
  "passesQualityCheck": true,
  "genericScore": 95,
  "specificityScore": 90,
  "professionalismScore": 100,
  "structureScore": 88,
  "totalIssues": 2,
  "criticalIssues": 0,
  "readyToSend": true
}
```

**Interpretation:**
- ✅ Excellent quality (A grade)
- ✅ Minimal generic language (95)
- ✅ All specific elements present (90)
- ✅ Perfect professionalism (100)
- ✅ Good structure (88)
- ✅ Ready to send

**Action:** Approve and send letter

---

### Example Report 2: Medium Quality

```json
{
  "overallQualityScore": 78,
  "qualityGrade": "C+",
  "passesQualityCheck": false,
  "genericScore": 75,
  "specificityScore": 80,
  "professionalismScore": 85,
  "structureScore": 75,
  "totalIssues": 8,
  "criticalIssues": 0,
  "highIssues": 3,
  "readyToSend": false
}
```

**Interpretation:**
- ⚠️ Below target quality (C+ grade)
- ⚠️ Some generic language (75)
- ⚠️ Missing some specific elements (80)
- ✅ Acceptable professionalism (85)
- ⚠️ Structure needs improvement (75)
- ❌ Should regenerate

**Action:** Review issues and regenerate

---

### Example Report 3: Low Quality

```json
{
  "overallQualityScore": 52,
  "qualityGrade": "F",
  "passesQualityCheck": false,
  "genericScore": 45,
  "specificityScore": 50,
  "professionalismScore": 70,
  "structureScore": 50,
  "totalIssues": 15,
  "criticalIssues": 3,
  "mustRegenerate": true,
  "readyToSend": false
}
```

**Interpretation:**
- ❌ Unacceptable quality (F grade)
- ❌ Heavy generic language (45)
- ❌ Missing many specific elements (50)
- ❌ Some emotional language (70)
- ❌ Poor structure (50)
- ❌ Must regenerate immediately

**Action:** Block sending, regenerate with stricter constraints

---

## IMPROVING QUALITY SCORES

### To Improve Generic Score

**Problem:** Too many generic phrases detected

**Solutions:**
1. Enhance prompt with specific examples
2. Add prohibited phrases to prompt
3. Increase specificity requirements
4. Use higher-quality prompt version

**Prompt Enhancement:**
```
PROHIBITED PHRASES:
- "in a timely manner" → Use "within [X] days"
- "appropriate compensation" → Use "$[amount]"
- "I look forward to" → Use "Please respond by [date]"
```

---

### To Improve Specificity Score

**Problem:** Missing required elements

**Solutions:**
1. Make elements MANDATORY in prompt
2. Provide user information upfront
3. Extract elements from uploaded letter
4. Use structured input fields

**Prompt Enhancement:**
```
MANDATORY ELEMENTS (must include all):
1. Specific date: [MM/DD/YYYY format]
2. Specific amount: [$X,XXX.XX format]
3. Claim number: [From user information]
4. Policy number: [From user information]
5. Specific deadline: [Date, not "soon"]
```

---

### To Improve Professionalism Score

**Problem:** Emotional or adversarial language detected

**Solutions:**
1. Strengthen language prohibitions
2. Add explicit examples of prohibited words
3. Emphasize factual statements only
4. Remove subjective language

**Prompt Enhancement:**
```
NEVER USE THESE WORDS:
Emotional: unfair, unreasonable, disappointed, frustrated
Adversarial: sue, lawsuit, demand, insist, bad faith

INSTEAD:
- State facts: "The denial letter dated [date] states [fact]"
- Request action: "I request reconsideration based on [fact]"
- Be direct: "I disagree with [specific finding]"
```

---

### To Improve Structure Score

**Problem:** Missing structural elements

**Solutions:**
1. Provide complete template in prompt
2. Add structure checklist
3. Require all elements before output
4. Use structured generation

**Prompt Enhancement:**
```
REQUIRED STRUCTURE (include all):
1. Sender address (top left)
2. Date
3. Recipient address
4. RE: line with Claim #, Policy #, Loss Date
5. Salutation
6. Opening paragraph
7. Body paragraphs
8. Request with deadline
9. Contact information
10. Closing with signature line
```

---

## QUALITY BENCHMARKING

### Historical Tracking

```sql
-- Get quality trends
SELECT 
  DATE_TRUNC('week', created_at) as week,
  AVG(overall_quality_score) as avg_quality,
  AVG(generic_score) as avg_generic,
  AVG(specificity_score) as avg_specificity,
  AVG(professionalism_score) as avg_professionalism,
  COUNT(*) as sample_size
FROM quality_metrics
GROUP BY week
ORDER BY week DESC;
```

### Comparison to Targets

```sql
-- Check if meeting targets
SELECT 
  AVG(overall_quality_score) >= 85 as meets_quality_target,
  AVG(generic_score) >= 90 as meets_generic_target,
  AVG(specificity_score) >= 85 as meets_specificity_target,
  AVG(professionalism_score) >= 95 as meets_professionalism_target
FROM quality_metrics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
```

---

## QUALITY ALERTS

### Alert Thresholds

**Critical (Immediate Action):**
- Overall quality <70
- Generic score <60
- Professionalism score <80
- 3+ critical issues in single letter

**Warning (Review Required):**
- Overall quality 70-84
- Generic score 60-89
- Specificity score <85
- Professionalism score 80-94

**Info (Monitor):**
- Overall quality 85-89
- Any component score 85-94
- 1-2 medium issues

### Alert Actions

**Critical Alert:**
1. Block letter from being sent
2. Regenerate with enhanced constraints
3. Review prompt configuration
4. Investigate root cause

**Warning Alert:**
1. Show warnings to user
2. Provide improvement recommendations
3. Allow user to regenerate
4. Track issue for prompt optimization

**Info Alert:**
1. Display quality score
2. Show minor recommendations
3. Allow user to proceed
4. Log for analysis

---

## USER-FACING QUALITY DISPLAY

### Quality Badge

```html
<div class="quality-badge ${grade}">
  <span class="score">${score}</span>
  <span class="grade">${grade}</span>
</div>

<style>
.quality-badge.A { background: #22c55e; } /* Green */
.quality-badge.B { background: #3b82f6; } /* Blue */
.quality-badge.C { background: #f59e0b; } /* Orange */
.quality-badge.D { background: #ef4444; } /* Red */
.quality-badge.F { background: #dc2626; } /* Dark Red */
</style>
```

### Quality Breakdown

```html
<div class="quality-breakdown">
  <h4>Quality Analysis</h4>
  
  <div class="metric">
    <label>Generic Language:</label>
    <div class="score-bar">
      <div class="fill" style="width: ${genericScore}%"></div>
    </div>
    <span>${genericScore}/100</span>
  </div>
  
  <div class="metric">
    <label>Specificity:</label>
    <div class="score-bar">
      <div class="fill" style="width: ${specificityScore}%"></div>
    </div>
    <span>${specificityScore}/100</span>
  </div>
  
  <div class="metric">
    <label>Professionalism:</label>
    <div class="score-bar">
      <div class="fill" style="width: ${professionalismScore}%"></div>
    </div>
    <span>${professionalismScore}/100</span>
  </div>
  
  <div class="metric">
    <label>Structure:</label>
    <div class="score-bar">
      <div class="fill" style="width: ${structureScore}%"></div>
    </div>
    <span>${structureScore}/100</span>
  </div>
</div>
```

---

## QUALITY IMPROVEMENT WORKFLOW

### Automatic Improvement

**System automatically:**
1. Detects quality issues
2. Generates recommendations
3. Enhances prompts
4. Regenerates if critical issues
5. Tracks improvements over time

### Manual Improvement

**Developer can:**
1. Review quality metrics dashboard
2. Identify common issues
3. Update prompt templates
4. Run A/B tests
5. Deploy optimized versions

**Process:**
```
1. Query quality_metrics for issues
2. Group by issue type
3. Identify top 5 most common
4. Update prompt to address issues
5. Test new prompt version
6. Run A/B test (control vs new)
7. Analyze results
8. Deploy winner
```

---

## QUALITY CORRELATION WITH OUTCOMES

### Analysis

```sql
-- Correlation between quality and success
SELECT 
  CASE 
    WHEN overall_quality_score >= 90 THEN '90-100'
    WHEN overall_quality_score >= 80 THEN '80-89'
    WHEN overall_quality_score >= 70 THEN '70-79'
    ELSE '<70'
  END as quality_range,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE outcome_result IN ('success', 'partial_success')) as successes,
  ROUND(
    COUNT(*) FILTER (WHERE outcome_result IN ('success', 'partial_success'))::numeric / 
    COUNT(*) * 100, 
    2
  ) as success_rate
FROM quality_metrics qm
JOIN outcome_tracking ot ON qm.document_id = ot.document_id
WHERE ot.outcome_result IS NOT NULL
GROUP BY quality_range
ORDER BY quality_range DESC;
```

**Expected Pattern:**
```
quality_range | total | successes | success_rate
--------------|-------|-----------|-------------
90-100        | 25    | 23        | 92.0%
80-89         | 40    | 32        | 80.0%
70-79         | 20    | 12        | 60.0%
<70           | 5     | 1         | 20.0%
```

**Insight:** Higher quality scores correlate with higher success rates.

---

## BEST PRACTICES

### For Developers

**DO:**
✅ Monitor quality metrics daily  
✅ Investigate quality drops immediately  
✅ Run A/B tests before major changes  
✅ Update prompts based on data  
✅ Document quality improvements  

**DON'T:**
❌ Lower quality thresholds without analysis  
❌ Ignore quality warnings  
❌ Deploy prompt changes without testing  
❌ Remove quality checks to "improve" UX  

### For Business Users

**DO:**
✅ Review quality scores before sending  
✅ Follow improvement recommendations  
✅ Report outcomes for tracking  
✅ Provide feedback on quality  

**DON'T:**
❌ Send letters with critical issues  
❌ Ignore quality warnings  
❌ Skip outcome reporting  

---

## TROUBLESHOOTING

### Issue: All letters scoring low

**Possible Causes:**
1. Prompt too restrictive
2. Quality thresholds too high
3. Detection patterns too sensitive
4. User information incomplete

**Solution:**
```sql
-- Check average scores
SELECT AVG(overall_quality_score) FROM quality_metrics 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- If <70, review prompt configuration
-- If 70-84, monitor and adjust gradually
-- If >85, system is working correctly
```

---

### Issue: Specificity score always low

**Possible Cause:** User information not being passed to prompt

**Solution:**
```javascript
// Verify user info in prompt
console.log('User Info:', userInfo);

// Ensure all fields present:
// - name, address, phone, email
// - claimNumber, policyNumber, lossDate
```

---

### Issue: Generic score inconsistent

**Possible Cause:** Some generic phrases not in detection list

**Solution:**
```javascript
// Add new phrases to GENERIC_AI_PHRASES
{ 
  phrase: "new generic phrase", 
  severity: "medium", 
  replacement: "specific alternative" 
}
```

---

## QUALITY METRICS API

### Get Quality Statistics

```bash
GET /.netlify/functions/outcome-tracking-system/statistics
```

**Response:**
```json
{
  "overall": {
    "averageQualityScore": 87,
    "averageGenericScore": 92,
    "averageSpecificityScore": 85,
    "averageProfessionalismScore": 95,
    "passRate": 88,
    "meetsTarget": true
  }
}
```

### Get Quality for Document

```sql
SELECT * FROM quality_metrics WHERE document_id = '[doc-id]';
```

---

**Guide Version:** 1.0  
**Last Updated:** March 17, 2026  
**Next Review:** April 17, 2026
