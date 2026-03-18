/**
 * COST OPTIMIZER
 * 
 * Tracks AI costs and optimizes provider selection for cost efficiency.
 * 
 * FEATURES:
 * - Real-time cost tracking per request
 * - Cost-to-claim-value ratio monitoring
 * - Cost alerts and thresholds
 * - Savings calculation from optimization
 * - Provider cost comparison
 */

const { COST_CONFIG, calculateCost } = require('./parity-config');
const { getSupabaseAdmin } = require('../_supabase');

// ============================================================================
// COST TRACKING
// ============================================================================

/**
 * Track cost for AI request
 * @param {Object} response - Provider response with cost data
 * @param {Object} context - Request context (claim amount, operation, etc.)
 * @returns {Object} - Cost tracking result
 */
async function trackCost(response, context = {}) {
  const {
    letterId,
    claimAmount,
    operation,
    userId
  } = context;
  
  const costData = {
    letter_id: letterId,
    user_id: userId,
    provider: response.provider,
    model: response.model,
    operation: operation || 'unknown',
    
    input_tokens: response.tokens.input,
    output_tokens: response.tokens.output,
    total_tokens: response.tokens.total,
    
    cost_usd: response.cost,
    claim_amount: claimAmount ? parseFloat(claimAmount) : null,
    
    latency_ms: response.latency,
    cached: response.cached || false,
    
    failover_occurred: response.failover?.occurred || false,
    attempt_count: response.failover?.attemptCount || 1,
    
    created_at: new Date().toISOString()
  };
  
  // Calculate cost ratio
  if (claimAmount && claimAmount > 0) {
    costData.cost_ratio = response.cost / parseFloat(claimAmount);
    
    // Check if cost ratio exceeds threshold
    if (costData.cost_ratio > COST_CONFIG.maxCostRatio) {
      console.warn(`⚠️ High cost ratio: $${response.cost} for $${claimAmount} claim (${(costData.cost_ratio * 100).toFixed(3)}%)`);
    }
  }
  
  // Save to database
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('ai_costs')
      .insert(costData);
    
    if (error) throw error;
    
    console.log(`Cost tracked: $${response.cost.toFixed(6)} (${response.provider}/${response.model})`);
    
  } catch (error) {
    console.error('Failed to track cost:', error.message);
  }
  
  return {
    cost: response.cost,
    costRatio: costData.cost_ratio,
    withinBudget: response.cost <= COST_CONFIG.maxCostPerRequest,
    ratioAcceptable: !costData.cost_ratio || costData.cost_ratio <= COST_CONFIG.maxCostRatio
  };
}

/**
 * Calculate savings from optimization
 * @param {Object} response - Actual response used
 * @param {Object} routingPlan - Routing plan
 * @returns {Object} - Savings calculation
 */
function calculateSavings(response, routingPlan) {
  // Calculate what it would have cost with primary provider
  const primaryCost = estimateCost(
    routingPlan.primary.provider,
    routingPlan.primary.model,
    response.tokens.input,
    response.tokens.output
  );
  
  const actualCost = response.cost;
  const savings = primaryCost - actualCost;
  
  return {
    primaryCost,
    actualCost,
    savings,
    savingsPercentage: primaryCost > 0 ? (savings / primaryCost) * 100 : 0,
    optimized: savings > 0
  };
}

/**
 * Estimate cost for provider/model
 * @param {string} provider - Provider name
 * @param {string} modelTier - Model tier
 * @param {number} inputTokens - Input tokens
 * @param {number} outputTokens - Output tokens
 * @returns {number} - Estimated cost
 */
function estimateCost(provider, modelTier, inputTokens, outputTokens) {
  return calculateCost(provider, modelTier, inputTokens, outputTokens);
}

// ============================================================================
// COST ANALYTICS
// ============================================================================

/**
 * Get cost statistics for time period
 * @param {string} period - Time period (day, week, month)
 * @returns {Object} - Cost statistics
 */
async function getCostStatistics(period = 'day') {
  try {
    const supabase = getSupabaseAdmin();
    
    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 1);
    }
    
    // Get cost data
    const { data, error } = await supabase
      .from('ai_costs')
      .select('*')
      .gte('created_at', startDate.toISOString());
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        period,
        totalCost: 0,
        requestCount: 0,
        message: 'No cost data for period'
      };
    }
    
    // Calculate statistics
    const totalCost = data.reduce((sum, row) => sum + parseFloat(row.cost_usd), 0);
    const totalTokens = data.reduce((sum, row) => sum + row.total_tokens, 0);
    const avgCost = totalCost / data.length;
    
    // Group by provider
    const byProvider = {};
    for (const row of data) {
      if (!byProvider[row.provider]) {
        byProvider[row.provider] = { count: 0, cost: 0, tokens: 0 };
      }
      byProvider[row.provider].count++;
      byProvider[row.provider].cost += parseFloat(row.cost_usd);
      byProvider[row.provider].tokens += row.total_tokens;
    }
    
    // Group by operation
    const byOperation = {};
    for (const row of data) {
      if (!byOperation[row.operation]) {
        byOperation[row.operation] = { count: 0, cost: 0 };
      }
      byOperation[row.operation].count++;
      byOperation[row.operation].cost += parseFloat(row.cost_usd);
    }
    
    // Calculate savings from optimization
    const optimizedRequests = data.filter(row => row.failover_occurred);
    const totalSavings = optimizedRequests.reduce((sum, row) => {
      // Estimate savings (simplified)
      return sum + (parseFloat(row.cost_usd) * 0.2);  // Assume 20% savings
    }, 0);
    
    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      
      totalCost: parseFloat(totalCost.toFixed(4)),
      requestCount: data.length,
      avgCostPerRequest: parseFloat(avgCost.toFixed(6)),
      totalTokens,
      
      byProvider,
      byOperation,
      
      optimization: {
        optimizedRequests: optimizedRequests.length,
        estimatedSavings: parseFloat(totalSavings.toFixed(4)),
        savingsPercentage: totalCost > 0 ? (totalSavings / totalCost) * 100 : 0
      },
      
      alerts: checkCostAlerts(totalCost, period)
    };
    
  } catch (error) {
    console.error('Failed to get cost statistics:', error);
    return { error: error.message };
  }
}

/**
 * Check if cost exceeds alert thresholds
 * @param {number} totalCost - Total cost for period
 * @param {string} period - Time period
 * @returns {Array} - Array of alerts
 */
function checkCostAlerts(totalCost, period) {
  const alerts = [];
  const thresholds = COST_CONFIG.alertThresholds;
  
  if (period === 'day' && totalCost > thresholds.daily) {
    alerts.push({
      severity: 'warning',
      message: `Daily cost ($${totalCost.toFixed(2)}) exceeds threshold ($${thresholds.daily})`,
      threshold: thresholds.daily,
      actual: totalCost
    });
  }
  
  if (period === 'week' && totalCost > thresholds.weekly) {
    alerts.push({
      severity: 'warning',
      message: `Weekly cost ($${totalCost.toFixed(2)}) exceeds threshold ($${thresholds.weekly})`,
      threshold: thresholds.weekly,
      actual: totalCost
    });
  }
  
  if (period === 'month' && totalCost > thresholds.monthly) {
    alerts.push({
      severity: 'critical',
      message: `Monthly cost ($${totalCost.toFixed(2)}) exceeds threshold ($${thresholds.monthly})`,
      threshold: thresholds.monthly,
      actual: totalCost
    });
  }
  
  return alerts;
}

/**
 * Get cost comparison across providers
 * @param {number} inputTokens - Estimated input tokens
 * @param {number} outputTokens - Estimated output tokens
 * @returns {Object} - Cost comparison
 */
function compareCosts(inputTokens, outputTokens) {
  const providers = ['openai', 'anthropic', 'google'];
  const modelTiers = ['mini', 'standard', 'advanced'];
  
  const comparison = {};
  
  for (const provider of providers) {
    comparison[provider] = {};
    
    for (const tier of modelTiers) {
      const cost = calculateCost(provider, tier, inputTokens, outputTokens);
      comparison[provider][tier] = {
        cost: parseFloat(cost.toFixed(6)),
        costPer1KTokens: parseFloat(((cost / (inputTokens + outputTokens)) * 1000).toFixed(6))
      };
    }
  }
  
  // Find cheapest option
  let cheapest = null;
  let lowestCost = Infinity;
  
  for (const provider of providers) {
    for (const tier of modelTiers) {
      const cost = comparison[provider][tier].cost;
      if (cost < lowestCost) {
        lowestCost = cost;
        cheapest = { provider, tier, cost };
      }
    }
  }
  
  return {
    comparison,
    cheapest,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}

/**
 * Validate cost is within budget
 * @param {number} cost - Request cost
 * @param {number} claimAmount - Claim amount
 * @returns {Object} - Validation result
 */
function validateCost(cost, claimAmount) {
  const issues = [];
  
  // Check absolute cost limit
  if (cost > COST_CONFIG.maxCostPerRequest) {
    issues.push({
      type: 'cost_limit_exceeded',
      severity: 'critical',
      message: `Cost ($${cost.toFixed(6)}) exceeds limit ($${COST_CONFIG.maxCostPerRequest})`,
      cost,
      limit: COST_CONFIG.maxCostPerRequest
    });
  }
  
  // Check cost-to-claim ratio
  if (claimAmount && claimAmount > 0) {
    const ratio = cost / claimAmount;
    
    if (ratio > COST_CONFIG.maxCostRatio) {
      issues.push({
        type: 'cost_ratio_exceeded',
        severity: 'warning',
        message: `Cost ratio (${(ratio * 100).toFixed(3)}%) exceeds limit (${(COST_CONFIG.maxCostRatio * 100).toFixed(3)}%)`,
        ratio,
        limit: COST_CONFIG.maxCostRatio
      });
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    cost,
    withinBudget: cost <= COST_CONFIG.maxCostPerRequest
  };
}

// ============================================================================
// COST OPTIMIZATION RECOMMENDATIONS
// ============================================================================

/**
 * Generate cost optimization recommendations
 * @param {Object} costStats - Cost statistics
 * @returns {Array} - Recommendations
 */
function generateCostRecommendations(costStats) {
  const recommendations = [];
  
  if (!costStats || !costStats.byProvider) {
    return recommendations;
  }
  
  // Find most expensive provider
  const providerCosts = Object.entries(costStats.byProvider)
    .map(([provider, data]) => ({ provider, cost: data.cost, count: data.count }))
    .sort((a, b) => b.cost - a.cost);
  
  if (providerCosts.length > 1) {
    const mostExpensive = providerCosts[0];
    const cheapest = providerCosts[providerCosts.length - 1];
    
    const potentialSavings = mostExpensive.cost - cheapest.cost;
    
    if (potentialSavings > 1.00) {
      recommendations.push({
        type: 'switch_provider',
        priority: 'high',
        message: `Switching from ${mostExpensive.provider} to ${cheapest.provider} could save $${potentialSavings.toFixed(2)}`,
        savings: potentialSavings,
        action: `Route more requests to ${cheapest.provider}`
      });
    }
  }
  
  // Check if using expensive models unnecessarily
  const avgCost = costStats.avgCostPerRequest;
  if (avgCost > COST_CONFIG.targetCostPerRequest * 2) {
    recommendations.push({
      type: 'reduce_model_tier',
      priority: 'medium',
      message: `Average cost ($${avgCost.toFixed(6)}) is 2x target. Consider using cheaper models for low-value claims.`,
      action: 'Enable cost optimization routing'
    });
  }
  
  // Check daily/weekly/monthly thresholds
  if (costStats.alerts && costStats.alerts.length > 0) {
    for (const alert of costStats.alerts) {
      recommendations.push({
        type: 'cost_threshold_exceeded',
        priority: alert.severity,
        message: alert.message,
        action: 'Review cost optimization settings or increase budget'
      });
    }
  }
  
  return recommendations;
}

/**
 * Calculate potential savings from optimization
 * @param {Object} currentStats - Current cost statistics
 * @returns {Object} - Savings projection
 */
function calculatePotentialSavings(currentStats) {
  if (!currentStats || !currentStats.byProvider) {
    return { message: 'Insufficient data for savings calculation' };
  }
  
  // Calculate what costs would be if all requests used cheapest provider
  const providerCosts = Object.entries(currentStats.byProvider);
  
  if (providerCosts.length === 0) {
    return { message: 'No provider data available' };
  }
  
  // Find cheapest provider per request
  const cheapestPerRequest = providerCosts
    .map(([provider, data]) => ({
      provider,
      avgCostPerRequest: data.cost / data.count
    }))
    .sort((a, b) => a.avgCostPerRequest - b.avgCostPerRequest)[0];
  
  // Calculate savings if all requests used cheapest
  const totalRequests = currentStats.requestCount;
  const currentTotalCost = currentStats.totalCost;
  const optimizedTotalCost = cheapestPerRequest.avgCostPerRequest * totalRequests;
  const potentialSavings = currentTotalCost - optimizedTotalCost;
  
  return {
    currentCost: currentTotalCost,
    optimizedCost: optimizedTotalCost,
    potentialSavings: Math.max(0, potentialSavings),
    savingsPercentage: currentTotalCost > 0 ? (potentialSavings / currentTotalCost) * 100 : 0,
    cheapestProvider: cheapestPerRequest.provider,
    recommendation: potentialSavings > 1.00 
      ? `Enable cost optimization to save ~$${potentialSavings.toFixed(2)} per ${currentStats.period}`
      : 'Current routing is already cost-efficient'
  };
}

// ============================================================================
// COST ALERTS
// ============================================================================

/**
 * Check for cost alerts
 * @param {Object} costData - Cost data for request
 * @returns {Array} - Array of alerts
 */
function checkCostAlertsForRequest(costData) {
  const alerts = [];
  
  // Check absolute cost
  if (costData.cost_usd > COST_CONFIG.maxCostPerRequest) {
    alerts.push({
      type: 'cost_limit_exceeded',
      severity: 'critical',
      message: `Request cost ($${costData.cost_usd.toFixed(6)}) exceeds limit ($${COST_CONFIG.maxCostPerRequest})`,
      cost: costData.cost_usd,
      limit: COST_CONFIG.maxCostPerRequest
    });
  }
  
  // Check cost ratio
  if (costData.cost_ratio && costData.cost_ratio > COST_CONFIG.maxCostRatio) {
    alerts.push({
      type: 'cost_ratio_high',
      severity: 'warning',
      message: `Cost ratio (${(costData.cost_ratio * 100).toFixed(3)}%) exceeds recommended limit (${(COST_CONFIG.maxCostRatio * 100).toFixed(3)}%)`,
      ratio: costData.cost_ratio,
      limit: COST_CONFIG.maxCostRatio
    });
  }
  
  // Check if expensive model used for low-value claim
  if (costData.claim_amount && costData.claim_amount < 10000 && costData.cost_usd > 0.002) {
    alerts.push({
      type: 'expensive_model_for_low_value',
      severity: 'info',
      message: `Using expensive model ($${costData.cost_usd.toFixed(6)}) for low-value claim ($${costData.claim_amount})`,
      recommendation: 'Consider using cheaper model for low-value claims'
    });
  }
  
  return alerts;
}

/**
 * Send cost alert notification
 * @param {Object} alert - Alert object
 */
async function sendCostAlert(alert) {
  // Log to console
  console.warn(`💰 COST ALERT [${alert.severity}]: ${alert.message}`);
  
  // Save to database
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('ai_cost_alerts').insert({
      alert_type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metadata: alert,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to save cost alert:', error.message);
  }
  
  // TODO: Send email/Slack notification for critical alerts
  if (alert.severity === 'critical') {
    console.error('🚨 CRITICAL COST ALERT - Manual review required');
  }
}

// ============================================================================
// COST PROJECTION
// ============================================================================

/**
 * Project costs for expected volume
 * @param {number} requestsPerDay - Expected requests per day
 * @param {string} routingStrategy - Routing strategy (cost, balanced, quality)
 * @returns {Object} - Cost projection
 */
function projectCosts(requestsPerDay, routingStrategy = 'balanced') {
  // Estimate average cost per request based on strategy
  const avgCostEstimates = {
    cost: 0.0003,      // Using cheapest models
    balanced: 0.0005,  // Mix of models
    quality: 0.0015    // Using premium models
  };
  
  const avgCost = avgCostEstimates[routingStrategy] || avgCostEstimates.balanced;
  
  const dailyCost = requestsPerDay * avgCost;
  const weeklyCost = dailyCost * 7;
  const monthlyCost = dailyCost * 30;
  const yearlyCost = dailyCost * 365;
  
  return {
    strategy: routingStrategy,
    requestsPerDay,
    avgCostPerRequest: avgCost,
    
    projections: {
      daily: parseFloat(dailyCost.toFixed(2)),
      weekly: parseFloat(weeklyCost.toFixed(2)),
      monthly: parseFloat(monthlyCost.toFixed(2)),
      yearly: parseFloat(yearlyCost.toFixed(2))
    },
    
    atScale: {
      requests100PerDay: {
        monthly: parseFloat((100 * avgCost * 30).toFixed(2)),
        yearly: parseFloat((100 * avgCost * 365).toFixed(2))
      },
      requests1000PerDay: {
        monthly: parseFloat((1000 * avgCost * 30).toFixed(2)),
        yearly: parseFloat((1000 * avgCost * 365).toFixed(2))
      },
      requests10000PerDay: {
        monthly: parseFloat((10000 * avgCost * 30).toFixed(2)),
        yearly: parseFloat((10000 * avgCost * 365).toFixed(2))
      }
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  trackCost,
  calculateSavings,
  estimateCost,
  getCostStatistics,
  checkCostAlertsForRequest,
  sendCostAlert,
  generateCostRecommendations,
  calculatePotentialSavings,
  projectCosts,
  compareCosts,
  validateCost
};
