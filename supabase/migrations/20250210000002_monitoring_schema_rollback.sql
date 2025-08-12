-- Rollback monitoring and observability schema

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_monitoring_data(INTEGER);
DROP FUNCTION IF EXISTS get_webhook_avg_latency(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_quota_write_failure_rate(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_webhook_success_rate(TIMESTAMPTZ, TIMESTAMPTZ);

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS public.quota_write_metrics;
DROP TABLE IF EXISTS public.webhook_metrics;
DROP TABLE IF EXISTS public.performance_metrics;
DROP TABLE IF EXISTS public.critical_alerts;
DROP TABLE IF EXISTS public.system_alerts;
DROP TABLE IF EXISTS public.system_metrics;
DROP TABLE IF EXISTS public.system_logs;