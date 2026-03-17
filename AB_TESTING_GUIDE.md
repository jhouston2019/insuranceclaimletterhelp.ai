# A/B TESTING GUIDE
**Scientific Experimentation for Continuous Improvement**

---

## OVERVIEW

The A/B testing framework enables scientific experimentation to optimize:
- Prompt variations
- Temperature settings
- Model comparisons
- Citation strategies
- Playbook modifications

**Goal:** Data-driven optimization with statistical confidence

---

## CREATING EXPERIMENTS

### Experiment Types

**1. Prompt Variations**
- Test different prompt wording
- Test different constraint emphasis
- Test different instruction formats

**2. Temperature Settings**
- Test 0.2 vs 0.3
- Test 0.3 vs 0.4
- Find optimal balance

**3. Model Comparisons**
- Test GPT-4o-mini vs GPT-4o
- Test cost vs quality tradeoff

**4. Citation Strategies**
- Test always-include vs relevant-only
- Test citation placement
- Test citation emphasis

---

## USING TEMPLATES

### Pre-Configured Templates

```javascript
EXPERIMENT_TEMPLATES = {
  TEMPERATURE_TEST,
  CITATION_STRATEGY,
  SPECIFICITY_EMPHASIS,
  MODEL_COMPARISON
}
```

### Create from Template

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/ab-testing-framework/create-from-template \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "TEMPERATURE_TEST",
    "overrides": {
      "claimTypes": ["property_homeowners"],
      "sampleSizeTarget": 100
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "experiment": {
    "id": "exp-123",
    "name": "temperature_03_vs_02",
    "status": "draft"
  }
}
```

---

## RUNNING EXPERIMENTS

### Step 1: Start Experiment

```bash
curl -X PUT https://your-site.netlify.app/.netlify/functions/ab-testing-framework/start/exp-123
```

**Effect:**
- Status: draft → active
- Traffic splitting begins
- Assignments start

### Step 2: Monitor Progress

```bash
curl https://your-site.netlify.app/.netlify/functions/ab-testing-framework/report/exp-123
```

**Response:**
```json
{
  "experiment": {
    "name": "temperature_03_vs_02",
    "status": "active"
  },
  "timeline": {
    "durationDays": 7,
    "progress": 45
  },
  "sampleSize": {
    "current": 45,
    "target": 100,
    "control": 23,
    "test": 22
  }
}
```

### Step 3: Wait for Completion

**Automatic Completion:**
- When `current_sample_size >= sample_size_target`
- System automatically analyzes results
- Winner determined
- Recommendations generated

**Manual Completion:**
```bash
curl -X PUT https://your-site.netlify.app/.netlify/functions/ab-testing-framework/complete/exp-123
```

---

## ANALYZING RESULTS

### Statistical Significance

**Method:** Z-test for proportions

**Requirements:**
- Minimum 10 samples per variant
- P-value < 0.05 (95% confidence)

**Example Result:**
```json
{
  "statisticalSignificance": {
    "isSignificant": true,
    "pValue": 0.023,
    "confidence": 97.7,
    "zScore": 2.15,
    "message": "Results are statistically significant (p=0.023, 98% confidence)"
  }
}
```

**Interpretation:**
- **p < 0.05:** Results are statistically significant (not due to chance)
- **p > 0.05:** Results are not significant (could be random variation)

---

### Winner Determination

**Primary Metric:** Success rate

**Secondary Metrics:**
- Quality score
- Citation score
- User satisfaction

**Example:**
```json
{
  "controlMetrics": {
    "successRate": 78,
    "avgQualityScore": 85,
    "avgCitationScore": 92
  },
  "testMetrics": {
    "successRate": 86,
    "avgQualityScore": 88,
    "avgCitationScore": 95
  },
  "winner": "test",
  "recommendation": {
    "action": "adopt_test",
    "message": "Test variant shows 8.0% improvement in success rate. Recommend adopting test variant.",
    "confidence": "high",
    "improvement": "8.0"
  }
}
```

**Decision:**
- Test variant wins: 86% vs 78% success rate
- Improvement is significant: +8%
- Recommendation: Adopt test variant

---

## EXPERIMENT EXAMPLES

### Example 1: Temperature Test

**Hypothesis:** Temperature 0.3 produces better quality than 0.2

**Configuration:**
```json
{
  "experimentName": "temperature_03_vs_02",
  "experimentType": "temperature",
  "controlVariant": { "temperature": 0.2 },
  "testVariant": { "temperature": 0.3 },
  "sampleSizeTarget": 100,
  "claimTypes": ["property_homeowners"]
}
```

**Expected Results:**
- Test (0.3) may have higher quality scores
- Test (0.3) may have more variation
- Control (0.2) may be more consistent

**Decision Criteria:**
- If test quality >5 points better AND success rate similar: Adopt test
- If test quality similar but success rate worse: Keep control
- If inconclusive: Continue testing

---

### Example 2: Citation Strategy

**Hypothesis:** Including citations in every letter improves success rate

**Configuration:**
```json
{
  "experimentName": "citation_always_vs_relevant_only",
  "experimentType": "prompt",
  "controlVariant": { "citationStrategy": "relevant_only" },
  "testVariant": { "citationStrategy": "always_include" },
  "sampleSizeTarget": 100
}
```

**Metrics to Watch:**
- Citation accuracy rate
- Quality score
- Success rate
- User perception

**Possible Outcomes:**
- Always-include wins: Citations help success rate
- Relevant-only wins: Unnecessary citations hurt quality
- Inconclusive: No significant difference

---

### Example 3: Model Comparison

**Hypothesis:** GPT-4o produces significantly better quality to justify 16x cost

**Configuration:**
```json
{
  "experimentName": "gpt4_mini_vs_gpt4",
  "experimentType": "model",
  "controlVariant": { "model": "gpt-4o-mini" },
  "testVariant": { "model": "gpt-4o" },
  "sampleSizeTarget": 50
}
```

**Cost Analysis:**
- GPT-4o-mini: ~$0.003 per letter
- GPT-4o: ~$0.048 per letter (16x more)

**Decision Criteria:**
- If GPT-4o quality >10 points better: Consider premium tier
- If GPT-4o quality <5 points better: Not worth cost
- If GPT-4o success rate >10% better: Worth for complex cases

---

## BEST PRACTICES

### Experiment Design

**DO:**
✅ Test one variable at a time  
✅ Set clear success metrics  
✅ Define minimum sample size  
✅ Wait for statistical significance  
✅ Document hypothesis and rationale  

**DON'T:**
❌ Change multiple variables simultaneously  
❌ Stop experiment early  
❌ Cherry-pick results  
❌ Ignore statistical significance  
❌ Run too many experiments concurrently  

---

### Sample Size Guidelines

**Minimum:** 10 per variant (20 total)
**Recommended:** 50 per variant (100 total)
**Ideal:** 100 per variant (200 total)

**Formula for Sample Size:**
```
n = (Z * √(2p(1-p)) / d)²

Where:
- Z = 1.96 (for 95% confidence)
- p = expected success rate (0.85)
- d = minimum detectable difference (0.10 for 10%)

Example: n = (1.96 * √(2*0.85*0.15) / 0.10)² ≈ 49 per variant
```

---

### Traffic Splitting

**Default:** 50/50 (control vs test)

**Conservative:** 80/20 (80% control, 20% test)
- Use for risky experiments
- Use when control is proven

**Aggressive:** 50/50 or 40/60
- Use for safe experiments
- Use when confident in test variant

---

## MONITORING EXPERIMENTS

### Daily Checks

```bash
# Get experiment status
curl https://your-site.netlify.app/.netlify/functions/ab-testing-framework/report/exp-123
```

**Check:**
- Current sample size
- Progress percentage
- Any errors or issues
- Preliminary trends

### Weekly Analysis

```sql
-- Get experiment assignments
SELECT 
  variant,
  COUNT(*) as count,
  AVG(quality_score) as avg_quality,
  AVG(citation_score) as avg_citation
FROM ab_test_assignments
WHERE experiment_id = 'exp-123'
GROUP BY variant;
```

**Review:**
- Sample balance (should be ~50/50)
- Quality score trends
- Any obvious winner emerging

---

## COMPLETING EXPERIMENTS

### When to Complete

**Automatic:**
- Sample size target reached
- System auto-analyzes and completes

**Manual:**
- Early stopping if clear winner
- Stopping if experiment failing
- Pausing if issues detected

### Completion Process

```bash
curl -X PUT https://your-site.netlify.app/.netlify/functions/ab-testing-framework/complete/exp-123
```

**System Actions:**
1. Analyze all results
2. Calculate statistical significance
3. Determine winner
4. Generate recommendations
5. Update experiment status
6. Save final metrics

---

## ACTING ON RESULTS

### If Test Wins

**Steps:**
1. Review test variant configuration
2. Update default configuration
3. Deploy to production
4. Monitor for 1 week
5. Verify improvement sustained

**Example:**
```javascript
// Test variant won with temperature 0.3
// Update default in generate-letter-enhanced.js
temperature: 0.3  // Was 0.2
```

### If Control Wins

**Steps:**
1. Keep current configuration
2. Document why test didn't work
3. Consider alternative variations
4. Design new experiment

### If Inconclusive

**Steps:**
1. Extend experiment (increase sample size)
2. Refine hypothesis
3. Test more extreme variation
4. Consider different metric

---

## EXPERIMENT TEMPLATES

### Template 1: Temperature Test

```javascript
{
  experimentName: "temperature_03_vs_02",
  experimentType: "temperature",
  description: "Test temperature 0.3 vs 0.2 for better quality",
  controlVariant: { temperature: 0.2 },
  testVariant: { temperature: 0.3 },
  sampleSizeTarget: 100,
  expectedDuration: "2-3 weeks"
}
```

**Hypothesis:** Higher temperature (0.3) produces better quality while maintaining control

**Metrics:** Quality score, citation accuracy, success rate

**Decision:** If test quality >5 points better with similar success rate, adopt 0.3

---

### Template 2: Citation Strategy

```javascript
{
  experimentName: "citation_always_vs_relevant_only",
  experimentType: "prompt",
  description: "Test including citations in every letter vs only when relevant",
  controlVariant: { citationStrategy: "relevant_only" },
  testVariant: { citationStrategy: "always_include" },
  sampleSizeTarget: 100,
  expectedDuration: "2-3 weeks"
}
```

**Hypothesis:** Including citations always improves perceived professionalism and success rate

**Metrics:** Citation usage rate, quality score, success rate

**Decision:** If test success rate >5% better, adopt always-include

---

### Template 3: Model Comparison

```javascript
{
  experimentName: "gpt4_mini_vs_gpt4",
  experimentType: "model",
  description: "Test GPT-4o-mini vs GPT-4o for quality improvement",
  controlVariant: { model: "gpt-4o-mini" },
  testVariant: { model: "gpt-4o" },
  sampleSizeTarget: 50,
  expectedDuration: "1-2 weeks"
}
```

**Hypothesis:** GPT-4o quality improvement justifies 16x cost increase

**Metrics:** Quality score, citation accuracy, success rate, cost per letter

**Decision:** If test quality >10 points better OR success rate >10% better, offer as premium tier

---

## TROUBLESHOOTING

### Issue: Experiment not assigning variants

**Cause:** Experiment not active or criteria not matching

**Solution:**
```sql
-- Check experiment status
SELECT * FROM ab_test_experiments WHERE id = 'exp-123';

-- Verify status = 'active'
-- Verify claim_types and phases match your documents
```

---

### Issue: Unbalanced variant assignment

**Cause:** Traffic percentage not 50/50 or random seed issue

**Solution:**
```sql
-- Check assignment distribution
SELECT variant, COUNT(*) 
FROM ab_test_assignments 
WHERE experiment_id = 'exp-123' 
GROUP BY variant;

-- Should be roughly equal (45/55 is acceptable, 30/70 is not)
```

---

### Issue: No statistical significance

**Cause:** Sample size too small or no real difference

**Solution:**
1. Increase sample size target
2. Extend experiment duration
3. Test more extreme variation
4. Accept that variants may be equivalent

---

**Guide Version:** 1.0  
**Last Updated:** March 17, 2026
