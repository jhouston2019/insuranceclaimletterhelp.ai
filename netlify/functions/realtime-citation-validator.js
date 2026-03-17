/**
 * REAL-TIME CITATION VALIDATION
 * 
 * Proactive prevention of citation errors during generation.
 * 
 * FEATURES:
 * - Streaming validation during AI generation
 * - Immediate hallucination detection
 * - Citation correction suggestions
 * - Real-time quality scoring
 * - Automatic regeneration triggers
 * 
 * PREVENTS:
 * - Hallucinated citations from being generated
 * - Invalid state code references
 * - Misapplied federal regulations
 * - Generic citation language
 */

const { 
  extractCitations, 
  verifyCitation,
  detectHallucinatedCitations,
  getRelevantCitations 
} = require("./citation-verification-system");

const { createLogger, EVENT_TYPES } = require("./structured-logging-system");

// ============================================================================
// REAL-TIME VALIDATION ENGINE
// ============================================================================

/**
 * Validate text chunk in real-time
 * @param {string} textChunk - Partial generated text
 * @param {Object} context - Validation context
 * @returns {Object} - Validation result
 */
function validateTextChunk(textChunk, context) {
  const { state, claimType } = context;
  
  // Extract any citations in this chunk
  const citations = extractCitations(textChunk);
  
  if (citations.length === 0) {
    return {
      valid: true,
      hasCitations: false,
      warnings: []
    };
  }
  
  // Verify each citation
  const verificationResults = citations.map(citation => {
    const result = verifyCitation(citation.fullText, state, claimType);
    return {
      citation: citation.fullText,
      ...result
    };
  });
  
  // Check for hallucinations
  const hallucinationCheck = detectHallucinatedCitations(textChunk);
  
  // Determine if chunk is valid
  const hasUnverifiedCitations = verificationResults.some(r => !r.verified);
  const hasHallucinations = hallucinationCheck.hasIssues;
  
  const warnings = [];
  
  if (hasUnverifiedCitations) {
    warnings.push({
      type: 'unverified_citation',
      severity: 'high',
      message: 'Unverified citation detected',
      citations: verificationResults.filter(r => !r.verified).map(r => r.citation)
    });
  }
  
  if (hasHallucinations) {
    warnings.push({
      type: 'hallucination',
      severity: 'critical',
      message: 'Potential hallucinated citation detected',
      issues: hallucinationCheck.issues
    });
  }
  
  return {
    valid: !hasUnverifiedCitations && !hasHallucinations,
    hasCitations: true,
    citationCount: citations.length,
    verifiedCount: verificationResults.filter(r => r.verified).length,
    unverifiedCount: verificationResults.filter(r => !r.verified).length,
    verificationResults,
    hallucinationCheck,
    warnings,
    shouldRegenerate: hasHallucinations || (hasUnverifiedCitations && citations.length > 0)
  };
}

/**
 * Validate complete generated text
 * @param {string} fullText - Complete generated text
 * @param {Object} context - Validation context
 * @returns {Object} - Complete validation result
 */
function validateCompleteText(fullText, context) {
  const { state, claimType } = context;
  
  // Extract all citations
  const citations = extractCitations(fullText);
  
  // Verify each citation
  const verificationResults = citations.map(citation => {
    const result = verifyCitation(citation.fullText, state, claimType);
    return {
      citation: citation.fullText,
      position: citation.position,
      ...result
    };
  });
  
  // Check for hallucinations
  const hallucinationCheck = detectHallucinatedCitations(fullText);
  
  // Calculate scores
  const totalCitations = citations.length;
  const verifiedCitations = verificationResults.filter(r => r.verified).length;
  const accurateCitations = verificationResults.filter(r => r.accurate).length;
  
  const verificationRate = totalCitations > 0 ? (verifiedCitations / totalCitations) * 100 : 100;
  const accuracyRate = totalCitations > 0 ? (accurateCitations / totalCitations) * 100 : 100;
  
  // Quality score calculation
  let qualityScore = 100;
  qualityScore -= (totalCitations - verifiedCitations) * 20; // -20 per unverified
  qualityScore -= hallucinationCheck.issueCount * 30; // -30 per hallucination
  qualityScore = Math.max(0, qualityScore);
  
  // Collect all warnings
  const warnings = [];
  
  verificationResults.forEach(result => {
    if (!result.verified) {
      warnings.push({
        type: 'unverified_citation',
        severity: 'high',
        citation: result.citation,
        position: result.position,
        message: 'Citation not found in verification database',
        recommendation: 'Remove this citation'
      });
    } else if (!result.accurate) {
      warnings.push({
        type: 'inapplicable_citation',
        severity: 'medium',
        citation: result.citation,
        position: result.position,
        message: result.warning,
        recommendation: 'Verify applicability or remove'
      });
    }
  });
  
  if (hallucinationCheck.hasIssues) {
    hallucinationCheck.issues.forEach(issue => {
      warnings.push({
        type: 'hallucination',
        severity: 'critical',
        text: issue.text,
        message: issue.reason,
        recommendation: 'Remove and regenerate'
      });
    });
  }
  
  return {
    valid: qualityScore >= 95,
    hasCitations: totalCitations > 0,
    citationMetrics: {
      total: totalCitations,
      verified: verifiedCitations,
      accurate: accurateCitations,
      verificationRate: Math.round(verificationRate),
      accuracyRate: Math.round(accuracyRate)
    },
    qualityScore,
    hallucinationCheck,
    warnings,
    criticalWarnings: warnings.filter(w => w.severity === 'critical').length,
    highWarnings: warnings.filter(w => w.severity === 'high').length,
    passesValidation: qualityScore >= 95 && warnings.filter(w => w.severity === 'critical').length === 0,
    shouldRegenerate: qualityScore < 80 || warnings.filter(w => w.severity === 'critical').length > 0,
    recommendations: generateValidationRecommendations(warnings, qualityScore)
  };
}

/**
 * Generate recommendations from validation warnings
 */
function generateValidationRecommendations(warnings, qualityScore) {
  const recommendations = [];
  
  const criticalWarnings = warnings.filter(w => w.severity === 'critical');
  const highWarnings = warnings.filter(w => w.severity === 'high');
  
  if (criticalWarnings.length > 0) {
    recommendations.push({
      priority: 'critical',
      action: 'regenerate',
      message: `${criticalWarnings.length} critical citation issues detected. Regenerate letter immediately.`,
      issues: criticalWarnings.map(w => w.text || w.citation)
    });
  }
  
  if (highWarnings.length > 0) {
    recommendations.push({
      priority: 'high',
      action: 'review',
      message: `${highWarnings.length} unverified citations detected. Review before sending.`,
      issues: highWarnings.map(w => w.citation)
    });
  }
  
  if (qualityScore < 95 && qualityScore >= 80) {
    recommendations.push({
      priority: 'medium',
      action: 'improve',
      message: 'Citation quality is acceptable but could be improved. Consider regenerating with stricter constraints.',
      currentScore: qualityScore,
      targetScore: 95
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'none',
      action: 'approve',
      message: 'All citations verified. Letter is ready to send.',
      qualityScore
    });
  }
  
  return recommendations;
}

// ============================================================================
// CITATION CORRECTION ENGINE
// ============================================================================

/**
 * Suggest corrections for invalid citations
 * @param {string} invalidCitation - Invalid citation text
 * @param {Object} context - Context for suggestions
 * @returns {Object} - Correction suggestions
 */
function suggestCitationCorrections(invalidCitation, context) {
  const { state, claimType, phase, issueType } = context;
  
  // Get relevant citations that could be used instead
  const relevantCitations = getRelevantCitations(state, claimType, phase, issueType);
  
  if (relevantCitations.length === 0) {
    return {
      hasSuggestions: false,
      message: 'No verified citations available for this scenario',
      recommendation: 'Remove citation'
    };
  }
  
  return {
    hasSuggestions: true,
    invalidCitation,
    suggestedReplacements: relevantCitations.map(c => ({
      citation: c.citation,
      summary: c.summary,
      relevanceScore: c.relevanceScore,
      reason: `This citation applies to ${c.applicableTo.join(', ')}`
    })),
    recommendation: 'Replace with one of the suggested verified citations'
  };
}

/**
 * Auto-correct common citation errors
 * @param {string} text - Text with potential citation errors
 * @param {Object} context - Context for corrections
 * @returns {Object} - Corrected text and changes made
 */
function autoCorrectCitations(text, context) {
  let correctedText = text;
  const corrections = [];
  
  // Common error patterns and corrections
  const errorPatterns = [
    {
      pattern: /state law requires/gi,
      replacement: '[Specific state code citation required]',
      reason: 'Vague reference - needs specific citation'
    },
    {
      pattern: /according to regulations/gi,
      replacement: '[Specific regulation citation required]',
      reason: 'Vague reference - needs specific citation'
    },
    {
      pattern: /under applicable law/gi,
      replacement: '[Specific law citation required]',
      reason: 'Vague reference - needs specific citation'
    },
    {
      pattern: /insurance code section \d+(?!\.\d)/gi,
      replacement: (match) => {
        const num = match.match(/\d+/)[0];
        return `[Verify: Insurance Code § ${num}]`;
      },
      reason: 'Incomplete citation - needs verification'
    }
  ];
  
  errorPatterns.forEach(pattern => {
    const matches = correctedText.match(pattern.pattern);
    if (matches) {
      matches.forEach(match => {
        const replacement = typeof pattern.replacement === 'function' 
          ? pattern.replacement(match)
          : pattern.replacement;
        
        correctedText = correctedText.replace(match, replacement);
        
        corrections.push({
          original: match,
          corrected: replacement,
          reason: pattern.reason
        });
      });
    }
  });
  
  return {
    correctedText,
    corrections,
    changesMade: corrections.length > 0
  };
}

// ============================================================================
// REGENERATION TRIGGERS
// ============================================================================

/**
 * Determine if text should be regenerated
 * @param {Object} validationResult - Validation result
 * @returns {Object} - Regeneration decision
 */
function shouldRegenerateText(validationResult) {
  const criticalIssues = validationResult.criticalWarnings || 0;
  const qualityScore = validationResult.qualityScore || 0;
  
  if (criticalIssues > 0) {
    return {
      shouldRegenerate: true,
      reason: 'critical_citation_issues',
      priority: 'immediate',
      message: `${criticalIssues} critical citation issues detected. Regeneration required.`
    };
  }
  
  if (qualityScore < 70) {
    return {
      shouldRegenerate: true,
      reason: 'low_quality_score',
      priority: 'high',
      message: `Citation quality score (${qualityScore}) is below threshold (70). Regeneration recommended.`
    };
  }
  
  if (validationResult.highWarnings > 3) {
    return {
      shouldRegenerate: true,
      reason: 'multiple_high_warnings',
      priority: 'medium',
      message: `${validationResult.highWarnings} high-priority warnings. Regeneration recommended.`
    };
  }
  
  return {
    shouldRegenerate: false,
    reason: 'quality_acceptable',
    priority: 'none',
    message: 'Citation quality is acceptable. No regeneration needed.'
  };
}

/**
 * Build regeneration prompt with corrections
 * @param {string} originalPrompt - Original prompt
 * @param {Object} validationResult - Validation result
 * @returns {string} - Enhanced prompt for regeneration
 */
function buildRegenerationPrompt(originalPrompt, validationResult) {
  const issues = validationResult.warnings || [];
  
  let regenerationInstructions = '\n\nREGENERATION REQUIRED:\n';
  regenerationInstructions += 'The previous generation had citation issues. Please regenerate with these corrections:\n\n';
  
  issues.forEach((warning, index) => {
    regenerationInstructions += `${index + 1}. ${warning.message}\n`;
    regenerationInstructions += `   - Issue: ${warning.citation || warning.text}\n`;
    regenerationInstructions += `   - Action: ${warning.recommendation}\n\n`;
  });
  
  regenerationInstructions += 'CRITICAL: Do NOT include any citations that are not explicitly provided in the verified citations list.\n';
  regenerationInstructions += 'If you cannot find a relevant verified citation, do NOT create one.\n';
  
  return originalPrompt + regenerationInstructions;
}

// ============================================================================
// CITATION SAFETY WRAPPER
// ============================================================================

/**
 * Wrap AI generation with citation validation
 * @param {Function} generationFunction - AI generation function
 * @param {Object} context - Generation context
 * @param {number} maxAttempts - Maximum regeneration attempts
 * @returns {Object} - Validated generation result
 */
async function generateWithCitationValidation(generationFunction, context, maxAttempts = 3) {
  const logger = createLogger(context);
  let attempt = 1;
  let lastValidationResult = null;
  
  while (attempt <= maxAttempts) {
    console.log(`Generation attempt ${attempt}/${maxAttempts}`);
    
    try {
      // Generate text
      const generationResult = await generationFunction(context, attempt);
      
      if (!generationResult.success) {
        throw new Error(generationResult.error || 'Generation failed');
      }
      
      const generatedText = generationResult.text;
      
      // Validate citations in real-time
      const validationResult = validateCompleteText(generatedText, {
        state: context.state,
        claimType: context.claimType
      });
      
      lastValidationResult = validationResult;
      
      await logger.info(EVENT_TYPES.CITATION_VERIFICATION, {
        attempt,
        quality_score: validationResult.qualityScore,
        passes_validation: validationResult.passesValidation,
        warnings: validationResult.warnings.length
      });
      
      // Check if validation passed
      if (validationResult.passesValidation) {
        console.log(`✅ Validation passed on attempt ${attempt}`);
        
        return {
          success: true,
          text: generatedText,
          attempt,
          validationResult,
          message: 'Generation successful with valid citations'
        };
      }
      
      // Check if should regenerate
      const regenerationDecision = shouldRegenerateText(validationResult);
      
      if (!regenerationDecision.shouldRegenerate || attempt === maxAttempts) {
        console.log(`⚠️ Validation issues on attempt ${attempt}, but continuing`);
        
        return {
          success: true,
          text: generatedText,
          attempt,
          validationResult,
          warnings: validationResult.warnings,
          message: 'Generation completed with warnings'
        };
      }
      
      // Regenerate with corrections
      console.log(`🔄 Regenerating due to: ${regenerationDecision.reason}`);
      
      // Update context with regeneration instructions
      context.regenerationInstructions = buildRegenerationPrompt(
        context.originalPrompt || '',
        validationResult
      );
      
      attempt++;
      
    } catch (error) {
      console.error(`Generation attempt ${attempt} failed:`, error);
      
      await logger.error(EVENT_TYPES.GENERATION_FAILED, error, {
        attempt,
        max_attempts: maxAttempts
      });
      
      if (attempt === maxAttempts) {
        return {
          success: false,
          error: error.message,
          attempt,
          lastValidationResult,
          message: 'All generation attempts failed'
        };
      }
      
      attempt++;
    }
  }
  
  return {
    success: false,
    error: 'Max attempts reached',
    attempt: maxAttempts,
    lastValidationResult,
    message: 'Could not generate valid letter within attempt limit'
  };
}

// ============================================================================
// CITATION QUALITY MONITORING
// ============================================================================

/**
 * Monitor citation quality in real-time
 * @param {string} documentId - Document ID
 * @param {Object} validationResult - Validation result
 */
async function monitorCitationQuality(documentId, validationResult) {
  const logger = createLogger({ documentId });
  
  // Log quality metrics
  await logger.info(EVENT_TYPES.CITATION_VERIFICATION, {
    document_id: documentId,
    quality_score: validationResult.qualityScore,
    citation_count: validationResult.citationMetrics?.total || 0,
    verified_count: validationResult.citationMetrics?.verified || 0,
    accuracy_rate: validationResult.citationMetrics?.accuracyRate || 0,
    has_hallucinations: validationResult.hallucinationCheck?.hasIssues || false,
    passes_validation: validationResult.passesValidation
  });
  
  // Alert on critical issues
  if (validationResult.criticalWarnings > 0) {
    await logger.critical(EVENT_TYPES.HALLUCINATION_DETECTED, new Error('Critical citation issues'), {
      document_id: documentId,
      critical_warnings: validationResult.criticalWarnings,
      warnings: validationResult.warnings.filter(w => w.severity === 'critical')
    });
  }
  
  return {
    monitored: true,
    qualityScore: validationResult.qualityScore,
    alertsGenerated: validationResult.criticalWarnings
  };
}

// ============================================================================
// PROACTIVE PREVENTION
// ============================================================================

/**
 * Get citation constraints for prompt
 * @param {Object} context - Generation context
 * @returns {string} - Citation constraints text
 */
function getCitationConstraints(context) {
  const { state, claimType, phase, issueType } = context;
  
  const relevantCitations = getRelevantCitations(state, claimType, phase, issueType);
  
  if (relevantCitations.length === 0) {
    return `
CITATION CONSTRAINTS:
- NO citations are available for this scenario
- DO NOT create or invent any citations
- DO NOT reference any laws, codes, or regulations
- Focus on factual dispute based on policy language only
`;
  }
  
  let constraints = `
CITATION CONSTRAINTS:

VERIFIED CITATIONS AVAILABLE (use ONLY these):
`;
  
  relevantCitations.forEach((citation, index) => {
    constraints += `${index + 1}. ${citation.citation}\n`;
    constraints += `   Summary: ${citation.summary}\n`;
    constraints += `   Applies to: ${citation.applicableTo.join(', ')}\n\n`;
  });
  
  constraints += `
CITATION RULES:
- Use ONLY citations listed above
- Use EXACT format provided (do not modify)
- Include citation ONLY if directly relevant to the specific issue
- If none of the above citations apply, do NOT create new ones
- NEVER invent citation numbers or modify citation text

VERIFICATION:
Any citation not listed above will be flagged as hallucinated and rejected.
`;
  
  return constraints;
}

/**
 * Enhance prompt with proactive citation prevention
 * @param {string} basePrompt - Base prompt
 * @param {Object} context - Generation context
 * @returns {string} - Enhanced prompt
 */
function enhancePromptWithValidation(basePrompt, context) {
  const citationConstraints = getCitationConstraints(context);
  
  const enhancedPrompt = `${basePrompt}

${citationConstraints}

VALIDATION REQUIREMENTS:
Before generating output, verify:
1. All citations are from the verified list above
2. Citation format is exact (not modified)
3. Citations are relevant to the specific issue
4. No vague citation language ("state law requires", "according to regulations")
5. No made-up case names or citation numbers

If you cannot find a relevant verified citation, proceed WITHOUT citations.
It is better to have NO citations than WRONG citations.`;

  return enhancedPrompt;
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  
  try {
    const path = event.path.replace('/.netlify/functions/realtime-citation-validator', '');
    const method = event.httpMethod;
    
    // POST /validate - Validate text
    if (method === 'POST' && path === '/validate') {
      const { text, context } = JSON.parse(event.body || '{}');
      const result = validateCompleteText(text, context);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // POST /validate-chunk - Validate text chunk
    if (method === 'POST' && path === '/validate-chunk') {
      const { textChunk, context } = JSON.parse(event.body || '{}');
      const result = validateTextChunk(textChunk, context);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // POST /suggest-corrections - Get correction suggestions
    if (method === 'POST' && path === '/suggest-corrections') {
      const { invalidCitation, context } = JSON.parse(event.body || '{}');
      const suggestions = suggestCitationCorrections(invalidCitation, context);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(suggestions)
      };
    }
    
    // POST /auto-correct - Auto-correct citations
    if (method === 'POST' && path === '/auto-correct') {
      const { text, context } = JSON.parse(event.body || '{}');
      const result = autoCorrectCitations(text, context);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }
    
    // POST /enhance-prompt - Enhance prompt with validation
    if (method === 'POST' && path === '/enhance-prompt') {
      const { basePrompt, context } = JSON.parse(event.body || '{}');
      const enhancedPrompt = enhancePromptWithValidation(basePrompt, context);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ enhancedPrompt })
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
    console.error('Real-time validation error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Real-time validation failed',
        details: error.message
      })
    };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  validateTextChunk,
  validateCompleteText,
  suggestCitationCorrections,
  autoCorrectCitations,
  shouldRegenerateText,
  buildRegenerationPrompt,
  generateWithCitationValidation,
  monitorCitationQuality,
  getCitationConstraints,
  enhancePromptWithValidation
};
