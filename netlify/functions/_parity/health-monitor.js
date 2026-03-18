/**
 * HEALTH MONITOR
 * 
 * Monitors provider health and availability.
 * Tracks latency, error rates, and uptime.
 * Integrates with circuit breaker for automatic provider exclusion.
 * 
 * FEATURES:
 * - Periodic health checks
 * - Latency tracking
 * - Error rate monitoring
 * - Availability calculation
 * - Provider comparison
 */

const { HEALTH_CONFIG, PROVIDERS } = require('./parity-config');
const { createAdapter, getConfiguredProviders } = require('./provider-adapters');
const { getSupabaseAdmin } = require('../_supabase');

// ============================================================================
// HEALTH STATE
// ============================================================================

const providerHealth = {
  openai: {
    healthy: true,
    lastCheck: null,
    errorCount: 0,
    consecutiveErrors: 0,
    avgLatency: 0,
    availability: 100,
    lastError: null
  },
  anthropic: {
    healthy: true,
    lastCheck: null,
    errorCount: 0,
    consecutiveErrors: 0,
    avgLatency: 0,
    availability: 100,
    lastError: null
  },
  google: {
    healthy: true,
    lastCheck: null,
    errorCount: 0,
    consecutiveErrors: 0,
    avgLatency: 0,
    availability: 100,
    lastError: null
  }
};

// ============================================================================
// HEALTH CHECKS
// ============================================================================

/**
 * Check health of single provider
 * @param {string} provider - Provider name
 * @returns {Object} - Health check result
 */
async function checkProviderHealth(provider) {
  try {
    const adapter = createAdapter(provider);
    
    if (!adapter.isConfigured()) {
      return {
        provider,
        healthy: false,
        error: 'Provider not configured',
        configured: false
      };
    }
    
    const result = await adapter.healthCheck();
    
    // Update health state
    const state = providerHealth[provider];
    if (state) {
      state.lastCheck = Date.now();
      
      if (result.healthy) {
        state.healthy = true;
        state.consecutiveErrors = 0;
        state.avgLatency = result.latency;
      } else {
        state.consecutiveErrors++;
        state.errorCount++;
        state.lastError = result.error;
        
        // Mark unhealthy after 3 consecutive failures
        if (state.consecutiveErrors >= 3) {
          state.healthy = false;
        }
      }
    }
    
    return result;
    
  } catch (error) {
    console.error(`Health check failed for ${provider}:`, error.message);
    
    const state = providerHealth[provider];
    if (state) {
      state.consecutiveErrors++;
      state.errorCount++;
      state.lastError = error.message;
      
      if (state.consecutiveErrors >= 3) {
        state.healthy = false;
      }
    }
    
    return {
      provider,
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check health of all providers
 * @returns {Object} - Health status for all providers
 */
async function checkAllProviders() {
  const configuredProviders = getConfiguredProviders();
  
  const results = await Promise.all(
    configuredProviders.map(provider => checkProviderHealth(provider))
  );
  
  const healthStatus = {};
  for (const result of results) {
    healthStatus[result.provider] = result;
  }
  
  // Save to database
  await saveHealthStatus(healthStatus);
  
  return healthStatus;
}

/**
 * Save health status to database
 * @param {Object} healthStatus - Health status map
 */
async function saveHealthStatus(healthStatus) {
  try {
    const supabase = getSupabaseAdmin();
    
    const records = Object.entries(healthStatus).map(([provider, status]) => ({
      provider,
      healthy: status.healthy,
      error_count: providerHealth[provider]?.errorCount || 0,
      avg_latency_ms: status.latency || providerHealth[provider]?.avgLatency || 0,
      last_check_at: new Date().toISOString(),
      last_error: status.error || null
    }));
    
    for (const record of records) {
      const { error } = await supabase
        .from('ai_provider_health')
        .insert(record);
      
      if (error) {
        console.error(`Failed to save health status for ${record.provider}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Failed to save health status:', error.message);
  }
}

// ============================================================================
// HEALTH MONITORING
// ============================================================================

let healthCheckInterval = null;

/**
 * Start health monitoring
 * Runs periodic health checks on all providers
 */
function startHealthMonitoring() {
  if (!HEALTH_CONFIG.enabled) {
    console.log('Health monitoring disabled');
    return;
  }
  
  if (healthCheckInterval) {
    console.log('Health monitoring already running');
    return;
  }
  
  console.log(`Starting health monitoring (interval: ${HEALTH_CONFIG.checkInterval}ms)`);
  
  // Run initial check
  checkAllProviders().catch(error => {
    console.error('Initial health check failed:', error);
  });
  
  // Schedule periodic checks
  healthCheckInterval = setInterval(async () => {
    try {
      await checkAllProviders();
    } catch (error) {
      console.error('Periodic health check failed:', error);
    }
  }, HEALTH_CONFIG.checkInterval);
}

/**
 * Stop health monitoring
 */
function stopHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('Health monitoring stopped');
  }
}

/**
 * Get current health status
 * @returns {Object} - Current health status for all providers
 */
function getHealthStatus() {
  return {
    timestamp: new Date().toISOString(),
    providers: { ...providerHealth },
    monitoring: {
      enabled: HEALTH_CONFIG.enabled,
      running: healthCheckInterval !== null,
      interval: HEALTH_CONFIG.checkInterval
    }
  };
}

// ============================================================================
// HEALTH ANALYTICS
// ============================================================================

/**
 * Get health statistics for time period
 * @param {string} period - Time period (hour, day, week)
 * @returns {Object} - Health statistics
 */
async function getHealthStatistics(period = 'day') {
  try {
    const supabase = getSupabaseAdmin();
    
    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'hour':
        startDate.setHours(now.getHours() - 1);
        break;
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      default:
        startDate.setDate(now.getDate() - 1);
    }
    
    // Get health data
    const { data, error } = await supabase
      .from('ai_provider_health')
      .select('*')
      .gte('last_check_at', startDate.toISOString())
      .order('last_check_at', { ascending: false });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        period,
        message: 'No health data for period'
      };
    }
    
    // Calculate statistics per provider
    const byProvider = {};
    
    for (const row of data) {
      if (!byProvider[row.provider]) {
        byProvider[row.provider] = {
          checks: 0,
          healthyChecks: 0,
          unhealthyChecks: 0,
          totalLatency: 0,
          errors: []
        };
      }
      
      const stats = byProvider[row.provider];
      stats.checks++;
      
      if (row.healthy) {
        stats.healthyChecks++;
      } else {
        stats.unhealthyChecks++;
        if (row.last_error) {
          stats.errors.push(row.last_error);
        }
      }
      
      stats.totalLatency += row.avg_latency_ms || 0;
    }
    
    // Calculate metrics
    const statistics = {};
    
    for (const [provider, stats] of Object.entries(byProvider)) {
      statistics[provider] = {
        totalChecks: stats.checks,
        availability: (stats.healthyChecks / stats.checks) * 100,
        avgLatency: Math.round(stats.totalLatency / stats.checks),
        errorCount: stats.unhealthyChecks,
        errorRate: (stats.unhealthyChecks / stats.checks) * 100,
        recentErrors: stats.errors.slice(0, 5),
        
        status: determineProviderStatus(stats)
      };
    }
    
    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      statistics,
      
      mostReliable: findMostReliable(statistics),
      leastReliable: findLeastReliable(statistics),
      
      recommendations: generateHealthRecommendations(statistics)
    };
    
  } catch (error) {
    console.error('Failed to get health statistics:', error);
    return { error: error.message };
  }
}

/**
 * Determine provider status
 */
function determineProviderStatus(stats) {
  const availability = (stats.healthyChecks / stats.checks) * 100;
  const avgLatency = stats.totalLatency / stats.checks;
  
  if (availability >= 99.9 && avgLatency < 2000) {
    return 'excellent';
  } else if (availability >= 99 && avgLatency < 5000) {
    return 'good';
  } else if (availability >= 95 && avgLatency < 10000) {
    return 'acceptable';
  } else {
    return 'poor';
  }
}

/**
 * Find most reliable provider
 */
function findMostReliable(statistics) {
  let best = null;
  let highestAvailability = 0;
  
  for (const [provider, stats] of Object.entries(statistics)) {
    if (stats.availability > highestAvailability) {
      highestAvailability = stats.availability;
      best = provider;
    }
  }
  
  return best ? { provider: best, availability: highestAvailability } : null;
}

/**
 * Find least reliable provider
 */
function findLeastReliable(statistics) {
  let worst = null;
  let lowestAvailability = 100;
  
  for (const [provider, stats] of Object.entries(statistics)) {
    if (stats.availability < lowestAvailability) {
      lowestAvailability = stats.availability;
      worst = provider;
    }
  }
  
  return worst ? { provider: worst, availability: lowestAvailability } : null;
}

/**
 * Generate health recommendations
 */
function generateHealthRecommendations(statistics) {
  const recommendations = [];
  
  for (const [provider, stats] of Object.entries(statistics)) {
    // Check availability
    if (stats.availability < 95) {
      recommendations.push({
        provider,
        type: 'low_availability',
        priority: 'critical',
        message: `${provider} availability (${stats.availability.toFixed(1)}%) is below acceptable threshold (95%)`,
        action: `Reduce ${provider} priority or investigate issues`
      });
    }
    
    // Check latency
    if (stats.avgLatency > HEALTH_CONFIG.latencyThresholds.poor) {
      recommendations.push({
        provider,
        type: 'high_latency',
        priority: 'medium',
        message: `${provider} average latency (${stats.avgLatency}ms) exceeds threshold (${HEALTH_CONFIG.latencyThresholds.poor}ms)`,
        action: `Consider using faster provider for latency-sensitive operations`
      });
    }
    
    // Check error rate
    if (stats.errorRate > 5) {
      recommendations.push({
        provider,
        type: 'high_error_rate',
        priority: 'high',
        message: `${provider} error rate (${stats.errorRate.toFixed(1)}%) is elevated`,
        action: `Review recent errors and consider reducing load`
      });
    }
  }
  
  return recommendations;
}

// ============================================================================
// PROVIDER COMPARISON
// ============================================================================

/**
 * Compare provider performance
 * @returns {Object} - Provider comparison
 */
async function compareProviders() {
  const stats = await getHealthStatistics('week');
  
  if (!stats.statistics) {
    return { message: 'Insufficient data for comparison' };
  }
  
  const providers = Object.entries(stats.statistics).map(([provider, data]) => ({
    provider,
    availability: data.availability,
    avgLatency: data.avgLatency,
    errorRate: data.errorRate,
    status: data.status,
    
    // Composite score: 50% availability, 30% latency, 20% error rate
    score: (
      data.availability * 0.5 +
      (10000 / data.avgLatency) * 0.3 +  // Lower latency = higher score
      (100 - data.errorRate) * 0.2
    )
  }));
  
  providers.sort((a, b) => b.score - a.score);
  
  return {
    providers,
    best: providers[0],
    worst: providers[providers.length - 1],
    
    recommendation: {
      primary: providers[0].provider,
      fallback: providers[1]?.provider,
      avoid: providers.filter(p => p.status === 'poor').map(p => p.provider)
    }
  };
}

// ============================================================================
// MANUAL HEALTH MANAGEMENT
// ============================================================================

/**
 * Manually mark provider as healthy/unhealthy
 * @param {string} provider - Provider name
 * @param {boolean} healthy - Health status
 * @param {string} reason - Reason for manual override
 */
function setProviderHealth(provider, healthy, reason = '') {
  if (!providerHealth[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  providerHealth[provider].healthy = healthy;
  providerHealth[provider].lastCheck = Date.now();
  
  if (!healthy) {
    providerHealth[provider].lastError = reason;
  } else {
    providerHealth[provider].consecutiveErrors = 0;
    providerHealth[provider].errorCount = 0;
  }
  
  console.log(`Provider ${provider} manually set to ${healthy ? 'healthy' : 'unhealthy'}: ${reason}`);
}

/**
 * Reset health state for provider
 * @param {string} provider - Provider name
 */
function resetProviderHealth(provider) {
  if (!providerHealth[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  providerHealth[provider] = {
    healthy: true,
    lastCheck: Date.now(),
    errorCount: 0,
    consecutiveErrors: 0,
    avgLatency: 0,
    availability: 100,
    lastError: null
  };
  
  console.log(`Health state reset for ${provider}`);
}

/**
 * Reset all provider health
 */
function resetAllProviderHealth() {
  for (const provider of Object.keys(providerHealth)) {
    resetProviderHealth(provider);
  }
  console.log('All provider health states reset');
}

// ============================================================================
// HEALTH MONITORING LIFECYCLE
// ============================================================================

/**
 * Initialize health monitoring
 * Starts periodic health checks
 */
async function initializeHealthMonitoring() {
  if (!HEALTH_CONFIG.enabled) {
    console.log('Health monitoring disabled in config');
    return { enabled: false };
  }
  
  console.log('Initializing health monitoring...');
  
  // Run initial health check
  const initialStatus = await checkAllProviders();
  
  console.log('Initial health status:', 
    Object.entries(initialStatus)
      .map(([p, s]) => `${p}: ${s.healthy ? '✓' : '✗'}`)
      .join(', ')
  );
  
  return {
    enabled: true,
    initialStatus,
    interval: HEALTH_CONFIG.checkInterval
  };
}

// ============================================================================
// HEALTH METRICS
// ============================================================================

/**
 * Calculate provider availability
 * @param {string} provider - Provider name
 * @param {number} hours - Hours to look back
 * @returns {Object} - Availability metrics
 */
async function calculateAvailability(provider, hours = 24) {
  try {
    const supabase = getSupabaseAdmin();
    
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);
    
    const { data, error } = await supabase
      .from('ai_provider_health')
      .select('healthy')
      .eq('provider', provider)
      .gte('last_check_at', startDate.toISOString());
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        provider,
        availability: null,
        message: 'No data available'
      };
    }
    
    const totalChecks = data.length;
    const healthyChecks = data.filter(row => row.healthy).length;
    const availability = (healthyChecks / totalChecks) * 100;
    
    return {
      provider,
      hours,
      totalChecks,
      healthyChecks,
      unhealthyChecks: totalChecks - healthyChecks,
      availability: parseFloat(availability.toFixed(2)),
      
      status: availability >= 99.9 ? 'excellent' :
              availability >= 99 ? 'good' :
              availability >= 95 ? 'acceptable' : 'poor'
    };
    
  } catch (error) {
    console.error(`Failed to calculate availability for ${provider}:`, error);
    return { provider, error: error.message };
  }
}

/**
 * Get latency percentiles for provider
 * @param {string} provider - Provider name
 * @param {number} hours - Hours to look back
 * @returns {Object} - Latency metrics
 */
async function getLatencyMetrics(provider, hours = 24) {
  try {
    const supabase = getSupabaseAdmin();
    
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);
    
    const { data, error } = await supabase
      .from('ai_costs')
      .select('latency_ms')
      .eq('provider', provider)
      .gte('created_at', startDate.toISOString())
      .not('latency_ms', 'is', null)
      .order('latency_ms', { ascending: true });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        provider,
        message: 'No latency data available'
      };
    }
    
    const latencies = data.map(row => row.latency_ms);
    
    return {
      provider,
      hours,
      sampleSize: latencies.length,
      
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      avg: Math.round(latencies.reduce((sum, val) => sum + val, 0) / latencies.length),
      
      p50: getPercentile(latencies, 50),
      p75: getPercentile(latencies, 75),
      p90: getPercentile(latencies, 90),
      p95: getPercentile(latencies, 95),
      p99: getPercentile(latencies, 99),
      
      status: categorizeLatency(getPercentile(latencies, 95))
    };
    
  } catch (error) {
    console.error(`Failed to get latency metrics for ${provider}:`, error);
    return { provider, error: error.message };
  }
}

/**
 * Get percentile value
 */
function getPercentile(sortedArray, percentile) {
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Categorize latency
 */
function categorizeLatency(latency) {
  const thresholds = HEALTH_CONFIG.latencyThresholds;
  
  if (latency < thresholds.good) return 'good';
  if (latency < thresholds.acceptable) return 'acceptable';
  if (latency < thresholds.poor) return 'poor';
  return 'critical';
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Health checks
  checkProviderHealth,
  checkAllProviders,
  
  // Monitoring lifecycle
  startHealthMonitoring,
  stopHealthMonitoring,
  initializeHealthMonitoring,
  
  // Health status
  getHealthStatus,
  setProviderHealth,
  resetProviderHealth,
  resetAllProviderHealth,
  
  // Analytics
  getHealthStatistics,
  calculateAvailability,
  getLatencyMetrics,
  compareProviders,
  
  // State (for testing)
  providerHealth
};
