/**
 * INSURANCE RESPONSE GENERATION FUNCTION
 * 
 * ⚠️ SAFETY LOCK — DO NOT MODIFY ⚠️
 * This system intentionally refuses certain scenarios.
 * Removing guardrails constitutes a safety regression.
 * 
 * HARDENED PROCEDURAL SYSTEM
 * 
 * This function:
 * 1. Checks hard stop conditions (MUST pass)
 * 2. Retrieves appropriate playbook
 * 3. Generates procedural response (NO persuasion, NO strategy)
 * 4. Enforces output constraints
 * 
 * Temperature: 0.2 (deterministic)
 * NO tone/style/approach options
 * NO free-form inputs
 * ONLY procedural templates
 * 
 * REGRESSION WARNING:
 * This file enforces safety boundaries.
 * Any loosening increases user harm risk.
 */

const OpenAI = require("openai");
const { getResponsePlaybook, formatPlaybook } = require("./insurance-response-playbooks");
const { evaluateRisk } = require("./insurance-risk-guardrails");
const { formatResponseOutput, validateOutputLength, sanitizeOutput } = require("./insurance-output-formatter");
const { getSupabaseAdmin } = require("./_supabase");

exports.handler = async (event) => {
  console.log('=== INSURANCE RESPONSE GENERATION START ===');
  
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const { 
      recordId, 
      classification, 
      phase, 
      riskAssessment,
      variables 
    } = JSON.parse(event.body || "{}");
    
    // STEP 1: VERIFY NO HARD STOP CONDITIONS
    console.log('Step 1: Verifying hard stop conditions...');
    
    if (!riskAssessment || riskAssessment.hardStop) {
      console.log('HARD STOP - Cannot generate response');
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Response generation blocked',
          reason: 'Hard stop condition detected. Professional representation required.',
          hardStop: true,
          message: riskAssessment?.message || 'This scenario requires attorney representation.'
        })
      };
    }
    
    if (!riskAssessment.allowSelfResponse) {
      console.log('Self-response not allowed');
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Response generation blocked',
          reason: 'Self-response not recommended for this scenario.',
          message: 'You should consult an attorney or insurance professional before responding.'
        })
      };
    }
    
    // STEP 2: VALIDATE PHASE
    if (!phase || !phase.phase) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Phase not determined',
          message: 'Letter phase must be determined before generating response.'
        })
      };
    }
    
    console.log('Phase validated:', phase.phase);
    
    // STEP 3: GET RESPONSE PLAYBOOK
    console.log('Step 2: Retrieving response playbook...');
    const playbook = getResponsePlaybook(phase.phase, {
      claimType: classification?.claimType,
      denialReason: variables?.denialReason
    });
    
    if (!playbook || !playbook.canRespond) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Response generation not available',
          reason: playbook?.error || 'No playbook available for this phase',
          message: 'This phase does not support automated response generation.'
        })
      };
    }
    
    console.log('Playbook retrieved:', playbook.responseType);
    
    // STEP 4: FORMAT PLAYBOOK WITH VARIABLES
    console.log('Step 3: Formatting playbook...');
    const formattedLetter = formatPlaybook(playbook, variables || {});
    
    if (!formattedLetter) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Playbook formatting failed',
          message: 'Could not generate response from playbook.'
        })
      };
    }
    
    // STEP 5: SANITIZE OUTPUT
    console.log('Step 4: Sanitizing output...');
    const sanitizedLetter = sanitizeOutput(formattedLetter);
    
    // STEP 6: VALIDATE OUTPUT LENGTH
    const lengthValidation = validateOutputLength(sanitizedLetter, playbook.maxTotalLines);
    if (!lengthValidation.valid) {
      console.warn('Output exceeds maximum length:', lengthValidation.message);
    }
    
    // STEP 7: USE AI ONLY FOR VARIABLE SUBSTITUTION (if needed)
    // Temperature 0.2 - deterministic only
    let finalLetter = sanitizedLetter;
    let aiResponse = null;
    
    if (variables?.useAiSubstitution) {
      console.log('Step 5: AI variable substitution...');
      
      try {
        // Try parity layer first
        const { execute } = require('./_parity/parity-gateway');
        
        const systemPrompt = `You are a procedural document formatter. Your ONLY task is to fill in placeholder variables in a template.

CRITICAL CONSTRAINTS:
- Do NOT add content
- Do NOT modify structure
- Do NOT add explanations
- Do NOT use emotional language
- ONLY substitute [PLACEHOLDER] values with provided data

Template variables to substitute:
${JSON.stringify(variables, null, 2)}

Return ONLY the completed template with variables substituted. No additions. No modifications.`;

        const userPrompt = `Substitute variables in this template:\n\n${sanitizedLetter}`;
        
        aiResponse = await execute({
          operation: 'generate',
          systemPrompt,
          userPrompt,
          claimAmount: variables?.claimAmount,
          claimType: classification?.claimType,
          phase: phase.phase,
          riskLevel: riskAssessment.riskLevel,
          letterId: recordId
        });
        
        console.log(`Generation completed using ${aiResponse.provider}/${aiResponse.model}`);
        
        const aiOutput = aiResponse.content || sanitizedLetter;
        finalLetter = sanitizeOutput(aiOutput);
        
      } catch (parityError) {
        console.warn('Parity layer failed, using direct OpenAI:', parityError.message);
        
        // Fallback to direct OpenAI
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OpenAI API key not configured');
        }
        
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        const systemPrompt = `You are a procedural document formatter. Your ONLY task is to fill in placeholder variables in a template.

CRITICAL CONSTRAINTS:
- Do NOT add content
- Do NOT modify structure
- Do NOT add explanations
- Do NOT use emotional language
- ONLY substitute [PLACEHOLDER] values with provided data

Template variables to substitute:
${JSON.stringify(variables, null, 2)}

Return ONLY the completed template with variables substituted. No additions. No modifications.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Substitute variables in this template:\n\n${sanitizedLetter}` }
          ]
        });

        const aiOutput = completion.choices?.[0]?.message?.content || sanitizedLetter;
        finalLetter = sanitizeOutput(aiOutput);
        
        aiResponse = {
          provider: 'openai',
          model: 'gpt-4o-mini',
          parityUsed: false
        };
      }
    }
    
    // STEP 8: FORMAT FINAL OUTPUT
    console.log('Step 6: Formatting final output...');
    const formattedOutput = formatResponseOutput(finalLetter, {
      phase: phase.phase,
      claimType: classification?.claimType,
      playbook: playbook.responseType
    });
    
    // STEP 9: SAVE TO DATABASE
    let savedRecordId = recordId;
    if (getSupabaseAdmin) {
      try {
        const supabase = getSupabaseAdmin();
        
        if (recordId) {
          // Update existing record
          const { error } = await supabase
            .from("cla_letters")
            .update({
              ai_response: finalLetter,
              status: 'responded'
            })
            .eq("id", recordId);
          
          if (error) throw error;
          console.log('Record updated:', recordId);
        } else {
          // Create new record
          const { data, error } = await supabase
            .from("cla_letters")
            .insert({
              ai_response: finalLetter,
              analysis: {
                classification,
                phase,
                riskAssessment
              },
              status: 'responded'
            })
            .select("id")
            .single();
          
          if (error) throw error;
          savedRecordId = data.id;
          console.log('New record created:', savedRecordId);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }
    
    // STEP 10: RETURN RESPONSE
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        letter: formattedOutput.letter,
        metadata: formattedOutput.metadata,
        warnings: formattedOutput.warnings,
        prohibitions: formattedOutput.prohibitions,
        playbook: {
          type: playbook.responseType,
          phase: playbook.phase,
          maxLines: playbook.maxTotalLines,
          prohibitions: playbook.prohibitions
        },
        lengthValidation,
        recordId: savedRecordId
      })
    };
    
  } catch (error) {
    console.error("Error in generate-insurance-response:", error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Response generation failed',
        details: error.message,
        message: 'An error occurred during response generation. Please try again or consult a professional.'
      })
    };
  }
};

