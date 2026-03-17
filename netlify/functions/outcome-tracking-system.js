/**
 * OUTCOME TRACKING SYSTEM
 * 
 * Measures real-world success rates and correlates with quality metrics.
 * 
 * FEATURES:
 * - Letter outcome tracking (sent, response received, resolved)
 * - Success rate calculation by claim type
 * - Recovery percentage tracking
 * - Time-to-resolution metrics
 * - User satisfaction scoring
 * - Quality correlation analysis
 * 
 * SUCCESS TARGETS:
 * - Overall success rate: 85%+
 * - Average recovery: 80%+ of claim amount
 * - Response time: <30 days
 * - User satisfaction: 4.0+ / 5.0
 */

const { getSupabaseAdmin } = require("./_supabase");

// ============================================================================
// OUTCOME STATUS DEFINITIONS
// ============================================================================

const OUTCOME_STATUSES = {
  PENDING: 'pending',           // Letter generated, not yet sent
  SENT: 'sent',                 // Letter sent to insurance company
  RESPONSE_RECEIVED: 'response_received', // Insurance company responded
  RESOLVED: 'resolved',         // Claim resolved (approved, denied, or settled)
  ESCALATED: 'escalated'        // Escalated to attorney or regulator
};

const OUTCOME_RESULTS = {
  SUCCESS: 'success',           // Claim approved/paid in full
  PARTIAL_SUCCESS: 'partial_success', // Claim partially approved/paid
  FAILURE: 'failure',           // Claim still denied
  SETTLED: 'settled',           // Settled for less than claimed
  ESCALATED: 'escalated',       // Required attorney intervention
  UNKNOWN: 'unknown'            // Outcome not yet determined
};

const RESOLUTION_TYPES = {
  APPROVED: 'approved',         // Full approval
  PARTIAL_APPROVAL: 'partial_approval', // Partial approval
  DENIED: 'denied',             // Still denied
  SETTLED: 'settled',           // Settlement reached
  ESCALATED: 'escalated',       // Escalated to attorney
  WITHDRAWN: 'withdrawn'        // User withdrew claim
};

// ============================================================================
// OUTCOME CREATION
// ============================================================================

/**
 * Create initial outcome tracking record
 * @param {Object} params - Outcome parameters
 * @returns {Object} - Created outcome record
 */
async function createOutcomeTracking(params) {
  const {
    documentId,
    userId,
    claimType,
    phase,
    issueType,
    stateCode,
    claimAmountRange,
    originalClaimAmount,
    citationQualityScore,
    outputQualityScore
  } = params;
  
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('outcome_tracking')
      .insert({
        document_id: documentId,
        user_id: userId,
        claim_type: claimType,
        phase: phase,
        issue_type: issueType,
        state_code: stateCode,
        claim_amount_range: claimAmountRange,
        original_claim_amount: originalClaimAmount,
        citation_quality_score: citationQualityScore,
        output_quality_score: outputQualityScore,
        outcome_status: OUTCOME_STATUSES.PENDING,
        outcome_result: OUTCOME_RESULTS.UNKNOWN
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('Outcome tracking created:', data.id);
    return { success: true, outcome: data };
    
  } catch (error) {
    console.error('Failed to create outcome tracking:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// OUTCOME UPDATES
// ============================================================================

/**
 * Update outcome when letter is sent
 * @param {string} documentId - Document ID
 * @param {Date} sentDate - Date letter was sent
 */
async function markLetterSent(documentId, sentDate = new Date()) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('outcome_tracking')
      .update({
        outcome_status: OUTCOME_STATUSES.SENT,
        letter_sent: true,
        letter_sent_date: sentDate.toISOString()
      })
      .eq('document_id', documentId);
    
    if (error) throw error;
    
    console.log('Letter marked as sent:', documentId);
    return { success: true };
    
  } catch (error) {
    console.error('Failed to mark letter as sent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update outcome when response is received
 * @param {string} documentId - Document ID
 * @param {Date} responseDate - Date response was received
 */
async function markResponseReceived(documentId, responseDate = new Date()) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get letter sent date to calculate days to response
    const { data: outcome } = await supabase
      .from('outcome_tracking')
      .select('letter_sent_date')
      .eq('document_id', documentId)
      .single();
    
    let daysToResponse = null;
    if (outcome && outcome.letter_sent_date) {
      const sentDate = new Date(outcome.letter_sent_date);
      daysToResponse = Math.round((responseDate - sentDate) / (1000 * 60 * 60 * 24));
    }
    
    const { error } = await supabase
      .from('outcome_tracking')
      .update({
        outcome_status: OUTCOME_STATUSES.RESPONSE_RECEIVED,
        response_received: true,
        response_received_date: responseDate.toISOString(),
        days_to_response: daysToResponse
      })
      .eq('document_id', documentId);
    
    if (error) throw error;
    
    console.log('Response marked as received:', documentId, 'Days:', daysToResponse);
    return { success: true, daysToResponse };
    
  } catch (error) {
    console.error('Failed to mark response received:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update outcome when claim is resolved
 * @param {string} documentId - Document ID
 * @param {Object} resolutionData - Resolution details
 */
async function markClaimResolved(documentId, resolutionData) {
  const {
    resolutionType,
    resolutionAmount,
    resolvedDate = new Date(),
    userSatisfaction,
    userFeedback,
    wouldRecommend
  } = resolutionData;
  
  try {
    const supabase = getSupabaseAdmin();
    
    // Get original data to calculate metrics
    const { data: outcome } = await supabase
      .from('outcome_tracking')
      .select('*')
      .eq('document_id', documentId)
      .single();
    
    // Calculate days to resolution
    let daysToResolution = null;
    if (outcome && outcome.letter_sent_date) {
      const sentDate = new Date(outcome.letter_sent_date);
      daysToResolution = Math.round((resolvedDate - sentDate) / (1000 * 60 * 60 * 24));
    }
    
    // Calculate recovery percentage
    let recoveryPercentage = null;
    if (outcome && outcome.original_claim_amount && resolutionAmount) {
      recoveryPercentage = Math.round((resolutionAmount / outcome.original_claim_amount) * 100);
    }
    
    // Determine outcome result
    let outcomeResult = OUTCOME_RESULTS.UNKNOWN;
    if (resolutionType === RESOLUTION_TYPES.APPROVED) {
      outcomeResult = OUTCOME_RESULTS.SUCCESS;
    } else if (resolutionType === RESOLUTION_TYPES.PARTIAL_APPROVAL || resolutionType === RESOLUTION_TYPES.SETTLED) {
      outcomeResult = recoveryPercentage >= 80 ? OUTCOME_RESULTS.SUCCESS : OUTCOME_RESULTS.PARTIAL_SUCCESS;
    } else if (resolutionType === RESOLUTION_TYPES.DENIED) {
      outcomeResult = OUTCOME_RESULTS.FAILURE;
    } else if (resolutionType === RESOLUTION_TYPES.ESCALATED) {
      outcomeResult = OUTCOME_RESULTS.ESCALATED;
    }
    
    const { error } = await supabase
      .from('outcome_tracking')
      .update({
        outcome_status: OUTCOME_STATUSES.RESOLVED,
        outcome_result: outcomeResult,
        claim_resolved: true,
        claim_resolved_date: resolvedDate.toISOString(),
        resolution_type: resolutionType,
        resolution_amount: resolutionAmount,
        recovery_percentage: recoveryPercentage,
        days_to_resolution: daysToResolution,
        user_satisfaction: userSatisfaction,
        user_feedback: userFeedback,
        would_recommend: wouldRecommend
      })
      .eq('document_id', documentId);
    
    if (error) throw error;
    
    console.log('Claim marked as resolved:', documentId, 'Result:', outcomeResult);
    return { 
      success: true, 
      outcomeResult, 
      daysToResolution, 
      recoveryPercentage 
    };
    
  } catch (error) {
    console.error('Failed to mark claim resolved:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SUCCESS RATE CALCULATION
// ============================================================================

/**
 * Calculate success rate for specific criteria
 * @param {Object} filters - Filter criteria
 * @returns {Object} - Success rate statistics
 */
async function calculateSuccessRate(filters = {}) {
  try {
    const supabase = getSupabaseAdmin();
    
    let query = supabase
      .from('outcome_tracking')
      .select('*')
      .not('outcome_result', 'is', null)
      .neq('outcome_result', OUTCOME_RESULTS.UNKNOWN);
    
    // Apply filters
    if (filters.claimType) {
      query = query.eq('claim_type', filters.claimType);
    }
    if (filters.phase) {
      query = query.eq('phase', filters.phase);
    }
    if (filters.stateCode) {
      query = query.eq('state_code', filters.stateCode);
    }
    if (filters.claimAmountRange) {
      query = query.eq('claim_amount_range', filters.claimAmountRange);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        totalOutcomes: 0,
        successCount: 0,
        partialSuccessCount: 0,
        failureCount: 0,
        escalatedCount: 0,
        successRate: 0,
        meetsTarget: false
      };
    }
    
    const totalOutcomes = data.length;
    const successCount = data.filter(o => o.outcome_result === OUTCOME_RESULTS.SUCCESS).length;
    const partialSuccessCount = data.filter(o => o.outcome_result === OUTCOME_RESULTS.PARTIAL_SUCCESS).length;
    const failureCount = data.filter(o => o.outcome_result === OUTCOME_RESULTS.FAILURE).length;
    const escalatedCount = data.filter(o => o.outcome_result === OUTCOME_RESULTS.ESCALATED).length;
    
    const successRate = Math.round(((successCount + partialSuccessCount) / totalOutcomes) * 100);
    
    // Calculate average metrics
    const avgDaysToResolution = data
      .filter(o => o.days_to_resolution)
      .reduce((sum, o) => sum + o.days_to_resolution, 0) / 
      data.filter(o => o.days_to_resolution).length || 0;
    
    const avgRecoveryPercentage = data
      .filter(o => o.recovery_percentage)
      .reduce((sum, o) => sum + o.recovery_percentage, 0) / 
      data.filter(o => o.recovery_percentage).length || 0;
    
    const avgUserSatisfaction = data
      .filter(o => o.user_satisfaction)
      .reduce((sum, o) => sum + o.user_satisfaction, 0) / 
      data.filter(o => o.user_satisfaction).length || 0;
    
    return {
      totalOutcomes,
      successCount,
      partialSuccessCount,
      failureCount,
      escalatedCount,
      successRate,
      avgDaysToResolution: Math.round(avgDaysToResolution),
      avgRecoveryPercentage: Math.round(avgRecoveryPercentage),
      avgUserSatisfaction: Math.round(avgUserSatisfaction * 10) / 10,
      meetsTarget: successRate >= 85,
      filters
    };
    
  } catch (error) {
    console.error('Failed to calculate success rate:', error);
    return null;
  }
}

/**
 * Get success rate by claim type
 * @returns {Array} - Success rates for each claim type
 */
async function getSuccessRateByClaimType() {
  try {
    const supabase = getSupabaseAdmin();
    
    const claimTypes = [
      'property_homeowners',
      'property_renters',
      'auto_collision',
      'auto_comprehensive',
      'health_medical',
      'health_prescription'
    ];
    
    const results = await Promise.all(
      claimTypes.map(claimType => calculateSuccessRate({ claimType }))
    );
    
    return claimTypes.map((claimType, index) => ({
      claimType,
      ...results[index]
    }));
    
  } catch (error) {
    console.error('Failed to get success rate by claim type:', error);
    return null;
  }
}

// ============================================================================
// QUALITY CORRELATION ANALYSIS
// ============================================================================

/**
 * Analyze correlation between quality scores and outcomes
 * @returns {Object} - Correlation analysis
 */
async function analyzeQualityCorrelation() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get outcomes with quality scores
    const { data, error } = await supabase
      .from('outcome_tracking')
      .select('outcome_result, citation_quality_score, output_quality_score, recovery_percentage')
      .not('outcome_result', 'is', null)
      .neq('outcome_result', OUTCOME_RESULTS.UNKNOWN);
    
    if (error) throw error;
    
    if (!data || data.length < 10) {
      return {
        sampleSize: data?.length || 0,
        sufficientData: false,
        message: 'Insufficient data for correlation analysis (minimum 10 outcomes required)'
      };
    }
    
    // Separate by outcome
    const successfulOutcomes = data.filter(o => 
      o.outcome_result === OUTCOME_RESULTS.SUCCESS || 
      o.outcome_result === OUTCOME_RESULTS.PARTIAL_SUCCESS
    );
    const failedOutcomes = data.filter(o => o.outcome_result === OUTCOME_RESULTS.FAILURE);
    
    // Calculate average quality scores for each group
    const avgCitationScoreSuccess = successfulOutcomes
      .filter(o => o.citation_quality_score)
      .reduce((sum, o) => sum + o.citation_quality_score, 0) / 
      successfulOutcomes.filter(o => o.citation_quality_score).length || 0;
    
    const avgCitationScoreFailure = failedOutcomes
      .filter(o => o.citation_quality_score)
      .reduce((sum, o) => sum + o.citation_quality_score, 0) / 
      failedOutcomes.filter(o => o.citation_quality_score).length || 0;
    
    const avgOutputScoreSuccess = successfulOutcomes
      .filter(o => o.output_quality_score)
      .reduce((sum, o) => sum + o.output_quality_score, 0) / 
      successfulOutcomes.filter(o => o.output_quality_score).length || 0;
    
    const avgOutputScoreFailure = failedOutcomes
      .filter(o => o.output_quality_score)
      .reduce((sum, o) => sum + o.output_quality_score, 0) / 
      failedOutcomes.filter(o => o.output_quality_score).length || 0;
    
    // Calculate correlation strength
    const citationDifference = avgCitationScoreSuccess - avgCitationScoreFailure;
    const outputDifference = avgOutputScoreSuccess - avgOutputScoreFailure;
    
    return {
      sampleSize: data.length,
      sufficientData: true,
      
      successfulOutcomes: successfulOutcomes.length,
      failedOutcomes: failedOutcomes.length,
      
      citationQuality: {
        avgScoreSuccess: Math.round(avgCitationScoreSuccess),
        avgScoreFailure: Math.round(avgCitationScoreFailure),
        difference: Math.round(citationDifference),
        correlation: citationDifference > 10 ? 'strong' : citationDifference > 5 ? 'moderate' : 'weak'
      },
      
      outputQuality: {
        avgScoreSuccess: Math.round(avgOutputScoreSuccess),
        avgScoreFailure: Math.round(avgOutputScoreFailure),
        difference: Math.round(outputDifference),
        correlation: outputDifference > 10 ? 'strong' : outputDifference > 5 ? 'moderate' : 'weak'
      },
      
      insights: generateCorrelationInsights(citationDifference, outputDifference)
    };
    
  } catch (error) {
    console.error('Failed to analyze quality correlation:', error);
    return null;
  }
}

/**
 * Generate insights from correlation analysis
 */
function generateCorrelationInsights(citationDiff, outputDiff) {
  const insights = [];
  
  if (citationDiff > 10) {
    insights.push({
      type: 'citation_quality',
      message: 'Strong correlation: Higher citation quality scores are associated with successful outcomes',
      recommendation: 'Prioritize citation accuracy in letter generation'
    });
  }
  
  if (outputDiff > 10) {
    insights.push({
      type: 'output_quality',
      message: 'Strong correlation: Higher output quality scores are associated with successful outcomes',
      recommendation: 'Focus on improving generic language detection and specificity'
    });
  }
  
  if (citationDiff < 5 && outputDiff < 5) {
    insights.push({
      type: 'weak_correlation',
      message: 'Weak correlation: Quality scores may not be strong predictors of outcomes',
      recommendation: 'Investigate other factors affecting success (claim type, state, timing, etc.)'
    });
  }
  
  return insights;
}

// ============================================================================
// USER FEEDBACK COLLECTION
// ============================================================================

/**
 * Submit user feedback on outcome
 * @param {string} documentId - Document ID
 * @param {Object} feedback - User feedback
 */
async function submitUserFeedback(documentId, feedback) {
  const {
    outcomeResult,
    resolutionType,
    resolutionAmount,
    userSatisfaction,
    userFeedback,
    wouldRecommend,
    followUpRequired,
    escalatedToAttorney
  } = feedback;
  
  try {
    const supabase = getSupabaseAdmin();
    
    const updateData = {
      user_satisfaction: userSatisfaction,
      user_feedback: userFeedback,
      would_recommend: wouldRecommend,
      follow_up_required: followUpRequired,
      escalated_to_attorney: escalatedToAttorney
    };
    
    // If resolution data provided, mark as resolved
    if (outcomeResult && resolutionType) {
      const resolutionData = {
        resolutionType,
        resolutionAmount,
        resolvedDate: new Date(),
        userSatisfaction,
        userFeedback,
        wouldRecommend
      };
      
      return await markClaimResolved(documentId, resolutionData);
    }
    
    // Otherwise just update feedback
    const { error } = await supabase
      .from('outcome_tracking')
      .update(updateData)
      .eq('document_id', documentId);
    
    if (error) throw error;
    
    console.log('User feedback submitted:', documentId);
    return { success: true };
    
  } catch (error) {
    console.error('Failed to submit user feedback:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// STATISTICS & REPORTING
// ============================================================================

/**
 * Get comprehensive outcome statistics
 * @param {Object} filters - Optional filters
 * @returns {Object} - Outcome statistics
 */
async function getOutcomeStatistics(filters = {}) {
  try {
    const overallStats = await calculateSuccessRate(filters);
    const claimTypeStats = await getSuccessRateByClaimType();
    const correlationAnalysis = await analyzeQualityCorrelation();
    
    return {
      overall: overallStats,
      byClaimType: claimTypeStats,
      qualityCorrelation: correlationAnalysis,
      meetsTargets: {
        successRate: overallStats.successRate >= 85,
        avgRecovery: overallStats.avgRecoveryPercentage >= 80,
        avgSatisfaction: overallStats.avgUserSatisfaction >= 4.0
      }
    };
    
  } catch (error) {
    console.error('Failed to get outcome statistics:', error);
    return null;
  }
}

/**
 * Get best performing configurations
 * @returns {Object} - Best performing settings
 */
async function getBestPerformingConfigurations() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get successful outcomes with high quality scores
    const { data, error } = await supabase
      .from('outcome_tracking')
      .select('claim_type, phase, state_code, citation_quality_score, output_quality_score, recovery_percentage')
      .in('outcome_result', [OUTCOME_RESULTS.SUCCESS, OUTCOME_RESULTS.PARTIAL_SUCCESS])
      .gte('citation_quality_score', 90)
      .gte('output_quality_score', 85)
      .order('recovery_percentage', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        sampleSize: 0,
        message: 'No successful outcomes with high quality scores yet'
      };
    }
    
    // Group by claim type
    const byClaimType = {};
    data.forEach(outcome => {
      if (!byClaimType[outcome.claim_type]) {
        byClaimType[outcome.claim_type] = [];
      }
      byClaimType[outcome.claim_type].push(outcome);
    });
    
    // Calculate averages per claim type
    const bestConfigurations = Object.entries(byClaimType).map(([claimType, outcomes]) => ({
      claimType,
      sampleSize: outcomes.length,
      avgCitationScore: Math.round(outcomes.reduce((sum, o) => sum + o.citation_quality_score, 0) / outcomes.length),
      avgOutputScore: Math.round(outcomes.reduce((sum, o) => sum + o.output_quality_score, 0) / outcomes.length),
      avgRecovery: Math.round(outcomes.filter(o => o.recovery_percentage).reduce((sum, o) => sum + o.recovery_percentage, 0) / outcomes.filter(o => o.recovery_percentage).length || 0),
      topStates: getTopStates(outcomes),
      topPhases: getTopPhases(outcomes)
    }));
    
    return {
      sampleSize: data.length,
      bestConfigurations,
      insights: generatePerformanceInsights(bestConfigurations)
    };
    
  } catch (error) {
    console.error('Failed to get best performing configurations:', error);
    return null;
  }
}

/**
 * Get top performing states
 */
function getTopStates(outcomes) {
  const stateCounts = {};
  outcomes.forEach(o => {
    if (o.state_code) {
      stateCounts[o.state_code] = (stateCounts[o.state_code] || 0) + 1;
    }
  });
  
  return Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([state, count]) => ({ state, count }));
}

/**
 * Get top performing phases
 */
function getTopPhases(outcomes) {
  const phaseCounts = {};
  outcomes.forEach(o => {
    if (o.phase) {
      phaseCounts[o.phase] = (phaseCounts[o.phase] || 0) + 1;
    }
  });
  
  return Object.entries(phaseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([phase, count]) => ({ phase, count }));
}

/**
 * Generate insights from performance data
 */
function generatePerformanceInsights(configurations) {
  const insights = [];
  
  // Find highest performing claim type
  const sortedByRecovery = [...configurations].sort((a, b) => b.avgRecovery - a.avgRecovery);
  if (sortedByRecovery.length > 0 && sortedByRecovery[0].avgRecovery > 85) {
    insights.push({
      type: 'high_performer',
      claimType: sortedByRecovery[0].claimType,
      message: `${sortedByRecovery[0].claimType} claims show highest success rate (${sortedByRecovery[0].avgRecovery}% recovery)`,
      recommendation: 'Use this claim type as template for improving others'
    });
  }
  
  // Find lowest performing claim type
  if (sortedByRecovery.length > 0 && sortedByRecovery[sortedByRecovery.length - 1].avgRecovery < 70) {
    insights.push({
      type: 'low_performer',
      claimType: sortedByRecovery[sortedByRecovery.length - 1].claimType,
      message: `${sortedByRecovery[sortedByRecovery.length - 1].claimType} claims show lower success rate (${sortedByRecovery[sortedByRecovery.length - 1].avgRecovery}% recovery)`,
      recommendation: 'Review and improve prompts/playbooks for this claim type'
    });
  }
  
  return insights;
}

// ============================================================================
// OUTCOME PREDICTION
// ============================================================================

/**
 * Predict outcome likelihood based on quality scores
 * @param {Object} qualityScores - Citation and output quality scores
 * @param {string} claimType - Claim type
 * @returns {Object} - Prediction
 */
async function predictOutcome(qualityScores, claimType) {
  const { citationQualityScore, outputQualityScore } = qualityScores;
  
  try {
    // Get historical data for this claim type
    const successRate = await calculateSuccessRate({ claimType });
    const correlation = await analyzeQualityCorrelation();
    
    if (!successRate || !correlation || !correlation.sufficientData) {
      return {
        prediction: 'unknown',
        confidence: 0,
        message: 'Insufficient historical data for prediction'
      };
    }
    
    // Simple prediction model based on quality scores and historical success rate
    let predictedSuccessProbability = successRate.successRate;
    
    // Adjust based on citation quality
    if (citationQualityScore >= 95) {
      predictedSuccessProbability += 10;
    } else if (citationQualityScore < 80) {
      predictedSuccessProbability -= 15;
    }
    
    // Adjust based on output quality
    if (outputQualityScore >= 90) {
      predictedSuccessProbability += 10;
    } else if (outputQualityScore < 75) {
      predictedSuccessProbability -= 15;
    }
    
    // Cap at 0-100
    predictedSuccessProbability = Math.max(0, Math.min(100, predictedSuccessProbability));
    
    return {
      prediction: predictedSuccessProbability >= 70 ? 'likely_success' : 
                  predictedSuccessProbability >= 50 ? 'uncertain' : 'likely_failure',
      probability: Math.round(predictedSuccessProbability),
      confidence: correlation.sampleSize >= 30 ? 'high' : 
                  correlation.sampleSize >= 15 ? 'medium' : 'low',
      factors: {
        baselineSuccessRate: successRate.successRate,
        citationQualityScore,
        outputQualityScore,
        historicalSampleSize: correlation.sampleSize
      },
      recommendation: predictedSuccessProbability < 60 
        ? 'Consider improving letter quality before sending'
        : 'Letter quality is good - proceed with sending'
    };
    
  } catch (error) {
    console.error('Failed to predict outcome:', error);
    return {
      prediction: 'unknown',
      confidence: 0,
      message: 'Prediction failed'
    };
  }
}

// ============================================================================
// NETLIFY FUNCTION HANDLER
// ============================================================================

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
      },
      body: ''
    };
  }
  
  try {
    const path = event.path.replace('/.netlify/functions/outcome-tracking-system', '');
    const method = event.httpMethod;
    
    // GET /statistics - Get outcome statistics
    if (method === 'GET' && path === '/statistics') {
      const stats = await getOutcomeStatistics();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(stats)
      };
    }
    
    // GET /by-claim-type - Get success rate by claim type
    if (method === 'GET' && path === '/by-claim-type') {
      const stats = await getSuccessRateByClaimType();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(stats)
      };
    }
    
    // GET /correlation - Get quality correlation analysis
    if (method === 'GET' && path === '/correlation') {
      const analysis = await analyzeQualityCorrelation();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(analysis)
      };
    }
    
    // POST /create - Create outcome tracking
    if (method === 'POST' && path === '/create') {
      const params = JSON.parse(event.body || '{}');
      const result = await createOutcomeTracking(params);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // PUT /mark-sent - Mark letter as sent
    if (method === 'PUT' && path === '/mark-sent') {
      const { documentId, sentDate } = JSON.parse(event.body || '{}');
      const result = await markLetterSent(documentId, sentDate ? new Date(sentDate) : undefined);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // PUT /mark-response - Mark response received
    if (method === 'PUT' && path === '/mark-response') {
      const { documentId, responseDate } = JSON.parse(event.body || '{}');
      const result = await markResponseReceived(documentId, responseDate ? new Date(responseDate) : undefined);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // PUT /mark-resolved - Mark claim as resolved
    if (method === 'PUT' && path === '/mark-resolved') {
      const resolutionData = JSON.parse(event.body || '{}');
      const result = await markClaimResolved(resolutionData.documentId, resolutionData);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // POST /feedback - Submit user feedback
    if (method === 'POST' && path === '/feedback') {
      const { documentId, feedback } = JSON.parse(event.body || '{}');
      const result = await submitUserFeedback(documentId, feedback);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // POST /predict - Predict outcome
    if (method === 'POST' && path === '/predict') {
      const { qualityScores, claimType } = JSON.parse(event.body || '{}');
      const prediction = await predictOutcome(qualityScores, claimType);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(prediction)
      };
    }
    
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Endpoint not found' })
    };
    
  } catch (error) {
    console.error('Outcome tracking error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Outcome tracking failed',
        details: error.message
      })
    };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createOutcomeTracking,
  markLetterSent,
  markResponseReceived,
  markClaimResolved,
  submitUserFeedback,
  calculateSuccessRate,
  getSuccessRateByClaimType,
  analyzeQualityCorrelation,
  getOutcomeStatistics,
  getBestPerformingConfigurations,
  predictOutcome,
  OUTCOME_STATUSES,
  OUTCOME_RESULTS,
  RESOLUTION_TYPES
};
