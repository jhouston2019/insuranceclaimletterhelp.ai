# API REFERENCE
**Enhanced Quality Systems - Complete API Documentation**

---

## BASE URL

```
https://your-site.netlify.app/.netlify/functions
```

---

## AUTHENTICATION

All endpoints require valid Supabase authentication token in header:

```
Authorization: Bearer <supabase-jwt-token>
```

---

## ENDPOINTS

### 1. Enhanced Letter Generation

**Endpoint:** `POST /generate-letter-enhanced`

**Description:** Generate letter with citation verification and quality assurance

**Request:**
```json
{
  "documentId": "uuid",
  "userId": "uuid",
  "stateCode": "CA",
  "userInfo": {
    "name": "John Doe",
    "address": "123 Main St, City, CA 90000",
    "phone": "(555) 123-4567",
    "email": "john@email.com",
    "claimNumber": "ABC-123-456",
    "policyNumber": "POL-789-012",
    "lossDate": "01/15/2026",
    "letterDate": "02/15/2026",
    "originalClaimAmount": 5000
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "letter": "Complete letter text...",
  "documentId": "uuid",
  "quality": {
    "overallScore": 88,
    "grade": "B+",
    "genericScore": 92,
    "specificityScore": 85,
    "professionalismScore": 95,
    "structureScore": 88,
    "passesCheck": true
  },
  "citations": {
    "qualityScore": 96,
    "accuracyRate": 100,
    "totalCitations": 2,
    "verifiedCitations": 2,
    "hasHallucinations": false,
    "passesVerification": true
  },
  "warnings": [],
  "recommendations": [],
  "performance": {
    "totalDuration": 3456,
    "tokensUsed": 1234,
    "estimatedCost": 0.003
  },
  "metadata": {
    "claimType": "property_homeowners",
    "phase": "denial",
    "state": "CA",
    "generatedAt": "2026-03-17T12:00:00Z"
  }
}
```

**Response (Quality Gate Failed):**
```json
{
  "success": false,
  "qualityGateFailed": true,
  "message": "Generated letter did not meet quality standards",
  "qualityScore": 72,
  "issues": [
    {
      "type": "generic_language",
      "severity": "high",
      "phrase": "in a timely manner",
      "recommendation": "Replace with specific timeframe"
    }
  ],
  "recommendations": [
    "Replace generic phrases with specific language",
    "Add specific deadline date"
  ]
}
```

---

### 2. Citation Verification

**Endpoint:** `POST /realtime-citation-validator/validate`

**Description:** Validate citations in generated text

**Request:**
```json
{
  "text": "Under California Insurance Code § 790.03...",
  "context": {
    "state": "CA",
    "claimType": "property_homeowners"
  }
}
```

**Response:**
```json
{
  "valid": true,
  "hasCitations": true,
  "citationMetrics": {
    "total": 1,
    "verified": 1,
    "accurate": 1,
    "verificationRate": 100,
    "accuracyRate": 100
  },
  "qualityScore": 100,
  "passesValidation": true,
  "warnings": []
}
```

---

### 3. Quality Assessment

**Endpoint:** `POST /quality-assurance-system/assess`

**Description:** Assess quality of generated text

**Request:**
```json
{
  "text": "Letter text to assess..."
}
```

**Response:**
```json
{
  "overallQualityScore": 88,
  "qualityGrade": "B+",
  "passesQualityCheck": true,
  "genericScore": 92,
  "specificityScore": 85,
  "professionalismScore": 95,
  "structureScore": 88,
  "totalIssues": 3,
  "criticalIssues": 0,
  "highIssues": 1,
  "mediumIssues": 2,
  "recommendations": [
    "Add specific deadline date",
    "Include policy number in RE: line"
  ],
  "readyToSend": true
}
```

---

### 4. Outcome Tracking

#### 4.1 Create Outcome Tracking

**Endpoint:** `POST /outcome-tracking-system/create`

**Request:**
```json
{
  "documentId": "uuid",
  "userId": "uuid",
  "claimType": "property_homeowners",
  "phase": "denial",
  "issueType": "delay",
  "stateCode": "CA",
  "claimAmountRange": "$5,000-$10,000",
  "originalClaimAmount": 7500,
  "citationQualityScore": 96,
  "outputQualityScore": 88
}
```

**Response:**
```json
{
  "success": true,
  "outcome": {
    "id": "uuid",
    "outcome_status": "pending",
    "outcome_result": "unknown"
  }
}
```

---

#### 4.2 Mark Letter Sent

**Endpoint:** `PUT /outcome-tracking-system/mark-sent`

**Request:**
```json
{
  "documentId": "uuid",
  "sentDate": "2026-02-15T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true
}
```

---

#### 4.3 Mark Response Received

**Endpoint:** `PUT /outcome-tracking-system/mark-response`

**Request:**
```json
{
  "documentId": "uuid",
  "responseDate": "2026-03-01T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "daysToResponse": 14
}
```

---

#### 4.4 Mark Claim Resolved

**Endpoint:** `PUT /outcome-tracking-system/mark-resolved`

**Request:**
```json
{
  "documentId": "uuid",
  "resolutionType": "approved",
  "resolutionAmount": 7500,
  "resolvedDate": "2026-03-10T10:00:00Z",
  "userSatisfaction": 5,
  "userFeedback": "Claim approved in full!",
  "wouldRecommend": true
}
```

**Response:**
```json
{
  "success": true,
  "outcomeResult": "success",
  "daysToResolution": 23,
  "recoveryPercentage": 100
}
```

---

#### 4.5 Get Statistics

**Endpoint:** `GET /outcome-tracking-system/statistics`

**Response:**
```json
{
  "overall": {
    "totalOutcomes": 50,
    "successCount": 35,
    "successRate": 87,
    "avgDaysToResolution": 45,
    "avgRecoveryPercentage": 82,
    "avgUserSatisfaction": 4.3,
    "meetsTarget": true
  },
  "byClaimType": [
    {
      "claimType": "property_homeowners",
      "successRate": 89,
      "totalOutcomes": 30
    }
  ],
  "qualityCorrelation": {
    "citationQuality": {
      "avgScoreSuccess": 94,
      "avgScoreFailure": 78,
      "correlation": "strong"
    }
  }
}
```

---

### 5. A/B Testing

#### 5.1 Create Experiment

**Endpoint:** `POST /ab-testing-framework/create`

**Request:**
```json
{
  "experimentName": "temperature_test_v1",
  "experimentType": "temperature",
  "description": "Test temperature 0.3 vs 0.2",
  "controlVariant": { "temperature": 0.2 },
  "testVariant": { "temperature": 0.3 },
  "claimTypes": ["property_homeowners"],
  "trafficPercentage": 50,
  "sampleSizeTarget": 100
}
```

**Response:**
```json
{
  "success": true,
  "experiment": {
    "id": "exp-uuid",
    "name": "temperature_test_v1",
    "status": "draft"
  }
}
```

---

#### 5.2 Start Experiment

**Endpoint:** `PUT /ab-testing-framework/start/{experimentId}`

**Response:**
```json
{
  "success": true
}
```

---

#### 5.3 Get Experiment Report

**Endpoint:** `GET /ab-testing-framework/report/{experimentId}`

**Response:**
```json
{
  "success": true,
  "experiment": {
    "id": "exp-uuid",
    "name": "temperature_test_v1",
    "status": "completed"
  },
  "timeline": {
    "durationDays": 14,
    "progress": 100
  },
  "sampleSize": {
    "current": 100,
    "target": 100,
    "control": 52,
    "test": 48
  },
  "results": {
    "controlMetrics": {
      "successRate": 78,
      "avgQualityScore": 85
    },
    "testMetrics": {
      "successRate": 86,
      "avgQualityScore": 88
    },
    "statisticalSignificance": {
      "isSignificant": true,
      "pValue": 0.023,
      "confidence": 97.7
    },
    "winner": "test",
    "recommendation": {
      "action": "adopt_test",
      "message": "Test variant shows 8.0% improvement",
      "confidence": "high"
    }
  }
}
```

---

### 6. Prompt Optimization

#### 6.1 Get Active Prompt

**Endpoint:** `GET /prompt-optimization-engine/active/{promptName}`

**Response:**
```json
{
  "promptVersion": {
    "id": "uuid",
    "prompt_name": "system_generation",
    "version": 2,
    "prompt_text": "You are a professional...",
    "temperature": 0.3,
    "model": "gpt-4o-mini",
    "usage_count": 150,
    "average_quality_score": 88,
    "average_citation_score": 96,
    "success_rate": 87
  }
}
```

---

#### 6.2 Analyze Prompt Performance

**Endpoint:** `GET /prompt-optimization-engine/analyze/{promptName}`

**Response:**
```json
{
  "promptName": "system_generation",
  "currentVersion": {
    "version": 1,
    "compositeScore": 83.7
  },
  "bestVersion": {
    "version": 2,
    "compositeScore": 90.1
  },
  "recommendations": [
    {
      "type": "version_upgrade",
      "priority": "high",
      "message": "Version 2 performs 6.4 points better",
      "action": "Set version 2 as default"
    }
  ],
  "shouldUpgrade": true
}
```

---

#### 6.3 Generate Optimized Prompt

**Endpoint:** `POST /prompt-optimization-engine/optimize`

**Request:**
```json
{
  "promptName": "system_generation"
}
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
    "missing specificity: dates"
  ],
  "recommendation": "Test with A/B testing before setting as default"
}
```

---

## ERROR RESPONSES

### Standard Error Format

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Technical details",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

**400 Bad Request:**
```json
{
  "error": "Invalid request",
  "message": "Document ID and User ID are required",
  "code": "MISSING_REQUIRED_FIELDS"
}
```

**403 Forbidden:**
```json
{
  "error": "Cannot generate letter",
  "message": "This letter requires professional attorney representation",
  "code": "HARD_STOP_CONDITION"
}
```

**404 Not Found:**
```json
{
  "error": "Document not found",
  "message": "Document does not exist or you do not have permission",
  "code": "DOCUMENT_NOT_FOUND"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Letter generation failed",
  "details": "OpenAI API error: Rate limit exceeded",
  "code": "GENERATION_FAILED"
}
```

---

## RATE LIMITS

**Per User:**
- 10 requests per minute
- 100 requests per hour
- 1000 requests per day

**Response Header:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1234567890
```

---

## WEBHOOKS (Future)

### Outcome Update Webhook

**Trigger:** When user reports outcome

**Payload:**
```json
{
  "event": "outcome.resolved",
  "documentId": "uuid",
  "outcomeResult": "success",
  "resolutionAmount": 5000,
  "recoveryPercentage": 100,
  "userSatisfaction": 5,
  "timestamp": "2026-03-17T12:00:00Z"
}
```

---

## CODE EXAMPLES

### JavaScript/Node.js

```javascript
const response = await fetch('https://your-site.netlify.app/.netlify/functions/generate-letter-enhanced', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseToken}`
  },
  body: JSON.stringify({
    documentId,
    userId,
    stateCode: 'CA',
    userInfo: {
      name: 'John Doe',
      address: '123 Main St',
      phone: '555-1234',
      email: 'john@email.com',
      claimNumber: 'ABC-123',
      policyNumber: 'POL-456',
      lossDate: '01/15/2026'
    }
  })
});

const result = await response.json();

if (result.success) {
  console.log('Letter generated:', result.letter);
  console.log('Quality score:', result.quality.overallScore);
  console.log('Citation accuracy:', result.citations.accuracyRate);
} else {
  console.error('Generation failed:', result.message);
}
```

### Python

```python
import requests

response = requests.post(
    'https://your-site.netlify.app/.netlify/functions/generate-letter-enhanced',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {supabase_token}'
    },
    json={
        'documentId': document_id,
        'userId': user_id,
        'stateCode': 'CA',
        'userInfo': {
            'name': 'John Doe',
            'address': '123 Main St',
            'phone': '555-1234',
            'email': 'john@email.com',
            'claimNumber': 'ABC-123',
            'policyNumber': 'POL-456',
            'lossDate': '01/15/2026'
        }
    }
)

result = response.json()

if result['success']:
    print(f"Quality score: {result['quality']['overallScore']}")
    print(f"Citation accuracy: {result['citations']['accuracyRate']}%")
else:
    print(f"Error: {result['message']}")
```

---

## SDK (Future)

### JavaScript SDK

```javascript
import { InsuranceLetterAI } from '@insurance-letter-ai/sdk';

const client = new InsuranceLetterAI({
  supabaseUrl: 'your-supabase-url',
  supabaseKey: 'your-supabase-key'
});

// Generate letter
const result = await client.generateLetter({
  documentId,
  userId,
  stateCode: 'CA',
  userInfo: { ... }
});

// Track outcome
await client.markLetterSent(documentId);
await client.markClaimResolved(documentId, {
  resolutionType: 'approved',
  resolutionAmount: 5000,
  userSatisfaction: 5
});

// Get statistics
const stats = await client.getStatistics();
```

---

**API Version:** 2.0  
**Last Updated:** March 17, 2026
