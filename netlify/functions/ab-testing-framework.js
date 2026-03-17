/**
 * A/B TESTING FRAMEWORK
 * 
 * Scientific experimentation for prompt optimization.
 * 
 * FEATURES:
 * - Experiment management (create, run, analyze)
 * - Traffic splitting (control vs test)
 * - Statistical significance testing
 * - Automatic winner selection
 * - Multi-variant testing support
 * 
 * EXPERIMENT TYPES:
 * - Prompt variations
 * - Temperature settings
 * - Model comparisons
 * - Playbook modifications
 * - Citation strategies
 */

const { getSupabaseAdmin } = require("./_supabase");
const { createLogger, EVENT_TYPES } = require("./structured-logging-system");

// ============================================================================
// EXPERIMENT MANAGEMENT
// ============================================================================

/**
 * Create new A/B test experiment
 * @param {Object} experimentConfig - Experiment configuration
 * @returns {Object} - Created experiment
 */
async function createExperiment(experimentConfig) {
  const {
    experimentName,
    experimentType,
    description,
    controlVariant,
    testVariant,
    claimTypes = [],
    phases = [],
    trafficPercentage = 50,
    sampleSizeTarget = 100
  } = experimentConfig;
  
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('ab_test_experiments')
      .insert({
        experiment_name: experimentName,
        experiment_type: experimentType,
        description,
        control_variant: controlVariant,
        test_variant: testVariant,
        status: 'draft',
        claim_types: claimTypes,
        phases: phases,
        traffic_percentage: trafficPercentage,
        sample_size_target: sampleSizeTarget,
        current_sample_size: 0,
        control_metrics: {},
        test_metrics: {},
        winner: null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('Experiment created:', data.id);
    return { success: true, experiment: data };
    
  } catch (error) {
    console.error('Failed to create experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start experiment
 * @param {string} experimentId - Experiment ID
 */
async function startExperiment(experimentId) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('ab_test_experiments')
      .update({
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', experimentId);
    
    if (error) throw error;
    
    console.log('Experiment started:', experimentId);
    return { success: true };
    
  } catch (error) {
    console.error('Failed to start experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Pause experiment
 * @param {string} experimentId - Experiment ID
 */
async function pauseExperiment(experimentId) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('ab_test_experiments')
      .update({
        status: 'paused'
      })
      .eq('id', experimentId);
    
    if (error) throw error;
    
    console.log('Experiment paused:', experimentId);
    return { success: true };
    
  } catch (error) {
    console.error('Failed to pause experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete experiment
 * @param {string} experimentId - Experiment ID
 */
async function completeExperiment(experimentId) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Analyze results first
    const analysis = await analyzeExperiment(experimentId);
    
    const { error } = await supabase
      .from('ab_test_experiments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        control_metrics: analysis.controlMetrics,
        test_metrics: analysis.testMetrics,
        statistical_significance: analysis.statisticalSignificance,
        winner: analysis.winner
      })
      .eq('id', experimentId);
    
    if (error) throw error;
    
    console.log('Experiment completed:', experimentId, 'Winner:', analysis.winner);
    return { success: true, analysis };
    
  } catch (error) {
    console.error('Failed to complete experiment:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// VARIANT ASSIGNMENT
// ============================================================================

/**
 * Assign variant to user
 * @param {string} experimentId - Experiment ID
 * @param {string} documentId - Document ID
 * @param {string} userId - User ID
 * @param {Object} documentContext - Document context
 * @returns {Object} - Assigned variant
 */
async function assignVariant(experimentId, documentId, userId, documentContext) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get experiment
    const { data: experiment, error: expError } = await supabase
      .from('ab_test_experiments')
      .select('*')
      .eq('id', experimentId)
      .eq('status', 'active')
      .single();
    
    if (expError || !experiment) {
      return { success: false, error: 'Experiment not found or not active' };
    }
    
    // Check if document matches experiment criteria
    const matchesCriteria = 
      (experiment.claim_types.length === 0 || experiment.claim_types.includes(documentContext.claimType)) &&
      (experiment.phases.length === 0 || experiment.phases.includes(documentContext.phase));
    
    if (!matchesCriteria) {
      return { 
        success: false, 
        error: 'Document does not match experiment criteria',
        useDefault: true 
      };
    }
    
    // Assign variant based on traffic percentage
    const random = Math.random() * 100;
    const variant = random < experiment.traffic_percentage ? 'test' : 'control';
    const variantConfig = variant === 'test' ? experiment.test_variant : experiment.control_variant;
    
    // Save assignment
    const { error: assignError } = await supabase
      .from('ab_test_assignments')
      .insert({
        experiment_id: experimentId,
        document_id: documentId,
        user_id: userId,
        variant,
        variant_config: variantConfig
      });
    
    if (assignError) throw assignError;
    
    // Increment sample size
    await supabase
      .from('ab_test_experiments')
      .update({
        current_sample_size: experiment.current_sample_size + 1
      })
      .eq('id', experimentId);
    
    console.log('Variant assigned:', variant, 'for document:', documentId);
    return { 
      success: true, 
      variant, 
      variantConfig,
      experimentId 
    };
    
  } catch (error) {
    console.error('Failed to assign variant:', error);
    return { success: false, error: error.message, useDefault: true };
  }
}

/**
 * Get active experiments for document
 * @param {Object} documentContext - Document context
 * @returns {Array} - Active experiments
 */
async function getActiveExperiments(documentContext) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('ab_test_experiments')
      .select('*')
      .eq('status', 'active')
      .lt('current_sample_size', supabase.raw('sample_size_target'));
    
    if (error) throw error;
    
    // Filter by criteria
    const matchingExperiments = (data || []).filter(exp => {
      const matchesClaim = exp.claim_types.length === 0 || exp.claim_types.includes(documentContext.claimType);
      const matchesPhase = exp.phases.length === 0 || exp.phases.includes(documentContext.phase);
      return matchesClaim && matchesPhase;
    });
    
    return matchingExperiments;
    
  } catch (error) {
    console.error('Failed to get active experiments:', error);
    return [];
  }
}

// ============================================================================
// RESULT TRACKING
// ============================================================================

/**
 * Record experiment result
 * @param {string} documentId - Document ID
 * @param {Object} results - Quality and outcome results
 */
async function recordExperimentResult(documentId, results) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('ab_test_assignments')
      .update({
        outcome_result: results.outcomeResult,
        quality_score: results.qualityScore,
        citation_score: results.citationScore,
        user_satisfaction: results.userSatisfaction
      })
      .eq('document_id', documentId);
    
    if (error) throw error;
    
    console.log('Experiment result recorded for document:', documentId);
    return { success: true };
    
  } catch (error) {
    console.error('Failed to record experiment result:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// STATISTICAL ANALYSIS
// ============================================================================

/**
 * Analyze experiment results
 * @param {string} experimentId - Experiment ID
 * @returns {Object} - Analysis results
 */
async function analyzeExperiment(experimentId) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get all assignments for this experiment
    const { data: assignments, error } = await supabase
      .from('ab_test_assignments')
      .select('*')
      .eq('experiment_id', experimentId);
    
    if (error) throw error;
    
    if (!assignments || assignments.length < 10) {
      return {
        sampleSize: assignments?.length || 0,
        sufficientData: false,
        message: 'Insufficient data for analysis (minimum 10 samples required)'
      };
    }
    
    // Separate control and test groups
    const controlGroup = assignments.filter(a => a.variant === 'control');
    const testGroup = assignments.filter(a => a.variant === 'test');
    
    // Calculate metrics for each group
    const controlMetrics = calculateGroupMetrics(controlGroup);
    const testMetrics = calculateGroupMetrics(testGroup);
    
    // Calculate statistical significance
    const significance = calculateStatisticalSignificance(controlMetrics, testMetrics);
    
    // Determine winner
    const winner = determineWinner(controlMetrics, testMetrics, significance);
    
    return {
      sampleSize: assignments.length,
      sufficientData: true,
      controlSampleSize: controlGroup.length,
      testSampleSize: testGroup.length,
      controlMetrics,
      testMetrics,
      statisticalSignificance: significance,
      winner,
      recommendation: generateRecommendation(winner, significance, controlMetrics, testMetrics)
    };
    
  } catch (error) {
    console.error('Failed to analyze experiment:', error);
    return null;
  }
}

/**
 * Calculate metrics for a group
 */
function calculateGroupMetrics(assignments) {
  const withOutcome = assignments.filter(a => a.outcome_result);
  const withQuality = assignments.filter(a => a.quality_score);
  const withCitation = assignments.filter(a => a.citation_score);
  const withSatisfaction = assignments.filter(a => a.user_satisfaction);
  
  const successCount = withOutcome.filter(a => 
    a.outcome_result === 'success' || a.outcome_result === 'partial_success'
  ).length;
  
  return {
    totalAssignments: assignments.length,
    
    // Success metrics
    outcomeCount: withOutcome.length,
    successCount,
    successRate: withOutcome.length > 0 ? (successCount / withOutcome.length) * 100 : 0,
    
    // Quality metrics
    avgQualityScore: withQuality.length > 0
      ? withQuality.reduce((sum, a) => sum + a.quality_score, 0) / withQuality.length
      : 0,
    
    avgCitationScore: withCitation.length > 0
      ? withCitation.reduce((sum, a) => sum + a.citation_score, 0) / withCitation.length
      : 0,
    
    // User satisfaction
    avgSatisfaction: withSatisfaction.length > 0
      ? withSatisfaction.reduce((sum, a) => sum + a.user_satisfaction, 0) / withSatisfaction.length
      : 0
  };
}

/**
 * Calculate statistical significance using Z-test for proportions
 * @param {Object} controlMetrics - Control group metrics
 * @param {Object} testMetrics - Test group metrics
 * @returns {Object} - Statistical significance
 */
function calculateStatisticalSignificance(controlMetrics, testMetrics) {
  const n1 = controlMetrics.outcomeCount;
  const n2 = testMetrics.outcomeCount;
  
  if (n1 < 10 || n2 < 10) {
    return {
      isSignificant: false,
      pValue: null,
      confidence: 0,
      message: 'Insufficient sample size for statistical analysis'
    };
  }
  
  const p1 = controlMetrics.successRate / 100;
  const p2 = testMetrics.successRate / 100;
  
  // Pooled proportion
  const pPool = (controlMetrics.successCount + testMetrics.successCount) / (n1 + n2);
  
  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1/n1 + 1/n2));
  
  // Z-score
  const z = (p2 - p1) / se;
  
  // P-value (two-tailed test)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  
  // Significance levels
  const isSignificant = pValue < 0.05; // 95% confidence
  const confidence = (1 - pValue) * 100;
  
  return {
    isSignificant,
    pValue: Math.round(pValue * 1000) / 1000,
    confidence: Math.round(confidence),
    zScore: Math.round(z * 100) / 100,
    message: isSignificant 
      ? `Results are statistically significant (p=${pValue.toFixed(3)}, ${Math.round(confidence)}% confidence)`
      : `Results are not statistically significant (p=${pValue.toFixed(3)})`
  };
}

/**
 * Normal CDF approximation (for p-value calculation)
 */
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Determine experiment winner
 */
function determineWinner(controlMetrics, testMetrics, significance) {
  if (!significance.isSignificant) {
    return 'inconclusive';
  }
  
  // Primary metric: success rate
  if (testMetrics.successRate > controlMetrics.successRate) {
    return 'test';
  } else if (controlMetrics.successRate > testMetrics.successRate) {
    return 'control';
  }
  
  // Secondary metric: quality score
  if (testMetrics.avgQualityScore > controlMetrics.avgQualityScore) {
    return 'test';
  } else if (controlMetrics.avgQualityScore > testMetrics.avgQualityScore) {
    return 'control';
  }
  
  return 'inconclusive';
}

/**
 * Generate recommendation from experiment results
 */
function generateRecommendation(winner, significance, controlMetrics, testMetrics) {
  if (!significance.isSignificant) {
    return {
      action: 'continue_testing',
      message: 'Continue experiment to reach statistical significance',
      confidence: 'low'
    };
  }
  
  if (winner === 'test') {
    const improvement = testMetrics.successRate - controlMetrics.successRate;
    return {
      action: 'adopt_test',
      message: `Test variant shows ${improvement.toFixed(1)}% improvement in success rate. Recommend adopting test variant.`,
      confidence: 'high',
      improvement: improvement.toFixed(1)
    };
  } else if (winner === 'control') {
    const decline = controlMetrics.successRate - testMetrics.successRate;
    return {
      action: 'keep_control',
      message: `Control variant performs ${decline.toFixed(1)}% better. Keep current configuration.`,
      confidence: 'high',
      decline: decline.toFixed(1)
    };
  } else {
    return {
      action: 'inconclusive',
      message: 'No clear winner. Consider testing different variations.',
      confidence: 'medium'
    };
  }
}

// ============================================================================
// EXPERIMENT EXAMPLES
// ============================================================================

/**
 * Pre-configured experiment templates
 */
const EXPERIMENT_TEMPLATES = {
  TEMPERATURE_TEST: {
    experimentName: 'temperature_03_vs_02',
    experimentType: 'temperature',
    description: 'Test temperature 0.3 vs 0.2 for better quality while maintaining control',
    controlVariant: {
      temperature: 0.2,
      model: 'gpt-4o-mini'
    },
    testVariant: {
      temperature: 0.3,
      model: 'gpt-4o-mini'
    },
    sampleSizeTarget: 100
  },
  
  CITATION_STRATEGY: {
    experimentName: 'citation_always_vs_relevant_only',
    experimentType: 'prompt',
    description: 'Test including citations in every letter vs only when relevant',
    controlVariant: {
      citationStrategy: 'relevant_only',
      temperature: 0.3
    },
    testVariant: {
      citationStrategy: 'always_include',
      temperature: 0.3
    },
    sampleSizeTarget: 100
  },
  
  SPECIFICITY_EMPHASIS: {
    experimentName: 'specificity_emphasis_high_vs_standard',
    experimentType: 'prompt',
    description: 'Test emphasizing specificity more strongly in prompt',
    controlVariant: {
      promptVersion: 'standard',
      specificityEmphasis: 'standard'
    },
    testVariant: {
      promptVersion: 'high_specificity',
      specificityEmphasis: 'high'
    },
    sampleSizeTarget: 100
  },
  
  MODEL_COMPARISON: {
    experimentName: 'gpt4_mini_vs_gpt4',
    experimentType: 'model',
    description: 'Test GPT-4o-mini vs GPT-4 for quality improvement',
    controlVariant: {
      model: 'gpt-4o-mini',
      temperature: 0.3
    },
    testVariant: {
      model: 'gpt-4o',
      temperature: 0.3
    },
    sampleSizeTarget: 50 // Smaller sample due to cost
  }
};

/**
 * Create experiment from template
 * @param {string} templateName - Template name
 * @param {Object} overrides - Configuration overrides
 */
async function createExperimentFromTemplate(templateName, overrides = {}) {
  const template = EXPERIMENT_TEMPLATES[templateName];
  
  if (!template) {
    return { success: false, error: 'Template not found' };
  }
  
  return await createExperiment({
    ...template,
    ...overrides
  });
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Get experiment report
 * @param {string} experimentId - Experiment ID
 * @returns {Object} - Comprehensive report
 */
async function getExperimentReport(experimentId) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get experiment
    const { data: experiment, error: expError } = await supabase
      .from('ab_test_experiments')
      .select('*')
      .eq('id', experimentId)
      .single();
    
    if (expError || !experiment) {
      return { success: false, error: 'Experiment not found' };
    }
    
    // Get analysis
    const analysis = await analyzeExperiment(experimentId);
    
    // Get timeline
    const startDate = experiment.started_at ? new Date(experiment.started_at) : null;
    const endDate = experiment.completed_at ? new Date(experiment.completed_at) : new Date();
    const durationDays = startDate ? Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) : 0;
    
    return {
      success: true,
      experiment: {
        id: experiment.id,
        name: experiment.experiment_name,
        type: experiment.experiment_type,
        description: experiment.description,
        status: experiment.status
      },
      timeline: {
        startDate: startDate?.toISOString(),
        endDate: experiment.completed_at,
        durationDays,
        progress: Math.round((experiment.current_sample_size / experiment.sample_size_target) * 100)
      },
      sampleSize: {
        current: experiment.current_sample_size,
        target: experiment.sample_size_target,
        control: analysis?.controlSampleSize || 0,
        test: analysis?.testSampleSize || 0
      },
      results: analysis,
      recommendation: analysis?.recommendation
    };
    
  } catch (error) {
    console.error('Failed to get experiment report:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all experiments summary
 * @returns {Array} - All experiments
 */
async function getAllExperiments() {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('ab_test_experiments')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(exp => ({
      id: exp.id,
      name: exp.experiment_name,
      type: exp.experiment_type,
      status: exp.status,
      progress: Math.round((exp.current_sample_size / exp.sample_size_target) * 100),
      winner: exp.winner,
      startedAt: exp.started_at,
      completedAt: exp.completed_at
    }));
    
  } catch (error) {
    console.error('Failed to get all experiments:', error);
    return [];
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
    const path = event.path.replace('/.netlify/functions/ab-testing-framework', '');
    const method = event.httpMethod;
    
    // POST /create - Create experiment
    if (method === 'POST' && path === '/create') {
      const config = JSON.parse(event.body || '{}');
      const result = await createExperiment(config);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // POST /create-from-template - Create from template
    if (method === 'POST' && path === '/create-from-template') {
      const { templateName, overrides } = JSON.parse(event.body || '{}');
      const result = await createExperimentFromTemplate(templateName, overrides);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // PUT /start - Start experiment
    if (method === 'PUT' && path.startsWith('/start/')) {
      const experimentId = path.replace('/start/', '');
      const result = await startExperiment(experimentId);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // PUT /complete - Complete experiment
    if (method === 'PUT' && path.startsWith('/complete/')) {
      const experimentId = path.replace('/complete/', '');
      const result = await completeExperiment(experimentId);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // GET /report - Get experiment report
    if (method === 'GET' && path.startsWith('/report/')) {
      const experimentId = path.replace('/report/', '');
      const report = await getExperimentReport(experimentId);
      return {
        statusCode: report.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(report)
      };
    }
    
    // GET /all - Get all experiments
    if (method === 'GET' && path === '/all') {
      const experiments = await getAllExperiments();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ experiments })
      };
    }
    
    // GET /templates - Get experiment templates
    if (method === 'GET' && path === '/templates') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ templates: EXPERIMENT_TEMPLATES })
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
    console.error('A/B testing error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'A/B testing operation failed',
        details: error.message
      })
    };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createExperiment,
  startExperiment,
  pauseExperiment,
  completeExperiment,
  assignVariant,
  getActiveExperiments,
  recordExperimentResult,
  analyzeExperiment,
  getExperimentReport,
  getAllExperiments,
  createExperimentFromTemplate,
  EXPERIMENT_TEMPLATES
};
