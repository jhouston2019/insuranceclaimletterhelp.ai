/**
 * PROMPT OPTIMIZATION ENGINE
 * 
 * Learns from outcomes to continuously improve prompts.
 * 
 * FEATURES:
 * - Prompt version management
 * - Performance tracking per prompt version
 * - Automatic optimization recommendations
 * - Best practice identification
 * - Prompt A/B testing integration
 * 
 * OPTIMIZATION TARGETS:
 * - Success rate: 85%+
 * - Quality score: 85%+
 * - Citation accuracy: 95%+
 * - User satisfaction: 4.0+
 */

const { getSupabaseAdmin } = require("./_supabase");
const { createLogger, EVENT_TYPES } = require("./structured-logging-system");

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

/**
 * Base system prompt templates
 */
const PROMPT_TEMPLATES = {
  SYSTEM_ANALYSIS: {
    name: 'system_analysis',
    type: 'system',
    version: 1,
    temperature: 0.2,
    model: 'gpt-4o-mini',
    text: `You are a procedural insurance correspondence analyzer. You provide FACTUAL analysis only.

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

Provide analysis in JSON format with factual extraction only.`
  },
  
  SYSTEM_GENERATION_V1: {
    name: 'system_generation',
    type: 'system',
    version: 1,
    temperature: 0.3,
    model: 'gpt-4o-mini',
    text: `You are a professional insurance claim correspondence specialist generating formal business letters.

CRITICAL REQUIREMENTS:

1. CITATION ACCURACY:
   - Use ONLY verified citations provided in the context
   - Use EXACT citation format (do not modify)
   - Include citations ONLY when directly relevant
   - NEVER create or invent citations

2. SPECIFICITY REQUIREMENTS:
   - Include specific dates (not "recently" or "soon")
   - Include specific amounts (not "appropriate compensation")
   - Include specific claim/policy numbers
   - Include specific deadlines (not "as soon as possible")

3. PROFESSIONAL LANGUAGE:
   - Use formal business letter format
   - Avoid emotional language (unfair, frustrated, disappointed)
   - Avoid adversarial language (sue, demand, insist)
   - Avoid generic AI phrases (I am writing to inform you)
   - Use direct, factual statements

4. STRUCTURE REQUIREMENTS:
   - Complete business letter format
   - RE: line with claim number, policy number, date of loss
   - Acknowledge their letter with specific date
   - State disagreement with specific facts
   - Request specific action with deadline
   - Include contact information

5. PROHIBITED CONTENT:
   - NO emotional appeals
   - NO threats of litigation
   - NO accusations of bad faith
   - NO narrative storytelling
   - NO speculation or opinions

OUTPUT FORMAT:
Generate a complete, professional business letter ready to print, sign, and mail.`
  },
  
  SYSTEM_GENERATION_V2_HIGH_SPECIFICITY: {
    name: 'system_generation',
    type: 'system',
    version: 2,
    temperature: 0.3,
    model: 'gpt-4o-mini',
    text: `You are a professional insurance claim correspondence specialist generating formal business letters.

CRITICAL REQUIREMENTS:

1. CITATION ACCURACY (HIGHEST PRIORITY):
   - Use ONLY verified citations provided in the context
   - Use EXACT citation format (do not modify)
   - Include citations ONLY when directly relevant
   - NEVER create or invent citations
   - If no citations provided, do NOT create any

2. SPECIFICITY REQUIREMENTS (MANDATORY):
   - MUST include specific dates in MM/DD/YYYY format
   - MUST include specific dollar amounts with $ symbol
   - MUST include claim number and policy number
   - MUST include specific deadline (date, not "soon")
   - MUST reference specific policy sections if applicable
   - MUST include specific incident details (date, location, what happened)

3. PROFESSIONAL LANGUAGE (STRICT):
   - Use formal business letter format
   - NEVER use emotional words: unfair, frustrated, disappointed, upset, angry
   - NEVER use adversarial words: sue, lawsuit, litigation, demand, insist
   - NEVER use generic AI phrases: "I am writing to inform you", "at your earliest convenience", "I look forward to"
   - Use direct, factual statements only

4. STRUCTURE REQUIREMENTS (COMPLETE):
   - Sender address (top left)
   - Date (below sender address)
   - Recipient address (below date)
   - RE: line with Claim #, Policy #, Date of Loss
   - Professional salutation (Dear Claims Adjuster:)
   - Opening: Acknowledge their letter with specific date
   - Body: State disagreement with specific facts and amounts
   - Request: State exactly what you want with specific deadline
   - Contact: Phone and email
   - Closing: Sincerely, [signature line], [printed name]

5. PROHIBITED CONTENT (NEVER INCLUDE):
   - NO emotional appeals or subjective statements
   - NO threats of litigation (unless already in litigation)
   - NO accusations of bad faith (unless citing specific statute)
   - NO narrative storytelling or background explanations
   - NO speculation, opinions, or interpretations
   - NO legal advice or strategy

QUALITY CHECKLIST (verify before output):
✓ Specific date in letter header
✓ Specific claim number and policy number in RE: line
✓ Specific date of their letter acknowledged
✓ Specific dollar amount stated
✓ Specific deadline for response (date format)
✓ No emotional language
✓ No generic AI phrases
✓ No invented citations
✓ Professional closing with contact info

OUTPUT FORMAT:
Generate a complete, professional business letter that scores 85%+ on quality assessment.`
  }
};

// ============================================================================
// PROMPT VERSION MANAGEMENT
// ============================================================================

/**
 * Save prompt version to database
 * @param {Object} promptData - Prompt configuration
 * @returns {Object} - Saved prompt version
 */
async function savePromptVersion(promptData) {
  const {
    promptName,
    promptType,
    version,
    promptText,
    promptVariables = {},
    temperature,
    maxTokens,
    model,
    status = 'draft',
    isDefault = false,
    notes = ''
  } = promptData;
  
  try {
    const supabase = getSupabaseAdmin();
    
    // If setting as default, unset other defaults first
    if (isDefault) {
      await supabase
        .from('prompt_versions')
        .update({ is_default: false })
        .eq('prompt_name', promptName);
    }
    
    const { data, error } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_name: promptName,
        prompt_type: promptType,
        version,
        prompt_text: promptText,
        prompt_variables: promptVariables,
        temperature,
        max_tokens: maxTokens,
        model,
        status,
        is_default: isDefault,
        notes,
        usage_count: 0
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('Prompt version saved:', data.id);
    return { success: true, promptVersion: data };
    
  } catch (error) {
    console.error('Failed to save prompt version:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get active prompt version
 * @param {string} promptName - Prompt name
 * @returns {Object} - Active prompt version
 */
async function getActivePromptVersion(promptName) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_name', promptName)
      .eq('is_default', true)
      .single();
    
    if (error) {
      // If no default found, get latest active version
      const { data: fallback } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('prompt_name', promptName)
        .eq('status', 'active')
        .order('version', { ascending: false })
        .limit(1)
        .single();
      
      return fallback || null;
    }
    
    return data;
    
  } catch (error) {
    console.error('Failed to get active prompt version:', error);
    return null;
  }
}

/**
 * Update prompt performance metrics
 * @param {string} promptVersionId - Prompt version ID
 * @param {Object} metrics - Performance metrics
 */
async function updatePromptMetrics(promptVersionId, metrics) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get current metrics
    const { data: current } = await supabase
      .from('prompt_versions')
      .select('usage_count, average_quality_score, average_citation_score, success_rate')
      .eq('id', promptVersionId)
      .single();
    
    if (!current) return { success: false, error: 'Prompt version not found' };
    
    // Calculate new averages
    const newUsageCount = current.usage_count + 1;
    const newAvgQuality = current.average_quality_score
      ? Math.round(((current.average_quality_score * current.usage_count) + metrics.qualityScore) / newUsageCount)
      : metrics.qualityScore;
    const newAvgCitation = current.average_citation_score
      ? Math.round(((current.average_citation_score * current.usage_count) + metrics.citationScore) / newUsageCount)
      : metrics.citationScore;
    
    // Update success rate if outcome provided
    let newSuccessRate = current.success_rate;
    if (metrics.outcomeResult) {
      const successCount = current.success_rate 
        ? Math.round((current.success_rate / 100) * current.usage_count)
        : 0;
      const newSuccessCount = successCount + (metrics.outcomeResult === 'success' || metrics.outcomeResult === 'partial_success' ? 1 : 0);
      newSuccessRate = (newSuccessCount / newUsageCount) * 100;
    }
    
    const { error } = await supabase
      .from('prompt_versions')
      .update({
        usage_count: newUsageCount,
        average_quality_score: newAvgQuality,
        average_citation_score: newAvgCitation,
        success_rate: newSuccessRate
      })
      .eq('id', promptVersionId);
    
    if (error) throw error;
    
    console.log('Prompt metrics updated:', promptVersionId);
    return { success: true };
    
  } catch (error) {
    console.error('Failed to update prompt metrics:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// OPTIMIZATION RECOMMENDATIONS
// ============================================================================

/**
 * Analyze prompt performance and generate optimization recommendations
 * @param {string} promptName - Prompt name
 * @returns {Object} - Optimization recommendations
 */
async function analyzePromptPerformance(promptName) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get all versions of this prompt
    const { data: versions, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_name', promptName)
      .order('version', { ascending: false });
    
    if (error) throw error;
    
    if (!versions || versions.length === 0) {
      return {
        promptName,
        message: 'No prompt versions found'
      };
    }
    
    // Find best performing version
    const versionsWithData = versions.filter(v => v.usage_count >= 10);
    
    if (versionsWithData.length === 0) {
      return {
        promptName,
        message: 'Insufficient usage data (minimum 10 uses per version required)'
      };
    }
    
    // Sort by composite score
    versionsWithData.forEach(v => {
      v.compositeScore = (
        (v.average_quality_score || 0) * 0.4 +
        (v.average_citation_score || 0) * 0.3 +
        (v.success_rate || 0) * 0.3
      );
    });
    
    versionsWithData.sort((a, b) => b.compositeScore - a.compositeScore);
    
    const bestVersion = versionsWithData[0];
    const currentVersion = versions.find(v => v.is_default) || versions[0];
    
    // Generate recommendations
    const recommendations = [];
    
    if (bestVersion.id !== currentVersion.id) {
      const improvement = bestVersion.compositeScore - currentVersion.compositeScore;
      recommendations.push({
        type: 'version_upgrade',
        priority: 'high',
        message: `Version ${bestVersion.version} performs ${improvement.toFixed(1)} points better than current version`,
        action: `Set version ${bestVersion.version} as default`,
        expectedImprovement: improvement.toFixed(1)
      });
    }
    
    // Analyze quality scores
    if (currentVersion.average_quality_score < 85) {
      recommendations.push({
        type: 'quality_improvement',
        priority: 'high',
        message: `Current quality score (${currentVersion.average_quality_score}) is below target (85)`,
        action: 'Enhance specificity requirements in prompt',
        expectedImprovement: '5-10 points'
      });
    }
    
    // Analyze citation scores
    if (currentVersion.average_citation_score < 95) {
      recommendations.push({
        type: 'citation_improvement',
        priority: 'high',
        message: `Current citation score (${currentVersion.average_citation_score}) is below target (95)`,
        action: 'Strengthen citation constraints in prompt',
        expectedImprovement: '5-10 points'
      });
    }
    
    // Analyze success rate
    if (currentVersion.success_rate && currentVersion.success_rate < 85) {
      recommendations.push({
        type: 'success_improvement',
        priority: 'critical',
        message: `Current success rate (${currentVersion.success_rate.toFixed(1)}%) is below target (85%)`,
        action: 'Review failed cases and adjust prompt accordingly',
        expectedImprovement: '10-15%'
      });
    }
    
    return {
      promptName,
      currentVersion: {
        version: currentVersion.version,
        usageCount: currentVersion.usage_count,
        avgQualityScore: currentVersion.average_quality_score,
        avgCitationScore: currentVersion.average_citation_score,
        successRate: currentVersion.success_rate,
        compositeScore: currentVersion.compositeScore
      },
      bestVersion: {
        version: bestVersion.version,
        usageCount: bestVersion.usage_count,
        avgQualityScore: bestVersion.average_quality_score,
        avgCitationScore: bestVersion.average_citation_score,
        successRate: bestVersion.success_rate,
        compositeScore: bestVersion.compositeScore
      },
      allVersions: versionsWithData.map(v => ({
        version: v.version,
        usageCount: v.usage_count,
        compositeScore: Math.round(v.compositeScore)
      })),
      recommendations,
      shouldUpgrade: bestVersion.id !== currentVersion.id && bestVersion.compositeScore > currentVersion.compositeScore + 5
    };
    
  } catch (error) {
    console.error('Failed to analyze prompt performance:', error);
    return null;
  }
}

/**
 * Generate optimization suggestions based on failure patterns
 * @param {string} promptName - Prompt name
 * @returns {Object} - Optimization suggestions
 */
async function generateOptimizationSuggestions(promptName) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get recent failures for this prompt
    const { data: currentPrompt } = await supabase
      .from('prompt_versions')
      .select('id')
      .eq('prompt_name', promptName)
      .eq('is_default', true)
      .single();
    
    if (!currentPrompt) {
      return { message: 'No active prompt version found' };
    }
    
    // Get quality metrics for letters generated with this prompt
    const { data: qualityData } = await supabase
      .from('quality_metrics')
      .select('generic_phrases, issues, overall_quality_score')
      .lt('overall_quality_score', 85)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!qualityData || qualityData.length === 0) {
      return {
        message: 'No quality issues found - prompt is performing well',
        currentPerformance: 'excellent'
      };
    }
    
    // Analyze common issues
    const issueFrequency = {};
    qualityData.forEach(qm => {
      if (qm.issues) {
        qm.issues.forEach(issue => {
          const key = `${issue.type}:${issue.phrase || issue.category || issue.element}`;
          issueFrequency[key] = (issueFrequency[key] || 0) + 1;
        });
      }
    });
    
    // Sort by frequency
    const commonIssues = Object.entries(issueFrequency)
      .map(([key, count]) => {
        const [type, detail] = key.split(':');
        return { type, detail, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Generate specific suggestions
    const suggestions = commonIssues.map(issue => {
      return generateSuggestionForIssue(issue);
    });
    
    return {
      promptName,
      analyzedSamples: qualityData.length,
      commonIssues,
      suggestions,
      overallRecommendation: generateOverallRecommendation(commonIssues)
    };
    
  } catch (error) {
    console.error('Failed to generate optimization suggestions:', error);
    return null;
  }
}

/**
 * Generate suggestion for specific issue
 */
function generateSuggestionForIssue(issue) {
  const suggestionMap = {
    generic_language: {
      action: 'Add stronger prohibition against generic phrases',
      promptAddition: `PROHIBITED PHRASES: ${issue.detail}\nREQUIRED: Use specific language instead`
    },
    emotional_language: {
      action: 'Strengthen emotional language prohibition',
      promptAddition: `NEVER use emotional words like "${issue.detail}". State facts only.`
    },
    adversarial_language: {
      action: 'Strengthen adversarial language prohibition',
      promptAddition: `NEVER use adversarial words like "${issue.detail}". Maintain professional tone.`
    },
    missing_specificity: {
      action: 'Make specificity requirements mandatory',
      promptAddition: `MANDATORY: Include specific ${issue.detail} in every letter`
    },
    missing_structure: {
      action: 'Add structure requirement to checklist',
      promptAddition: `REQUIRED ELEMENT: ${issue.detail}`
    }
  };
  
  const suggestion = suggestionMap[issue.type] || {
    action: `Address ${issue.type} issue`,
    promptAddition: `Review and improve handling of ${issue.detail}`
  };
  
  return {
    issue: issue.detail,
    frequency: issue.count,
    severity: issue.count > 10 ? 'high' : issue.count > 5 ? 'medium' : 'low',
    ...suggestion
  };
}

/**
 * Generate overall recommendation
 */
function generateOverallRecommendation(commonIssues) {
  if (commonIssues.length === 0) {
    return {
      action: 'maintain',
      message: 'Current prompt is performing well. Continue monitoring.'
    };
  }
  
  const highFrequencyIssues = commonIssues.filter(i => i.count > 10);
  
  if (highFrequencyIssues.length > 0) {
    return {
      action: 'urgent_revision',
      message: `${highFrequencyIssues.length} high-frequency issues detected. Prompt revision recommended.`,
      priority: 'high'
    };
  }
  
  return {
    action: 'minor_revision',
    message: `${commonIssues.length} issues detected. Consider minor prompt improvements.`,
    priority: 'medium'
  };
}

// ============================================================================
// AUTOMATIC OPTIMIZATION
// ============================================================================

/**
 * Automatically generate optimized prompt version
 * @param {string} promptName - Prompt name to optimize
 * @returns {Object} - New optimized prompt version
 */
async function generateOptimizedPrompt(promptName) {
  try {
    // Get current prompt
    const currentPrompt = await getActivePromptVersion(promptName);
    if (!currentPrompt) {
      return { success: false, error: 'No active prompt found' };
    }
    
    // Get optimization suggestions
    const suggestions = await generateOptimizationSuggestions(promptName);
    if (!suggestions || suggestions.suggestions.length === 0) {
      return { success: false, error: 'No optimization suggestions available' };
    }
    
    // Build optimized prompt text
    let optimizedText = currentPrompt.prompt_text;
    
    // Add top 5 suggestions to prompt
    const topSuggestions = suggestions.suggestions.slice(0, 5);
    const additions = topSuggestions
      .map(s => s.promptAddition)
      .join('\n');
    
    optimizedText += `\n\nADDITIONAL CONSTRAINTS (based on quality analysis):\n${additions}`;
    
    // Create new version
    const newVersion = {
      promptName: currentPrompt.prompt_name,
      promptType: currentPrompt.prompt_type,
      version: currentPrompt.version + 1,
      promptText: optimizedText,
      promptVariables: currentPrompt.prompt_variables,
      temperature: currentPrompt.temperature,
      maxTokens: currentPrompt.max_tokens,
      model: currentPrompt.model,
      status: 'testing',
      isDefault: false,
      notes: `Auto-generated optimization based on ${suggestions.analyzedSamples} samples. Addresses: ${topSuggestions.map(s => s.issue).join(', ')}`
    };
    
    const result = await savePromptVersion(newVersion);
    
    return {
      success: result.success,
      newVersion: result.promptVersion,
      basedOn: currentPrompt.version,
      improvements: topSuggestions.map(s => s.issue),
      recommendation: 'Test this version with A/B testing before setting as default'
    };
    
  } catch (error) {
    console.error('Failed to generate optimized prompt:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Compare prompt versions
 * @param {string} promptName - Prompt name
 * @param {number} version1 - First version number
 * @param {number} version2 - Second version number
 * @returns {Object} - Comparison results
 */
async function comparePromptVersions(promptName, version1, version2) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: versions, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_name', promptName)
      .in('version', [version1, version2]);
    
    if (error) throw error;
    
    if (!versions || versions.length !== 2) {
      return { success: false, error: 'Could not find both versions' };
    }
    
    const v1 = versions.find(v => v.version === version1);
    const v2 = versions.find(v => v.version === version2);
    
    const comparison = {
      version1: {
        version: v1.version,
        usageCount: v1.usage_count,
        avgQualityScore: v1.average_quality_score,
        avgCitationScore: v1.average_citation_score,
        successRate: v1.success_rate,
        compositeScore: calculateCompositeScore(v1)
      },
      version2: {
        version: v2.version,
        usageCount: v2.usage_count,
        avgQualityScore: v2.average_quality_score,
        avgCitationScore: v2.average_citation_score,
        successRate: v2.success_rate,
        compositeScore: calculateCompositeScore(v2)
      },
      differences: {
        qualityScore: (v2.average_quality_score || 0) - (v1.average_quality_score || 0),
        citationScore: (v2.average_citation_score || 0) - (v1.average_citation_score || 0),
        successRate: (v2.success_rate || 0) - (v1.success_rate || 0),
        compositeScore: calculateCompositeScore(v2) - calculateCompositeScore(v1)
      },
      winner: determineVersionWinner(v1, v2),
      recommendation: generateVersionRecommendation(v1, v2)
    };
    
    return { success: true, comparison };
    
  } catch (error) {
    console.error('Failed to compare prompt versions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate composite score for prompt version
 */
function calculateCompositeScore(version) {
  return (
    (version.average_quality_score || 0) * 0.4 +
    (version.average_citation_score || 0) * 0.3 +
    (version.success_rate || 0) * 0.3
  );
}

/**
 * Determine winner between two versions
 */
function determineVersionWinner(v1, v2) {
  const score1 = calculateCompositeScore(v1);
  const score2 = calculateCompositeScore(v2);
  
  if (Math.abs(score2 - score1) < 3) {
    return 'tie';
  }
  
  return score2 > score1 ? `version_${v2.version}` : `version_${v1.version}`;
}

/**
 * Generate recommendation for version comparison
 */
function generateVersionRecommendation(v1, v2) {
  const winner = determineVersionWinner(v1, v2);
  
  if (winner === 'tie') {
    return {
      action: 'continue_testing',
      message: 'Performance is similar. Continue collecting data or test new variations.'
    };
  }
  
  const winningVersion = winner === `version_${v2.version}` ? v2 : v1;
  
  return {
    action: 'adopt_winner',
    message: `Version ${winningVersion.version} shows better performance. Consider setting as default.`,
    version: winningVersion.version
  };
}

// ============================================================================
// PROMPT LIBRARY INITIALIZATION
// ============================================================================

/**
 * Initialize prompt library with templates
 */
async function initializePromptLibrary() {
  try {
    const results = [];
    
    for (const [key, template] of Object.entries(PROMPT_TEMPLATES)) {
      const result = await savePromptVersion({
        promptName: template.name,
        promptType: template.type,
        version: template.version,
        promptText: template.text,
        temperature: template.temperature,
        model: template.model,
        status: 'active',
        isDefault: template.version === 1,
        notes: `Initial template: ${key}`
      });
      
      results.push(result);
    }
    
    return {
      success: true,
      initialized: results.filter(r => r.success).length,
      total: results.length
    };
    
  } catch (error) {
    console.error('Failed to initialize prompt library:', error);
    return { success: false, error: error.message };
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
    const path = event.path.replace('/.netlify/functions/prompt-optimization-engine', '');
    const method = event.httpMethod;
    
    // POST /save - Save prompt version
    if (method === 'POST' && path === '/save') {
      const promptData = JSON.parse(event.body || '{}');
      const result = await savePromptVersion(promptData);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // GET /active - Get active prompt version
    if (method === 'GET' && path.startsWith('/active/')) {
      const promptName = path.replace('/active/', '');
      const promptVersion = await getActivePromptVersion(promptName);
      return {
        statusCode: promptVersion ? 200 : 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ promptVersion })
      };
    }
    
    // GET /analyze - Analyze prompt performance
    if (method === 'GET' && path.startsWith('/analyze/')) {
      const promptName = path.replace('/analyze/', '');
      const analysis = await analyzePromptPerformance(promptName);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(analysis)
      };
    }
    
    // GET /suggestions - Get optimization suggestions
    if (method === 'GET' && path.startsWith('/suggestions/')) {
      const promptName = path.replace('/suggestions/', '');
      const suggestions = await generateOptimizationSuggestions(promptName);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(suggestions)
      };
    }
    
    // POST /optimize - Generate optimized prompt
    if (method === 'POST' && path === '/optimize') {
      const { promptName } = JSON.parse(event.body || '{}');
      const result = await generateOptimizedPrompt(promptName);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // GET /compare - Compare prompt versions
    if (method === 'GET' && path.includes('/compare/')) {
      const parts = path.replace('/compare/', '').split('/');
      const promptName = parts[0];
      const version1 = parseInt(parts[1]);
      const version2 = parseInt(parts[2]);
      
      const result = await comparePromptVersions(promptName, version1, version2);
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // POST /initialize - Initialize prompt library
    if (method === 'POST' && path === '/initialize') {
      const result = await initializePromptLibrary();
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
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
    console.error('Prompt optimization error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Prompt optimization failed',
        details: error.message
      })
    };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  savePromptVersion,
  getActivePromptVersion,
  updatePromptMetrics,
  analyzePromptPerformance,
  generateOptimizationSuggestions,
  generateOptimizedPrompt,
  comparePromptVersions,
  initializePromptLibrary,
  PROMPT_TEMPLATES
};
