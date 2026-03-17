/**
 * STRUCTURED LOGGING SYSTEM
 * 
 * Provides observability, debugging, and performance monitoring.
 * 
 * FEATURES:
 * - Structured JSON logging
 * - Performance metrics (duration, tokens, cost)
 * - Error tracking with stack traces
 * - Event correlation (session tracking)
 * - Cost monitoring
 * - Query-able log database
 * 
 * LOG LEVELS: debug, info, warn, error, critical
 * EVENT TYPES: upload, extract, analyze, generate, verify, payment, etc.
 */

const { getSupabaseAdmin } = require("./_supabase");

// ============================================================================
// LOG LEVELS
// ============================================================================

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// ============================================================================
// EVENT TYPES
// ============================================================================

const EVENT_TYPES = {
  // User actions
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  
  // Payment events
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed',
  
  // File operations
  FILE_UPLOAD: 'file_upload',
  FILE_UPLOAD_FAILED: 'file_upload_failed',
  TEXT_EXTRACTION: 'text_extraction',
  TEXT_EXTRACTION_FAILED: 'text_extraction_failed',
  
  // Analysis events
  CLASSIFICATION_STARTED: 'classification_started',
  CLASSIFICATION_COMPLETED: 'classification_completed',
  PHASE_DETECTION: 'phase_detection',
  RISK_ASSESSMENT: 'risk_assessment',
  HARD_STOP_TRIGGERED: 'hard_stop_triggered',
  ANALYSIS_COMPLETED: 'analysis_completed',
  ANALYSIS_FAILED: 'analysis_failed',
  
  // Generation events
  GENERATION_STARTED: 'generation_started',
  GENERATION_COMPLETED: 'generation_completed',
  GENERATION_FAILED: 'generation_failed',
  
  // Quality events
  CITATION_VERIFICATION: 'citation_verification',
  QUALITY_ASSESSMENT: 'quality_assessment',
  HALLUCINATION_DETECTED: 'hallucination_detected',
  QUALITY_FAILURE: 'quality_failure',
  
  // Outcome events
  LETTER_SENT: 'letter_sent',
  RESPONSE_RECEIVED: 'response_received',
  CLAIM_RESOLVED: 'claim_resolved',
  USER_FEEDBACK: 'user_feedback',
  
  // System events
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  API_ERROR: 'api_error',
  DATABASE_ERROR: 'database_error',
  SYSTEM_ERROR: 'system_error'
};

// ============================================================================
// LOGGER CLASS
// ============================================================================

class StructuredLogger {
  constructor(context = {}) {
    this.context = context;
    this.sessionId = context.sessionId || generateSessionId();
    this.startTime = Date.now();
  }
  
  /**
   * Log debug message
   */
  debug(eventName, eventData = {}) {
    return this.log(LOG_LEVELS.DEBUG, EVENT_TYPES.SYSTEM_ERROR, eventName, eventData);
  }
  
  /**
   * Log info message
   */
  info(eventName, eventData = {}) {
    return this.log(LOG_LEVELS.INFO, eventName, eventName, eventData);
  }
  
  /**
   * Log warning
   */
  warn(eventName, eventData = {}) {
    return this.log(LOG_LEVELS.WARN, eventName, eventName, eventData);
  }
  
  /**
   * Log error
   */
  error(eventName, error, eventData = {}) {
    return this.log(LOG_LEVELS.ERROR, eventName, eventName, {
      ...eventData,
      error_message: error.message,
      error_stack: error.stack
    });
  }
  
  /**
   * Log critical error
   */
  critical(eventName, error, eventData = {}) {
    return this.log(LOG_LEVELS.CRITICAL, eventName, eventName, {
      ...eventData,
      error_message: error.message,
      error_stack: error.stack
    });
  }
  
  /**
   * Core logging function
   */
  async log(logLevel, eventType, eventName, eventData = {}) {
    const logEntry = {
      // Context
      document_id: this.context.documentId || null,
      user_id: this.context.userId || null,
      session_id: this.sessionId,
      
      // Log details
      log_level: logLevel,
      event_type: eventType,
      event_name: eventName,
      event_data: eventData,
      
      // Performance
      duration_ms: eventData.duration_ms || null,
      tokens_used: eventData.tokens_used || null,
      cost_usd: eventData.cost_usd || null,
      
      // Error tracking
      error_message: eventData.error_message || null,
      error_stack: eventData.error_stack || null,
      
      // Request metadata
      ip_address: this.context.ipAddress || null,
      user_agent: this.context.userAgent || null,
      
      created_at: new Date().toISOString()
    };
    
    // Console output for immediate visibility
    const consoleMessage = `[${logLevel.toUpperCase()}] ${eventType}: ${eventName}`;
    if (logLevel === LOG_LEVELS.ERROR || logLevel === LOG_LEVELS.CRITICAL) {
      console.error(consoleMessage, eventData);
    } else if (logLevel === LOG_LEVELS.WARN) {
      console.warn(consoleMessage, eventData);
    } else {
      console.log(consoleMessage, eventData);
    }
    
    // Save to database (async, don't block)
    this.saveToDatabase(logEntry).catch(err => {
      console.error('Failed to save log to database:', err);
    });
    
    return logEntry;
  }
  
  /**
   * Save log entry to database
   */
  async saveToDatabase(logEntry) {
    try {
      const supabase = getSupabaseAdmin();
      
      await supabase
        .from('structured_logs')
        .insert(logEntry);
      
    } catch (error) {
      // Don't throw - logging failures shouldn't break the app
      console.error('Database logging failed:', error);
    }
  }
  
  /**
   * Log performance metrics
   */
  async logPerformance(eventType, eventName, metrics) {
    return this.info(eventType, {
      ...metrics,
      duration_ms: metrics.duration_ms,
      tokens_used: metrics.tokens_used,
      cost_usd: metrics.cost_usd
    });
  }
  
  /**
   * Log AI operation
   */
  async logAIOperation(operation, details) {
    const { model, temperature, tokens, cost, duration } = details;
    
    return this.info(operation, {
      ai_operation: true,
      model,
      temperature,
      tokens_used: tokens,
      cost_usd: cost,
      duration_ms: duration,
      ...details
    });
  }
  
  /**
   * Log quality check
   */
  async logQualityCheck(checkType, results) {
    const logLevel = results.passesCheck ? LOG_LEVELS.INFO : LOG_LEVELS.WARN;
    
    return this.log(logLevel, EVENT_TYPES.QUALITY_ASSESSMENT, checkType, {
      quality_check: true,
      passes: results.passesCheck,
      score: results.score || results.qualityScore,
      issues: results.issues || [],
      recommendations: results.recommendations || []
    });
  }
  
  /**
   * Log hard stop trigger
   */
  async logHardStop(condition, details) {
    return this.log(LOG_LEVELS.CRITICAL, EVENT_TYPES.HARD_STOP_TRIGGERED, condition, {
      hard_stop: true,
      condition_code: details.code,
      severity: details.severity,
      requires_attorney: details.requiresAttorney,
      message: details.message
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create logger instance
 * @param {Object} context - Logger context
 * @returns {StructuredLogger} - Logger instance
 */
function createLogger(context = {}) {
  return new StructuredLogger(context);
}

/**
 * Extract context from Netlify event
 * @param {Object} event - Netlify function event
 * @returns {Object} - Extracted context
 */
function extractContextFromEvent(event) {
  const body = event.body ? JSON.parse(event.body) : {};
  
  return {
    documentId: body.documentId || body.document_id || null,
    userId: body.userId || body.user_id || null,
    sessionId: body.sessionId || event.headers['x-session-id'] || null,
    ipAddress: event.headers['x-forwarded-for'] || event.headers['client-ip'] || null,
    userAgent: event.headers['user-agent'] || null
  };
}

// ============================================================================
// PERFORMANCE TRACKING
// ============================================================================

/**
 * Performance timer utility
 */
class PerformanceTimer {
  constructor(operationName) {
    this.operationName = operationName;
    this.startTime = Date.now();
    this.checkpoints = [];
  }
  
  /**
   * Add checkpoint
   */
  checkpoint(name) {
    const now = Date.now();
    this.checkpoints.push({
      name,
      timestamp: now,
      elapsed: now - this.startTime
    });
  }
  
  /**
   * End timer and get metrics
   */
  end() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    return {
      operation: this.operationName,
      duration_ms: duration,
      start_time: this.startTime,
      end_time: endTime,
      checkpoints: this.checkpoints
    };
  }
}

/**
 * Create performance timer
 */
function createTimer(operationName) {
  return new PerformanceTimer(operationName);
}

// ============================================================================
// LOG QUERYING
// ============================================================================

/**
 * Query logs with filters
 * @param {Object} filters - Query filters
 * @returns {Array} - Matching log entries
 */
async function queryLogs(filters = {}) {
  try {
    const supabase = getSupabaseAdmin();
    
    let query = supabase
      .from('structured_logs')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (filters.documentId) {
      query = query.eq('document_id', filters.documentId);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.sessionId) {
      query = query.eq('session_id', filters.sessionId);
    }
    if (filters.logLevel) {
      query = query.eq('log_level', filters.logLevel);
    }
    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data || [];
    
  } catch (error) {
    console.error('Failed to query logs:', error);
    return [];
  }
}

/**
 * Get error logs
 * @param {number} limit - Number of logs to retrieve
 * @returns {Array} - Error log entries
 */
async function getErrorLogs(limit = 50) {
  return queryLogs({
    logLevel: LOG_LEVELS.ERROR,
    limit
  });
}

/**
 * Get logs for specific document
 * @param {string} documentId - Document ID
 * @returns {Array} - Document log entries
 */
async function getDocumentLogs(documentId) {
  return queryLogs({ documentId });
}

/**
 * Get performance metrics
 * @param {string} eventType - Event type to analyze
 * @param {number} limit - Number of recent events
 * @returns {Object} - Performance statistics
 */
async function getPerformanceMetrics(eventType, limit = 100) {
  try {
    const logs = await queryLogs({ eventType, limit });
    
    if (logs.length === 0) {
      return {
        eventType,
        sampleSize: 0,
        message: 'No performance data available'
      };
    }
    
    const durationsWithData = logs.filter(log => log.duration_ms);
    const tokensWithData = logs.filter(log => log.tokens_used);
    const costsWithData = logs.filter(log => log.cost_usd);
    
    const avgDuration = durationsWithData.length > 0
      ? durationsWithData.reduce((sum, log) => sum + log.duration_ms, 0) / durationsWithData.length
      : 0;
    
    const avgTokens = tokensWithData.length > 0
      ? tokensWithData.reduce((sum, log) => sum + log.tokens_used, 0) / tokensWithData.length
      : 0;
    
    const avgCost = costsWithData.length > 0
      ? costsWithData.reduce((sum, log) => sum + parseFloat(log.cost_usd), 0) / costsWithData.length
      : 0;
    
    const maxDuration = durationsWithData.length > 0
      ? Math.max(...durationsWithData.map(log => log.duration_ms))
      : 0;
    
    const minDuration = durationsWithData.length > 0
      ? Math.min(...durationsWithData.map(log => log.duration_ms))
      : 0;
    
    return {
      eventType,
      sampleSize: logs.length,
      performance: {
        avgDuration: Math.round(avgDuration),
        minDuration: Math.round(minDuration),
        maxDuration: Math.round(maxDuration),
        avgTokens: Math.round(avgTokens),
        avgCost: avgCost.toFixed(6)
      }
    };
    
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    return null;
  }
}

/**
 * Get cost summary
 * @param {Object} filters - Date filters
 * @returns {Object} - Cost statistics
 */
async function getCostSummary(filters = {}) {
  try {
    const logs = await queryLogs({
      startDate: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
      endDate: filters.endDate || new Date().toISOString()
    });
    
    const logsWithCost = logs.filter(log => log.cost_usd);
    
    if (logsWithCost.length === 0) {
      return {
        totalCost: 0,
        totalOperations: 0,
        avgCostPerOperation: 0,
        message: 'No cost data available'
      };
    }
    
    const totalCost = logsWithCost.reduce((sum, log) => sum + parseFloat(log.cost_usd), 0);
    const totalOperations = logsWithCost.length;
    const avgCostPerOperation = totalCost / totalOperations;
    
    // Group by event type
    const costByEventType = {};
    logsWithCost.forEach(log => {
      if (!costByEventType[log.event_type]) {
        costByEventType[log.event_type] = {
          count: 0,
          totalCost: 0
        };
      }
      costByEventType[log.event_type].count++;
      costByEventType[log.event_type].totalCost += parseFloat(log.cost_usd);
    });
    
    const costBreakdown = Object.entries(costByEventType).map(([eventType, data]) => ({
      eventType,
      operations: data.count,
      totalCost: data.totalCost.toFixed(6),
      avgCost: (data.totalCost / data.count).toFixed(6)
    }));
    
    return {
      totalCost: totalCost.toFixed(4),
      totalOperations,
      avgCostPerOperation: avgCostPerOperation.toFixed(6),
      costBreakdown,
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate
      }
    };
    
  } catch (error) {
    console.error('Failed to get cost summary:', error);
    return null;
  }
}

// ============================================================================
// ERROR ANALYSIS
// ============================================================================

/**
 * Get error rate by event type
 * @param {number} limit - Number of recent events to analyze
 * @returns {Object} - Error rate statistics
 */
async function getErrorRates(limit = 1000) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('structured_logs')
      .select('event_type, log_level')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        sampleSize: 0,
        message: 'No log data available'
      };
    }
    
    // Group by event type
    const eventStats = {};
    data.forEach(log => {
      if (!eventStats[log.event_type]) {
        eventStats[log.event_type] = {
          total: 0,
          errors: 0,
          criticals: 0
        };
      }
      eventStats[log.event_type].total++;
      if (log.log_level === LOG_LEVELS.ERROR) {
        eventStats[log.event_type].errors++;
      }
      if (log.log_level === LOG_LEVELS.CRITICAL) {
        eventStats[log.event_type].criticals++;
      }
    });
    
    // Calculate error rates
    const errorRates = Object.entries(eventStats).map(([eventType, stats]) => ({
      eventType,
      total: stats.total,
      errors: stats.errors,
      criticals: stats.criticals,
      errorRate: Math.round((stats.errors / stats.total) * 100),
      criticalRate: Math.round((stats.criticals / stats.total) * 100),
      healthStatus: stats.errors === 0 && stats.criticals === 0 ? 'healthy' :
                    stats.criticals > 0 ? 'critical' :
                    stats.errorRate > 10 ? 'unhealthy' : 'warning'
    }));
    
    // Sort by error rate descending
    errorRates.sort((a, b) => b.errorRate - a.errorRate);
    
    return {
      sampleSize: data.length,
      errorRates,
      overallErrorRate: Math.round((data.filter(l => l.log_level === LOG_LEVELS.ERROR).length / data.length) * 100),
      overallCriticalRate: Math.round((data.filter(l => l.log_level === LOG_LEVELS.CRITICAL).length / data.length) * 100)
    };
    
  } catch (error) {
    console.error('Failed to get error rates:', error);
    return null;
  }
}

/**
 * Get most common errors
 * @param {number} limit - Number of errors to retrieve
 * @returns {Array} - Common error messages
 */
async function getCommonErrors(limit = 20) {
  try {
    const errorLogs = await queryLogs({
      logLevel: LOG_LEVELS.ERROR,
      limit: 500
    });
    
    // Group by error message
    const errorCounts = {};
    errorLogs.forEach(log => {
      const message = log.error_message || 'Unknown error';
      errorCounts[message] = (errorCounts[message] || 0) + 1;
    });
    
    // Sort by frequency
    const commonErrors = Object.entries(errorCounts)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    
    return commonErrors;
    
  } catch (error) {
    console.error('Failed to get common errors:', error);
    return [];
  }
}

// ============================================================================
// MONITORING & ALERTS
// ============================================================================

/**
 * Check system health
 * @returns {Object} - Health status
 */
async function checkSystemHealth() {
  try {
    const errorRates = await getErrorRates(1000);
    const costSummary = await getCostSummary();
    const performanceMetrics = await Promise.all([
      getPerformanceMetrics(EVENT_TYPES.TEXT_EXTRACTION, 50),
      getPerformanceMetrics(EVENT_TYPES.ANALYSIS_COMPLETED, 50),
      getPerformanceMetrics(EVENT_TYPES.GENERATION_COMPLETED, 50)
    ]);
    
    // Determine overall health
    const isHealthy = 
      errorRates.overallErrorRate < 5 &&
      errorRates.overallCriticalRate < 1 &&
      performanceMetrics.every(m => m.performance.avgDuration < 10000); // < 10 seconds
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      errorRates,
      costSummary,
      performanceMetrics,
      alerts: generateHealthAlerts(errorRates, performanceMetrics)
    };
    
  } catch (error) {
    console.error('Failed to check system health:', error);
    return {
      status: 'unknown',
      error: error.message
    };
  }
}

/**
 * Generate health alerts
 */
function generateHealthAlerts(errorRates, performanceMetrics) {
  const alerts = [];
  
  // Error rate alerts
  if (errorRates.overallErrorRate > 10) {
    alerts.push({
      severity: 'critical',
      type: 'high_error_rate',
      message: `Overall error rate is ${errorRates.overallErrorRate}% (threshold: 5%)`,
      recommendation: 'Investigate error logs immediately'
    });
  } else if (errorRates.overallErrorRate > 5) {
    alerts.push({
      severity: 'warning',
      type: 'elevated_error_rate',
      message: `Overall error rate is ${errorRates.overallErrorRate}% (threshold: 5%)`,
      recommendation: 'Monitor error trends'
    });
  }
  
  // Critical error alerts
  if (errorRates.overallCriticalRate > 1) {
    alerts.push({
      severity: 'critical',
      type: 'critical_errors',
      message: `Critical error rate is ${errorRates.overallCriticalRate}%`,
      recommendation: 'Investigate critical errors immediately'
    });
  }
  
  // Performance alerts
  performanceMetrics.forEach(metric => {
    if (metric.performance.avgDuration > 10000) {
      alerts.push({
        severity: 'warning',
        type: 'slow_performance',
        message: `${metric.eventType} average duration is ${metric.performance.avgDuration}ms (threshold: 10000ms)`,
        recommendation: 'Optimize operation performance'
      });
    }
  });
  
  return alerts;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  StructuredLogger,
  createLogger,
  extractContextFromEvent,
  createTimer,
  queryLogs,
  getErrorLogs,
  getDocumentLogs,
  getPerformanceMetrics,
  getCostSummary,
  getErrorRates,
  getCommonErrors,
  checkSystemHealth,
  LOG_LEVELS,
  EVENT_TYPES
};
