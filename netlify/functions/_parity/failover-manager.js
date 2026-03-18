/**
 * FAILOVER MANAGER
 * 
 * Handles automatic retry with exponential backoff and provider failover.
 * Implements circuit breaker pattern to protect against cascading failures.
 * 
 * FEATURES:
 * - Automatic retry on transient errors
 * - Exponential backoff with jitter
 * - Provider failover chain
 * - Circuit breaker protection
 * - Comprehensive error tracking
 */

const { RETRY_CONFIG, CIRCUIT_BREAKER_CONFIG } = require('./parity-config');
const { createAdapter } = require('./provider-adapters');

// ============================================================================
// CIRCUIT BREAKER STATE
// ============================================================================

const circuitBreakerState = {
  openai: { failures: 0, lastFailure: null, state: 'closed', requestCount: 0 },
  anthropic: { failures: 0, lastFailure: null, state: 'closed', requestCount: 0 },
  google: { failures: 0, lastFailure: null, state: 'closed', requestCount: 0 }
};

/**
 * Check circuit breaker state
 * @param {string} provider - Provider name
 * @returns {boolean} - True if circuit is closed (provider usable)
 */
function isCircuitClosed(provider) {
  if (!CIRCUIT_BREAKER_CONFIG.enabled) {
    return true;  // Circuit breaker disabled
  }
  
  const state = circuitBreakerState[provider];
  if (!state) return true;
  
  // Check if circuit is open
  if (state.state === 'open') {
    const timeSinceFailure = Date.now() - state.lastFailure;
    
    // Attempt recovery after timeout
    if (timeSinceFailure > CIRCUIT_BREAKER_CONFIG.recoveryTimeout) {
      state.state = 'half-open';
      state.failures = 0;
      console.log(`Circuit breaker for ${provider} entering half-open state (recovery attempt)`);
      return true;
    }
    
    return false;  // Circuit still open
  }
  
  return true;  // Circuit closed or half-open
}

/**
 * Record success for circuit breaker
 * @param {string} provider - Provider name
 */
function recordSuccess(provider) {
  const state = circuitBreakerState[provider];
  if (!state) return;
  
  state.requestCount++;
  
  // If in half-open state, close circuit on success
  if (state.state === 'half-open') {
    state.state = 'closed';
    state.failures = 0;
    console.log(`Circuit breaker for ${provider} closed (recovery successful)`);
  }
}

/**
 * Record failure for circuit breaker
 * @param {string} provider - Provider name
 */
function recordFailure(provider) {
  const state = circuitBreakerState[provider];
  if (!state) return;
  
  state.requestCount++;
  state.failures++;
  state.lastFailure = Date.now();
  
  // Check if should open circuit
  const { failureThreshold, minimumRequests } = CIRCUIT_BREAKER_CONFIG;
  
  if (state.requestCount >= minimumRequests && state.failures >= failureThreshold) {
    state.state = 'open';
    console.error(`Circuit breaker for ${provider} OPENED (${state.failures} failures)`);
  }
}

/**
 * Reset circuit breaker for provider
 * @param {string} provider - Provider name
 */
function resetCircuitBreaker(provider) {
  if (circuitBreakerState[provider]) {
    circuitBreakerState[provider] = {
      failures: 0,
      lastFailure: null,
      state: 'closed',
      requestCount: 0
    };
    console.log(`Circuit breaker for ${provider} reset`);
  }
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Calculate backoff delay
 * @param {number} attemptNumber - Current attempt number (0-indexed)
 * @returns {number} - Delay in milliseconds
 */
function calculateBackoffDelay(attemptNumber) {
  const { initialDelay, backoffMultiplier, maxDelay, jitter } = RETRY_CONFIG;
  
  // Exponential backoff: delay * (multiplier ^ attempt)
  let delay = initialDelay * Math.pow(backoffMultiplier, attemptNumber);
  
  // Cap at max delay
  delay = Math.min(delay, maxDelay);
  
  // Add jitter (±25% randomness)
  if (jitter) {
    const jitterAmount = delay * 0.25;
    delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
  }
  
  return Math.round(delay);
}

/**
 * Check if error is retryable
 * @param {Object} error - Normalized error
 * @returns {boolean}
 */
function isRetryableError(error) {
  if (!error) return false;
  
  // Check if explicitly marked as retryable
  if (error.retryable === true) return true;
  if (error.retryable === false) return false;
  
  // Check error type
  const { retryableErrors } = RETRY_CONFIG;
  if (retryableErrors.includes(error.type)) return true;
  
  // Check status code
  if (error.statusCode && RETRY_CONFIG.retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }
  
  return false;
}

/**
 * Sleep for specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// FAILOVER EXECUTION
// ============================================================================

/**
 * Execute request with automatic failover
 * @param {Object} request - Unified request
 * @param {Object} routingPlan - Routing plan with primary and fallbacks
 * @returns {Object} - Response or throws error
 */
async function executeWithFailover(request, routingPlan) {
  const attempts = [];
  let lastError = null;
  
  // Build execution chain: primary + fallbacks
  const executionChain = [routingPlan.primary, ...routingPlan.fallbacks];
  
  for (let i = 0; i < executionChain.length && i < RETRY_CONFIG.maxAttempts; i++) {
    const target = executionChain[i];
    const { provider, model } = target;
    
    // Check circuit breaker
    if (!isCircuitClosed(provider)) {
      console.log(`Circuit breaker open for ${provider}, skipping`);
      attempts.push({
        provider,
        model,
        skipped: true,
        reason: 'circuit_breaker_open'
      });
      continue;
    }
    
    // Add backoff delay (except for first attempt)
    if (i > 0) {
      const delay = calculateBackoffDelay(i - 1);
      console.log(`Waiting ${delay}ms before retry ${i + 1}...`);
      await sleep(delay);
    }
    
    try {
      console.log(`Attempt ${i + 1}: Using ${provider} (${model})`);
      
      const adapter = createAdapter(provider);
      const response = await adapter.complete({
        ...request,
        modelTier: model
      });
      
      // Success!
      recordSuccess(provider);
      
      const attemptInfo = {
        provider,
        model,
        success: true,
        latency: response.latency,
        cost: response.cost,
        attemptNumber: i + 1
      };
      
      attempts.push(attemptInfo);
      
      // Log failover if not using primary
      if (i > 0) {
        console.log(`FAILOVER SUCCESS: ${routingPlan.primary.provider} → ${provider}`);
      }
      
      return {
        ...response,
        failover: {
          occurred: i > 0,
          attemptCount: i + 1,
          attempts,
          primaryProvider: routingPlan.primary.provider,
          usedProvider: provider
        }
      };
      
    } catch (error) {
      lastError = error;
      recordFailure(provider);
      
      const attemptInfo = {
        provider,
        model,
        success: false,
        error: error.error || error.message,
        errorType: error.type,
        retryable: isRetryableError(error),
        attemptNumber: i + 1
      };
      
      attempts.push(attemptInfo);
      
      console.error(`Attempt ${i + 1} failed (${provider}):`, error.error || error.message);
      
      // If error is not retryable, stop immediately
      if (!isRetryableError(error)) {
        console.log('Error is not retryable, stopping failover chain');
        break;
      }
      
      // Continue to next provider
    }
  }
  
  // All attempts failed
  throw {
    error: 'All providers failed',
    message: 'Request failed after trying all available providers',
    attempts,
    lastError,
    primaryProvider: routingPlan.primary.provider,
    totalAttempts: attempts.length,
    retryable: false
  };
}

// ============================================================================
// PARALLEL EXECUTION (FOR CONSENSUS)
// ============================================================================

/**
 * Execute request on multiple providers in parallel
 * Used for safety-critical operations requiring consensus
 * 
 * @param {Object} request - Unified request
 * @param {Array} providers - Array of {provider, model} objects
 * @returns {Array} - Array of responses
 */
async function executeParallel(request, providers) {
  const promises = providers.map(async ({ provider, model }) => {
    try {
      const adapter = createAdapter(provider);
      const response = await adapter.complete({
        ...request,
        modelTier: model
      });
      
      recordSuccess(provider);
      return response;
      
    } catch (error) {
      recordFailure(provider);
      
      return {
        provider,
        model,
        error: true,
        errorMessage: error.error || error.message,
        errorType: error.type
      };
    }
  });
  
  const results = await Promise.all(promises);
  
  // Filter out errors
  const successful = results.filter(r => !r.error);
  
  if (successful.length === 0) {
    throw {
      error: 'All parallel requests failed',
      message: 'All providers failed in parallel execution',
      results
    };
  }
  
  return successful;
}

// ============================================================================
// FAILOVER ANALYTICS
// ============================================================================

/**
 * Analyze failover event
 * @param {Object} failoverResult - Result with failover info
 * @returns {Object} - Failover analysis
 */
function analyzeFailover(failoverResult) {
  const { failover } = failoverResult;
  
  if (!failover || !failover.occurred) {
    return {
      occurred: false,
      message: 'No failover occurred - primary provider succeeded'
    };
  }
  
  const failedAttempts = failover.attempts.filter(a => !a.success);
  const successfulAttempt = failover.attempts.find(a => a.success);
  
  return {
    occurred: true,
    primaryProvider: failover.primaryProvider,
    usedProvider: failover.usedProvider,
    attemptCount: failover.attemptCount,
    
    failedProviders: failedAttempts.map(a => a.provider),
    failureReasons: failedAttempts.map(a => a.errorType),
    
    successfulProvider: successfulAttempt?.provider,
    successLatency: successfulAttempt?.latency,
    successCost: successfulAttempt?.cost,
    
    totalLatency: failover.attempts.reduce((sum, a) => sum + (a.latency || 0), 0),
    
    recommendation: generateFailoverRecommendation(failover)
  };
}

/**
 * Generate recommendation from failover
 */
function generateFailoverRecommendation(failover) {
  const failedPrimary = failover.attempts[0];
  
  if (failedPrimary.errorType === 'RATE_LIMIT_EXCEEDED') {
    return {
      action: 'increase_rate_limits',
      message: `${failedPrimary.provider} rate limit exceeded. Consider upgrading plan or distributing load.`
    };
  }
  
  if (failedPrimary.errorType === 'SERVER_ERROR') {
    return {
      action: 'monitor_provider',
      message: `${failedPrimary.provider} experiencing server errors. Monitor for ongoing issues.`
    };
  }
  
  if (failedPrimary.errorType === 'INVALID_API_KEY') {
    return {
      action: 'check_credentials',
      message: `${failedPrimary.provider} API key invalid. Update credentials immediately.`,
      severity: 'critical'
    };
  }
  
  return {
    action: 'continue_monitoring',
    message: 'Failover successful. Continue monitoring provider health.'
  };
}

/**
 * Get failover statistics
 * @param {Array} failoverHistory - Array of past failover events
 * @returns {Object} - Failover statistics
 */
function getFailoverStatistics(failoverHistory) {
  if (!failoverHistory || failoverHistory.length === 0) {
    return {
      totalFailovers: 0,
      message: 'No failover events recorded'
    };
  }
  
  const providerFailures = {};
  const errorTypes = {};
  
  for (const event of failoverHistory) {
    const failedAttempts = event.attempts.filter(a => !a.success);
    
    for (const attempt of failedAttempts) {
      providerFailures[attempt.provider] = (providerFailures[attempt.provider] || 0) + 1;
      errorTypes[attempt.errorType] = (errorTypes[attempt.errorType] || 0) + 1;
    }
  }
  
  return {
    totalFailovers: failoverHistory.length,
    failoverRate: (failoverHistory.length / (failoverHistory.length + 1000)) * 100,  // Approximate
    
    providerFailures,
    mostUnreliableProvider: Object.entries(providerFailures).sort((a, b) => b[1] - a[1])[0]?.[0],
    
    errorTypes,
    mostCommonError: Object.entries(errorTypes).sort((a, b) => b[1] - a[1])[0]?.[0],
    
    avgAttempts: failoverHistory.reduce((sum, e) => sum + e.attemptCount, 0) / failoverHistory.length,
    
    recommendations: generateFailoverRecommendations(providerFailures, errorTypes)
  };
}

/**
 * Generate recommendations from failover statistics
 */
function generateFailoverRecommendations(providerFailures, errorTypes) {
  const recommendations = [];
  
  // Check for high failure rate
  for (const [provider, failures] of Object.entries(providerFailures)) {
    if (failures > 10) {
      recommendations.push({
        provider,
        issue: 'high_failure_rate',
        message: `${provider} has ${failures} failures. Consider reducing priority or investigating issues.`,
        priority: 'high'
      });
    }
  }
  
  // Check for common error types
  for (const [errorType, count] of Object.entries(errorTypes)) {
    if (count > 5) {
      recommendations.push({
        errorType,
        issue: 'recurring_error',
        message: `${errorType} occurred ${count} times. Investigate root cause.`,
        priority: errorType === 'INVALID_API_KEY' ? 'critical' : 'medium'
      });
    }
  }
  
  return recommendations;
}

// ============================================================================
// RETRY EXECUTION
// ============================================================================

/**
 * Execute single provider with retry
 * @param {string} provider - Provider name
 * @param {string} model - Model tier
 * @param {Object} request - Request object
 * @param {number} maxRetries - Max retry attempts
 * @returns {Object} - Response or throws error
 */
async function executeWithRetry(provider, model, request, maxRetries = 2) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Add delay for retries
    if (attempt > 0) {
      const delay = calculateBackoffDelay(attempt - 1);
      await sleep(delay);
    }
    
    try {
      const adapter = createAdapter(provider);
      const response = await adapter.complete({
        ...request,
        modelTier: model
      });
      
      return response;
      
    } catch (error) {
      lastError = error;
      
      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        throw error;
      }
      
      console.log(`Retry ${attempt + 1}/${maxRetries} for ${provider} due to ${error.type}`);
    }
  }
  
  // All retries exhausted
  throw lastError;
}

// ============================================================================
// MAIN FAILOVER FUNCTION
// ============================================================================

/**
 * Execute request with automatic failover and retry
 * 
 * This is the main entry point for failover-protected execution.
 * 
 * @param {Object} request - Unified AI request
 * @param {Object} routingPlan - Routing plan with primary and fallbacks
 * @param {Object} options - Execution options
 * @returns {Object} - Response with failover metadata
 */
async function executeWithFailoverAndRetry(request, routingPlan, options = {}) {
  const {
    enableRetry = true,
    enableFailover = true,
    maxTotalAttempts = RETRY_CONFIG.maxAttempts
  } = options;
  
  const attempts = [];
  let lastError = null;
  
  // Build execution chain
  const executionChain = [routingPlan.primary];
  if (enableFailover) {
    executionChain.push(...routingPlan.fallbacks);
  }
  
  // Limit total attempts
  const limitedChain = executionChain.slice(0, maxTotalAttempts);
  
  for (let i = 0; i < limitedChain.length; i++) {
    const target = limitedChain[i];
    const { provider, model } = target;
    
    // Check circuit breaker
    if (!isCircuitClosed(provider)) {
      console.log(`Circuit breaker open for ${provider}, skipping`);
      attempts.push({
        provider,
        model,
        skipped: true,
        reason: 'circuit_breaker_open',
        attemptNumber: i + 1
      });
      continue;
    }
    
    // Add backoff delay (except for first attempt)
    if (i > 0) {
      const delay = calculateBackoffDelay(i - 1);
      console.log(`Failover delay: ${delay}ms before attempt ${i + 1}`);
      await sleep(delay);
    }
    
    try {
      console.log(`Attempt ${i + 1}/${limitedChain.length}: ${provider} (${model})`);
      
      // Execute with provider-level retry if enabled
      const response = enableRetry
        ? await executeWithRetry(provider, model, request, 1)  // 1 retry per provider
        : await createAdapter(provider).complete({ ...request, modelTier: model });
      
      // Success!
      recordSuccess(provider);
      
      attempts.push({
        provider,
        model,
        success: true,
        latency: response.latency,
        cost: response.cost,
        tokens: response.tokens,
        attemptNumber: i + 1
      });
      
      // Log failover event if not using primary
      if (i > 0) {
        console.log(`✓ FAILOVER SUCCESS: ${routingPlan.primary.provider} → ${provider}`);
      }
      
      return {
        ...response,
        failover: {
          occurred: i > 0,
          attemptCount: i + 1,
          attempts,
          primaryProvider: routingPlan.primary.provider,
          usedProvider: provider,
          totalLatency: attempts.reduce((sum, a) => sum + (a.latency || 0), 0),
          totalCost: attempts.reduce((sum, a) => sum + (a.cost || 0), 0)
        }
      };
      
    } catch (error) {
      lastError = error;
      recordFailure(provider);
      
      attempts.push({
        provider,
        model,
        success: false,
        error: error.error || error.message,
        errorType: error.type,
        retryable: isRetryableError(error),
        attemptNumber: i + 1
      });
      
      console.error(`✗ Attempt ${i + 1} failed (${provider}):`, error.type || error.message);
      
      // If error is not retryable, stop immediately
      if (!isRetryableError(error)) {
        console.log('Non-retryable error, stopping failover chain');
        break;
      }
    }
  }
  
  // All attempts failed
  console.error('✗ ALL PROVIDERS FAILED');
  
  throw {
    error: 'FAILOVER_EXHAUSTED',
    message: 'Request failed after trying all available providers',
    attempts,
    lastError,
    primaryProvider: routingPlan.primary.provider,
    totalAttempts: attempts.length,
    retryable: false,
    
    // Include details for debugging
    executionChain: limitedChain.map(t => `${t.provider}:${t.model}`),
    circuitBreakerStates: { ...circuitBreakerState }
  };
}

// ============================================================================
// CIRCUIT BREAKER MANAGEMENT
// ============================================================================

/**
 * Get circuit breaker status for all providers
 * @returns {Object} - Circuit breaker status
 */
function getCircuitBreakerStatus() {
  return {
    enabled: CIRCUIT_BREAKER_CONFIG.enabled,
    providers: { ...circuitBreakerState },
    config: CIRCUIT_BREAKER_CONFIG
  };
}

/**
 * Reset all circuit breakers
 */
function resetAllCircuitBreakers() {
  for (const provider of Object.keys(circuitBreakerState)) {
    resetCircuitBreaker(provider);
  }
  console.log('All circuit breakers reset');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  executeWithFailover,
  executeWithFailoverAndRetry,
  executeWithRetry,
  executeParallel,
  
  // Circuit breaker
  isCircuitClosed,
  recordSuccess,
  recordFailure,
  resetCircuitBreaker,
  resetAllCircuitBreakers,
  getCircuitBreakerStatus,
  
  // Analytics
  analyzeFailover,
  getFailoverStatistics,
  
  // Utilities
  calculateBackoffDelay,
  isRetryableError,
  sleep,
  
  // For testing
  circuitBreakerState
};
