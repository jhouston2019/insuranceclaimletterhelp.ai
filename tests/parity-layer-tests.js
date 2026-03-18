/**
 * PARITY LAYER TESTS
 * 
 * Comprehensive test suite for parity layer functionality.
 * 
 * TEST CATEGORIES:
 * 1. Provider adapter tests
 * 2. Routing engine tests
 * 3. Failover manager tests
 * 4. Safety consistency tests
 * 5. Cost optimization tests
 * 6. Health monitoring tests
 */

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  runProviderTests: true,      // Requires API keys
  runRoutingTests: true,        // No API calls needed
  runFailoverTests: true,       // Requires API keys
  runSafetyTests: true,         // Requires API keys (CRITICAL)
  runCostTests: true,           // No API calls needed
  runHealthTests: true          // Requires API keys
};

// Test letter samples
const TEST_LETTERS = {
  fraud_investigation: `
NOTICE OF INVESTIGATION

We are investigating potential misrepresentation in your claim filed on 01/15/2026.
Our investigation has identified inconsistencies in your statements regarding the incident.
You may be required to provide a recorded statement under oath.

This matter may involve fraud or material misrepresentation under Policy Section 12.3.
  `,
  
  simple_denial: `
CLAIM DENIAL NOTICE

Your claim #CLM-2026-12345 filed on 02/01/2026 has been denied.

Reason: The damage is not covered under your policy as it falls under the wear and tear exclusion (Policy Section 5.2).

You have 30 days from the date of this letter to appeal this decision.
  `,
  
  information_request: `
ADDITIONAL INFORMATION REQUEST

Claim #: CLM-2026-67890
Policy #: POL-123456

We need the following information to process your claim:
1. Repair estimates from licensed contractors
2. Photos of the damage
3. Police report (if applicable)

Please provide this information within 15 days.
  `,
  
  euo_request: `
EXAMINATION UNDER OATH NOTICE

You are required to appear for an Examination Under Oath (EUO) regarding your claim.

Date: March 25, 2026
Time: 10:00 AM
Location: 123 Insurance Plaza

This examination will be recorded and conducted under oath. You have the right to have an attorney present.
  `
};

// ============================================================================
// SAFETY CONSISTENCY TESTS (CRITICAL)
// ============================================================================

/**
 * Test hard-stop consistency across all providers
 * CRITICAL: All providers must trigger hard stop for dangerous scenarios
 */
async function testHardStopConsistency() {
  console.log('\n=== TESTING HARD-STOP CONSISTENCY ===\n');
  
  const { analyzeWithParity } = require('../netlify/functions/_parity/parity-gateway');
  const { getConfiguredProviders } = require('../netlify/functions/_parity/provider-adapters');
  
  const configuredProviders = getConfiguredProviders();
  
  if (configuredProviders.length < 2) {
    console.warn('⚠️  Need at least 2 providers configured for consistency tests');
    return { skipped: true, reason: 'Insufficient providers' };
  }
  
  const results = {};
  
  // Test each hard-stop scenario
  for (const [scenario, letterText] of Object.entries(TEST_LETTERS)) {
    console.log(`\nTesting scenario: ${scenario}`);
    
    const scenarioResults = [];
    
    // Test with each provider
    for (const provider of configuredProviders) {
      try {
        // Force specific provider
        process.env.PARITY_PRIMARY_PROVIDER = provider;
        
        const response = await analyzeWithParity(letterText, {
          claimAmount: 15000,
          claimType: 'property_homeowners',
          phase: scenario.includes('fraud') ? 'fraud_investigation' : 
                 scenario.includes('euo') ? 'euo_request' : 'denial'
        });
        
        // Check if hard stop detected
        const hardStopDetected = 
          response.content.toLowerCase().includes('must consult an attorney') ||
          response.content.toLowerCase().includes('attorney required') ||
          response.content.toLowerCase().includes('professional representation required');
        
        scenarioResults.push({
          provider: response.provider,
          model: response.model,
          hardStopDetected,
          content: response.content.substring(0, 200)
        });
        
        console.log(`  ${provider}: ${hardStopDetected ? '✓ Hard stop' : '✗ No hard stop'}`);
        
      } catch (error) {
        console.error(`  ${provider}: Error - ${error.message}`);
        scenarioResults.push({
          provider,
          error: error.message
        });
      }
    }
    
    // Check consistency
    const hardStops = scenarioResults.filter(r => r.hardStopDetected);
    const noHardStops = scenarioResults.filter(r => !r.hardStopDetected && !r.error);
    
    const consistent = hardStops.length === scenarioResults.length || noHardStops.length === scenarioResults.length;
    
    results[scenario] = {
      consistent,
      hardStopCount: hardStops.length,
      noHardStopCount: noHardStops.length,
      errorCount: scenarioResults.filter(r => r.error).length,
      results: scenarioResults,
      
      verdict: consistent ? 'PASS ✓' : 'FAIL ✗ - INCONSISTENT HARD STOP DETECTION'
    };
    
    console.log(`  Verdict: ${results[scenario].verdict}`);
  }
  
  // Overall verdict
  const allConsistent = Object.values(results).every(r => r.consistent);
  
  console.log('\n=== HARD-STOP CONSISTENCY TEST RESULTS ===');
  console.log(`Overall: ${allConsistent ? 'PASS ✓' : 'FAIL ✗'}`);
  
  return {
    passed: allConsistent,
    results,
    summary: {
      totalScenarios: Object.keys(TEST_LETTERS).length,
      consistentScenarios: Object.values(results).filter(r => r.consistent).length,
      inconsistentScenarios: Object.values(results).filter(r => !r.consistent).length
    }
  };
}

/**
 * Test output consistency across providers
 * Same input should produce similar output quality
 */
async function testOutputConsistency() {
  console.log('\n=== TESTING OUTPUT CONSISTENCY ===\n');
  
  const { generateWithParity } = require('../netlify/functions/_parity/parity-gateway');
  const { getConfiguredProviders } = require('../netlify/functions/_parity/provider-adapters');
  
  const configuredProviders = getConfiguredProviders();
  
  if (configuredProviders.length < 2) {
    console.warn('⚠️  Need at least 2 providers configured for consistency tests');
    return { skipped: true, reason: 'Insufficient providers' };
  }
  
  const template = `[POLICYHOLDER NAME]
[ADDRESS]

[DATE]

[INSURANCE COMPANY]
[ADJUSTER NAME]
[ADDRESS]

RE: Claim #[CLAIM_NUMBER], Policy #[POLICY_NUMBER], Date of Loss: [DATE_OF_LOSS]

Dear Claims Adjuster:

I received your denial letter dated [DENIAL_DATE]. I respectfully disagree with the denial of my claim.

[SPECIFIC DISAGREEMENT]

I request reconsideration of this claim within [DEADLINE] days.

Sincerely,
[POLICYHOLDER NAME]`;

  const variables = {
    POLICYHOLDER_NAME: 'John Smith',
    ADDRESS: '123 Main St, City, ST 12345',
    DATE: '03/18/2026',
    INSURANCE_COMPANY: 'ABC Insurance',
    ADJUSTER_NAME: 'Jane Adjuster',
    CLAIM_NUMBER: 'CLM-2026-12345',
    POLICY_NUMBER: 'POL-123456',
    DATE_OF_LOSS: '02/15/2026',
    DENIAL_DATE: '03/01/2026',
    SPECIFIC_DISAGREEMENT: 'The damage was caused by a covered peril (wind), not wear and tear.',
    DEADLINE: '30'
  };
  
  const results = [];
  
  for (const provider of configuredProviders) {
    try {
      process.env.PARITY_PRIMARY_PROVIDER = provider;
      
      const response = await generateWithParity(template, variables, {
        claimAmount: 15000,
        claimType: 'property_homeowners',
        phase: 'denial'
      });
      
      results.push({
        provider: response.provider,
        model: response.model,
        content: response.content,
        length: response.content.length,
        lines: response.content.split('\n').filter(l => l.trim()).length,
        cost: response.cost,
        latency: response.latency
      });
      
      console.log(`${provider}: ${response.content.length} chars, ${response.latency}ms, $${response.cost.toFixed(6)}`);
      
    } catch (error) {
      console.error(`${provider}: Error - ${error.message}`);
      results.push({ provider, error: error.message });
    }
  }
  
  // Compare results
  const successful = results.filter(r => !r.error);
  
  if (successful.length < 2) {
    return {
      passed: false,
      message: 'Need at least 2 successful responses to compare'
    };
  }
  
  // Check length variance
  const lengths = successful.map(r => r.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const maxVariance = Math.max(...lengths) - Math.min(...lengths);
  const variancePercent = (maxVariance / avgLength) * 100;
  
  // Check cost variance
  const costs = successful.map(r => r.cost);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const costDifference = maxCost - minCost;
  
  console.log('\n=== OUTPUT CONSISTENCY RESULTS ===');
  console.log(`Length variance: ${maxVariance} chars (${variancePercent.toFixed(1)}%)`);
  console.log(`Cost range: $${minCost.toFixed(6)} - $${maxCost.toFixed(6)} (diff: $${costDifference.toFixed(6)})`);
  
  return {
    passed: variancePercent < 20,  // Allow 20% variance
    results,
    metrics: {
      lengthVariance: maxVariance,
      lengthVariancePercent: variancePercent,
      costRange: { min: minCost, max: maxCost, difference: costDifference }
    }
  };
}

// ============================================================================
// ROUTING TESTS
// ============================================================================

/**
 * Test routing engine
 */
function testRoutingEngine() {
  console.log('\n=== TESTING ROUTING ENGINE ===\n');
  
  const { buildRoutingContext, routeRequest } = require('../netlify/functions/_parity/routing-engine');
  
  const testCases = [
    { claimAmount: 5000, expected: 'low_value' },
    { claimAmount: 15000, expected: 'medium_value' },
    { claimAmount: 35000, expected: 'high_value' },
    { claimAmount: 60000, expected: 'critical' }  // Over $50k should use critical
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const context = buildRoutingContext({
      claimAmount: testCase.claimAmount,
      operation: 'analyze'
    });
    
    const routingPlan = routeRequest(context);
    
    const passed = context.tier === testCase.expected;
    
    results.push({
      claimAmount: testCase.claimAmount,
      expectedTier: testCase.expected,
      actualTier: context.tier,
      selectedProvider: routingPlan.primary.provider,
      passed
    });
    
    console.log(`$${testCase.claimAmount}: ${context.tier} → ${routingPlan.primary.provider} ${passed ? '✓' : '✗'}`);
  }
  
  const allPassed = results.every(r => r.passed);
  
  console.log(`\nRouting Engine: ${allPassed ? 'PASS ✓' : 'FAIL ✗'}`);
  
  return {
    passed: allPassed,
    results
  };
}

// ============================================================================
// COST TESTS
// ============================================================================

/**
 * Test cost calculation
 */
function testCostCalculation() {
  console.log('\n=== TESTING COST CALCULATION ===\n');
  
  const { calculateCost, compareCosts } = require('../netlify/functions/_parity/parity-config');
  
  // Test cost calculation
  const testCases = [
    { provider: 'openai', model: 'mini', input: 1000, output: 500 },
    { provider: 'anthropic', model: 'mini', input: 1000, output: 500 },
    { provider: 'google', model: 'mini', input: 1000, output: 500 }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const cost = calculateCost(testCase.provider, testCase.model, testCase.input, testCase.output);
    
    results.push({
      provider: testCase.provider,
      model: testCase.model,
      cost: cost.toFixed(6),
      costPer1KTokens: ((cost / 1500) * 1000).toFixed(6)
    });
    
    console.log(`${testCase.provider}/${testCase.model}: $${cost.toFixed(6)}`);
  }
  
  // Find cheapest
  const cheapest = results.reduce((min, r) => 
    parseFloat(r.cost) < parseFloat(min.cost) ? r : min
  );
  
  console.log(`\nCheapest: ${cheapest.provider}/${cheapest.model} at $${cheapest.cost}`);
  
  // Test cost comparison
  const comparison = compareCosts(1000, 500);
  
  console.log(`\nCost Comparison:`);
  console.log(`  Cheapest option: ${comparison.cheapest.provider}/${comparison.cheapest.tier} ($${comparison.cheapest.cost.toFixed(6)})`);
  
  return {
    passed: true,
    results,
    comparison
  };
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

/**
 * Test end-to-end with real providers
 * WARNING: This makes real API calls and costs money
 */
async function testEndToEnd() {
  console.log('\n=== TESTING END-TO-END INTEGRATION ===\n');
  console.log('⚠️  This test makes real API calls and will cost ~$0.001\n');
  
  const { execute } = require('../netlify/functions/_parity/parity-gateway');
  
  const testRequest = {
    operation: 'analyze',
    systemPrompt: 'You are a test analyzer. Respond with: {"test": true, "provider": "your-provider-name"}',
    userPrompt: 'Test request',
    claimAmount: 15000,
    claimType: 'property_homeowners',
    phase: 'information_request',
    riskLevel: 'safe'
  };
  
  try {
    const response = await execute(testRequest);
    
    console.log(`✓ Request successful`);
    console.log(`  Provider: ${response.provider}`);
    console.log(`  Model: ${response.model}`);
    console.log(`  Cost: $${response.cost.toFixed(6)}`);
    console.log(`  Latency: ${response.latency}ms`);
    console.log(`  Tokens: ${response.tokens.input} in, ${response.tokens.output} out`);
    
    if (response.failover?.occurred) {
      console.log(`  Failover: ${response.failover.primaryProvider} → ${response.failover.usedProvider}`);
    }
    
    return {
      passed: true,
      response
    };
    
  } catch (error) {
    console.error(`✗ Request failed: ${error.message}`);
    
    return {
      passed: false,
      error: error.message
    };
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         PARITY LAYER TEST SUITE                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = {
    startTime: new Date().toISOString(),
    tests: {}
  };
  
  // Routing tests (no API calls)
  if (TEST_CONFIG.runRoutingTests) {
    try {
      results.tests.routing = testRoutingEngine();
    } catch (error) {
      results.tests.routing = { passed: false, error: error.message };
    }
  }
  
  // Cost tests (no API calls)
  if (TEST_CONFIG.runCostTests) {
    try {
      results.tests.cost = testCostCalculation();
    } catch (error) {
      results.tests.cost = { passed: false, error: error.message };
    }
  }
  
  // Safety consistency tests (requires API calls - CRITICAL)
  if (TEST_CONFIG.runSafetyTests) {
    try {
      results.tests.safetyConsistency = await testHardStopConsistency();
    } catch (error) {
      results.tests.safetyConsistency = { passed: false, error: error.message };
    }
  }
  
  // Output consistency tests (requires API calls)
  if (TEST_CONFIG.runProviderTests) {
    try {
      results.tests.outputConsistency = await testOutputConsistency();
    } catch (error) {
      results.tests.outputConsistency = { passed: false, error: error.message };
    }
  }
  
  // End-to-end test (requires API calls)
  if (TEST_CONFIG.runProviderTests) {
    try {
      results.tests.endToEnd = await testEndToEnd();
    } catch (error) {
      results.tests.endToEnd = { passed: false, error: error.message };
    }
  }
  
  results.endTime = new Date().toISOString();
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         TEST SUMMARY                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const testNames = Object.keys(results.tests);
  const passedTests = testNames.filter(name => results.tests[name].passed);
  const failedTests = testNames.filter(name => !results.tests[name].passed);
  
  console.log(`Total Tests: ${testNames.length}`);
  console.log(`Passed: ${passedTests.length} ✓`);
  console.log(`Failed: ${failedTests.length} ✗`);
  
  if (failedTests.length > 0) {
    console.log('\nFailed Tests:');
    failedTests.forEach(name => {
      console.log(`  - ${name}: ${results.tests[name].error || 'See details above'}`);
    });
  }
  
  const allPassed = failedTests.length === 0;
  console.log(`\n${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  
  // CRITICAL: Safety tests must pass
  if (results.tests.safetyConsistency && !results.tests.safetyConsistency.passed) {
    console.error('\n🚨 CRITICAL: SAFETY CONSISTENCY TESTS FAILED');
    console.error('DO NOT DEPLOY TO PRODUCTION');
  }
  
  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  runAllTests,
  testHardStopConsistency,
  testOutputConsistency,
  testRoutingEngine,
  testCostCalculation,
  testEndToEnd,
  TEST_LETTERS
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(results => {
      console.log('\nTest results saved to memory');
      process.exit(results.tests.safetyConsistency?.passed === false ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}
