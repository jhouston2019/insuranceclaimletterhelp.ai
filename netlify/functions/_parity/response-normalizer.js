/**
 * RESPONSE NORMALIZER
 * 
 * Ensures consistent response format across all AI providers.
 * Validates safety constraints and output quality.
 * 
 * CRITICAL: This module enforces consistency for safety-critical operations.
 * All providers must produce equivalent outputs for the same inputs.
 */

const { SAFETY_CONFIG } = require('./parity-config');

// ============================================================================
// RESPONSE NORMALIZATION
// ============================================================================

/**
 * Normalize provider response to standard format
 * @param {Object} providerResponse - Raw provider response
 * @returns {Object} - Normalized response
 */
function normalizeResponse(providerResponse) {
  // Provider responses already normalized by adapters
  // This function adds additional validation and metadata
  
  return {
    ...providerResponse,
    
    // Add normalized metadata
    normalized: true,
    normalizedAt: new Date().toISOString(),
    
    // Add cost efficiency score
    costEfficiency: calculateCostEfficiency(providerResponse),
    
    // Add quality metadata
    quality: {
      lengthScore: scoreLengthAppropriate(providerResponse.content),
      formatScore: scoreFormatCorrect(providerResponse.content),
      validated: false  // Will be set by quality system
    }
  };
}

/**
 * Calculate cost efficiency score
 * Lower cost = higher score
 */
function calculateCostEfficiency(response) {
  const costPerToken = response.cost / response.tokens.total;
  
  // Score from 0-100
  // $0.0001 per token = 0 score
  // $0.000001 per token = 100 score
  const maxCost = 0.0001;
  const minCost = 0.000001;
  
  if (costPerToken >= maxCost) return 0;
  if (costPerToken <= minCost) return 100;
  
  const range = maxCost - minCost;
  const score = 100 - ((costPerToken - minCost) / range * 100);
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Score content length appropriateness
 */
function scoreLengthAppropriate(content) {
  const lines = content.split('\n').filter(line => line.trim().length > 0).length;
  
  // Target: 15-30 lines
  if (lines >= 15 && lines <= 30) return 100;
  if (lines >= 10 && lines <= 40) return 80;
  if (lines >= 5 && lines <= 50) return 60;
  return 40;
}

/**
 * Score format correctness
 */
function scoreFormatCorrect(content) {
  let score = 100;
  
  // Check for business letter components
  if (!content.includes('RE:')) score -= 20;
  if (!content.includes('Dear')) score -= 10;
  if (!content.includes('Sincerely')) score -= 10;
  
  return Math.max(0, score);
}

// ============================================================================
// CONSISTENCY VALIDATION
// ============================================================================

/**
 * Validate consistency across multiple provider responses
 * Used for safety-critical operations where we need consensus
 * 
 * @param {Array} responses - Array of responses from different providers
 * @param {string} validationType - Type of validation (hard_stop, risk_level, quality)
 * @returns {Object} - Validation result
 */
function validateConsistency(responses, validationType) {
  if (!responses || responses.length < 2) {
    return {
      consistent: true,
      message: 'Only one response, no consistency check needed'
    };
  }
  
  switch (validationType) {
    case 'hard_stop':
      return validateHardStopConsistency(responses);
    case 'risk_level':
      return validateRiskLevelConsistency(responses);
    case 'quality':
      return validateQualityConsistency(responses);
    default:
      return { consistent: true, message: 'Unknown validation type' };
  }
}

/**
 * Validate hard-stop consistency
 * All providers must agree on hard-stop decisions
 */
function validateHardStopConsistency(responses) {
  const hardStopDetections = responses.map(r => {
    const content = r.content.toLowerCase();
    return {
      provider: r.provider,
      hardStop: content.includes('must consult an attorney') || 
                content.includes('attorney required') ||
                content.includes('professional representation required')
    };
  });
  
  const allAgree = hardStopDetections.every(d => d.hardStop === hardStopDetections[0].hardStop);
  
  if (!allAgree) {
    return {
      consistent: false,
      severity: 'critical',
      message: 'SAFETY VIOLATION: Providers disagree on hard-stop detection',
      details: hardStopDetections,
      action: 'REFUSE OUTPUT - Manual review required'
    };
  }
  
  return {
    consistent: true,
    hardStop: hardStopDetections[0].hardStop,
    consensus: 'unanimous',
    providers: hardStopDetections.map(d => d.provider)
  };
}

/**
 * Validate risk level consistency
 * Allow ±1 level variance
 */
function validateRiskLevelConsistency(responses) {
  const riskLevels = {
    'safe': 1,
    'caution': 2,
    'high_risk': 3,
    'critical': 4,
    'hard_stop': 5
  };
  
  const detectedLevels = responses.map(r => {
    const content = r.content.toLowerCase();
    
    if (content.includes('hard stop') || content.includes('must consult')) return 5;
    if (content.includes('critical') || content.includes('attorney required')) return 4;
    if (content.includes('high risk') || content.includes('should consult')) return 3;
    if (content.includes('caution') || content.includes('consider')) return 2;
    return 1;
  });
  
  const minLevel = Math.min(...detectedLevels);
  const maxLevel = Math.max(...detectedLevels);
  const variance = maxLevel - minLevel;
  
  const tolerance = SAFETY_CONFIG.consistencyValidation.riskLevelTolerance || 1;
  
  if (variance > tolerance) {
    return {
      consistent: false,
      severity: 'high',
      message: `Risk level variance (${variance}) exceeds tolerance (${tolerance})`,
      details: responses.map((r, i) => ({ provider: r.provider, level: detectedLevels[i] })),
      action: 'Use most conservative (highest) risk level'
    };
  }
  
  return {
    consistent: true,
    riskLevel: Math.max(...detectedLevels),
    variance,
    providers: responses.map(r => r.provider)
  };
}

/**
 * Validate quality consistency
 * Allow ±5 points variance
 */
function validateQualityConsistency(responses) {
  const qualityScores = responses.map(r => r.quality?.overallScore || 0);
  
  const minScore = Math.min(...qualityScores);
  const maxScore = Math.max(...qualityScores);
  const variance = maxScore - minScore;
  
  const tolerance = SAFETY_CONFIG.consistencyValidation.qualityScoreTolerance || 5;
  
  if (variance > tolerance) {
    return {
      consistent: false,
      severity: 'medium',
      message: `Quality score variance (${variance}) exceeds tolerance (${tolerance})`,
      details: responses.map((r, i) => ({ provider: r.provider, score: qualityScores[i] })),
      action: 'Use highest quality response'
    };
  }
  
  return {
    consistent: true,
    avgQuality: Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length),
    variance,
    providers: responses.map(r => r.provider)
  };
}

// ============================================================================
// RESPONSE SELECTION
// ============================================================================

/**
 * Select best response from multiple provider responses
 * @param {Array} responses - Array of responses from different providers
 * @param {string} selectionCriteria - Criteria for selection (cost, quality, latency)
 * @returns {Object} - Selected response
 */
function selectBestResponse(responses, selectionCriteria = 'quality') {
  if (!responses || responses.length === 0) {
    throw new Error('No responses to select from');
  }
  
  if (responses.length === 1) {
    return responses[0];
  }
  
  switch (selectionCriteria) {
    case 'cost':
      return responses.reduce((best, current) => 
        current.cost < best.cost ? current : best
      );
      
    case 'quality':
      return responses.reduce((best, current) => 
        (current.quality?.overallScore || 0) > (best.quality?.overallScore || 0) ? current : best
      );
      
    case 'latency':
      return responses.reduce((best, current) => 
        current.latency < best.latency ? current : best
      );
      
    case 'balanced':
      // Composite score: 40% quality, 30% cost efficiency, 30% latency
      return responses.reduce((best, current) => {
        const currentScore = 
          (current.quality?.overallScore || 0) * 0.4 +
          current.costEfficiency * 0.3 +
          (10000 / current.latency) * 0.3;  // Lower latency = higher score
          
        const bestScore = 
          (best.quality?.overallScore || 0) * 0.4 +
          best.costEfficiency * 0.3 +
          (10000 / best.latency) * 0.3;
          
        return currentScore > bestScore ? current : best;
      });
      
    default:
      return responses[0];  // Return first response
  }
}

// ============================================================================
// RESPONSE COMPARISON
// ============================================================================

/**
 * Compare responses from multiple providers
 * @param {Array} responses - Array of responses
 * @returns {Object} - Comparison analysis
 */
function compareResponses(responses) {
  if (!responses || responses.length < 2) {
    return { comparable: false, message: 'Need at least 2 responses to compare' };
  }
  
  return {
    comparable: true,
    count: responses.length,
    providers: responses.map(r => r.provider),
    
    costs: {
      min: Math.min(...responses.map(r => r.cost)),
      max: Math.max(...responses.map(r => r.cost)),
      avg: responses.reduce((sum, r) => sum + r.cost, 0) / responses.length,
      variance: calculateVariance(responses.map(r => r.cost))
    },
    
    latencies: {
      min: Math.min(...responses.map(r => r.latency)),
      max: Math.max(...responses.map(r => r.latency)),
      avg: responses.reduce((sum, r) => sum + r.latency, 0) / responses.length,
      variance: calculateVariance(responses.map(r => r.latency))
    },
    
    tokens: {
      input: {
        min: Math.min(...responses.map(r => r.tokens.input)),
        max: Math.max(...responses.map(r => r.tokens.input)),
        avg: responses.reduce((sum, r) => sum + r.tokens.input, 0) / responses.length
      },
      output: {
        min: Math.min(...responses.map(r => r.tokens.output)),
        max: Math.max(...responses.map(r => r.tokens.output)),
        avg: responses.reduce((sum, r) => sum + r.tokens.output, 0) / responses.length
      }
    },
    
    contentLengths: {
      min: Math.min(...responses.map(r => r.content.length)),
      max: Math.max(...responses.map(r => r.content.length)),
      avg: responses.reduce((sum, r) => sum + r.content.length, 0) / responses.length
    },
    
    recommendation: generateRecommendation(responses)
  };
}

/**
 * Calculate variance
 */
function calculateVariance(values) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);
}

/**
 * Generate recommendation from comparison
 */
function generateRecommendation(responses) {
  const costs = responses.map(r => ({ provider: r.provider, cost: r.cost }));
  const latencies = responses.map(r => ({ provider: r.provider, latency: r.latency }));
  
  costs.sort((a, b) => a.cost - b.cost);
  latencies.sort((a, b) => a.latency - b.latency);
  
  return {
    cheapest: costs[0].provider,
    fastest: latencies[0].provider,
    costSavings: costs[costs.length - 1].cost - costs[0].cost,
    latencyDifference: latencies[latencies.length - 1].latency - latencies[0].latency
  };
}

// ============================================================================
// CONTENT VALIDATION
// ============================================================================

/**
 * Validate response content meets safety requirements
 * @param {Object} response - Normalized response
 * @returns {Object} - Validation result
 */
function validateResponseContent(response) {
  const issues = [];
  
  // Check for prohibited phrases
  const prohibitedPhrases = [
    'we understand', 'i understand',
    'don\'t worry', 'rest assured',
    'you deserve', 'fight for',
    'unfortunately', 'frustrating',
    'how can i help', 'tell me more',
    'i am writing to inform you',
    'at your earliest convenience',
    'i look forward to'
  ];
  
  const contentLower = response.content.toLowerCase();
  const foundProhibited = prohibitedPhrases.filter(phrase => contentLower.includes(phrase));
  
  if (foundProhibited.length > 0) {
    issues.push({
      type: 'prohibited_phrases',
      severity: 'high',
      count: foundProhibited.length,
      phrases: foundProhibited
    });
  }
  
  // Check length
  const lines = response.content.split('\n').filter(line => line.trim().length > 0).length;
  if (lines > 35) {
    issues.push({
      type: 'excessive_length',
      severity: 'medium',
      lines,
      maxAllowed: 35
    });
  }
  
  // Check for emotional language
  const emotionalWords = ['unfair', 'frustrated', 'disappointed', 'upset', 'angry', 'outraged'];
  const foundEmotional = emotionalWords.filter(word => contentLower.includes(word));
  
  if (foundEmotional.length > 0) {
    issues.push({
      type: 'emotional_language',
      severity: 'high',
      count: foundEmotional.length,
      words: foundEmotional
    });
  }
  
  // Check for adversarial language
  const adversarialWords = ['sue', 'lawsuit', 'litigation', 'legal action', 'bad faith'];
  const foundAdversarial = adversarialWords.filter(word => contentLower.includes(word));
  
  if (foundAdversarial.length > 0) {
    issues.push({
      type: 'adversarial_language',
      severity: 'medium',
      count: foundAdversarial.length,
      words: foundAdversarial
    });
  }
  
  return {
    valid: issues.length === 0,
    issues,
    issueCount: issues.length,
    highSeverityCount: issues.filter(i => i.severity === 'high').length
  };
}

// ============================================================================
// RESPONSE SANITIZATION
// ============================================================================

/**
 * Sanitize response content
 * Remove prohibited phrases and ensure safety
 * @param {Object} response - Normalized response
 * @returns {Object} - Sanitized response
 */
function sanitizeResponse(response) {
  let sanitizedContent = response.content;
  
  // Remove prohibited phrases
  const prohibitedPhrases = [
    /we understand/gi,
    /i understand/gi,
    /don't worry/gi,
    /rest assured/gi,
    /you deserve/gi,
    /fight for/gi,
    /unfortunately/gi,
    /frustrating/gi,
    /how can i help/gi,
    /tell me more/gi,
    /i am writing to inform you/gi,
    /at your earliest convenience/gi,
    /i look forward to/gi
  ];
  
  for (const phrase of prohibitedPhrases) {
    sanitizedContent = sanitizedContent.replace(phrase, '');
  }
  
  // Clean up extra whitespace
  sanitizedContent = sanitizedContent
    .replace(/\n\n\n+/g, '\n\n')  // Max 2 consecutive newlines
    .replace(/  +/g, ' ')  // Remove multiple spaces
    .trim();
  
  return {
    ...response,
    content: sanitizedContent,
    sanitized: true,
    sanitizedAt: new Date().toISOString()
  };
}

// ============================================================================
// RESPONSE MERGING
// ============================================================================

/**
 * Merge multiple responses into single best response
 * Used when running multiple providers in parallel for quality
 * 
 * @param {Array} responses - Array of responses
 * @param {string} strategy - Merge strategy (best, consensus, hybrid)
 * @returns {Object} - Merged response
 */
function mergeResponses(responses, strategy = 'best') {
  if (!responses || responses.length === 0) {
    throw new Error('No responses to merge');
  }
  
  if (responses.length === 1) {
    return responses[0];
  }
  
  switch (strategy) {
    case 'best':
      // Select highest quality response
      return selectBestResponse(responses, 'quality');
      
    case 'cheapest':
      // Select lowest cost response
      return selectBestResponse(responses, 'cost');
      
    case 'fastest':
      // Select lowest latency response
      return selectBestResponse(responses, 'latency');
      
    case 'consensus':
      // Use consensus approach (majority vote on key elements)
      return buildConsensusResponse(responses);
      
    case 'hybrid':
      // Combine best elements from multiple responses
      return buildHybridResponse(responses);
      
    default:
      return responses[0];
  }
}

/**
 * Build consensus response
 * Used for safety-critical operations
 */
function buildConsensusResponse(responses) {
  // For safety operations, use most conservative response
  const hardStopValidation = validateHardStopConsistency(responses);
  
  if (hardStopValidation.hardStop) {
    // All agree it's a hard stop - use any response
    return responses[0];
  }
  
  // If no hard stop, use highest quality response
  return selectBestResponse(responses, 'quality');
}

/**
 * Build hybrid response
 * Combine best elements from multiple responses
 */
function buildHybridResponse(responses) {
  // For now, just select best response
  // Future: Could combine sections from different responses
  return selectBestResponse(responses, 'balanced');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  normalizeResponse,
  validateConsistency,
  validateHardStopConsistency,
  validateRiskLevelConsistency,
  validateQualityConsistency,
  validateResponseContent,
  sanitizeResponse,
  mergeResponses,
  selectBestResponse,
  compareResponses,
  
  // For testing
  calculateCostEfficiency,
  scoreLengthAppropriate,
  scoreFormatCorrect
};
