-- Rollback Rate Limiting and Abuse Prevention Schema
-- This file rolls back the rate limiting schema changes

-- Drop triggers
DROP TRIGGER IF EXISTS update_account_suspensions_updated_at ON public.account_suspensions;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS is_suspended(UUID, TEXT);
DROP FUNCTION IF EXISTS get_rate_limit_stats(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_rate_limit_records(INTEGER);
DROP FUNCTION IF EXISTS create_rate_limit_tables();

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS public.admin_actions;
DROP TABLE IF EXISTS public.account_suspensions;
DROP TABLE IF EXISTS public.suspicious_activities;
DROP TABLE IF EXISTS public.rate_limit_records;

-- Note: Indexes are automatically dropped when tables are dropped