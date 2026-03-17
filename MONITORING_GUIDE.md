# MONITORING GUIDE
**System Health, Performance, and Quality Monitoring**

---

## OVERVIEW

Monitor system health, performance, quality metrics, and costs in real-time.

**Key Metrics:**
- Error rate (<5%)
- Quality scores (>85%)
- Citation accuracy (>95%)
- Performance (<10s per operation)
- Cost per letter (<$0.01)

---

## DAILY MONITORING

### Health Check

```bash
curl https://your-site.netlify.app/.netlify/functions/structured-logging-system/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-17T12:00:00Z",
  "errorRates": {
    "overallErrorRate": 2,
    "overallCriticalRate": 0
  },
  "performanceMetrics": [
    {
      "eventType": "generation_completed",
      "avgDuration": 3456,
      "avgTokens": 1234,
      "avgCost": 0.003
    }
  ],
  "alerts": []
}
```

**Action if Unhealthy:**
1. Check error logs
2. Identify root cause
3. Fix immediately
4. Verify resolution

---

### Error Rate Check

```sql
-- Daily error rate
SELECT 
  COUNT(*) FILTER (WHERE log_level = 'error') as errors,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE log_level = 'error')::numeric / COUNT(*) * 100, 2) as error_rate
FROM structured_logs
WHERE created_at >= CURRENT_DATE;
```

**Target:** <5% error rate

**Alert if:** >5% error rate

---

### Quality Score Check

```sql
-- Daily average quality
SELECT 
  AVG(overall_quality_score) as avg_quality,
  AVG(generic_score) as avg_generic,
  AVG(specificity_score) as avg_specificity,
  AVG(professionalism_score) as avg_professionalism,
  COUNT(*) as sample_size
FROM quality_metrics
WHERE created_at >= CURRENT_DATE;
```

**Target:** >85% average quality

**Alert if:** <80% average quality

---

### Citation Accuracy Check

```sql
-- Daily citation accuracy
SELECT 
  AVG(accuracy_rate) as avg_accuracy,
  COUNT(*) FILTER (WHERE has_hallucinations = true) as hallucination_count,
  COUNT(*) as total
FROM citation_verifications
WHERE created_at >= CURRENT_DATE;
```

**Target:** >95% accuracy, 0 hallucinations

**Alert if:** <90% accuracy OR any hallucinations

---

### Cost Check

```sql
-- Daily cost
SELECT 
  SUM(cost_usd) as total_cost,
  COUNT(*) as operations,
  AVG(cost_usd) as avg_cost
FROM structured_logs
WHERE cost_usd IS NOT NULL
AND created_at >= CURRENT_DATE;
```

**Target:** <$0.01 per letter

**Alert if:** >$0.02 per letter OR >$100 daily total

---

## WEEKLY MONITORING

### Performance Trends

```sql
-- Weekly performance comparison
SELECT 
  DATE_TRUNC('week', created_at) as week,
  AVG(duration_ms) as avg_duration,
  AVG(tokens_used) as avg_tokens,
  AVG(cost_usd) as avg_cost,
  COUNT(*) as operations
FROM structured_logs
WHERE event_type = 'generation_completed'
AND created_at >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY week
ORDER BY week DESC;
```

**Look for:**
- Increasing duration (performance degradation)
- Increasing token usage (prompt bloat)
- Increasing costs (efficiency issues)

---

### Quality Trends

```sql
-- Weekly quality trends
SELECT 
  DATE_TRUNC('week', created_at) as week,
  AVG(overall_quality_score) as avg_quality,
  AVG(generic_score) as avg_generic,
  AVG(specificity_score) as avg_specificity,
  COUNT(*) as letters
FROM quality_metrics
WHERE created_at >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY week
ORDER BY week DESC;
```

**Look for:**
- Declining quality scores (prompt degradation)
- Increasing generic language (prompt weakening)
- Decreasing specificity (missing user info)

---

### Success Rate Trends

```sql
-- Weekly success rates (requires outcomes)
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as total_outcomes,
  COUNT(*) FILTER (WHERE outcome_result IN ('success', 'partial_success')) as successes,
  ROUND(
    COUNT(*) FILTER (WHERE outcome_result IN ('success', 'partial_success'))::numeric / 
    COUNT(*) * 100, 
    2
  ) as success_rate
FROM outcome_tracking
WHERE outcome_result IS NOT NULL
AND created_at >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY week
ORDER BY week DESC;
```

**Look for:**
- Declining success rate (quality issues)
- Increasing failure rate (prompt problems)

---

## MONTHLY MONITORING

### Comprehensive Report

```sql
-- Monthly comprehensive metrics
SELECT 
  COUNT(DISTINCT cl.id) as total_letters,
  AVG(cv.accuracy_rate) as avg_citation_accuracy,
  AVG(qm.overall_quality_score) as avg_quality,
  COUNT(DISTINCT ot.id) as total_outcomes,
  ROUND(
    COUNT(*) FILTER (WHERE ot.outcome_result IN ('success', 'partial_success'))::numeric / 
    NULLIF(COUNT(ot.id), 0) * 100, 
    2
  ) as success_rate,
  AVG(ot.recovery_percentage) as avg_recovery,
  AVG(ot.user_satisfaction) as avg_satisfaction
FROM claim_letters cl
LEFT JOIN citation_verifications cv ON cl.id = cv.document_id
LEFT JOIN quality_metrics qm ON cl.id = qm.document_id
LEFT JOIN outcome_tracking ot ON cl.id = ot.document_id
WHERE cl.created_at >= DATE_TRUNC('month', CURRENT_DATE);
```

---

### Target Achievement

```sql
-- Check if meeting all targets
SELECT 
  AVG(cv.accuracy_rate) >= 95 as meets_citation_target,
  AVG(qm.overall_quality_score) >= 85 as meets_quality_target,
  (
    COUNT(*) FILTER (WHERE ot.outcome_result IN ('success', 'partial_success'))::numeric / 
    NULLIF(COUNT(ot.id), 0) * 100
  ) >= 85 as meets_success_target,
  AVG(ot.user_satisfaction) >= 4.0 as meets_satisfaction_target
FROM citation_verifications cv
CROSS JOIN quality_metrics qm
CROSS JOIN outcome_tracking ot
WHERE cv.created_at >= DATE_TRUNC('month', CURRENT_DATE);
```

---

## ALERT CONFIGURATION

### Critical Alerts (Immediate)

**Trigger:** Error rate >10%
**Action:** Investigate immediately, pause generation if needed

**Trigger:** Hallucination detected
**Action:** Block letter, investigate prompt, fix immediately

**Trigger:** System downtime >5 minutes
**Action:** Check Netlify status, restart functions if needed

---

### Warning Alerts (Review Within 1 Hour)

**Trigger:** Error rate 5-10%
**Action:** Review error logs, identify patterns

**Trigger:** Quality score <80%
**Action:** Review recent letters, check prompt configuration

**Trigger:** Cost >$100/day
**Action:** Review usage patterns, check for abuse

---

### Info Alerts (Review Daily)

**Trigger:** Quality score 80-84%
**Action:** Monitor trend, consider prompt optimization

**Trigger:** Citation accuracy 90-94%
**Action:** Review unverified citations, update database

---

## DASHBOARDS

### Operations Dashboard

**Metrics:**
- Requests per hour
- Error rate
- Average response time
- Function execution time
- Active users

**Query:**
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as requests,
  COUNT(*) FILTER (WHERE log_level = 'error') as errors,
  AVG(duration_ms) as avg_duration
FROM structured_logs
WHERE created_at >= CURRENT_DATE
GROUP BY hour
ORDER BY hour DESC;
```

---

### Quality Dashboard

**Metrics:**
- Average quality score
- Quality grade distribution
- Generic language rate
- Specificity pass rate
- Professionalism pass rate

**Query:**
```sql
SELECT 
  AVG(overall_quality_score) as avg_quality,
  COUNT(*) FILTER (WHERE quality_grade LIKE 'A%') as grade_a_count,
  COUNT(*) FILTER (WHERE quality_grade LIKE 'B%') as grade_b_count,
  COUNT(*) FILTER (WHERE quality_grade LIKE 'C%') as grade_c_count,
  COUNT(*) FILTER (WHERE passes_quality_check = true) as pass_count,
  COUNT(*) as total
FROM quality_metrics
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
```

---

### Outcome Dashboard

**Metrics:**
- Success rate
- Average recovery percentage
- Average days to resolution
- User satisfaction
- Outcomes by claim type

**Query:**
```sql
SELECT 
  claim_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE outcome_result IN ('success', 'partial_success')) as successes,
  ROUND(
    COUNT(*) FILTER (WHERE outcome_result IN ('success', 'partial_success'))::numeric / 
    COUNT(*) * 100, 
    2
  ) as success_rate,
  AVG(recovery_percentage) as avg_recovery,
  AVG(user_satisfaction) as avg_satisfaction
FROM outcome_tracking
WHERE outcome_result IS NOT NULL
GROUP BY claim_type;
```

---

### Cost Dashboard

**Metrics:**
- Daily cost
- Cost per letter
- Cost by operation type
- Monthly projection

**Query:**
```sql
SELECT 
  DATE(created_at) as date,
  SUM(cost_usd) as daily_cost,
  COUNT(*) as operations,
  AVG(cost_usd) as avg_cost_per_operation
FROM structured_logs
WHERE cost_usd IS NOT NULL
AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;
```

---

## AUTOMATED MONITORING SCRIPTS

### Script 1: Health Monitor

**File:** `scripts/monitor-health.js`

```javascript
const fetch = require('node-fetch');

async function monitorHealth() {
  try {
    const response = await fetch('https://your-site.netlify.app/.netlify/functions/structured-logging-system/health');
    const health = await response.json();
    
    console.log(`[${new Date().toISOString()}] Health Status: ${health.status}`);
    
    if (health.status !== 'healthy') {
      console.error('🚨 SYSTEM UNHEALTHY');
      sendAlert('System Unhealthy', JSON.stringify(health, null, 2));
    }
    
    if (health.alerts && health.alerts.length > 0) {
      console.warn('⚠️ ALERTS:', health.alerts.length);
      health.alerts.forEach(alert => {
        console.warn(`  - [${alert.severity}] ${alert.message}`);
      });
    }
    
  } catch (error) {
    console.error('Health check failed:', error);
    sendAlert('Health Check Failed', error.message);
  }
}

// Run every 5 minutes
setInterval(monitorHealth, 5 * 60 * 1000);
monitorHealth(); // Run immediately
```

---

### Script 2: Quality Monitor

**File:** `scripts/monitor-quality.js`

```javascript
const { getSupabaseAdmin } = require('../netlify/functions/_supabase');

async function monitorQuality() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get today's quality metrics
    const { data, error } = await supabase
      .from('quality_metrics')
      .select('overall_quality_score, generic_score, specificity_score')
      .gte('created_at', new Date().toISOString().split('T')[0]);
    
    if (error) throw error;
    
    if (data.length === 0) {
      console.log('No letters generated today yet');
      return;
    }
    
    const avgQuality = data.reduce((sum, m) => sum + m.overall_quality_score, 0) / data.length;
    const avgGeneric = data.reduce((sum, m) => sum + m.generic_score, 0) / data.length;
    const avgSpecificity = data.reduce((sum, m) => sum + m.specificity_score, 0) / data.length;
    
    console.log(`[${new Date().toISOString()}] Quality Metrics:`);
    console.log(`  Average Quality: ${avgQuality.toFixed(1)}/100`);
    console.log(`  Average Generic: ${avgGeneric.toFixed(1)}/100`);
    console.log(`  Average Specificity: ${avgSpecificity.toFixed(1)}/100`);
    console.log(`  Sample Size: ${data.length}`);
    
    if (avgQuality < 80) {
      console.error('🚨 LOW QUALITY ALERT');
      sendAlert('Low Quality Score', `Average quality: ${avgQuality.toFixed(1)}`);
    }
    
  } catch (error) {
    console.error('Quality check failed:', error);
  }
}

// Run every hour
setInterval(monitorQuality, 60 * 60 * 1000);
```

---

### Script 3: Cost Monitor

**File:** `scripts/monitor-costs.js`

```javascript
const { getSupabaseAdmin } = require('../netlify/functions/_supabase');

async function monitorCosts() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get today's costs
    const { data, error } = await supabase
      .from('structured_logs')
      .select('cost_usd')
      .not('cost_usd', 'is', null)
      .gte('created_at', new Date().toISOString().split('T')[0]);
    
    if (error) throw error;
    
    const totalCost = data.reduce((sum, log) => sum + parseFloat(log.cost_usd), 0);
    const avgCost = totalCost / data.length;
    
    console.log(`[${new Date().toISOString()}] Cost Metrics:`);
    console.log(`  Total Cost Today: $${totalCost.toFixed(4)}`);
    console.log(`  Average Cost: $${avgCost.toFixed(6)}`);
    console.log(`  Operations: ${data.length}`);
    
    if (totalCost > 100) {
      console.error('🚨 HIGH COST ALERT');
      sendAlert('High Daily Cost', `Total: $${totalCost.toFixed(2)}`);
    }
    
    if (avgCost > 0.02) {
      console.warn('⚠️ HIGH PER-OPERATION COST');
      sendAlert('High Per-Operation Cost', `Average: $${avgCost.toFixed(4)}`);
    }
    
  } catch (error) {
    console.error('Cost check failed:', error);
  }
}

// Run every hour
setInterval(monitorCosts, 60 * 60 * 1000);
```

---

## ALERT SYSTEM

### Email Alerts

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendAlert(subject, message) {
  try {
    await sgMail.send({
      to: process.env.ALERT_EMAIL,
      from: 'alerts@yoursite.com',
      subject: `🚨 ALERT: ${subject}`,
      text: message,
      html: `<h2>Alert: ${subject}</h2><pre>${message}</pre>`
    });
    console.log('Alert sent:', subject);
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}
```

### Slack Alerts

```javascript
const fetch = require('node-fetch');

async function sendSlackAlert(message) {
  try {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *ALERT*\n${message}`
      })
    });
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}
```

---

## PERFORMANCE BENCHMARKS

### Target Benchmarks

| Operation | Target | Alert Threshold |
|-----------|--------|-----------------|
| File upload | <2s | >5s |
| Text extraction | <3s | >8s |
| Analysis | <5s | >15s |
| Generation | <8s | >20s |
| Citation verification | <1s | >3s |
| Quality assessment | <1s | >3s |
| Total (end-to-end) | <15s | >30s |

### Monitoring Query

```sql
SELECT 
  event_type,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration
FROM structured_logs
WHERE duration_ms IS NOT NULL
AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY event_type
ORDER BY avg_duration DESC;
```

---

## TROUBLESHOOTING

### High Error Rate

**Investigate:**
```sql
-- Get common errors
SELECT 
  error_message,
  COUNT(*) as count,
  MAX(created_at) as last_occurrence
FROM structured_logs
WHERE log_level = 'error'
AND created_at >= CURRENT_DATE - INTERVAL '24 hours'
GROUP BY error_message
ORDER BY count DESC
LIMIT 10;
```

**Common Causes:**
- OpenAI API issues
- Database connection problems
- Invalid user input
- Rate limiting

---

### Low Quality Scores

**Investigate:**
```sql
-- Get common quality issues
SELECT 
  jsonb_array_elements(issues)->>'type' as issue_type,
  COUNT(*) as count
FROM quality_metrics
WHERE overall_quality_score < 80
AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY issue_type
ORDER BY count DESC;
```

**Common Causes:**
- Prompt degradation
- Missing user information
- Generic language creeping in
- Structure requirements not met

---

### High Costs

**Investigate:**
```sql
-- Get high-cost operations
SELECT 
  event_type,
  document_id,
  tokens_used,
  cost_usd,
  created_at
FROM structured_logs
WHERE cost_usd > 0.02
AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY cost_usd DESC
LIMIT 20;
```

**Common Causes:**
- Excessive token usage (prompt too long)
- Multiple regenerations
- Large input documents
- API pricing changes

---

**Guide Version:** 1.0  
**Last Updated:** March 17, 2026
