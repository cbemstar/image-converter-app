-- Rollback migration for billing integration schema
-- This script reverses all changes made in 20250210000000_billing_integration_schema.sql

-- Drop triggers first
DROP TRIGGER IF EXISTS handle_updated_at_feature_flags ON public.feature_flags;
DROP TRIGGER IF EXISTS handle_updated_at_usage_records ON public.usage_records;
DROP TRIGGER IF EXISTS handle_updated_at_user_subscriptions ON public.user_subscriptions;
DROP TRIGGER IF EXISTS handle_updated_at_profiles ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created_billing ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_usage_statistics(DATE, DATE);
DROP FUNCTION IF EXISTS public.check_user_role(UUID);
DROP FUNCTION IF EXISTS public.reset_monthly_usage();
DROP FUNCTION IF EXISTS public.increment_usage_counter(UUID, JSONB);
DROP FUNCTION IF EXISTS public.get_user_usage_info(UUID);
DROP FUNCTION IF EXISTS public.check_feature_flag(TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_current_period_start();
DROP FUNCTION IF EXISTS public.handle_updated_at_billing();
DROP FUNCTION IF EXISTS public.handle_new_user_billing();

-- Drop RLS policies
DROP POLICY IF EXISTS "feature_flags_service_policy" ON public.feature_flags;
DROP POLICY IF EXISTS "webhook_events_service_policy" ON public.webhook_events;
DROP POLICY IF EXISTS "plans_select_policy" ON public.plans;
DROP POLICY IF EXISTS "conversions_service_insert_policy" ON public.conversions;
DROP POLICY IF EXISTS "conversions_select_policy" ON public.conversions;
DROP POLICY IF EXISTS "usage_records_service_insert_policy" ON public.usage_records;
DROP POLICY IF EXISTS "usage_records_service_update_policy" ON public.usage_records;
DROP POLICY IF EXISTS "usage_records_select_policy" ON public.usage_records;
DROP POLICY IF EXISTS "user_subscriptions_service_policy" ON public.user_subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_select_policy" ON public.user_subscriptions;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_feature_flags_name;
DROP INDEX IF EXISTS public.idx_webhook_events_processed;
DROP INDEX IF EXISTS public.idx_webhook_events_stripe_id;
DROP INDEX IF EXISTS public.idx_conversions_created_at;
DROP INDEX IF EXISTS public.idx_conversions_user_id;
DROP INDEX IF EXISTS public.idx_usage_records_user_period;
DROP INDEX IF EXISTS public.idx_user_subscriptions_stripe_subscription;
DROP INDEX IF EXISTS public.idx_user_subscriptions_stripe_customer;
DROP INDEX IF EXISTS public.idx_user_subscriptions_user_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.feature_flags;
DROP TABLE IF EXISTS public.webhook_events;
DROP TABLE IF EXISTS public.conversions;
DROP TABLE IF EXISTS public.usage_records;
DROP TABLE IF EXISTS public.user_subscriptions;
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.plans;