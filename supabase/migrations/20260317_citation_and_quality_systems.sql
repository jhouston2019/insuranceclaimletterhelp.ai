-- ============================================================================
-- CITATION VERIFICATION & QUALITY ASSURANCE SYSTEMS
-- Migration Date: March 17, 2026
-- ============================================================================
-- This migration adds tables for:
-- 1. Citation verification tracking
-- 2. Quality assurance metrics
-- 3. Outcome tracking
-- 4. Structured logging
-- 5. A/B testing framework
-- ============================================================================

-- ============================================================================
-- TABLE 1: CITATION_VERIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.citation_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.claim_letters(id) ON DELETE CASCADE,
  
  -- Citation metrics
  total_citations integer DEFAULT 0,
  verified_citations integer DEFAULT 0,
  accurate_citations integer DEFAULT 0,
  unverified_citations integer DEFAULT 0,
  accuracy_rate integer, -- Percentage (0-100)
  quality_score integer, -- Overall quality (0-100)
  
  -- Hallucination detection
  has_hallucinations boolean DEFAULT false,
  hallucination_count integer DEFAULT 0,
  hallucination_details jsonb,
  
  -- Verification details
  citations jsonb, -- Array of citation objects with verification status
  warnings text[],
  recommendations text[],
  passes_verification boolean DEFAULT false,
  
  -- Metadata
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_citation_verifications_document 
ON public.citation_verifications(document_id);

CREATE INDEX IF NOT EXISTS idx_citation_verifications_quality 
ON public.citation_verifications(quality_score);

CREATE INDEX IF NOT EXISTS idx_citation_verifications_accuracy 
ON public.citation_verifications(accuracy_rate);

-- ============================================================================
-- TABLE 2: QUALITY_METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.claim_letters(id) ON DELETE CASCADE,
  
  -- Generic language detection
  generic_phrase_count integer DEFAULT 0,
  generic_phrases jsonb, -- Array of detected phrases
  generic_score integer, -- 0-100 (100 = no generic language)
  
  -- Specificity metrics
  has_specific_dates boolean DEFAULT false,
  has_specific_amounts boolean DEFAULT false,
  has_policy_references boolean DEFAULT false,
  has_claim_numbers boolean DEFAULT false,
  specificity_score integer, -- 0-100
  
  -- Professional language
  has_emotional_language boolean DEFAULT false,
  emotional_phrases jsonb,
  has_adversarial_language boolean DEFAULT false,
  adversarial_phrases jsonb,
  professionalism_score integer, -- 0-100
  
  -- Structure quality
  has_proper_format boolean DEFAULT false,
  has_clear_request boolean DEFAULT false,
  has_deadline boolean DEFAULT false,
  structure_score integer, -- 0-100
  
  -- Overall quality
  overall_quality_score integer, -- 0-100 (weighted average)
  quality_grade text, -- A+, A, B+, B, C+, C, D, F
  passes_quality_check boolean DEFAULT false,
  
  -- Issues and recommendations
  issues jsonb,
  recommendations text[],
  
  -- Metadata
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quality_metrics_document 
ON public.quality_metrics(document_id);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_overall 
ON public.quality_metrics(overall_quality_score);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_grade 
ON public.quality_metrics(quality_grade);

-- ============================================================================
-- TABLE 3: OUTCOME_TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.outcome_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.claim_letters(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Letter details
  claim_type text,
  phase text,
  issue_type text,
  state_code text,
  claim_amount_range text,
  
  -- Outcome data (user-reported)
  outcome_status text, -- pending, sent, response_received, resolved, escalated
  outcome_result text, -- success, partial_success, failure, unknown
  
  -- Success metrics
  letter_sent boolean DEFAULT false,
  letter_sent_date timestamp,
  response_received boolean DEFAULT false,
  response_received_date timestamp,
  claim_resolved boolean DEFAULT false,
  claim_resolved_date timestamp,
  
  -- Resolution details
  resolution_type text, -- approved, partial_approval, denied, settled, escalated
  resolution_amount numeric,
  original_claim_amount numeric,
  recovery_percentage numeric,
  
  -- Time metrics
  days_to_response integer,
  days_to_resolution integer,
  
  -- Quality correlation
  citation_quality_score integer,
  output_quality_score integer,
  
  -- User feedback
  user_satisfaction integer, -- 1-5 stars
  user_feedback text,
  would_recommend boolean,
  
  -- Follow-up tracking
  follow_up_required boolean DEFAULT false,
  follow_up_count integer DEFAULT 0,
  escalated_to_attorney boolean DEFAULT false,
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outcome_tracking_document 
ON public.outcome_tracking(document_id);

CREATE INDEX IF NOT EXISTS idx_outcome_tracking_user 
ON public.outcome_tracking(user_id);

CREATE INDEX IF NOT EXISTS idx_outcome_tracking_status 
ON public.outcome_tracking(outcome_status);

CREATE INDEX IF NOT EXISTS idx_outcome_tracking_result 
ON public.outcome_tracking(outcome_result);

CREATE INDEX IF NOT EXISTS idx_outcome_tracking_claim_type 
ON public.outcome_tracking(claim_type);

CREATE INDEX IF NOT EXISTS idx_outcome_tracking_success 
ON public.outcome_tracking(outcome_result, claim_type);

-- ============================================================================
-- TABLE 4: STRUCTURED_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.structured_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  document_id uuid REFERENCES public.claim_letters(id) ON DELETE CASCADE,
  user_id uuid,
  session_id text,
  
  -- Log details
  log_level text, -- debug, info, warn, error, critical
  event_type text, -- upload, extract, analyze, generate, verify, etc.
  event_name text,
  
  -- Event data
  event_data jsonb,
  
  -- Performance metrics
  duration_ms integer,
  tokens_used integer,
  cost_usd numeric(10, 6),
  
  -- Error tracking
  error_message text,
  error_stack text,
  
  -- Request metadata
  ip_address text,
  user_agent text,
  
  -- Timestamp
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_structured_logs_document 
ON public.structured_logs(document_id);

CREATE INDEX IF NOT EXISTS idx_structured_logs_user 
ON public.structured_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_structured_logs_level 
ON public.structured_logs(log_level);

CREATE INDEX IF NOT EXISTS idx_structured_logs_event 
ON public.structured_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_structured_logs_created 
ON public.structured_logs(created_at);

-- Partitioning by month (for log retention)
CREATE INDEX IF NOT EXISTS idx_structured_logs_created_month 
ON public.structured_logs(date_trunc('month', created_at));

-- ============================================================================
-- TABLE 5: AB_TEST_EXPERIMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ab_test_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Experiment details
  experiment_name text NOT NULL UNIQUE,
  experiment_type text, -- prompt, temperature, model, playbook, etc.
  description text,
  
  -- Variants
  control_variant jsonb, -- Original configuration
  test_variant jsonb, -- New configuration
  
  -- Status
  status text DEFAULT 'draft', -- draft, active, paused, completed, cancelled
  
  -- Targeting
  claim_types text[], -- Which claim types to include
  phases text[], -- Which phases to include
  traffic_percentage integer DEFAULT 50, -- % of traffic to test variant
  
  -- Metrics
  sample_size_target integer DEFAULT 100,
  current_sample_size integer DEFAULT 0,
  
  -- Results
  control_metrics jsonb,
  test_metrics jsonb,
  statistical_significance numeric,
  winner text, -- control, test, inconclusive
  
  -- Timestamps
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status 
ON public.ab_test_experiments(status);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_name 
ON public.ab_test_experiments(experiment_name);

-- ============================================================================
-- TABLE 6: AB_TEST_ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ab_test_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Assignment details
  experiment_id uuid REFERENCES public.ab_test_experiments(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.claim_letters(id) ON DELETE CASCADE,
  user_id uuid,
  
  -- Variant assigned
  variant text, -- control or test
  variant_config jsonb,
  
  -- Outcome
  outcome_result text,
  quality_score integer,
  citation_score integer,
  user_satisfaction integer,
  
  -- Metadata
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ab_assignments_experiment 
ON public.ab_test_assignments(experiment_id);

CREATE INDEX IF NOT EXISTS idx_ab_assignments_document 
ON public.ab_test_assignments(document_id);

CREATE INDEX IF NOT EXISTS idx_ab_assignments_variant 
ON public.ab_test_assignments(experiment_id, variant);

-- ============================================================================
-- TABLE 7: PROMPT_VERSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Prompt details
  prompt_name text NOT NULL,
  prompt_type text, -- system, user, analysis, generation
  version integer NOT NULL,
  
  -- Prompt content
  prompt_text text NOT NULL,
  prompt_variables jsonb,
  
  -- Configuration
  temperature numeric(3, 2),
  max_tokens integer,
  model text,
  
  -- Performance metrics
  usage_count integer DEFAULT 0,
  average_quality_score integer,
  average_citation_score integer,
  success_rate numeric,
  
  -- Status
  status text DEFAULT 'draft', -- draft, testing, active, archived
  is_default boolean DEFAULT false,
  
  -- Metadata
  created_by text,
  notes text,
  created_at timestamp DEFAULT now(),
  activated_at timestamp,
  archived_at timestamp
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_versions_name 
ON public.prompt_versions(prompt_name);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_status 
ON public.prompt_versions(status);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_default 
ON public.prompt_versions(prompt_name, is_default) 
WHERE is_default = true;

-- Unique constraint: Only one default per prompt name
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_versions_one_default 
ON public.prompt_versions(prompt_name) 
WHERE is_default = true;

-- ============================================================================
-- TABLE 8: QUALITY_BENCHMARKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quality_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Benchmark period
  period_start date NOT NULL,
  period_end date NOT NULL,
  
  -- Citation metrics
  avg_citation_accuracy numeric,
  avg_citation_quality_score numeric,
  hallucination_rate numeric,
  
  -- Quality metrics
  avg_generic_score numeric,
  avg_specificity_score numeric,
  avg_professionalism_score numeric,
  avg_overall_quality numeric,
  
  -- Outcome metrics
  success_rate numeric,
  partial_success_rate numeric,
  failure_rate numeric,
  avg_days_to_resolution numeric,
  avg_recovery_percentage numeric,
  
  -- User satisfaction
  avg_user_satisfaction numeric,
  recommendation_rate numeric,
  
  -- Sample size
  total_letters integer,
  total_outcomes integer,
  
  -- Targets met
  meets_citation_target boolean, -- 95%+ accuracy
  meets_quality_target boolean, -- 85%+ quality
  meets_success_target boolean, -- 85%+ success
  
  -- Metadata
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quality_benchmarks_period 
ON public.quality_benchmarks(period_start, period_end);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.citation_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structured_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_benchmarks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Citation Verifications: Users can view their own
CREATE POLICY "Users can view own citation verifications" ON public.citation_verifications
FOR SELECT USING (
  document_id IN (
    SELECT id FROM public.claim_letters WHERE user_id = auth.uid()
  )
);

-- Quality Metrics: Users can view their own
CREATE POLICY "Users can view own quality metrics" ON public.quality_metrics
FOR SELECT USING (
  document_id IN (
    SELECT id FROM public.claim_letters WHERE user_id = auth.uid()
  )
);

-- Outcome Tracking: Users can view and update their own
CREATE POLICY "Users can view own outcomes" ON public.outcome_tracking
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own outcomes" ON public.outcome_tracking
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own outcomes" ON public.outcome_tracking
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Structured Logs: Service role only
CREATE POLICY "Service role can manage logs" ON public.structured_logs
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- AB Tests: Service role only (internal)
CREATE POLICY "Service role can manage ab tests" ON public.ab_test_experiments
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage ab assignments" ON public.ab_test_assignments
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Prompt Versions: Service role only (internal)
CREATE POLICY "Service role can manage prompts" ON public.prompt_versions
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Quality Benchmarks: Public read, service role write
CREATE POLICY "Anyone can view benchmarks" ON public.quality_benchmarks
FOR SELECT USING (true);

CREATE POLICY "Service role can manage benchmarks" ON public.quality_benchmarks
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger for outcome_tracking
CREATE OR REPLACE FUNCTION public.update_outcome_tracking_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_outcome_tracking_updated_at ON public.outcome_tracking;

CREATE TRIGGER update_outcome_tracking_updated_at
  BEFORE UPDATE ON public.outcome_tracking
  FOR EACH ROW EXECUTE PROCEDURE public.update_outcome_tracking_updated_at();

-- Update timestamp trigger for ab_test_experiments
CREATE OR REPLACE FUNCTION public.update_ab_experiments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ab_experiments_updated_at ON public.ab_test_experiments;

CREATE TRIGGER update_ab_experiments_updated_at
  BEFORE UPDATE ON public.ab_test_experiments
  FOR EACH ROW EXECUTE PROCEDURE public.update_ab_experiments_updated_at();

-- ============================================================================
-- FUNCTIONS FOR ANALYTICS
-- ============================================================================

-- Calculate success rate by claim type
CREATE OR REPLACE FUNCTION public.get_success_rate_by_claim_type(claim_type_param text)
RETURNS TABLE (
  claim_type text,
  total_outcomes bigint,
  success_count bigint,
  partial_success_count bigint,
  failure_count bigint,
  success_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ot.claim_type,
    COUNT(*) as total_outcomes,
    COUNT(*) FILTER (WHERE ot.outcome_result = 'success') as success_count,
    COUNT(*) FILTER (WHERE ot.outcome_result = 'partial_success') as partial_success_count,
    COUNT(*) FILTER (WHERE ot.outcome_result = 'failure') as failure_count,
    ROUND(
      (COUNT(*) FILTER (WHERE ot.outcome_result IN ('success', 'partial_success'))::numeric / 
       NULLIF(COUNT(*), 0) * 100), 
      2
    ) as success_rate
  FROM public.outcome_tracking ot
  WHERE ot.claim_type = claim_type_param
    AND ot.outcome_result IS NOT NULL
  GROUP BY ot.claim_type;
END;
$$ LANGUAGE plpgsql;

-- Calculate average quality scores
CREATE OR REPLACE FUNCTION public.get_quality_statistics()
RETURNS TABLE (
  total_letters bigint,
  avg_citation_accuracy numeric,
  avg_quality_score numeric,
  avg_success_rate numeric,
  meets_targets boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT cv.document_id) as total_letters,
    ROUND(AVG(cv.accuracy_rate), 2) as avg_citation_accuracy,
    ROUND(AVG(qm.overall_quality_score), 2) as avg_quality_score,
    ROUND(
      (COUNT(*) FILTER (WHERE ot.outcome_result IN ('success', 'partial_success'))::numeric / 
       NULLIF(COUNT(ot.id), 0) * 100), 
      2
    ) as avg_success_rate,
    (
      AVG(cv.accuracy_rate) >= 95 AND
      AVG(qm.overall_quality_score) >= 85 AND
      (COUNT(*) FILTER (WHERE ot.outcome_result IN ('success', 'partial_success'))::numeric / 
       NULLIF(COUNT(ot.id), 0) * 100) >= 85
    ) as meets_targets
  FROM public.citation_verifications cv
  LEFT JOIN public.quality_metrics qm ON cv.document_id = qm.document_id
  LEFT JOIN public.outcome_tracking ot ON cv.document_id = ot.document_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Quality dashboard view
CREATE OR REPLACE VIEW public.quality_dashboard AS
SELECT 
  cl.id as document_id,
  cl.user_email,
  cl.claim_type,
  cl.phase,
  cl.status,
  cl.created_at,
  
  -- Citation metrics
  cv.accuracy_rate as citation_accuracy,
  cv.quality_score as citation_quality,
  cv.has_hallucinations,
  
  -- Quality metrics
  qm.overall_quality_score,
  qm.quality_grade,
  qm.generic_score,
  qm.specificity_score,
  qm.professionalism_score,
  
  -- Outcome metrics
  ot.outcome_status,
  ot.outcome_result,
  ot.days_to_resolution,
  ot.recovery_percentage,
  ot.user_satisfaction
  
FROM public.claim_letters cl
LEFT JOIN public.citation_verifications cv ON cl.id = cv.document_id
LEFT JOIN public.quality_metrics qm ON cl.id = qm.document_id
LEFT JOIN public.outcome_tracking ot ON cl.id = ot.document_id
WHERE cl.status IN ('completed', 'analyzed');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.citation_verifications IS 
'Tracks citation accuracy and hallucination prevention for generated letters';

COMMENT ON TABLE public.quality_metrics IS 
'Comprehensive quality assessment including generic language detection and specificity scoring';

COMMENT ON TABLE public.outcome_tracking IS 
'Real-world outcome tracking for measuring letter effectiveness and success rates';

COMMENT ON TABLE public.structured_logs IS 
'Structured logging for observability, debugging, and performance monitoring';

COMMENT ON TABLE public.ab_test_experiments IS 
'A/B testing framework for scientific experimentation with prompts and configurations';

COMMENT ON TABLE public.prompt_versions IS 
'Version control for AI prompts with performance tracking';

COMMENT ON TABLE public.quality_benchmarks IS 
'Historical quality benchmarks for tracking improvement over time';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default quality targets
INSERT INTO public.quality_benchmarks (
  period_start,
  period_end,
  total_letters,
  meets_citation_target,
  meets_quality_target,
  meets_success_target
) VALUES (
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 month',
  0,
  false,
  false,
  false
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ CITATION & QUALITY SYSTEMS MIGRATION COMPLETE';
  RAISE NOTICE 'Tables created: 8';
  RAISE NOTICE 'Indexes created: 25+';
  RAISE NOTICE 'Functions created: 2';
  RAISE NOTICE 'Views created: 1';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Quality Targets:';
  RAISE NOTICE '   - Citation Accuracy: 95%+';
  RAISE NOTICE '   - Quality Score: 85%+';
  RAISE NOTICE '   - Success Rate: 85%+';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Systems ready for production';
END $$;
