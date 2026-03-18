/**
 * PARITY LAYER CONFIGURATION
 * 
 * Multi-provider AI configuration for Insurance Claim Letter Help AI
 * 
 * PROVIDERS:
 * - OpenAI (primary)
 * - Anthropic (fallback)
 * - Google (secondary fallback)
 * 
 * ROUTING:
 * - Low-value claims (<$10k): Cheapest models
 * - Medium-value claims ($10k-$25k): Standard models
 * - High-value claims ($25k-$50k): Premium models
 * - Critical operations: Best reasoning models
 */

// ============================================================================
// PROVIDER CONFIGURATIONS
// ============================================================================

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    enabled: true,
    priority: 1,
    apiKeyEnv: 'OPENAI_API_KEY',
    
    models: {
      mini: {
        name: 'gpt-4o-mini',
        pricing: {
          input: 0.150,   // $ per 1M tokens
          output: 0.600   // $ per 1M tokens
        },
        maxTokens: 16384,
        contextWindow: 128000
      },
      standard: {
        name: 'gpt-4o',
        pricing: {
          input: 5.00,
          output: 15.00
        },
        maxTokens: 16384,
        contextWindow: 128000
      },
      advanced: {
        name: 'gpt-4-turbo',
        pricing: {
          input: 10.00,
          output: 30.00
        },
        maxTokens: 4096,
        contextWindow: 128000
      }
    },
    
    timeout: 30000,
    maxRetries: 2,
    
    healthCheck: {
      enabled: true,
      interval: 60000,
      testModel: 'gpt-4o-mini'
    }
  },
  
  anthropic: {
    name: 'Anthropic',
    enabled: true,
    priority: 2,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    
    models: {
      mini: {
        name: 'claude-3-haiku-20240307',
        pricing: {
          input: 0.25,
          output: 1.25
        },
        maxTokens: 4096,
        contextWindow: 200000
      },
      standard: {
        name: 'claude-3-5-sonnet-20241022',
        pricing: {
          input: 3.00,
          output: 15.00
        },
        maxTokens: 8192,
        contextWindow: 200000
      },
      advanced: {
        name: 'claude-3-opus-20240229',
        pricing: {
          input: 15.00,
          output: 75.00
        },
        maxTokens: 4096,
        contextWindow: 200000
      }
    },
    
    timeout: 30000,
    maxRetries: 2,
    
    healthCheck: {
      enabled: true,
      interval: 60000,
      testModel: 'claude-3-haiku-20240307'
    }
  },
  
  google: {
    name: 'Google',
    enabled: true,
    priority: 3,
    apiKeyEnv: 'GOOGLE_API_KEY',
    projectIdEnv: 'GOOGLE_PROJECT_ID',
    
    models: {
      mini: {
        name: 'gemini-1.5-flash',
        pricing: {
          input: 0.075,   // Cheapest option
          output: 0.30
        },
        maxTokens: 8192,
        contextWindow: 1000000
      },
      standard: {
        name: 'gemini-1.5-pro',
        pricing: {
          input: 1.25,
          output: 5.00
        },
        maxTokens: 8192,
        contextWindow: 2000000
      },
      advanced: {
        name: 'gemini-1.5-pro',
        pricing: {
          input: 1.25,
          output: 5.00
        },
        maxTokens: 8192,
        contextWindow: 2000000
      }
    },
    
    timeout: 30000,
    maxRetries: 2,
    
    healthCheck: {
      enabled: true,
      interval: 60000,
      testModel: 'gemini-1.5-flash'
    }
  }
};

// ============================================================================
// ROUTING RULES
// ============================================================================

const ROUTING_RULES = {
  // Low-value claims (<$10k) - optimize for cost
  low_value: {
    threshold: { min: 0, max: 10000 },
    
    analyze: {
      primary: { provider: 'google', model: 'mini' },      // Gemini Flash ($0.075)
      fallbacks: [
        { provider: 'openai', model: 'mini' },             // GPT-4o-mini ($0.150)
        { provider: 'anthropic', model: 'mini' }           // Claude Haiku ($0.25)
      ]
    },
    
    generate: {
      primary: { provider: 'google', model: 'mini' },
      fallbacks: [
        { provider: 'openai', model: 'mini' },
        { provider: 'anthropic', model: 'mini' }
      ]
    },
    
    classify: {
      primary: { provider: 'google', model: 'mini' },
      fallbacks: [
        { provider: 'openai', model: 'mini' },
        { provider: 'anthropic', model: 'mini' }
      ]
    }
  },
  
  // Medium-value claims ($10k-$25k) - balance cost and quality
  medium_value: {
    threshold: { min: 10000, max: 25000 },
    
    analyze: {
      primary: { provider: 'openai', model: 'mini' },      // GPT-4o-mini ($0.150)
      fallbacks: [
        { provider: 'anthropic', model: 'mini' },          // Claude Haiku ($0.25)
        { provider: 'google', model: 'mini' }              // Gemini Flash ($0.075)
      ]
    },
    
    generate: {
      primary: { provider: 'openai', model: 'mini' },
      fallbacks: [
        { provider: 'anthropic', model: 'mini' },
        { provider: 'google', model: 'standard' }
      ]
    },
    
    classify: {
      primary: { provider: 'openai', model: 'mini' },
      fallbacks: [
        { provider: 'anthropic', model: 'mini' },
        { provider: 'google', model: 'mini' }
      ]
    }
  },
  
  // High-value claims ($25k-$50k) - optimize for quality
  high_value: {
    threshold: { min: 25000, max: 50000 },
    
    analyze: {
      primary: { provider: 'anthropic', model: 'standard' }, // Claude Sonnet ($3.00)
      fallbacks: [
        { provider: 'openai', model: 'standard' },           // GPT-4o ($5.00)
        { provider: 'google', model: 'standard' }            // Gemini Pro ($1.25)
      ]
    },
    
    generate: {
      primary: { provider: 'anthropic', model: 'standard' },
      fallbacks: [
        { provider: 'openai', model: 'standard' },
        { provider: 'google', model: 'standard' }
      ]
    },
    
    classify: {
      primary: { provider: 'anthropic', model: 'standard' },
      fallbacks: [
        { provider: 'openai', model: 'mini' },
        { provider: 'google', model: 'mini' }
      ]
    }
  },
  
  // Critical operations (risk assessment, hard-stop evaluation)
  critical: {
    threshold: { min: 0, max: Infinity },
    
    analyze: {
      primary: { provider: 'anthropic', model: 'standard' }, // Claude best for reasoning
      fallbacks: [
        { provider: 'openai', model: 'standard' },
        { provider: 'google', model: 'standard' }
      ]
    },
    
    generate: {
      primary: { provider: 'anthropic', model: 'standard' },
      fallbacks: [
        { provider: 'openai', model: 'standard' },
        { provider: 'google', model: 'standard' }
      ]
    },
    
    classify: {
      primary: { provider: 'anthropic', model: 'standard' },
      fallbacks: [
        { provider: 'openai', model: 'mini' },
        { provider: 'google', model: 'mini' }
      ]
    }
  }
};

// ============================================================================
// RETRY & FAILOVER CONFIGURATION
// ============================================================================

const RETRY_CONFIG = {
  maxAttempts: 3,           // Try up to 3 providers
  backoffMultiplier: 1.5,   // Exponential backoff
  initialDelay: 1000,       // 1 second initial delay
  maxDelay: 10000,          // 10 second max delay
  jitter: true,             // Add randomness to prevent thundering herd
  
  // Errors that should trigger retry
  retryableErrors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'RATE_LIMIT_EXCEEDED',
    'SERVER_ERROR',
    'SERVICE_UNAVAILABLE',
    'GATEWAY_TIMEOUT'
  ],
  
  // HTTP status codes that should trigger retry
  retryableStatusCodes: [
    429,  // Rate limit
    500,  // Internal server error
    502,  // Bad gateway
    503,  // Service unavailable
    504   // Gateway timeout
  ],
  
  // Errors that should NOT trigger retry
  nonRetryableErrors: [
    'INVALID_API_KEY',
    'INVALID_REQUEST',
    'VALIDATION_ERROR',
    'INSUFFICIENT_QUOTA',
    'MODEL_NOT_FOUND'
  ]
};

// ============================================================================
// CIRCUIT BREAKER CONFIGURATION
// ============================================================================

const CIRCUIT_BREAKER_CONFIG = {
  enabled: true,
  
  // Mark provider as unhealthy after this many consecutive failures
  failureThreshold: 5,
  
  // Time window for counting failures (ms)
  failureWindow: 60000,  // 1 minute
  
  // How long to wait before attempting to use unhealthy provider (ms)
  recoveryTimeout: 300000,  // 5 minutes
  
  // Minimum requests before circuit breaker activates
  minimumRequests: 10
};

// ============================================================================
// COST OPTIMIZATION CONFIGURATION
// ============================================================================

const COST_CONFIG = {
  enabled: true,
  
  // Optimize routing for cost vs. quality vs. latency
  optimizationMode: 'balanced',  // 'cost' | 'quality' | 'latency' | 'balanced'
  
  // Cost thresholds
  maxCostPerRequest: 0.01,  // $0.01 hard limit
  targetCostPerRequest: 0.001,  // $0.001 target
  
  // Cost alerts
  alertThresholds: {
    daily: 10.00,    // Alert if daily cost exceeds $10
    weekly: 50.00,   // Alert if weekly cost exceeds $50
    monthly: 200.00  // Alert if monthly cost exceeds $200
  },
  
  // Cost-to-claim-value ratio
  maxCostRatio: 0.001,  // Cost should not exceed 0.1% of claim value
  
  // Track cost savings from optimization
  trackSavings: true
};

// ============================================================================
// HEALTH MONITORING CONFIGURATION
// ============================================================================

const HEALTH_CONFIG = {
  enabled: true,
  
  // How often to check provider health (ms)
  checkInterval: 60000,  // 1 minute
  
  // Health check timeout (ms)
  checkTimeout: 5000,  // 5 seconds
  
  // Metrics to track
  metrics: {
    latency: true,
    availability: true,
    errorRate: true,
    costPerRequest: true,
    qualityScore: true
  },
  
  // Latency thresholds
  latencyThresholds: {
    good: 2000,    // <2s is good
    acceptable: 5000,  // <5s is acceptable
    poor: 10000    // >10s is poor
  },
  
  // Availability thresholds
  availabilityThresholds: {
    good: 0.999,    // 99.9%+
    acceptable: 0.99,   // 99%+
    poor: 0.95      // <95% is poor
  }
};

// ============================================================================
// FEATURE FLAGS
// ============================================================================

const FEATURE_FLAGS = {
  // Master switch for parity layer
  enabled: process.env.PARITY_ENABLED === 'true',
  
  // Enable/disable individual providers
  providers: {
    openai: process.env.PARITY_OPENAI_ENABLED !== 'false',  // Default: true
    anthropic: process.env.PARITY_ANTHROPIC_ENABLED === 'true',  // Default: false (until API key added)
    google: process.env.PARITY_GOOGLE_ENABLED === 'true'  // Default: false (until API key added)
  },
  
  // Enable/disable features
  features: {
    autoFailover: process.env.PARITY_AUTO_FAILOVER !== 'false',  // Default: true
    costOptimization: process.env.PARITY_COST_OPTIMIZATION === 'true',  // Default: false (manual routing)
    healthChecks: process.env.PARITY_HEALTH_CHECKS === 'true',  // Default: false
    circuitBreaker: process.env.PARITY_CIRCUIT_BREAKER === 'true'  // Default: false
  },
  
  // Gradual rollout percentage (0-100)
  rolloutPercentage: parseInt(process.env.PARITY_ROLLOUT_PERCENTAGE || '0', 10)
};

// ============================================================================
// SAFETY CONFIGURATION
// ============================================================================

const SAFETY_CONFIG = {
  // Maintain low temperature for deterministic output
  maxTemperature: 0.3,
  
  // Require consistency across providers
  consistencyValidation: {
    enabled: true,
    
    // For hard-stop detection, all providers must agree
    hardStopConsensus: 'unanimous',  // 'unanimous' | 'majority'
    
    // For risk level, allow ±1 level variance
    riskLevelTolerance: 1,
    
    // For quality score, allow ±5 points variance
    qualityScoreTolerance: 5
  },
  
  // Validate output across providers
  outputValidation: {
    enabled: true,
    
    // Check for prohibited phrases
    checkProhibitedPhrases: true,
    
    // Check for hallucinated citations
    checkCitations: true,
    
    // Check length limits
    checkLength: true
  }
};

// ============================================================================
// OPERATION CONFIGURATIONS
// ============================================================================

const OPERATION_CONFIGS = {
  analyze: {
    temperature: 0.2,
    maxTokens: 1000,
    responseFormat: 'json',
    timeout: 30000,
    
    // Use critical routing for risk assessment
    useRoutingTier: 'critical'
  },
  
  generate: {
    temperature: 0.3,
    maxTokens: 2000,
    responseFormat: 'text',
    timeout: 30000,
    
    // Use value-based routing
    useRoutingTier: 'value-based'
  },
  
  classify: {
    temperature: 0.2,
    maxTokens: 500,
    responseFormat: 'json',
    timeout: 20000,
    
    // Use value-based routing
    useRoutingTier: 'value-based'
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get routing tier based on claim amount
 * @param {number} claimAmount - Claim amount in dollars
 * @returns {string} - Routing tier (low_value, medium_value, high_value)
 */
function getRoutingTier(claimAmount) {
  if (!claimAmount || claimAmount < 10000) {
    return 'low_value';
  } else if (claimAmount < 25000) {
    return 'medium_value';
  } else if (claimAmount < 50000) {
    return 'high_value';
  } else {
    // Claims >$50k should trigger hard stop, but if somehow here, use best models
    return 'critical';
  }
}

/**
 * Get enabled providers in priority order
 * @returns {Array} - Array of enabled provider names
 */
function getEnabledProviders() {
  return Object.entries(PROVIDERS)
    .filter(([name, config]) => config.enabled && FEATURE_FLAGS.providers[name])
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([name]) => name);
}

/**
 * Check if parity layer is enabled
 * @returns {boolean}
 */
function isParityEnabled() {
  return FEATURE_FLAGS.enabled && getEnabledProviders().length > 0;
}

/**
 * Check if request should use parity layer (gradual rollout)
 * @returns {boolean}
 */
function shouldUseParityLayer() {
  if (!isParityEnabled()) return false;
  
  const rolloutPercentage = FEATURE_FLAGS.rolloutPercentage;
  if (rolloutPercentage === 0) return false;
  if (rolloutPercentage >= 100) return true;
  
  // Random sampling for gradual rollout
  return Math.random() * 100 < rolloutPercentage;
}

/**
 * Calculate cost for request
 * @param {string} provider - Provider name
 * @param {string} modelTier - Model tier (mini/standard/advanced)
 * @param {number} inputTokens - Input tokens
 * @param {number} outputTokens - Output tokens
 * @returns {number} - Cost in USD
 */
function calculateCost(provider, modelTier, inputTokens, outputTokens) {
  const model = PROVIDERS[provider]?.models[modelTier];
  if (!model) return 0;
  
  const inputCost = (inputTokens / 1000000) * model.pricing.input;
  const outputCost = (outputTokens / 1000000) * model.pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Get cheapest provider for operation
 * @param {string} operation - Operation type
 * @param {number} estimatedInputTokens - Estimated input tokens
 * @param {number} estimatedOutputTokens - Estimated output tokens
 * @returns {Object} - Provider and model selection
 */
function getCheapestProvider(operation, estimatedInputTokens, estimatedOutputTokens) {
  const enabledProviders = getEnabledProviders();
  
  let cheapest = null;
  let lowestCost = Infinity;
  
  for (const provider of enabledProviders) {
    const cost = calculateCost(provider, 'mini', estimatedInputTokens, estimatedOutputTokens);
    if (cost < lowestCost) {
      lowestCost = cost;
      cheapest = { provider, model: 'mini', estimatedCost: cost };
    }
  }
  
  return cheapest;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  PROVIDERS,
  ROUTING_RULES,
  RETRY_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
  COST_CONFIG,
  HEALTH_CONFIG,
  FEATURE_FLAGS,
  SAFETY_CONFIG,
  OPERATION_CONFIGS,
  
  // Helper functions
  getRoutingTier,
  getEnabledProviders,
  isParityEnabled,
  shouldUseParityLayer,
  calculateCost,
  getCheapestProvider
};
