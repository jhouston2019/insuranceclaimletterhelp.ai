/**
 * PARITY LAYER DATABASE SCHEMA
 * 
 * Tables for tracking AI provider costs, health, failovers, and performance.
 * 
 * Migration: 20260318_parity_layer_tables
 * Created: March 18, 2026
 */

-- ============================================================================
-- AI COSTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  letter_id uuid REFERENCES claim_letters(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Provider info
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  model text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('analyze', 'generate', 'classify')),
  
  -- Token usage
  input_tokens integer NOT NULL CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  total_tokens integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- Cost tracking
  cost_usd decimal(10,6) NOT NULL CHECK (cost_usd >= 0),
  claim_amount decimal(10,2),
  cost_ratio decimal(10,8) GENERATED ALWAYS AS (
    CASE 
      WHEN claim_amount > 0 THEN cost_usd / claim_amount 
      ELSE NULL 
    END
  ) STORED,
  
  -- Performance
  latency_ms integer CHECK (latency_ms >= 0),
  cached boolean DEFAULT false,
  
  -- Failover tracking
  failover_occurred boolean DEFAULT false,
  attempt_count integer DEFAULT 1 CHECK (attempt_count >= 1),
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  
  -- Indexes
  INDEX idx_ai_costs_provider (provider),
  INDEX idx_ai_costs_operation (operation),
  INDEX idx_ai_costs_created_at (created_at),
  INDEX idx_ai_costs_letter_id (letter_id),
  INDEX idx_ai_costs_cost_ratio (cost_ratio)
);

COMMENT ON TABLE ai_costs IS 'Tracks AI request costs per provider and operation';

-- ============================================================================
-- AI PROVIDER HEALTH TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider info
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  
  -- Health status
  healthy boolean DEFAULT true,
  error_count integer DEFAULT 0 CHECK (error_count >= 0),
  consecutive_errors integer DEFAULT 0 CHECK (consecutive_errors >= 0),
  
  -- Performance metrics
  avg_latency_ms integer CHECK (avg_latency_ms >= 0),
  
  -- Error tracking
  last_error text,
  last_check_at timestamp DEFAULT now(),
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  
  -- Indexes
  INDEX idx_provider_health_provider (provider),
  INDEX idx_provider_health_last_check (last_check_at),
  INDEX idx_provider_health_healthy (healthy)
);

COMMENT ON TABLE ai_provider_health IS 'Tracks provider health status and availability';

-- ============================================================================
-- AI FAILOVERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_failovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  letter_id uuid REFERENCES claim_letters(id) ON DELETE CASCADE,
  
  -- Failover info
  operation text NOT NULL CHECK (operation IN ('analyze', 'generate', 'classify')),
  primary_provider text NOT NULL,
  fallback_provider text NOT NULL,
  
  -- Failure details
  reason text NOT NULL,
  attempts jsonb NOT NULL,
  
  -- Outcome
  success boolean NOT NULL,
  total_latency_ms integer,
  total_cost_usd decimal(10,6),
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  
  -- Indexes
  INDEX idx_failovers_primary_provider (primary_provider),
  INDEX idx_failovers_fallback_provider (fallback_provider),
  INDEX idx_failovers_created_at (created_at),
  INDEX idx_failovers_success (success)
);

COMMENT ON TABLE ai_failovers IS 'Tracks failover events when primary provider fails';

-- ============================================================================
-- AI PROVIDER METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_provider_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider and model
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  model text NOT NULL,
  
  -- Date (for daily aggregation)
  date date DEFAULT CURRENT_DATE,
  
  -- Request metrics
  total_requests integer DEFAULT 0 CHECK (total_requests >= 0),
  successful_requests integer DEFAULT 0 CHECK (successful_requests >= 0),
  failed_requests integer DEFAULT 0 CHECK (failed_requests >= 0),
  
  -- Performance metrics
  avg_latency_ms integer CHECK (avg_latency_ms >= 0),
  min_latency_ms integer CHECK (min_latency_ms >= 0),
  max_latency_ms integer CHECK (max_latency_ms >= 0),
  
  -- Cost metrics
  total_cost_usd decimal(10,2) CHECK (total_cost_usd >= 0),
  avg_cost_per_request decimal(10,6),
  
  -- Quality metrics
  avg_quality_score integer CHECK (avg_quality_score >= 0 AND avg_quality_score <= 100),
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  -- Unique constraint (one row per provider/model/date)
  UNIQUE(provider, model, date),
  
  -- Indexes
  INDEX idx_provider_metrics_provider (provider),
  INDEX idx_provider_metrics_date (date)
);

COMMENT ON TABLE ai_provider_metrics IS 'Daily aggregated metrics per provider and model';

-- ============================================================================
-- AI COST ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_cost_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert info
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message text NOT NULL,
  
  -- Metadata
  metadata jsonb,
  
  -- Resolution
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamp,
  acknowledged_by uuid REFERENCES auth.users(id),
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  
  -- Indexes
  INDEX idx_cost_alerts_severity (severity),
  INDEX idx_cost_alerts_created_at (created_at),
  INDEX idx_cost_alerts_acknowledged (acknowledged)
);

COMMENT ON TABLE ai_cost_alerts IS 'Tracks cost alerts and threshold violations';

-- ============================================================================
-- AI ROUTING DECISIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_routing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  letter_id uuid REFERENCES claim_letters(id) ON DELETE CASCADE,
  
  -- Routing context
  operation text NOT NULL,
  claim_amount decimal(10,2),
  routing_tier text NOT NULL,
  
  -- Decision
  selected_provider text NOT NULL,
  selected_model text NOT NULL,
  routing_reason text NOT NULL,
  
  -- Fallback chain
  fallback_providers jsonb,
  
  -- Outcome
  success boolean,
  actual_provider text,
  actual_model text,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  
  -- Indexes
  INDEX idx_routing_decisions_tier (routing_tier),
  INDEX idx_routing_decisions_provider (selected_provider),
  INDEX idx_routing_decisions_created_at (created_at)
);

COMMENT ON TABLE ai_routing_decisions IS 'Tracks routing decisions and outcomes';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE ai_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_failovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_routing_decisions ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admin full access to ai_costs"
  ON ai_costs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to ai_provider_health"
  ON ai_provider_health
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to ai_failovers"
  ON ai_failovers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to ai_provider_metrics"
  ON ai_provider_metrics
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to ai_cost_alerts"
  ON ai_cost_alerts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to ai_routing_decisions"
  ON ai_routing_decisions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Users can view their own costs
CREATE POLICY "Users can view own ai_costs"
  ON ai_costs
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Daily cost summary
CREATE OR REPLACE VIEW ai_daily_costs AS
SELECT 
  DATE(created_at) as date,
  provider,
  operation,
  COUNT(*) as request_count,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  AVG(latency_ms) as avg_latency,
  SUM(CASE WHEN failover_occurred THEN 1 ELSE 0 END) as failover_count
FROM ai_costs
GROUP BY DATE(created_at), provider, operation
ORDER BY date DESC, provider;

COMMENT ON VIEW ai_daily_costs IS 'Daily aggregated cost metrics per provider and operation';

-- Provider health summary
CREATE OR REPLACE VIEW ai_provider_health_summary AS
SELECT 
  provider,
  COUNT(*) as total_checks,
  SUM(CASE WHEN healthy THEN 1 ELSE 0 END) as healthy_checks,
  SUM(CASE WHEN NOT healthy THEN 1 ELSE 0 END) as unhealthy_checks,
  ROUND((SUM(CASE WHEN healthy THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 2) as availability_percent,
  AVG(avg_latency_ms) as avg_latency,
  MAX(last_check_at) as last_check
FROM ai_provider_health
WHERE last_check_at > NOW() - INTERVAL '7 days'
GROUP BY provider;

COMMENT ON VIEW ai_provider_health_summary IS '7-day provider health summary';

-- Failover summary
CREATE OR REPLACE VIEW ai_failover_summary AS
SELECT 
  primary_provider,
  fallback_provider,
  COUNT(*) as failover_count,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_failovers,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_failovers,
  ROUND((SUM(CASE WHEN success THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 2) as success_rate,
  AVG(total_latency_ms) as avg_total_latency,
  AVG(total_cost_usd) as avg_total_cost
FROM ai_failovers
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY primary_provider, fallback_provider
ORDER BY failover_count DESC;

COMMENT ON VIEW ai_failover_summary IS '7-day failover statistics';

-- ============================================================================
-- FUNCTIONS FOR METRICS AGGREGATION
-- ============================================================================

-- Function to update daily provider metrics
CREATE OR REPLACE FUNCTION update_provider_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO ai_provider_metrics (
    provider,
    model,
    date,
    total_requests,
    successful_requests,
    failed_requests,
    avg_latency_ms,
    min_latency_ms,
    max_latency_ms,
    total_cost_usd,
    avg_cost_per_request
  )
  SELECT 
    provider,
    model,
    CURRENT_DATE,
    COUNT(*) as total_requests,
    COUNT(*) as successful_requests,  -- All in ai_costs are successful
    0 as failed_requests,
    ROUND(AVG(latency_ms)) as avg_latency_ms,
    MIN(latency_ms) as min_latency_ms,
    MAX(latency_ms) as max_latency_ms,
    SUM(cost_usd) as total_cost_usd,
    AVG(cost_usd) as avg_cost_per_request
  FROM ai_costs
  WHERE DATE(created_at) = CURRENT_DATE
  GROUP BY provider, model
  ON CONFLICT (provider, model, date) 
  DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    successful_requests = EXCLUDED.successful_requests,
    avg_latency_ms = EXCLUDED.avg_latency_ms,
    min_latency_ms = EXCLUDED.min_latency_ms,
    max_latency_ms = EXCLUDED.max_latency_ms,
    total_cost_usd = EXCLUDED.total_cost_usd,
    avg_cost_per_request = EXCLUDED.avg_cost_per_request,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION update_provider_metrics IS 'Aggregates daily metrics from ai_costs table';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update metrics after cost insert
CREATE OR REPLACE FUNCTION trigger_update_metrics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update metrics asynchronously (don't block insert)
  PERFORM update_provider_metrics();
  RETURN NEW;
END;
$$;

-- Note: Uncomment this trigger if you want automatic metric updates
-- This can be expensive at scale, consider running as scheduled job instead
-- CREATE TRIGGER after_cost_insert
-- AFTER INSERT ON ai_costs
-- FOR EACH ROW
-- EXECUTE FUNCTION trigger_update_metrics();

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_costs_provider_date 
  ON ai_costs(provider, DATE(created_at));

CREATE INDEX IF NOT EXISTS idx_ai_costs_operation_date 
  ON ai_costs(operation, DATE(created_at));

CREATE INDEX IF NOT EXISTS idx_ai_costs_user_date 
  ON ai_costs(user_id, DATE(created_at));

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get daily cost by provider
-- SELECT * FROM ai_daily_costs WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- Get provider health summary
-- SELECT * FROM ai_provider_health_summary;

-- Get failover statistics
-- SELECT * FROM ai_failover_summary;

-- Get total cost for last 30 days
-- SELECT SUM(cost_usd) as total_cost FROM ai_costs WHERE created_at >= NOW() - INTERVAL '30 days';

-- Get most expensive requests
-- SELECT * FROM ai_costs ORDER BY cost_usd DESC LIMIT 10;

-- Get provider with lowest average cost
-- SELECT provider, AVG(cost_usd) as avg_cost FROM ai_costs GROUP BY provider ORDER BY avg_cost;

-- Get provider availability
-- SELECT 
--   provider,
--   COUNT(*) as checks,
--   SUM(CASE WHEN healthy THEN 1 ELSE 0 END) as healthy,
--   ROUND((SUM(CASE WHEN healthy THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 2) as availability
-- FROM ai_provider_health
-- WHERE last_check_at >= NOW() - INTERVAL '24 hours'
-- GROUP BY provider;
