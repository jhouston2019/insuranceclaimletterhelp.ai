/**
 * ROUTING ENGINE
 * 
 * Intelligent model selection based on:
 * - Claim value (low/medium/high)
 * - Operation type (analyze/generate/classify)
 * - Provider health status
 * - Cost optimization preferences
 * - Safety requirements
 */

const { 
  ROUTING_RULES, 
  COST_CONFIG, 
  getRoutingTier,
  getEnabledProviders 
} = require('./parity-config');

// ============================================================================
// ROUTING CONTEXT
// ============================================================================

/**
 * Build routing context from request
 * @param {Object} params - Request parameters
 * @returns {Object} - Routing context
 */
function buildRoutingContext(params) {
  const {
    claimAmount,
    operation,
    claimType,
    phase,
    riskLevel,
    optimizeFor = 'balanced'
  } = params;
  
  // Determine routing tier
  const tier = determineRoutingTier(claimAmount, riskLevel, phase);
  
  return {
    claimAmount: parseFloat(claimAmount) || 0,
    operation: operation || 'analyze',
    claimType,
    phase,
    riskLevel,
    tier,
    optimizeFor,
    timestamp: new Date().toISOString()
  };
}

/**
 * Determine routing tier
 * @param {number} claimAmount - Claim amount
 * @param {string} riskLevel - Risk level
 * @param {string} phase - Claim phase
 * @returns {string} - Routing tier
 */
function determineRoutingTier(claimAmount, riskLevel, phase) {
  // Critical operations always use critical tier
  if (riskLevel === 'critical' || riskLevel === 'hard_stop') {
    return 'critical';
  }
  
  // Hard-stop phases always use critical tier
  const criticalPhases = ['fraud_investigation', 'euo_request', 'recorded_statement', 'litigation'];
  if (criticalPhases.includes(phase)) {
    return 'critical';
  }
  
  // Otherwise use claim value
  return getRoutingTier(claimAmount);
}

// ============================================================================
// PROVIDER SELECTION
// ============================================================================

/**
 * Select provider and model for request
 * @param {Object} context - Routing context
 * @param {Object} healthStatus - Provider health status
 * @returns {Object} - Routing plan
 */
function selectProvider(context, healthStatus = {}) {
  const { tier, operation, optimizeFor } = context;
  
  // Get routing rule for tier and operation
  const routingRule = ROUTING_RULES[tier]?.[operation];
  
  if (!routingRule) {
    // Fallback to medium_value if tier not found
    const fallbackRule = ROUTING_RULES.medium_value?.[operation];
    if (!fallbackRule) {
      throw new Error(`No routing rule found for tier: ${tier}, operation: ${operation}`);
    }
    return buildRoutingPlan(fallbackRule, healthStatus, optimizeFor);
  }
  
  return buildRoutingPlan(routingRule, healthStatus, optimizeFor);
}

/**
 * Build routing plan with fallback chain
 * @param {Object} routingRule - Routing rule
 * @param {Object} healthStatus - Provider health status
 * @param {string} optimizeFor - Optimization preference
 * @returns {Object} - Routing plan
 */
function buildRoutingPlan(routingRule, healthStatus, optimizeFor) {
  const { primary, fallbacks } = routingRule;
  
  // Check if primary provider is healthy
  const primaryHealthy = isProviderHealthy(primary.provider, healthStatus);
  
  // If optimizing for cost and primary is unhealthy, try to find cheaper fallback
  if (!primaryHealthy && optimizeFor === 'cost') {
    const cheapestHealthy = findCheapestHealthyProvider([primary, ...fallbacks], healthStatus);
    if (cheapestHealthy) {
      return {
        primary: cheapestHealthy,
        fallbacks: buildFallbackChain([primary, ...fallbacks], cheapestHealthy, healthStatus),
        reason: 'cost_optimization_with_health_check'
      };
    }
  }
  
  // Standard routing: primary + fallbacks
  if (primaryHealthy) {
    return {
      primary,
      fallbacks: buildFallbackChain(fallbacks, primary, healthStatus),
      reason: 'standard_routing'
    };
  }
  
  // Primary unhealthy - use first healthy fallback
  const healthyFallback = fallbacks.find(f => isProviderHealthy(f.provider, healthStatus));
  
  if (!healthyFallback) {
    // No healthy providers - use primary anyway and let failover handle it
    return {
      primary,
      fallbacks: fallbacks.filter(f => f.provider !== primary.provider),
      reason: 'no_healthy_providers_available',
      warning: 'All providers may be unhealthy'
    };
  }
  
  return {
    primary: healthyFallback,
    fallbacks: buildFallbackChain(
      [primary, ...fallbacks.filter(f => f.provider !== healthyFallback.provider)],
      healthyFallback,
      healthStatus
    ),
    reason: 'primary_unhealthy_using_fallback'
  };
}

/**
 * Build fallback chain excluding primary
 * @param {Array} candidates - Candidate providers
 * @param {Object} primary - Primary provider
 * @param {Object} healthStatus - Health status
 * @returns {Array} - Fallback chain
 */
function buildFallbackChain(candidates, primary, healthStatus) {
  return candidates
    .filter(candidate => candidate.provider !== primary.provider)
    .filter(candidate => isProviderHealthy(candidate.provider, healthStatus))
    .slice(0, 2);  // Max 2 fallbacks
}

/**
 * Check if provider is healthy
 * @param {string} provider - Provider name
 * @param {Object} healthStatus - Health status map
 * @returns {boolean}
 */
function isProviderHealthy(provider, healthStatus) {
  if (!healthStatus || Object.keys(healthStatus).length === 0) {
    return true;  // Assume healthy if no health data
  }
  
  const status = healthStatus[provider];
  return status?.healthy !== false;
}

/**
 * Find cheapest healthy provider
 * @param {Array} providers - Provider options
 * @param {Object} healthStatus - Health status
 * @returns {Object} - Cheapest healthy provider
 */
function findCheapestHealthyProvider(providers, healthStatus) {
  const healthy = providers.filter(p => isProviderHealthy(p.provider, healthStatus));
  
  if (healthy.length === 0) return null;
  
  // Sort by cost (model tier as proxy)
  // mini < standard < advanced
  const tierCost = { mini: 1, standard: 2, advanced: 3 };
  
  healthy.sort((a, b) => {
    const aCost = tierCost[a.model] || 2;
    const bCost = tierCost[b.model] || 2;
    return aCost - bCost;
  });
  
  return healthy[0];
}

// ============================================================================
// COST-BASED ROUTING
// ============================================================================

/**
 * Select provider optimized for cost
 * @param {Object} context - Routing context
 * @param {Object} healthStatus - Provider health status
 * @returns {Object} - Routing plan
 */
function selectCostOptimizedProvider(context, healthStatus) {
  const { operation } = context;
  
  // Always use cheapest models for cost optimization
  const lowValueRule = ROUTING_RULES.low_value[operation];
  
  return buildRoutingPlan(lowValueRule, healthStatus, 'cost');
}

/**
 * Select provider optimized for quality
 * @param {Object} context - Routing context
 * @param {Object} healthStatus - Provider health status
 * @returns {Object} - Routing plan
 */
function selectQualityOptimizedProvider(context, healthStatus) {
  const { operation } = context;
  
  // Always use best models for quality optimization
  const highValueRule = ROUTING_RULES.high_value[operation];
  
  return buildRoutingPlan(highValueRule, healthStatus, 'quality');
}

/**
 * Select provider optimized for latency
 * @param {Object} context - Routing context
 * @param {Object} healthStatus - Provider health status
 * @returns {Object} - Routing plan
 */
function selectLatencyOptimizedProvider(context, healthStatus) {
  // Use fastest provider based on health status latency data
  const enabledProviders = getEnabledProviders();
  
  const providerLatencies = enabledProviders.map(provider => ({
    provider,
    latency: healthStatus[provider]?.avgLatency || 3000
  }));
  
  providerLatencies.sort((a, b) => a.latency - b.latency);
  
  const fastest = providerLatencies[0];
  
  return {
    primary: { provider: fastest.provider, model: 'mini' },
    fallbacks: providerLatencies.slice(1, 3).map(p => ({ provider: p.provider, model: 'mini' })),
    reason: 'latency_optimization'
  };
}

// ============================================================================
// ROUTING DECISION
// ============================================================================

/**
 * Make routing decision
 * @param {Object} context - Routing context
 * @param {Object} healthStatus - Provider health status
 * @returns {Object} - Routing plan
 */
function routeRequest(context, healthStatus = {}) {
  const { optimizeFor } = context;
  
  // Cost optimization enabled?
  if (COST_CONFIG.enabled && COST_CONFIG.optimizationMode === 'cost') {
    return selectCostOptimizedProvider(context, healthStatus);
  }
  
  // Quality optimization?
  if (optimizeFor === 'quality') {
    return selectQualityOptimizedProvider(context, healthStatus);
  }
  
  // Latency optimization?
  if (optimizeFor === 'latency') {
    return selectLatencyOptimizedProvider(context, healthStatus);
  }
  
  // Standard value-based routing
  return selectProvider(context, healthStatus);
}

// ============================================================================
// ROUTING ANALYTICS
// ============================================================================

/**
 * Analyze routing decision
 * @param {Object} routingPlan - Routing plan
 * @param {Object} context - Routing context
 * @returns {Object} - Routing analysis
 */
function analyzeRoutingDecision(routingPlan, context) {
  return {
    tier: context.tier,
    operation: context.operation,
    claimAmount: context.claimAmount,
    
    selected: {
      provider: routingPlan.primary.provider,
      model: routingPlan.primary.model,
      reason: routingPlan.reason
    },
    
    fallbackCount: routingPlan.fallbacks.length,
    fallbacks: routingPlan.fallbacks.map(f => f.provider),
    
    warning: routingPlan.warning,
    
    timestamp: new Date().toISOString()
  };
}

/**
 * Get routing statistics
 * @param {Array} routingHistory - Array of past routing decisions
 * @returns {Object} - Routing statistics
 */
function getRoutingStatistics(routingHistory) {
  if (!routingHistory || routingHistory.length === 0) {
    return { message: 'No routing history available' };
  }
  
  const providerCounts = {};
  const tierCounts = {};
  const operationCounts = {};
  
  for (const decision of routingHistory) {
    providerCounts[decision.selected.provider] = (providerCounts[decision.selected.provider] || 0) + 1;
    tierCounts[decision.tier] = (tierCounts[decision.tier] || 0) + 1;
    operationCounts[decision.operation] = (operationCounts[decision.operation] || 0) + 1;
  }
  
  return {
    totalRequests: routingHistory.length,
    providerDistribution: providerCounts,
    tierDistribution: tierCounts,
    operationDistribution: operationCounts,
    
    mostUsedProvider: Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
    mostUsedTier: Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  buildRoutingContext,
  determineRoutingTier,
  selectProvider,
  buildRoutingPlan,
  routeRequest,
  selectCostOptimizedProvider,
  selectQualityOptimizedProvider,
  selectLatencyOptimizedProvider,
  analyzeRoutingDecision,
  getRoutingStatistics,
  
  // For testing
  isProviderHealthy,
  findCheapestHealthyProvider,
  buildFallbackChain
};
