# DEPLOYMENT GUIDE
**Enhanced Quality Systems - Insurance Claim Letter Help AI**  
**Version:** 2.0  
**Date:** March 17, 2026

---

## OVERVIEW

This guide provides step-by-step instructions for deploying the enhanced quality systems.

**Systems Being Deployed:**
1. Citation Verification System
2. Quality Assurance System
3. Outcome Tracking System
4. Structured Logging System
5. A/B Testing Framework
6. Prompt Optimization Engine
7. Real-Time Citation Validation
8. Enhanced Letter Generation

---

## PRE-DEPLOYMENT CHECKLIST

### Environment Requirements

- [ ] Supabase project with admin access
- [ ] Netlify account with function deployment
- [ ] OpenAI API key configured
- [ ] Stripe payment integration active
- [ ] Node.js 18+ installed locally
- [ ] PostgreSQL client (psql) installed

### Backup Requirements

- [ ] Backup current database
- [ ] Backup current Netlify functions
- [ ] Document current environment variables
- [ ] Export current user data
- [ ] Save current prompt configurations

### Testing Requirements

- [ ] Test environment available
- [ ] Sample test data prepared
- [ ] Test user accounts created
- [ ] Monitoring tools configured

---

## DEPLOYMENT STEPS

### STEP 1: Database Migration

**Estimated Time:** 10-15 minutes

**1.1 Connect to Supabase**

```bash
# Get connection string from Supabase dashboard
# Settings → Database → Connection string

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

**1.2 Run Migration**

```bash
# From project root
\i supabase/migrations/20260317_citation_and_quality_systems.sql
```

**1.3 Verify Tables Created**

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'citation_verifications',
  'quality_metrics',
  'outcome_tracking',
  'structured_logs',
  'ab_test_experiments',
  'ab_test_assignments',
  'prompt_versions',
  'quality_benchmarks'
);

-- Should return 8 rows
```

**1.4 Verify RLS Policies**

```sql
-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%citation%' OR tablename LIKE '%quality%';

-- All should show rowsecurity = true
```

**1.5 Test Functions**

```sql
-- Test success rate function
SELECT * FROM get_success_rate_by_claim_type('property_homeowners');

-- Test quality statistics function
SELECT * FROM get_quality_statistics();
```

**Expected Output:**
```
✅ CITATION & QUALITY SYSTEMS MIGRATION COMPLETE
Tables created: 8
Indexes created: 25+
Functions created: 2
Views created: 1

🎯 Quality Targets:
   - Citation Accuracy: 95%+
   - Quality Score: 85%+
   - Success Rate: 85%+

🚀 Systems ready for production
```

---

### STEP 2: Deploy Netlify Functions

**Estimated Time:** 5-10 minutes

**2.1 Verify Function Files**

```bash
# Check all new function files exist
ls -la netlify/functions/ | grep -E "(citation|quality|outcome|logging|ab-testing|prompt|realtime|enhanced)"
```

**Expected Files:**
- `citation-verification-system.js`
- `quality-assurance-system.js`
- `outcome-tracking-system.js`
- `structured-logging-system.js`
- `ab-testing-framework.js`
- `prompt-optimization-engine.js`
- `realtime-citation-validator.js`
- `generate-letter-enhanced.js`

**2.2 Install Dependencies**

```bash
# No new dependencies required - all use existing packages
npm install
```

**2.3 Deploy to Netlify**

```bash
# Option 1: Git push (automatic deployment)
git add .
git commit -m "Deploy enhanced quality systems"
git push origin main

# Option 2: Manual deployment
netlify deploy --prod
```

**2.4 Verify Functions Deployed**

```bash
# Check Netlify dashboard
# Functions → Should see 8 new functions

# Or test endpoints
curl https://your-site.netlify.app/.netlify/functions/citation-verification-system
curl https://your-site.netlify.app/.netlify/functions/quality-assurance-system
curl https://your-site.netlify.app/.netlify/functions/outcome-tracking-system
```

---

### STEP 3: Initialize Prompt Library

**Estimated Time:** 2-3 minutes

**3.1 Initialize Default Prompts**

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/prompt-optimization-engine/initialize \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "initialized": 3,
  "total": 3
}
```

**3.2 Verify Prompts Saved**

```sql
-- Check prompt versions
SELECT prompt_name, version, status, is_default 
FROM prompt_versions 
ORDER BY prompt_name, version;
```

**Expected Output:**
```
prompt_name          | version | status | is_default
---------------------|---------|--------|------------
system_analysis      | 1       | active | true
system_generation    | 1       | active | true
system_generation    | 2       | active | false
```

**3.3 Set Default Versions**

```sql
-- If needed, set specific version as default
UPDATE prompt_versions 
SET is_default = true 
WHERE prompt_name = 'system_generation' AND version = 2;

-- Unset other defaults
UPDATE prompt_versions 
SET is_default = false 
WHERE prompt_name = 'system_generation' AND version != 2;
```

---

### STEP 4: Configure Monitoring

**Estimated Time:** 10-15 minutes

**4.1 Set Up Error Alerts**

Create monitoring script: `scripts/monitor-health.js`

```javascript
const fetch = require('node-fetch');

async function checkHealth() {
  const response = await fetch('https://your-site.netlify.app/.netlify/functions/structured-logging-system/health');
  const health = await response.json();
  
  if (health.status !== 'healthy') {
    console.error('🚨 SYSTEM UNHEALTHY:', health);
    // Send alert (email, Slack, etc.)
  }
  
  if (health.errorRates.overallErrorRate > 5) {
    console.error('🚨 HIGH ERROR RATE:', health.errorRates.overallErrorRate + '%');
  }
  
  if (health.alerts && health.alerts.length > 0) {
    console.error('🚨 ALERTS:', health.alerts);
  }
}

// Run every 5 minutes
setInterval(checkHealth, 5 * 60 * 1000);
```

**4.2 Set Up Cost Alerts**

```javascript
async function checkCosts() {
  const response = await fetch('https://your-site.netlify.app/.netlify/functions/structured-logging-system/cost-summary');
  const costs = await response.json();
  
  const dailyCost = parseFloat(costs.totalCost);
  
  if (dailyCost > 100) {
    console.error('🚨 HIGH DAILY COST:', dailyCost);
    // Send alert
  }
}

// Run every hour
setInterval(checkCosts, 60 * 60 * 1000);
```

**4.3 Set Up Quality Alerts**

```javascript
async function checkQuality() {
  const response = await fetch('https://your-site.netlify.app/.netlify/functions/outcome-tracking-system/statistics');
  const stats = await response.json();
  
  if (stats.overall.averageQualityScore < 85) {
    console.error('🚨 LOW QUALITY SCORE:', stats.overall.averageQualityScore);
  }
  
  if (stats.overall.averageCitationAccuracy < 95) {
    console.error('🚨 LOW CITATION ACCURACY:', stats.overall.averageCitationAccuracy);
  }
}

// Run every hour
setInterval(checkQuality, 60 * 60 * 1000);
```

---

### STEP 5: Update Frontend Integration

**Estimated Time:** 30-45 minutes

**5.1 Update Letter Generation Endpoint**

**File:** `upload.html` or your frontend code

**Before:**
```javascript
const response = await fetch('/.netlify/functions/generate-letter', {
  method: 'POST',
  body: JSON.stringify({ documentId, userId, userInfo })
});
```

**After:**
```javascript
const response = await fetch('/.netlify/functions/generate-letter-enhanced', {
  method: 'POST',
  body: JSON.stringify({ 
    documentId, 
    userId, 
    userInfo,
    stateCode: 'CA' // Add state code
  })
});

const result = await response.json();

// Now includes quality metrics
console.log('Quality Score:', result.quality.overallScore);
console.log('Citation Accuracy:', result.citations.accuracyRate);
console.log('Grade:', result.quality.grade);
```

**5.2 Display Quality Metrics**

Add to UI after letter generation:

```html
<div class="quality-metrics">
  <h3>Letter Quality Report</h3>
  
  <div class="metric">
    <label>Overall Quality:</label>
    <span class="score">${result.quality.overallScore}/100</span>
    <span class="grade">${result.quality.grade}</span>
  </div>
  
  <div class="metric">
    <label>Citation Accuracy:</label>
    <span class="score">${result.citations.accuracyRate}%</span>
    <span class="status">${result.citations.passesVerification ? '✅ Verified' : '⚠️ Issues'}</span>
  </div>
  
  ${result.warnings.length > 0 ? `
    <div class="warnings">
      <h4>⚠️ Warnings:</h4>
      <ul>
        ${result.warnings.map(w => `<li>${w}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
  
  ${result.recommendations.length > 0 ? `
    <div class="recommendations">
      <h4>💡 Recommendations:</h4>
      <ul>
        ${result.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
</div>
```

**5.3 Add Outcome Tracking UI**

Create new section for outcome tracking:

```html
<div class="outcome-tracking">
  <h3>Track Your Outcome</h3>
  <p>Help us improve by reporting your results:</p>
  
  <button onclick="markLetterSent()">✉️ I Sent the Letter</button>
  <button onclick="markResponseReceived()">📬 I Received a Response</button>
  <button onclick="reportOutcome()">✅ My Claim Was Resolved</button>
</div>

<script>
async function markLetterSent() {
  await fetch('/.netlify/functions/outcome-tracking-system/mark-sent', {
    method: 'PUT',
    body: JSON.stringify({ 
      documentId: currentDocumentId,
      sentDate: new Date().toISOString()
    })
  });
  alert('Thank you! We\'ll track your outcome.');
}

async function reportOutcome() {
  // Show modal for outcome details
  const outcome = await showOutcomeModal();
  
  await fetch('/.netlify/functions/outcome-tracking-system/mark-resolved', {
    method: 'PUT',
    body: JSON.stringify({
      documentId: currentDocumentId,
      resolutionType: outcome.type,
      resolutionAmount: outcome.amount,
      userSatisfaction: outcome.satisfaction,
      userFeedback: outcome.feedback,
      wouldRecommend: outcome.recommend
    })
  });
  
  alert('Thank you for your feedback!');
}
</script>
```

---

### STEP 6: Run Test Suite

**Estimated Time:** 5 minutes

**6.1 Run Tests**

```bash
cd tests
node quality-systems.test.js
```

**Expected Output:**
```
========================================
QUALITY SYSTEMS TEST SUITE
========================================

✅ TEST 1 PASSED: Valid CA citation verified
✅ TEST 2 PASSED: Invalid citation rejected
✅ TEST 3 PASSED: Citations extracted correctly
...
✅ TEST 35 PASSED: Federal regulations database populated

========================================
TEST RESULTS
========================================
Total Tests: 35
Passed: 35
Failed: 0
Success Rate: 100%

✅ ALL TESTS PASSED
```

**6.2 Fix Any Failures**

If any tests fail:
1. Review error message
2. Check database migration completed
3. Verify function files deployed
4. Check dependencies installed
5. Re-run tests

---

### STEP 7: Smoke Testing

**Estimated Time:** 15-20 minutes

**7.1 Test Citation Verification**

```bash
# Test CA citation
curl -X POST https://your-site.netlify.app/.netlify/functions/realtime-citation-validator/validate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Under California Insurance Code § 790.03, the insurer must respond promptly.",
    "context": {
      "state": "CA",
      "claimType": "property_homeowners"
    }
  }'
```

**Expected:** `{ "valid": true, "qualityScore": 100, "passesValidation": true }`

**7.2 Test Quality Assessment**

```bash
# Test quality scoring
curl -X POST https://your-site.netlify.app/.netlify/functions/quality-assurance-system/assess \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I am writing to inform you that I look forward to your response at your earliest convenience."
  }'
```

**Expected:** `{ "genericScore": <50, "hasGenericLanguage": true }`

**7.3 Test Enhanced Generation**

```bash
# Generate test letter
curl -X POST https://your-site.netlify.app/.netlify/functions/generate-letter-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "test-doc-id",
    "userId": "test-user-id",
    "stateCode": "CA",
    "userInfo": {
      "name": "Test User",
      "address": "123 Test St",
      "phone": "555-1234",
      "email": "test@test.com",
      "claimNumber": "TEST-123",
      "policyNumber": "POL-456",
      "lossDate": "01/15/2026"
    }
  }'
```

**Expected:** `{ "success": true, "quality": { "overallScore": >85 }, "citations": { "passesVerification": true } }`

---

### STEP 8: Configure Monitoring

**Estimated Time:** 20-30 minutes

**8.1 Set Up Cron Jobs**

Create `netlify.toml` scheduled functions:

```toml
[[functions]]
  name = "monitor-health"
  schedule = "*/5 * * * *"  # Every 5 minutes

[[functions]]
  name = "monitor-costs"
  schedule = "0 * * * *"  # Every hour

[[functions]]
  name = "monitor-quality"
  schedule = "0 * * * *"  # Every hour
```

**8.2 Create Monitoring Functions**

**File:** `netlify/functions/monitor-health.js`

```javascript
const { checkSystemHealth } = require('./structured-logging-system');

exports.handler = async () => {
  const health = await checkSystemHealth();
  
  if (health.status !== 'healthy') {
    // Send alert via SendGrid or other service
    console.error('🚨 SYSTEM UNHEALTHY:', health);
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify(health)
  };
};
```

**8.3 Configure Alerts**

Set up alerts in your monitoring service (e.g., SendGrid, Slack):

```javascript
// Example: SendGrid email alert
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendAlert(subject, message) {
  await sgMail.send({
    to: 'admin@yoursite.com',
    from: 'alerts@yoursite.com',
    subject,
    text: message
  });
}
```

---

### STEP 9: Update Environment Variables

**Estimated Time:** 5 minutes

**9.1 Add New Environment Variables**

In Netlify Dashboard → Site settings → Environment variables:

```bash
# Quality system configuration
QUALITY_TARGET_CITATION_ACCURACY=95
QUALITY_TARGET_OUTPUT_SCORE=85
QUALITY_TARGET_SUCCESS_RATE=85

# Monitoring configuration
ENABLE_STRUCTURED_LOGGING=true
ENABLE_QUALITY_GATES=true
ENABLE_AB_TESTING=false  # Enable after testing

# Alert configuration
ALERT_EMAIL=admin@yoursite.com
ALERT_ERROR_THRESHOLD=5
ALERT_COST_THRESHOLD=100
```

**9.2 Verify Variables**

```bash
# Check in Netlify function
netlify env:list
```

---

### STEP 10: Gradual Rollout

**Estimated Time:** 1-2 weeks

**10.1 Phase 1: Internal Testing (Days 1-3)**

- Generate 10-20 test letters
- Verify quality scores
- Check citation accuracy
- Review logs
- Fix any issues

**10.2 Phase 2: Beta Users (Days 4-7)**

- Enable for 10% of users
- Monitor quality metrics
- Collect feedback
- Adjust configurations

**10.3 Phase 3: Full Rollout (Days 8-14)**

- Enable for 50% of users
- Monitor success rates
- Track outcomes
- Compare to baseline

**10.4 Phase 4: 100% Deployment (Day 15+)**

- Enable for all users
- Continue monitoring
- Optimize based on data

---

## POST-DEPLOYMENT VALIDATION

### Day 1 Checks

- [ ] All functions responding (200 status)
- [ ] Database tables populated
- [ ] Logs being written
- [ ] No critical errors
- [ ] Cost within budget

### Week 1 Checks

- [ ] 50+ letters generated
- [ ] Citation accuracy >90%
- [ ] Quality scores >80%
- [ ] No hallucinations detected
- [ ] Error rate <5%
- [ ] Performance <10s per letter

### Month 1 Checks

- [ ] 200+ letters generated
- [ ] Citation accuracy >95%
- [ ] Quality scores >85%
- [ ] 20+ outcomes tracked
- [ ] Success rate trending toward 85%
- [ ] User satisfaction >4.0

---

## ROLLBACK PROCEDURE

### If Deployment Fails

**STEP 1: Pause New System**

```sql
-- Disable quality gates temporarily
UPDATE ab_test_experiments SET status = 'paused' WHERE status = 'active';
```

**STEP 2: Revert to Old Endpoint**

Update frontend to use old endpoint:

```javascript
// Revert to
const response = await fetch('/.netlify/functions/generate-letter', {
  method: 'POST',
  body: JSON.stringify({ documentId, userId, userInfo })
});
```

**STEP 3: Investigate Issues**

```sql
-- Check error logs
SELECT * FROM structured_logs 
WHERE log_level IN ('error', 'critical') 
ORDER BY created_at DESC 
LIMIT 50;

-- Check quality failures
SELECT * FROM quality_metrics 
WHERE passes_quality_check = false 
ORDER BY created_at DESC 
LIMIT 20;
```

**STEP 4: Fix and Redeploy**

1. Identify root cause
2. Fix issue
3. Test locally
4. Redeploy
5. Verify fix

---

## TROUBLESHOOTING

### Common Issues

**Issue 1: Functions not found (404)**

**Cause:** Functions not deployed or named incorrectly

**Solution:**
```bash
# Redeploy functions
netlify deploy --prod

# Check function names
netlify functions:list
```

---

**Issue 2: Database connection errors**

**Cause:** Supabase credentials not configured

**Solution:**
```bash
# Verify environment variables
netlify env:get SUPABASE_URL
netlify env:get SUPABASE_SERVICE_ROLE_KEY

# Test connection
node -e "const { getSupabaseAdmin } = require('./netlify/functions/_supabase'); getSupabaseAdmin().from('claim_letters').select('count').then(console.log)"
```

---

**Issue 3: Quality gate blocking all letters**

**Cause:** Quality thresholds too strict

**Solution:**
```javascript
// Temporarily lower thresholds
// In generate-letter-enhanced.js
if (qualityAssessment.overallQualityScore < 70) { // Was 85
  // Block
}
```

---

**Issue 4: High error rate**

**Cause:** Various potential issues

**Solution:**
```sql
-- Get common errors
SELECT error_message, COUNT(*) as count
FROM structured_logs
WHERE log_level = 'error'
GROUP BY error_message
ORDER BY count DESC
LIMIT 10;
```

---

## MONITORING DASHBOARD

### Key Metrics to Watch

**Daily:**
- Error rate (<5%)
- Cost per letter (<$0.01)
- Generation success rate (>95%)
- Average response time (<10s)

**Weekly:**
- Citation accuracy rate (>95%)
- Quality score average (>85%)
- Generic language rate (<10%)
- Hallucination rate (<1%)

**Monthly:**
- Success rate by claim type (>85%)
- User satisfaction (>4.0)
- Recovery percentage (>80%)
- Prompt performance trends

### Dashboard Queries

```sql
-- Daily health check
SELECT 
  COUNT(*) as total_letters,
  AVG(citation_quality_score) as avg_citation,
  AVG(output_quality_score) as avg_quality,
  COUNT(*) FILTER (WHERE output_quality_score >= 85) as quality_pass_count
FROM claim_letters
WHERE created_at >= CURRENT_DATE;

-- Error rate
SELECT 
  COUNT(*) FILTER (WHERE log_level = 'error') as errors,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE log_level = 'error')::numeric / COUNT(*) * 100, 2) as error_rate
FROM structured_logs
WHERE created_at >= CURRENT_DATE;

-- Cost summary
SELECT 
  SUM(cost_usd) as total_cost,
  COUNT(*) as operations,
  AVG(cost_usd) as avg_cost
FROM structured_logs
WHERE cost_usd IS NOT NULL
AND created_at >= CURRENT_DATE;
```

---

## SUCCESS CRITERIA

### Deployment Successful If:

- [x] All 8 database tables created
- [x] All 8 Netlify functions deployed
- [x] All 35 tests passing
- [ ] 50+ letters generated without critical errors
- [ ] Citation accuracy >90% (first week)
- [ ] Quality scores >80% (first week)
- [ ] Error rate <5%
- [ ] No system downtime
- [ ] User feedback positive

### Ready for Full Production If:

- [ ] 200+ letters generated
- [ ] Citation accuracy >95%
- [ ] Quality scores >85%
- [ ] 20+ outcomes tracked
- [ ] Success rate >80%
- [ ] No critical bugs
- [ ] Monitoring operational
- [ ] Team trained

---

## SUPPORT & MAINTENANCE

### Weekly Tasks

- Review error logs
- Check quality trends
- Monitor cost usage
- Review user feedback
- Update citation database (if laws changed)

### Monthly Tasks

- Analyze outcome data
- Review A/B test results
- Optimize prompts based on data
- Update quality benchmarks
- Generate performance report

### Quarterly Tasks

- Comprehensive citation database review
- Add new state codes
- Update federal regulations
- Review and update quality thresholds
- Conduct security audit

---

## CONTACT & ESCALATION

### Technical Issues

**Level 1:** Check logs and documentation  
**Level 2:** Review troubleshooting guide  
**Level 3:** Contact development team  

### Critical Issues

**Criteria:**
- System downtime >1 hour
- Error rate >20%
- Data loss or corruption
- Security breach

**Action:**
1. Immediately pause new letter generation
2. Alert development team
3. Investigate root cause
4. Implement fix
5. Verify resolution
6. Resume operations

---

## APPENDIX

### A. File Checklist

**New Files Created:**
- [x] `netlify/functions/citation-verification-system.js`
- [x] `netlify/functions/quality-assurance-system.js`
- [x] `netlify/functions/outcome-tracking-system.js`
- [x] `netlify/functions/structured-logging-system.js`
- [x] `netlify/functions/ab-testing-framework.js`
- [x] `netlify/functions/prompt-optimization-engine.js`
- [x] `netlify/functions/realtime-citation-validator.js`
- [x] `netlify/functions/generate-letter-enhanced.js`
- [x] `supabase/migrations/20260317_citation_and_quality_systems.sql`
- [x] `tests/quality-systems.test.js`
- [x] `AI_QUALITY_IMPROVEMENT_AUDIT_2026.md`
- [x] `DEPLOYMENT_GUIDE.md` (this file)

### B. Database Objects

**Tables:** 8  
**Indexes:** 25+  
**Functions:** 2  
**Views:** 1  
**Triggers:** 2  
**Policies:** 12+  

### C. API Endpoints

**New Endpoints:**
- `POST /.netlify/functions/generate-letter-enhanced`
- `POST /.netlify/functions/realtime-citation-validator/validate`
- `GET /.netlify/functions/outcome-tracking-system/statistics`
- `PUT /.netlify/functions/outcome-tracking-system/mark-sent`
- `PUT /.netlify/functions/outcome-tracking-system/mark-resolved`
- `GET /.netlify/functions/ab-testing-framework/all`
- `POST /.netlify/functions/ab-testing-framework/create`
- `GET /.netlify/functions/prompt-optimization-engine/analyze/{promptName}`
- `POST /.netlify/functions/prompt-optimization-engine/optimize`

---

**Deployment Guide Version:** 1.0  
**Last Updated:** March 17, 2026  
**Status:** ✅ Complete and Ready for Use
