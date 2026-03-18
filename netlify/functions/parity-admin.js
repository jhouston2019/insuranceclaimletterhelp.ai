/**
 * PARITY LAYER ADMIN API
 * 
 * Admin endpoints for monitoring and managing the parity layer.
 * 
 * ENDPOINTS:
 * - GET /status - Gateway status
 * - GET /health - Provider health status
 * - GET /costs - Cost statistics
 * - GET /failovers - Failover statistics
 * - POST /health/check - Trigger health check
 * - POST /circuit-breaker/reset - Reset circuit breaker
 * - POST /config/update - Update configuration
 */

const { getGatewayStatus } = require('./_parity/parity-gateway');
const { 
  getHealthStatus, 
  checkAllProviders, 
  getHealthStatistics,
  compareProviders,
  resetProviderHealth
} = require('./_parity/health-monitor');
const { 
  getCostStatistics,
  generateCostRecommendations,
  calculatePotentialSavings,
  projectCosts
} = require('./_parity/cost-optimizer');
const { 
  getFailoverStatistics,
  getCircuitBreakerStatus,
  resetAllCircuitBreakers
} = require('./_parity/failover-manager');
const { getSupabaseAdmin } = require('./_supabase');

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Verify admin authentication
 */
async function verifyAdmin(event) {
  const authHeader = event.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'No authorization token' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { authenticated: false, error: 'Invalid token' };
    }
    
    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return { authenticated: false, error: 'Admin access required' };
    }
    
    return { authenticated: true, user };
    
  } catch (error) {
    return { authenticated: false, error: error.message };
  }
}

// ============================================================================
// HANDLER
// ============================================================================

exports.handler = async (event) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // Verify admin
  const auth = await verifyAdmin(event);
  if (!auth.authenticated) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Unauthorized',
        message: auth.error
      })
    };
  }
  
  const path = event.path.replace('/.netlify/functions/parity-admin', '');
  const method = event.httpMethod;
  
  try {
    // GET /status - Gateway status
    if (method === 'GET' && path === '/status') {
      const status = getGatewayStatus();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(status)
      };
    }
    
    // GET /health - Provider health
    if (method === 'GET' && path === '/health') {
      const health = getHealthStatus();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(health)
      };
    }
    
    // GET /health/statistics - Health statistics
    if (method === 'GET' && path.startsWith('/health/statistics')) {
      const period = new URL(event.rawUrl).searchParams.get('period') || 'day';
      const stats = await getHealthStatistics(period);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(stats)
      };
    }
    
    // GET /health/compare - Compare providers
    if (method === 'GET' && path === '/health/compare') {
      const comparison = await compareProviders();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(comparison)
      };
    }
    
    // POST /health/check - Trigger health check
    if (method === 'POST' && path === '/health/check') {
      const results = await checkAllProviders();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'Health check completed',
          results
        })
      };
    }
    
    // GET /costs - Cost statistics
    if (method === 'GET' && path.startsWith('/costs')) {
      const period = new URL(event.rawUrl).searchParams.get('period') || 'day';
      const stats = await getCostStatistics(period);
      
      // Add recommendations
      if (stats && !stats.error) {
        stats.recommendations = generateCostRecommendations(stats);
        stats.potentialSavings = calculatePotentialSavings(stats);
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(stats)
      };
    }
    
    // GET /costs/projection - Cost projection
    if (method === 'GET' && path === '/costs/projection') {
      const requestsPerDay = parseInt(new URL(event.rawUrl).searchParams.get('requests') || '100');
      const strategy = new URL(event.rawUrl).searchParams.get('strategy') || 'balanced';
      
      const projection = projectCosts(requestsPerDay, strategy);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(projection)
      };
    }
    
    // GET /failovers - Failover statistics
    if (method === 'GET' && path === '/failovers') {
      const supabase = getSupabaseAdmin();
      
      // Get recent failovers
      const { data: failovers, error } = await supabase
        .from('ai_failovers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Get statistics
      const stats = getFailoverStatistics(failovers || []);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          recentFailovers: failovers,
          statistics: stats
        })
      };
    }
    
    // GET /circuit-breaker - Circuit breaker status
    if (method === 'GET' && path === '/circuit-breaker') {
      const status = getCircuitBreakerStatus();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(status)
      };
    }
    
    // POST /circuit-breaker/reset - Reset circuit breaker
    if (method === 'POST' && path === '/circuit-breaker/reset') {
      const { provider } = JSON.parse(event.body || '{}');
      
      if (provider === 'all') {
        resetAllCircuitBreakers();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            message: 'All circuit breakers reset'
          })
        };
      } else if (provider) {
        resetProviderHealth(provider);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            message: `Circuit breaker reset for ${provider}`
          })
        };
      } else {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Provider name required'
          })
        };
      }
    }
    
    // GET /dashboard - Dashboard data
    if (method === 'GET' && path === '/dashboard') {
      const [
        gatewayStatus,
        healthStatus,
        costStats,
        healthStats,
        providerComparison
      ] = await Promise.all([
        Promise.resolve(getGatewayStatus()),
        Promise.resolve(getHealthStatus()),
        getCostStatistics('day'),
        getHealthStatistics('day'),
        compareProviders()
      ]);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          gateway: gatewayStatus,
          health: healthStatus,
          costs: costStats,
          healthStatistics: healthStats,
          providerComparison,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Unknown endpoint
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Endpoint not found',
        path,
        availableEndpoints: [
          'GET /status',
          'GET /health',
          'GET /health/statistics?period=day|week|month',
          'GET /health/compare',
          'POST /health/check',
          'GET /costs?period=day|week|month',
          'GET /costs/projection?requests=100&strategy=cost|balanced|quality',
          'GET /failovers',
          'GET /circuit-breaker',
          'POST /circuit-breaker/reset',
          'GET /dashboard'
        ]
      })
    };
    
  } catch (error) {
    console.error('Parity admin error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
