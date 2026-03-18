/**
 * PARITY GATEWAY
 * 
 * Main orchestrator for multi-provider AI requests.
 * Unified interface for all AI operations with automatic failover.
 * 
 * ⚠️ SAFETY CRITICAL ⚠️
 * This gateway maintains all existing safety guardrails.
 * Provider selection must not compromise safety constraints.
 * 
 * FEATURES:
 * - Unified AI request interface
 * - Automatic provider selection
 * - Automatic failover and retry
 * - Cost tracking and optimization
 * - Health monitoring integration
 * - Safety validation
 */

const { 
  isParityEnabled, 
  shouldUseParityLayer,
  OPERATION_CONFIGS,
  FEATURE_FLAGS
} = require('./parity-config');

const { buildRoutingContext, routeRequest } = require('./routing-engine');
const { executeWithFailoverAndRetry } = require('./failover-manager');
const { normalizeResponse, validateResponseContent, sanitizeResponse } = require('./response-normalizer');
const { trackCost, validateCost } = require('./cost-optimizer');
const { getHealthStatus } = require('./health-monitor');

// ============================================================================
// UNIFIED REQUEST INTERFACE
// ============================================================================

/**
 * Execute AI request through parity layer
 * 
 * This is the main entry point for all AI operations.
 * 
 * @param {Object} request - Unified request object
 * @returns {Object} - Normalized response
 */
async function executeAIRequest(request) {
  const {
    operation,          // 'analyze' | 'generate' | 'classify'
    systemPrompt,       // System prompt
    userPrompt,         // User prompt
    claimAmount,        // Claim amount (for routing)
    claimType,          // Claim type
    phase,              // Claim phase
    riskLevel,          // Risk level
    letterId,           // Letter ID (for tracking)
    userId,             // User ID (for tracking)
    options = {}        // Additional options
  } = request;
  
  console.log(`=== PARITY GATEWAY: ${operation} ===`);
  
  // Validate request
  if (!operation || !systemPrompt || !userPrompt) {
    throw new Error('Missing required parameters: operation, systemPrompt, userPrompt');
  }
  
  // Check if parity layer should be used
  if (!isParityEnabled()) {
    throw new Error('Parity layer is not enabled');
  }
  
  // Get operation config
  const operationConfig = OPERATION_CONFIGS[operation];
  if (!operationConfig) {
    throw new Error(`Unknown operation: ${operation}`);
  }
  
  // Build routing context
  const routingContext = buildRoutingContext({
    claimAmount,
    operation,
    claimType,
    phase,
    riskLevel,
    optimizeFor: options.optimizeFor || 'balanced'
  });
  
  console.log(`Routing tier: ${routingContext.tier}`);
  
  // Get current health status
  const healthStatus = getHealthStatus();
  
  // Select provider and build routing plan
  const routingPlan = routeRequest(routingContext, healthStatus.providers);
  
  console.log(`Primary: ${routingPlan.primary.provider}/${routingPlan.primary.model}`);
  console.log(`Fallbacks: ${routingPlan.fallbacks.map(f => f.provider).join(', ')}`);
  
  // Build unified request for providers
  const providerRequest = {
    operation,
    systemPrompt,
    userPrompt,
    temperature: operationConfig.temperature,
    maxTokens: operationConfig.maxTokens,
    responseFormat: operationConfig.responseFormat
  };
  
  // Execute with failover
  const response = await executeWithFailoverAndRetry(
    providerRequest,
    routingPlan,
    {
      enableRetry: FEATURE_FLAGS.features.autoFailover,
      enableFailover: FEATURE_FLAGS.features.autoFailover,
      maxTotalAttempts: 3
    }
  );
  
  // Normalize response
  const normalized = normalizeResponse(response);
  
  // Validate content
  const contentValidation = validateResponseContent(normalized);
  if (!contentValidation.valid) {
    console.warn(`Content validation issues: ${contentValidation.issueCount} issues found`);
    
    // Sanitize if needed
    if (contentValidation.highSeverityCount > 0) {
      console.log('Sanitizing response due to high-severity issues');
      const sanitized = sanitizeResponse(normalized);
      normalized.content = sanitized.content;
      normalized.sanitized = true;
    }
  }
  
  normalized.contentValidation = contentValidation;
  
  // Track cost
  if (FEATURE_FLAGS.features.costOptimization) {
    const costTracking = await trackCost(normalized, {
      letterId,
      claimAmount,
      operation,
      userId
    });
    
    normalized.costTracking = costTracking;
  }
  
  // Validate cost
  const costValidation = validateCost(normalized.cost, claimAmount);
  if (!costValidation.valid) {
    console.warn(`Cost validation issues:`, costValidation.issues);
  }
  
  normalized.costValidation = costValidation;
  
  return normalized;
}

// ============================================================================
// OPERATION-SPECIFIC FUNCTIONS
// ============================================================================

/**
 * Analyze insurance letter
 * @param {string} letterText - Letter text to analyze
 * @param {Object} context - Analysis context
 * @returns {Object} - Analysis result
 */
async function analyzeWithParity(letterText, context = {}) {
  const systemPrompt = `You are a procedural insurance correspondence analyzer. You provide FACTUAL analysis only.

CRITICAL CONSTRAINTS:
- NO advice or recommendations
- NO strategy or negotiation tactics
- NO emotional language
- NO persuasive framing
- NO interpretation beyond facts stated in letter
- NO speculation

EXTRACT ONLY:
1. Denial reasons (exact wording from letter)
2. Information requests (specific items requested)
3. Deadlines (exact dates mentioned)
4. Policy references (specific sections cited)
5. Claim amounts (exact dollar amounts)
6. Contact information (phone, email, claim number)

Provide analysis in JSON format with factual extraction only.`;

  const userPrompt = `Analyze this insurance letter and extract key information:\n\n${letterText}`;
  
  return await executeAIRequest({
    operation: 'analyze',
    systemPrompt,
    userPrompt,
    ...context
  });
}

/**
 * Generate insurance response
 * @param {string} template - Response template
 * @param {Object} variables - Variables to substitute
 * @param {Object} context - Generation context
 * @returns {Object} - Generated response
 */
async function generateWithParity(template, variables, context = {}) {
  const systemPrompt = `You are a professional insurance claim correspondence specialist generating formal business letters.

CRITICAL REQUIREMENTS:

1. CITATION ACCURACY (HIGHEST PRIORITY):
   - Use ONLY verified citations provided in the context
   - Use EXACT citation format (do not modify)
   - NEVER create or invent citations

2. SPECIFICITY REQUIREMENTS (MANDATORY):
   - MUST include specific dates in MM/DD/YYYY format
   - MUST include specific dollar amounts with $ symbol
   - MUST include claim number and policy number
   - MUST include specific deadline (date, not "soon")

3. PROFESSIONAL LANGUAGE (STRICT):
   - Use formal business letter format
   - NEVER use emotional words: unfair, frustrated, disappointed, upset, angry
   - NEVER use adversarial words: sue, lawsuit, litigation, demand, insist
   - NEVER use generic AI phrases: "I am writing to inform you", "at your earliest convenience"
   - Use direct, factual statements only

4. PROHIBITED CONTENT (NEVER INCLUDE):
   - NO emotional appeals or subjective statements
   - NO threats of litigation
   - NO accusations of bad faith
   - NO narrative storytelling
   - NO speculation or opinions

OUTPUT FORMAT:
Generate a complete, professional business letter ready to print, sign, and mail.`;

  const userPrompt = `Fill in this template with the provided variables:\n\nTemplate:\n${template}\n\nVariables:\n${JSON.stringify(variables, null, 2)}`;
  
  return await executeAIRequest({
    operation: 'generate',
    systemPrompt,
    userPrompt,
    ...context
  });
}

/**
 * Classify claim type
 * @param {string} letterText - Letter text
 * @param {Object} context - Classification context
 * @returns {Object} - Classification result
 */
async function classifyWithParity(letterText, context = {}) {
  const systemPrompt = `You are an insurance claim classifier. Analyze the letter and suggest the most appropriate claim type.

CLAIM TYPES:
- property_homeowners: Homeowners insurance claims
- property_renters: Renters insurance claims
- auto_collision: Auto collision claims
- auto_comprehensive: Auto comprehensive claims (theft, vandalism, weather)
- health_medical: Health insurance medical claims
- health_prescription: Health insurance prescription claims

Provide classification in JSON format with:
- suggestedClaimType: string
- confidence: number (0-100)
- reasoning: string (brief explanation)`;

  const userPrompt = `Classify this insurance letter:\n\n${letterText}`;
  
  return await executeAIRequest({
    operation: 'classify',
    systemPrompt,
    userPrompt,
    ...context
  });
}

// ============================================================================
// FALLBACK TO DIRECT OPENAI
// ============================================================================

/**
 * Execute request with direct OpenAI (fallback when parity disabled)
 * @param {Object} request - Request object
 * @returns {Object} - Response
 */
async function executeWithDirectOpenAI(request) {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const operationConfig = OPERATION_CONFIGS[request.operation];
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt }
    ],
    temperature: operationConfig.temperature,
    max_tokens: operationConfig.maxTokens,
    response_format: operationConfig.responseFormat === 'json' 
      ? { type: 'json_object' } 
      : undefined
  });
  
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    content: completion.choices[0]?.message?.content || '',
    tokens: {
      input: completion.usage?.prompt_tokens || 0,
      output: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0
    },
    cost: ((completion.usage?.prompt_tokens || 0) / 1000000) * 0.150 +
          ((completion.usage?.completion_tokens || 0) / 1000000) * 0.600,
    parityUsed: false
  };
}

// ============================================================================
// MAIN GATEWAY FUNCTION
// ============================================================================

/**
 * Execute AI request with automatic parity layer or direct OpenAI
 * 
 * This function automatically decides whether to use parity layer or direct OpenAI
 * based on configuration and rollout percentage.
 * 
 * @param {Object} request - Request object
 * @returns {Object} - Response
 */
async function execute(request) {
  // Check if should use parity layer (gradual rollout)
  if (shouldUseParityLayer()) {
    try {
      console.log('Using parity layer');
      return await executeAIRequest(request);
    } catch (error) {
      console.error('Parity layer failed, falling back to direct OpenAI:', error.message);
      
      // Fallback to direct OpenAI if parity fails
      return await executeWithDirectOpenAI(request);
    }
  } else {
    console.log('Using direct OpenAI (parity layer disabled or not in rollout)');
    return await executeWithDirectOpenAI(request);
  }
}

// ============================================================================
// GATEWAY STATUS
// ============================================================================

/**
 * Get parity gateway status
 * @returns {Object} - Gateway status
 */
function getGatewayStatus() {
  return {
    enabled: isParityEnabled(),
    rolloutPercentage: FEATURE_FLAGS.rolloutPercentage,
    
    features: {
      autoFailover: FEATURE_FLAGS.features.autoFailover,
      costOptimization: FEATURE_FLAGS.features.costOptimization,
      healthChecks: FEATURE_FLAGS.features.healthChecks,
      circuitBreaker: FEATURE_FLAGS.features.circuitBreaker
    },
    
    providers: {
      openai: FEATURE_FLAGS.providers.openai,
      anthropic: FEATURE_FLAGS.providers.anthropic,
      google: FEATURE_FLAGS.providers.google
    },
    
    healthStatus: getHealthStatus(),
    
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main functions
  execute,
  executeAIRequest,
  
  // Operation-specific functions
  analyzeWithParity,
  generateWithParity,
  classifyWithParity,
  
  // Fallback
  executeWithDirectOpenAI,
  
  // Status
  getGatewayStatus
};
