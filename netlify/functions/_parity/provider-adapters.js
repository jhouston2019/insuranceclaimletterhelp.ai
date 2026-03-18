/**
 * PROVIDER ADAPTERS
 * 
 * Translates unified parity requests to provider-specific API formats
 * and normalizes responses back to unified format.
 * 
 * SUPPORTED PROVIDERS:
 * - OpenAI (GPT-4o-mini, GPT-4o, GPT-4-turbo)
 * - Anthropic (Claude 3 Haiku, Sonnet, Opus)
 * - Google (Gemini 1.5 Flash, Pro)
 */

const OpenAI = require('openai');
const { PROVIDERS } = require('./parity-config');

// ============================================================================
// PROVIDER ADAPTER BASE CLASS
// ============================================================================

class ProviderAdapter {
  constructor(providerName) {
    this.providerName = providerName;
    this.config = PROVIDERS[providerName];
  }
  
  /**
   * Execute AI completion request
   * @param {Object} request - Unified request object
   * @returns {Object} - Normalized response
   */
  async complete(request) {
    throw new Error('complete() must be implemented by subclass');
  }
  
  /**
   * Test provider health
   * @returns {Object} - Health check result
   */
  async healthCheck() {
    throw new Error('healthCheck() must be implemented by subclass');
  }
  
  /**
   * Get API key from environment
   * @returns {string} - API key
   */
  getApiKey() {
    const apiKey = process.env[this.config.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${this.providerName} API key not configured (${this.config.apiKeyEnv})`);
    }
    return apiKey;
  }
  
  /**
   * Check if provider is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!process.env[this.config.apiKeyEnv];
  }
}

// ============================================================================
// OPENAI ADAPTER
// ============================================================================

class OpenAIAdapter extends ProviderAdapter {
  constructor() {
    super('openai');
    
    if (this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: this.getApiKey()
      });
    }
  }
  
  /**
   * Execute OpenAI completion
   */
  async complete(request) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized - API key missing');
    }
    
    const startTime = Date.now();
    
    try {
      const modelName = this.config.models[request.modelTier].name;
      
      const completion = await this.client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt }
        ],
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        response_format: request.responseFormat === 'json' 
          ? { type: 'json_object' } 
          : undefined
      });
      
      const latency = Date.now() - startTime;
      
      return this.normalizeResponse(completion, modelName, latency, request);
      
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  
  /**
   * Normalize OpenAI response to unified format
   */
  normalizeResponse(completion, modelName, latency, request) {
    const usage = completion.usage || {};
    
    return {
      provider: 'openai',
      model: modelName,
      modelTier: request.modelTier,
      content: completion.choices[0]?.message?.content || '',
      finishReason: completion.choices[0]?.finish_reason,
      
      tokens: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0,
        total: usage.total_tokens || 0
      },
      
      cost: this.calculateCost(request.modelTier, usage.prompt_tokens, usage.completion_tokens),
      latency,
      
      cached: false,
      timestamp: new Date().toISOString(),
      
      raw: completion
    };
  }
  
  /**
   * Normalize OpenAI errors
   */
  normalizeError(error) {
    const normalized = {
      provider: 'openai',
      error: error.message,
      code: error.code,
      type: error.type,
      retryable: false
    };
    
    // Determine if error is retryable
    if (error.code === 'rate_limit_exceeded' || error.status === 429) {
      normalized.retryable = true;
      normalized.type = 'RATE_LIMIT_EXCEEDED';
    } else if (error.status >= 500 && error.status < 600) {
      normalized.retryable = true;
      normalized.type = 'SERVER_ERROR';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      normalized.retryable = true;
      normalized.type = 'NETWORK_ERROR';
    } else if (error.code === 'invalid_api_key') {
      normalized.type = 'INVALID_API_KEY';
    }
    
    return normalized;
  }
  
  /**
   * Calculate cost for request
   */
  calculateCost(modelTier, inputTokens, outputTokens) {
    const model = this.config.models[modelTier];
    if (!model) return 0;
    
    const inputCost = (inputTokens / 1000000) * model.pricing.input;
    const outputCost = (outputTokens / 1000000) * model.pricing.output;
    
    return inputCost + outputCost;
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    try {
      const testModel = this.config.healthCheck.testModel;
      const startTime = Date.now();
      
      await this.client.chat.completions.create({
        model: testModel,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
        temperature: 0
      });
      
      const latency = Date.now() - startTime;
      
      return {
        provider: 'openai',
        healthy: true,
        latency,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        provider: 'openai',
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// ============================================================================
// ANTHROPIC ADAPTER
// ============================================================================

class AnthropicAdapter extends ProviderAdapter {
  constructor() {
    super('anthropic');
    
    if (this.isConfigured()) {
      // Anthropic SDK
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({
        apiKey: this.getApiKey()
      });
    }
  }
  
  /**
   * Execute Anthropic completion
   */
  async complete(request) {
    if (!this.client) {
      throw new Error('Anthropic client not initialized - API key missing');
    }
    
    const startTime = Date.now();
    
    try {
      const modelName = this.config.models[request.modelTier].name;
      
      const completion = await this.client.messages.create({
        model: modelName,
        system: request.systemPrompt,
        messages: [
          { role: 'user', content: request.userPrompt }
        ],
        temperature: request.temperature,
        max_tokens: request.maxTokens
      });
      
      const latency = Date.now() - startTime;
      
      return this.normalizeResponse(completion, modelName, latency, request);
      
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  
  /**
   * Normalize Anthropic response to unified format
   */
  normalizeResponse(completion, modelName, latency, request) {
    const usage = completion.usage || {};
    
    // Extract text content from Anthropic's content array
    const content = completion.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
    
    return {
      provider: 'anthropic',
      model: modelName,
      modelTier: request.modelTier,
      content,
      finishReason: completion.stop_reason,
      
      tokens: {
        input: usage.input_tokens || 0,
        output: usage.output_tokens || 0,
        total: (usage.input_tokens || 0) + (usage.output_tokens || 0)
      },
      
      cost: this.calculateCost(request.modelTier, usage.input_tokens, usage.output_tokens),
      latency,
      
      cached: false,
      timestamp: new Date().toISOString(),
      
      raw: completion
    };
  }
  
  /**
   * Normalize Anthropic errors
   */
  normalizeError(error) {
    const normalized = {
      provider: 'anthropic',
      error: error.message,
      code: error.type,
      type: error.type,
      retryable: false
    };
    
    // Determine if error is retryable
    if (error.status === 429) {
      normalized.retryable = true;
      normalized.type = 'RATE_LIMIT_EXCEEDED';
    } else if (error.status >= 500 && error.status < 600) {
      normalized.retryable = true;
      normalized.type = 'SERVER_ERROR';
    } else if (error.type === 'overloaded_error') {
      normalized.retryable = true;
      normalized.type = 'SERVICE_UNAVAILABLE';
    } else if (error.type === 'authentication_error') {
      normalized.type = 'INVALID_API_KEY';
    }
    
    return normalized;
  }
  
  /**
   * Calculate cost for request
   */
  calculateCost(modelTier, inputTokens, outputTokens) {
    const model = this.config.models[modelTier];
    if (!model) return 0;
    
    const inputCost = (inputTokens / 1000000) * model.pricing.input;
    const outputCost = (outputTokens / 1000000) * model.pricing.output;
    
    return inputCost + outputCost;
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    try {
      const testModel = this.config.healthCheck.testModel;
      const startTime = Date.now();
      
      await this.client.messages.create({
        model: testModel,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      });
      
      const latency = Date.now() - startTime;
      
      return {
        provider: 'anthropic',
        healthy: true,
        latency,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        provider: 'anthropic',
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// ============================================================================
// GOOGLE ADAPTER
// ============================================================================

class GoogleAdapter extends ProviderAdapter {
  constructor() {
    super('google');
    
    if (this.isConfigured()) {
      // Google Generative AI SDK
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      this.client = new GoogleGenerativeAI(this.getApiKey());
    }
  }
  
  /**
   * Execute Google completion
   */
  async complete(request) {
    if (!this.client) {
      throw new Error('Google client not initialized - API key missing');
    }
    
    const startTime = Date.now();
    
    try {
      const modelName = this.config.models[request.modelTier].name;
      const model = this.client.getGenerativeModel({ model: modelName });
      
      // Combine system and user prompts for Google
      const combinedPrompt = `${request.systemPrompt}\n\n${request.userPrompt}`;
      
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: combinedPrompt }] }
        ],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          topP: 1,
          topK: 1
        }
      });
      
      const latency = Date.now() - startTime;
      
      return this.normalizeResponse(result, modelName, latency, request);
      
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  
  /**
   * Normalize Google response to unified format
   */
  normalizeResponse(result, modelName, latency, request) {
    const response = result.response;
    const usage = response.usageMetadata || {};
    
    return {
      provider: 'google',
      model: modelName,
      modelTier: request.modelTier,
      content: response.text(),
      finishReason: response.candidates?.[0]?.finishReason || 'stop',
      
      tokens: {
        input: usage.promptTokenCount || 0,
        output: usage.candidatesTokenCount || 0,
        total: usage.totalTokenCount || 0
      },
      
      cost: this.calculateCost(request.modelTier, usage.promptTokenCount, usage.candidatesTokenCount),
      latency,
      
      cached: usage.cachedContentTokenCount > 0,
      timestamp: new Date().toISOString(),
      
      raw: result
    };
  }
  
  /**
   * Normalize Google errors
   */
  normalizeError(error) {
    const normalized = {
      provider: 'google',
      error: error.message,
      code: error.code,
      type: 'UNKNOWN_ERROR',
      retryable: false
    };
    
    // Determine if error is retryable
    if (error.status === 429 || error.message?.includes('quota')) {
      normalized.retryable = true;
      normalized.type = 'RATE_LIMIT_EXCEEDED';
    } else if (error.status >= 500 && error.status < 600) {
      normalized.retryable = true;
      normalized.type = 'SERVER_ERROR';
    } else if (error.message?.includes('UNAVAILABLE')) {
      normalized.retryable = true;
      normalized.type = 'SERVICE_UNAVAILABLE';
    } else if (error.message?.includes('API key')) {
      normalized.type = 'INVALID_API_KEY';
    }
    
    return normalized;
  }
  
  /**
   * Calculate cost for request
   */
  calculateCost(modelTier, inputTokens, outputTokens) {
    const model = this.config.models[modelTier];
    if (!model) return 0;
    
    const inputCost = (inputTokens / 1000000) * model.pricing.input;
    const outputCost = (outputTokens / 1000000) * model.pricing.output;
    
    return inputCost + outputCost;
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    try {
      const testModel = this.config.healthCheck.testModel;
      const model = this.client.getGenerativeModel({ model: testModel });
      const startTime = Date.now();
      
      await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 5 }
      });
      
      const latency = Date.now() - startTime;
      
      return {
        provider: 'google',
        healthy: true,
        latency,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        provider: 'google',
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// ============================================================================
// ADAPTER FACTORY
// ============================================================================

/**
 * Create adapter for provider
 * @param {string} providerName - Provider name (openai, anthropic, google)
 * @returns {ProviderAdapter} - Provider adapter instance
 */
function createAdapter(providerName) {
  switch (providerName.toLowerCase()) {
    case 'openai':
      return new OpenAIAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    case 'google':
      return new GoogleAdapter();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

/**
 * Get all configured adapters
 * @returns {Object} - Map of provider name to adapter
 */
function getAllAdapters() {
  const adapters = {};
  
  for (const providerName of Object.keys(PROVIDERS)) {
    try {
      const adapter = createAdapter(providerName);
      if (adapter.isConfigured()) {
        adapters[providerName] = adapter;
      }
    } catch (error) {
      console.warn(`Failed to create adapter for ${providerName}:`, error.message);
    }
  }
  
  return adapters;
}

/**
 * Check which providers are configured
 * @returns {Array} - Array of configured provider names
 */
function getConfiguredProviders() {
  const configured = [];
  
  for (const providerName of Object.keys(PROVIDERS)) {
    const apiKeyEnv = PROVIDERS[providerName].apiKeyEnv;
    if (process.env[apiKeyEnv]) {
      configured.push(providerName);
    }
  }
  
  return configured;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  ProviderAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  GoogleAdapter,
  createAdapter,
  getAllAdapters,
  getConfiguredProviders
};
