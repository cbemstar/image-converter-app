-- Monitoring and observability schema
-- Implements requirement 17.1: Structured logging and metrics collection

-- System logs table for log aggregation
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  component TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient log queries
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON public.system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_session_id ON public.system_logs(session_id);

-- GIN index for metadata search
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata ON public.system_logs USING GIN(metadata);

-- System metrics table for metrics collection
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'histogram', 'gauge')),
  value NUMERIC NOT NULL,
  labels JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient metrics queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON public.system_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON public.system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON public.system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON public.system_metrics(metric_name, timestamp DESC);

-- GIN index for labels search
CREATE INDEX IF NOT EXISTS idx_system_metrics_labels ON public.system_metrics USING GIN(labels);

-- System alerts table for alert management
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for alert queries
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON public.system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON public.system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON public.system_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON public.system_alerts(created_at DESC);

-- Critical alerts table for immediate attention
CREATE TABLE IF NOT EXISTS public.critical_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  component TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for critical alerts
CREATE INDEX IF NOT EXISTS idx_critical_alerts_acknowledged ON public.critical_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_critical_alerts_created_at ON public.critical_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_critical_alerts_component ON public.critical_alerts(component);

-- Performance monitoring table for tracking system performance
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  operation TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  component TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON public.performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation ON public.performance_metrics(operation);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_component ON public.performance_metrics(component);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_success ON public.performance_metrics(success);

-- Webhook monitoring table for tracking webhook performance (requirement 17.7)
CREATE TABLE IF NOT EXISTS public.webhook_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  latency_ms INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for webhook metrics
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_timestamp ON public.webhook_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_event_type ON public.webhook_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_success ON public.webhook_metrics(success);
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_event_id ON public.webhook_metrics(event_id);

-- Quota write monitoring table (requirement 17.7)
CREATE TABLE IF NOT EXISTS public.quota_write_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  operation TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  latency_ms INTEGER NOT NULL,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quota write metrics
CREATE INDEX IF NOT EXISTS idx_quota_write_metrics_timestamp ON public.quota_write_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quota_write_metrics_user_id ON public.quota_write_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_write_metrics_success ON public.quota_write_metrics(success);
CREATE INDEX IF NOT EXISTS idx_quota_write_metrics_operation ON public.quota_write_metrics(operation);

-- RLS policies for monitoring tables
-- Only service role and admin users can access monitoring data

-- System logs RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_logs_service_role_policy" ON public.system_logs
  FOR ALL USING (auth.role() = 'service_role');

-- System metrics RLS
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_metrics_service_role_policy" ON public.system_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- System alerts RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_alerts_service_role_policy" ON public.system_alerts
  FOR ALL USING (auth.role() = 'service_role');

-- Critical alerts RLS
ALTER TABLE public.critical_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "critical_alerts_service_role_policy" ON public.critical_alerts
  FOR ALL USING (auth.role() = 'service_role');

-- Performance metrics RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "performance_metrics_service_role_policy" ON public.performance_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- Webhook metrics RLS
ALTER TABLE public.webhook_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_metrics_service_role_policy" ON public.webhook_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- Quota write metrics RLS
ALTER TABLE public.quota_write_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quota_write_metrics_service_role_policy" ON public.quota_write_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- Functions for metrics aggregation and analysis

-- Function to get webhook success rate
CREATE OR REPLACE FUNCTION get_webhook_success_rate(
  start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC AS $$
DECLARE
  total_webhooks INTEGER;
  successful_webhooks INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_webhooks
  FROM webhook_metrics
  WHERE timestamp BETWEEN start_time AND end_time;
  
  SELECT COUNT(*) INTO successful_webhooks
  FROM webhook_metrics
  WHERE timestamp BETWEEN start_time AND end_time
    AND success = true;
  
  IF total_webhooks = 0 THEN
    RETURN 100.0;
  END IF;
  
  RETURN (successful_webhooks::NUMERIC / total_webhooks::NUMERIC) * 100.0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get quota write failure rate
CREATE OR REPLACE FUNCTION get_quota_write_failure_rate(
  start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC AS $$
DECLARE
  total_writes INTEGER;
  failed_writes INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_writes
  FROM quota_write_metrics
  WHERE timestamp BETWEEN start_time AND end_time;
  
  SELECT COUNT(*) INTO failed_writes
  FROM quota_write_metrics
  WHERE timestamp BETWEEN start_time AND end_time
    AND success = false;
  
  IF total_writes = 0 THEN
    RETURN 0.0;
  END IF;
  
  RETURN (failed_writes::NUMERIC / total_writes::NUMERIC) * 100.0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get average webhook latency
CREATE OR REPLACE FUNCTION get_webhook_avg_latency(
  start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT AVG(latency_ms)
    FROM webhook_metrics
    WHERE timestamp BETWEEN start_time AND end_time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old monitoring data
CREATE OR REPLACE FUNCTION cleanup_monitoring_data(
  retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  deleted_count INTEGER := 0;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Clean up old logs
  DELETE FROM system_logs WHERE created_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up old metrics
  DELETE FROM system_metrics WHERE created_at < cutoff_date;
  
  -- Clean up old performance metrics
  DELETE FROM performance_metrics WHERE created_at < cutoff_date;
  
  -- Clean up old webhook metrics
  DELETE FROM webhook_metrics WHERE created_at < cutoff_date;
  
  -- Clean up old quota write metrics
  DELETE FROM quota_write_metrics WHERE created_at < cutoff_date;
  
  -- Clean up resolved alerts older than retention period
  DELETE FROM system_alerts 
  WHERE created_at < cutoff_date AND resolved = true;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;