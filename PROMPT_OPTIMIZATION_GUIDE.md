# PROMPT OPTIMIZATION GUIDE
**Continuous Improvement Through Data**

---

## OVERVIEW

The prompt optimization engine learns from outcomes to continuously improve prompts.

**Features:**
- Version management
- Performance tracking
- Automatic optimization
- Comparison analysis

**Goal:** Continuous quality improvement

---

## PROMPT VERSIONS

### Version Management

**Current Versions:**
- `system_analysis` v1 (active)
- `system_generation` v1 (active)
- `system_generation` v2 (testing)

**Version Lifecycle:**
```
draft → testing → active → archived
```

### Creating New Version

```javascript
savePromptVersion({
  promptName: 'system_generation',
  promptType: 'system',
  version: 3,
  promptText: '[Enhanced prompt text]',
  temperature: 0.3,
  model: 'gpt-4o-mini',
  status: 'draft',
  isDefault: false,
  notes: 'Improved specificity requirements'
})
```

---

## PERFORMANCE TRACKING

### Metrics Per Version

**Tracked Automatically:**
- usage_count: Number of times used
- average_quality_score: Average output quality
- average_citation_score: Average citation accuracy
- success_rate: Percentage of successful outcomes

**Composite Score:**
```javascript
compositeScore = 
  (avgQualityScore * 0.4) +
  (avgCitationScore * 0.3) +
  (successRate * 0.3)
```

### Viewing Performance

```bash
curl https://your-site.netlify.app/.netlify/functions/prompt-optimization-engine/analyze/system_generation
```

**Response:**
```json
{
  "promptName": "system_generation",
  "currentVersion": {
    "version": 1,
    "usageCount": 150,
    "avgQualityScore": 82,
    "avgCitationScore": 91,
    "successRate": 79,
    "compositeScore": 83.7
  },
  "bestVersion": {
    "version": 2,
    "usageCount": 50,
    "avgQualityScore": 88,
    "avgCitationScore": 96,
    "successRate": 87,
    "compositeScore": 90.1
  },
  "recommendations": [
    {
      "type": "version_upgrade",
      "priority": "high",
      "message": "Version 2 performs 6.4 points better than current version",
      "action": "Set version 2 as default"
    }
  ],
  "shouldUpgrade": true
}
```

---

## AUTOMATIC OPTIMIZATION

### How It Works

1. **Analyze Failures:**
   - Get recent low-quality letters
   - Identify common issues
   - Group by issue type

2. **Generate Fixes:**
   - Create prompt additions for each issue
   - Build enhanced prompt text
   - Increment version number

3. **Create New Version:**
   - Save as "testing" status
   - Not set as default
   - Ready for A/B test

### Running Automatic Optimization

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/prompt-optimization-engine/optimize \
  -H "Content-Type: application/json" \
  -d '{ "promptName": "system_generation" }'
```

**Response:**
```json
{
  "success": true,
  "newVersion": {
    "version": 3,
    "status": "testing"
  },
  "basedOn": 2,
  "improvements": [
    "generic language: 'in a timely manner'",
    "missing specificity: dates",
    "emotional language: 'disappointed'"
  ],
  "recommendation": "Test this version with A/B testing before setting as default"
}
```

---

## OPTIMIZATION WORKFLOW

### Weekly Optimization Cycle

**Monday: Analyze Performance**
```bash
# Get performance analysis
curl https://your-site.netlify.app/.netlify/functions/prompt-optimization-engine/analyze/system_generation
```

**Tuesday: Generate Optimizations**
```bash
# Get optimization suggestions
curl https://your-site.netlify.app/.netlify/functions/prompt-optimization-engine/suggestions/system_generation

# Generate optimized version
curl -X POST https://your-site.netlify.app/.netlify/functions/prompt-optimization-engine/optimize \
  -d '{ "promptName": "system_generation" }'
```

**Wednesday: Create A/B Test**
```bash
# Create experiment to test new version
curl -X POST https://your-site.netlify.app/.netlify/functions/ab-testing-framework/create \
  -d '{
    "experimentName": "prompt_v2_vs_v3",
    "experimentType": "prompt",
    "controlVariant": { "promptVersion": 2 },
    "testVariant": { "promptVersion": 3 },
    "sampleSizeTarget": 100
  }'
```

**Thursday-Next Wednesday: Run Experiment**
- Monitor progress
- Collect 100 samples
- Wait for outcomes

**Next Thursday: Analyze Results**
```bash
# Get experiment report
curl https://your-site.netlify.app/.netlify/functions/ab-testing-framework/report/exp-123
```

**Next Friday: Deploy Winner**
```sql
-- If test wins, set as default
UPDATE prompt_versions 
SET is_default = true 
WHERE prompt_name = 'system_generation' AND version = 3;
```

---

## PROMPT IMPROVEMENT PATTERNS

### Pattern 1: Strengthen Constraints

**Issue:** Generic language detected frequently

**Fix:**
```
BEFORE:
- Avoid generic phrases

AFTER:
PROHIBITED PHRASES (never use):
- "in a timely manner" → Use "within [X] days"
- "appropriate compensation" → Use "$[amount]"
- "I look forward to" → Use "Please respond by [date]"
```

---

### Pattern 2: Make Requirements Mandatory

**Issue:** Missing specific elements

**Fix:**
```
BEFORE:
- Include specific dates

AFTER:
MANDATORY ELEMENTS (must include all):
- Specific date in MM/DD/YYYY format
- Specific dollar amount with $ symbol
- Claim number from user information
- Policy number from user information
- Specific deadline (date, not "soon")
```

---

### Pattern 3: Add Quality Checklist

**Issue:** Inconsistent quality

**Fix:**
```
BEFORE:
Generate a professional letter.

AFTER:
Generate a professional letter.

QUALITY CHECKLIST (verify before output):
✓ Specific date in header
✓ Claim and policy numbers in RE: line
✓ Specific dollar amount stated
✓ Specific deadline for response
✓ No emotional language
✓ No generic AI phrases
✓ No invented citations
✓ Professional closing
```

---

### Pattern 4: Provide Examples

**Issue:** AI not understanding requirements

**Fix:**
```
BEFORE:
Use specific language.

AFTER:
Use specific language.

EXAMPLES:
❌ BAD: "I request your attention to this matter"
✅ GOOD: "I request reconsideration of Claim #ABC-123"

❌ BAD: "Please respond soon"
✅ GOOD: "Please respond by February 15, 2026"

❌ BAD: "The incident occurred recently"
✅ GOOD: "The incident occurred on January 10, 2026"
```

---

## VERSION COMPARISON

### Comparing Two Versions

```bash
curl https://your-site.netlify.app/.netlify/functions/prompt-optimization-engine/compare/system_generation/1/2
```

**Response:**
```json
{
  "version1": {
    "version": 1,
    "usageCount": 150,
    "avgQualityScore": 82,
    "compositeScore": 83.7
  },
  "version2": {
    "version": 2,
    "usageCount": 50,
    "avgQualityScore": 88,
    "compositeScore": 90.1
  },
  "differences": {
    "qualityScore": +6,
    "citationScore": +5,
    "successRate": +8,
    "compositeScore": +6.4
  },
  "winner": "version_2",
  "recommendation": {
    "action": "adopt_winner",
    "message": "Version 2 shows better performance. Consider setting as default."
  }
}
```

---

## BEST PRACTICES

### DO:
✅ Track performance for every version  
✅ Wait for sufficient data (50+ uses)  
✅ Compare versions scientifically  
✅ Document changes and rationale  
✅ Test before setting as default  

### DON'T:
❌ Deploy untested versions  
❌ Make changes without data  
❌ Ignore performance metrics  
❌ Optimize for one metric only  

---

**Guide Version:** 1.0  
**Last Updated:** March 17, 2026
