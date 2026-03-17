# TROUBLESHOOTING GUIDE
**Common Issues and Solutions**

---

## GENERATION ISSUES

### Issue: Letter generation fails

**Symptoms:**
- 500 error from generate-letter-enhanced
- "Letter generation failed" message
- No letter returned

**Possible Causes:**
1. OpenAI API error
2. Database connection issue
3. Invalid document ID
4. Missing user information

**Solutions:**

**Check 1: Error Logs**
```sql
SELECT * FROM structured_logs 
WHERE event_type = 'generation_failed' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Check 2: OpenAI API Status**
```bash
curl https://status.openai.com/api/v2/status.json
```

**Check 3: Document Exists**
```sql
SELECT * FROM claim_letters WHERE id = '[document-id]';
```

**Check 4: User Info Complete**
```javascript
// Verify all required fields present:
// name, address, phone, email, claimNumber, policyNumber, lossDate
```

---

### Issue: Quality gate blocking all letters

**Symptoms:**
- All letters fail quality check
- Quality scores consistently <70
- "Quality gate failed" message

**Possible Causes:**
1. Quality thresholds too strict
2. Prompt not generating specific content
3. User information missing
4. Detection patterns too sensitive

**Solutions:**

**Check 1: Average Quality Scores**
```sql
SELECT 
  AVG(overall_quality_score) as avg_quality,
  AVG(generic_score) as avg_generic,
  AVG(specificity_score) as avg_specificity
FROM quality_metrics
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
```

**Check 2: Common Issues**
```sql
SELECT 
  jsonb_array_elements(issues)->>'type' as issue_type,
  COUNT(*) as count
FROM quality_metrics
WHERE overall_quality_score < 80
GROUP BY issue_type
ORDER BY count DESC;
```

**Check 3: Temporarily Lower Threshold**
```javascript
// In generate-letter-enhanced.js
if (qualityAssessment.overallQualityScore < 70) { // Was 85
  // Block
}
```

**Check 4: Review Prompt**
```bash
curl https://your-site.netlify.app/.netlify/functions/prompt-optimization-engine/active/system_generation
```

---

### Issue: Citations not being included

**Symptoms:**
- Letters have no citations
- Citation count = 0
- Missing legal references

**Possible Causes:**
1. State code not in database
2. No relevant citations for scenario
3. Prompt not emphasizing citations
4. AI avoiding citations due to constraints

**Solutions:**

**Check 1: State Coverage**
```javascript
// Check if state is in database
const stateCodes = STATE_INSURANCE_CODES[stateCode];
console.log('State coverage:', stateCodes ? 'Yes' : 'No');
```

**Check 2: Get Relevant Citations**
```javascript
const citations = getRelevantCitations(state, claimType, phase, issueType);
console.log('Available citations:', citations.length);
```

**Check 3: Review Prompt**
- Ensure prompt includes citation context
- Verify citations are listed in prompt
- Check if prompt is too restrictive

---

## QUALITY ISSUES

### Issue: High generic language scores

**Symptoms:**
- Generic score <80
- Many generic phrases detected
- Letters sound AI-generated

**Possible Causes:**
1. Prompt not prohibiting generic phrases
2. AI defaulting to generic language
3. Missing specific information in prompt

**Solutions:**

**Check 1: Most Common Generic Phrases**
```sql
SELECT 
  jsonb_array_elements(generic_phrases)->>'phrase' as phrase,
  COUNT(*) as count
FROM quality_metrics
WHERE generic_score < 80
GROUP BY phrase
ORDER BY count DESC
LIMIT 10;
```

**Check 2: Enhance Prompt**
```javascript
// Add to prompt:
PROHIBITED PHRASES (never use):
- [List top 10 most common generic phrases]

REQUIRED: Use specific language instead
```

**Check 3: Increase Temperature**
```javascript
// Try temperature 0.3 instead of 0.2
temperature: 0.3
```

---

### Issue: Low specificity scores

**Symptoms:**
- Specificity score <70
- Missing dates, amounts, or claim numbers
- Vague language

**Possible Causes:**
1. User information not provided
2. Prompt not emphasizing specificity
3. AI not extracting specific details

**Solutions:**

**Check 1: User Info Provided**
```javascript
console.log('User Info:', userInfo);
// Verify: name, claimNumber, policyNumber, lossDate all present
```

**Check 2: Check Missing Elements**
```sql
SELECT 
  has_specific_dates,
  has_specific_amounts,
  has_claim_numbers,
  has_policy_references
FROM quality_metrics
WHERE specificity_score < 70
LIMIT 10;
```

**Check 3: Make Requirements MANDATORY**
```javascript
// In prompt:
MANDATORY ELEMENTS (must include all):
- Specific date in MM/DD/YYYY format
- Specific dollar amount with $ symbol
- Claim number: [FROM USER INFO]
- Policy number: [FROM USER INFO]
```

---

### Issue: Emotional language detected

**Symptoms:**
- Professionalism score <90
- Emotional phrases detected
- Unprofessional tone

**Possible Causes:**
1. Prompt not prohibiting emotional language
2. AI responding to emotional content in input
3. Temperature too high

**Solutions:**

**Check 1: Common Emotional Phrases**
```sql
SELECT 
  jsonb_array_elements(emotional_phrases)->>'phrase' as phrase,
  COUNT(*) as count
FROM quality_metrics
WHERE has_emotional_language = true
GROUP BY phrase
ORDER BY count DESC;
```

**Check 2: Strengthen Prohibitions**
```javascript
// In prompt:
NEVER USE THESE WORDS:
unfair, unreasonable, disappointed, frustrated, angry

INSTEAD: State facts directly without emotion
```

---

## CITATION ISSUES

### Issue: Hallucinations detected

**Symptoms:**
- has_hallucinations = true
- Suspicious citation patterns
- Made-up case names or codes

**Possible Causes:**
1. Prompt allowing citation creation
2. AI inventing citations
3. Temperature too high
4. Insufficient citation constraints

**Solutions:**

**Check 1: Review Hallucinations**
```sql
SELECT 
  hallucination_details
FROM citation_verifications
WHERE has_hallucinations = true
ORDER BY created_at DESC
LIMIT 5;
```

**Check 2: Strengthen Citation Constraints**
```javascript
// In prompt:
CRITICAL: You MUST NOT create or invent citations.
Use ONLY citations provided in the verified list.
If no relevant citation exists, proceed WITHOUT citations.
```

**Check 3: Enable Real-Time Validation**
```javascript
// Use generateWithCitationValidation wrapper
// Automatically regenerates if hallucinations detected
```

---

### Issue: Unverified citations

**Symptoms:**
- accuracy_rate <95%
- Citations not in database
- Unverified count >0

**Possible Causes:**
1. Citation format not matching database
2. State not in database
3. New law not yet added
4. Citation extraction regex not matching

**Solutions:**

**Check 1: Review Unverified Citations**
```sql
SELECT 
  citations
FROM citation_verifications
WHERE unverified_citations > 0
ORDER BY created_at DESC
LIMIT 5;
```

**Check 2: Add Missing Citations**
- Research citation
- Verify accuracy
- Add to database
- Redeploy

**Check 3: Update Extraction Regex**
```javascript
// If format not matching, add new pattern
const newPattern = /[Pattern for this citation format]/gi;
```

---

## OUTCOME TRACKING ISSUES

### Issue: No outcomes being reported

**Symptoms:**
- outcome_tracking table empty
- No success rate data
- Users not reporting

**Possible Causes:**
1. Users not aware of tracking
2. UI not prominent
3. No incentive to report
4. Process too complicated

**Solutions:**

**Solution 1: Email Reminders**
- Send follow-up at 7, 30, 60 days
- Ask simple yes/no questions
- Provide quick reporting link

**Solution 2: Incentivize**
- Offer $5 gift card for outcome report
- Offer free second letter
- Show impact ("Help us improve")

**Solution 3: Simplify UI**
- One-click status updates
- Pre-filled forms
- Mobile-friendly

---

### Issue: Low success rates

**Symptoms:**
- Success rate <70%
- High failure count
- Low recovery percentages

**Possible Causes:**
1. Letter quality actually low
2. Claim types too difficult
3. User not following instructions
4. Reporting bias (failures more likely to report)

**Solutions:**

**Check 1: Correlation with Quality**
```sql
SELECT 
  CASE 
    WHEN overall_quality_score >= 85 THEN 'High Quality'
    ELSE 'Low Quality'
  END as quality_level,
  COUNT(*) FILTER (WHERE outcome_result = 'success') as successes,
  COUNT(*) as total,
  ROUND(
    COUNT(*) FILTER (WHERE outcome_result = 'success')::numeric / COUNT(*) * 100,
    2
  ) as success_rate
FROM quality_metrics qm
JOIN outcome_tracking ot ON qm.document_id = ot.document_id
WHERE ot.outcome_result IS NOT NULL
GROUP BY quality_level;
```

**Check 2: By Claim Type**
```sql
SELECT 
  claim_type,
  COUNT(*) as total,
  ROUND(
    COUNT(*) FILTER (WHERE outcome_result IN ('success', 'partial_success'))::numeric / 
    COUNT(*) * 100,
    2
  ) as success_rate
FROM outcome_tracking
WHERE outcome_result IS NOT NULL
GROUP BY claim_type;
```

**Check 3: Improve Quality**
- Review failed cases
- Identify patterns
- Optimize prompts
- Run A/B tests

---

## DATABASE ISSUES

### Issue: Slow queries

**Symptoms:**
- Dashboard loading slowly
- Queries timing out
- High database CPU

**Solutions:**

**Check 1: Missing Indexes**
```sql
-- Check if indexes exist
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('citation_verifications', 'quality_metrics', 'outcome_tracking');
```

**Check 2: Query Performance**
```sql
EXPLAIN ANALYZE
SELECT * FROM quality_dashboard
LIMIT 100;
```

**Check 3: Add Indexes if Needed**
```sql
CREATE INDEX IF NOT EXISTS idx_custom 
ON public.table_name(column_name);
```

---

### Issue: Database storage growing too fast

**Symptoms:**
- Supabase storage warning
- structured_logs table very large
- Slow queries

**Solutions:**

**Check 1: Log Table Size**
```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('structured_logs')) as size,
  COUNT(*) as row_count
FROM structured_logs;
```

**Check 2: Implement Retention Policy**
```sql
-- Delete logs older than 90 days
DELETE FROM structured_logs 
WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
```

**Check 3: Archive Old Logs**
```sql
-- Archive to separate table
CREATE TABLE structured_logs_archive AS
SELECT * FROM structured_logs
WHERE created_at < CURRENT_DATE - INTERVAL '90 days';

DELETE FROM structured_logs
WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
```

---

## PERFORMANCE ISSUES

### Issue: Slow generation

**Symptoms:**
- Generation taking >20 seconds
- Timeouts
- Poor user experience

**Solutions:**

**Check 1: Performance Metrics**
```sql
SELECT 
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  COUNT(*) as sample_size
FROM structured_logs
WHERE event_type = 'generation_completed'
AND created_at >= CURRENT_DATE - INTERVAL '24 hours';
```

**Check 2: Identify Bottleneck**
```sql
-- Check which step is slow
SELECT 
  event_name,
  AVG(duration_ms) as avg_duration
FROM structured_logs
WHERE document_id = '[slow-document-id]'
GROUP BY event_name
ORDER BY avg_duration DESC;
```

**Check 3: Optimize**
- Reduce prompt length
- Optimize database queries
- Cache frequently accessed data
- Use faster model for simple cases

---

## COST ISSUES

### Issue: Costs exceeding budget

**Symptoms:**
- Daily cost >$100
- Cost per letter >$0.02
- Unexpected charges

**Solutions:**

**Check 1: Cost Breakdown**
```sql
SELECT 
  event_type,
  COUNT(*) as operations,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost
FROM structured_logs
WHERE cost_usd IS NOT NULL
AND created_at >= CURRENT_DATE
GROUP BY event_type
ORDER BY total_cost DESC;
```

**Check 2: High-Cost Operations**
```sql
SELECT 
  document_id,
  event_type,
  tokens_used,
  cost_usd
FROM structured_logs
WHERE cost_usd > 0.02
ORDER BY cost_usd DESC
LIMIT 20;
```

**Check 3: Optimize**
- Reduce max_tokens if too high
- Truncate input more aggressively
- Use cost protector more strictly
- Consider cheaper model for simple cases

---

## INTEGRATION ISSUES

### Issue: Frontend not receiving quality metrics

**Symptoms:**
- Quality scores not displaying
- Citations not showing
- Warnings missing

**Solutions:**

**Check 1: Response Format**
```javascript
console.log('Response:', JSON.stringify(result, null, 2));
// Verify structure matches expected format
```

**Check 2: API Endpoint**
```javascript
// Ensure using enhanced endpoint
const response = await fetch('/.netlify/functions/generate-letter-enhanced', {
  // Not generate-letter
});
```

**Check 3: CORS**
```javascript
// Check response headers
console.log('Headers:', response.headers);
// Should include Access-Control-Allow-Origin: *
```

---

### Issue: Outcome tracking not saving

**Symptoms:**
- Outcomes not appearing in database
- Statistics showing 0 outcomes
- User reports not saved

**Solutions:**

**Check 1: RLS Policies**
```sql
-- Verify user can insert
SELECT * FROM outcome_tracking WHERE user_id = auth.uid();
```

**Check 2: Required Fields**
```javascript
// Ensure all required fields provided:
// documentId, userId, claimType, phase
```

**Check 3: API Response**
```javascript
const result = await markLetterSent(documentId);
console.log('Result:', result);
// Should return { success: true }
```

---

## CONTACT SUPPORT

### Before Contacting

1. Check this troubleshooting guide
2. Review error logs
3. Check system health
4. Try common solutions

### Information to Provide

- Error message (exact text)
- Document ID (if applicable)
- Timestamp of issue
- Steps to reproduce
- Error logs (from structured_logs table)
- System health status

### Support Channels

- Email: support@yoursite.com
- Documentation: /docs
- GitHub Issues: [repo-url]/issues

---

**Guide Version:** 1.0  
**Last Updated:** March 17, 2026
