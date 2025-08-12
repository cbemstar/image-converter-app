-- pgTAP tests for database functions
-- This file tests the custom database functions for billing integration
-- Requirements: 2.1, 2.2, 2.4, 2.5, 5.2, 5.3, 5.4, 5.5

BEGIN;

SELECT plan(25);

-- Test helper functions
CREATE OR REPLACE FUNCTION tests.create_test_user_with_subscription(
  email TEXT, 
  user_id UUID DEFAULT gen_random_uuid(),
  plan_id TEXT DEFAULT 'free'
)
RETURNS UUID AS $$
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
  VALUES (user_id, email, NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- The trigger should create profile and subscription automatically
  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.authenticate_as_service_role()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.authenticate_as(user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text)::text, true);
END;
$$ LANGUAGE plpgsql;

-- Set up test environment
SELECT tests.authenticate_as_service_role();

-- Create test users
SELECT tests.create_test_user_with_subscription('func_test1@test.com', '44444444-4444-4444-4444-444444444444'::uuid, 'free');
SELECT tests.create_test_user_with_subscription('func_test2@test.com', '55555555-5555-5555-5555-555555555555'::uuid, 'pro');

-- Test 1-5: get_current_period_start() function
-- Test 1: Function returns current month start
SELECT is(
  public.get_current_period_start(),
  DATE_TRUNC('month', NOW())::DATE,
  'get_current_period_start returns current month start'
);

-- Test 2-6: check_feature_flag() function
-- Test 2: Returns false for non-existent flag
SELECT is(
  public.check_feature_flag('non_existent_flag', '44444444-4444-4444-4444-444444444444'::uuid),
  false,
  'check_feature_flag returns false for non-existent flag'
);

-- Test 3: Returns false for disabled flag
UPDATE public.feature_flags SET is_enabled = false WHERE flag_name = 'billing_enabled';
SELECT is(
  public.check_feature_flag('billing_enabled', '44444444-4444-4444-4444-444444444444'::uuid),
  false,
  'check_feature_flag returns false for disabled flag'
);

-- Test 4: Returns true for enabled flag with 100% rollout
UPDATE public.feature_flags SET is_enabled = true, rollout_percentage = 100 WHERE flag_name = 'auth_enabled';
SELECT is(
  public.check_feature_flag('auth_enabled', '44444444-4444-4444-4444-444444444444'::uuid),
  true,
  'check_feature_flag returns true for enabled flag with 100% rollout'
);

-- Test 5: Returns true for user in target list
UPDATE public.feature_flags 
SET target_users = ARRAY['44444444-4444-4444-4444-444444444444'::uuid::text]
WHERE flag_name = 'billing_enabled';
SELECT is(
  public.check_feature_flag('billing_enabled', '44444444-4444-4444-4444-444444444444'::uuid),
  true,
  'check_feature_flag returns true for user in target list'
);

-- Test 6-10: get_user_usage_info() function
-- Test 6: Returns correct usage info for free user
SELECT tests.authenticate_as('44444444-4444-4444-4444-444444444444'::uuid);
SELECT results_eq(
  'SELECT plan_name FROM public.get_user_usage_info()',
  ARRAY['Free'],
  'get_user_usage_info returns correct plan name for free user'
);

-- Test 7: Returns correct conversion limits
SELECT results_eq(
  'SELECT conversions_limit FROM public.get_user_usage_info()',
  ARRAY[10],
  'get_user_usage_info returns correct conversion limit for free user'
);

-- Test 8: Returns correct usage count (should be 0 initially)
SELECT results_eq(
  'SELECT conversions_used FROM public.get_user_usage_info()',
  ARRAY[0],
  'get_user_usage_info returns correct initial usage count'
);

-- Test 9: Returns can_convert as true when under limit
SELECT results_eq(
  'SELECT can_convert FROM public.get_user_usage_info()',
  ARRAY[true],
  'get_user_usage_info returns can_convert true when under limit'
);

-- Test 10: Test with pro user
SELECT tests.authenticate_as('55555555-5555-5555-5555-555555555555'::uuid);
SELECT results_eq(
  'SELECT conversions_limit FROM public.get_user_usage_info()',
  ARRAY[500],
  'get_user_usage_info returns correct limit for pro user'
);

-- Test 11-15: increment_usage_counter() function
SELECT tests.authenticate_as_service_role();

-- Test 11: Service role can increment usage
SELECT results_eq(
  'SELECT success FROM public.increment_usage_counter(''44444444-4444-4444-4444-444444444444''::uuid)',
  ARRAY[true],
  'increment_usage_counter succeeds for service role'
);

-- Test 12: Usage counter is incremented
SELECT results_eq(
  'SELECT conversions_used FROM public.usage_records WHERE user_id = ''44444444-4444-4444-4444-444444444444''::uuid AND period_start = public.get_current_period_start()',
  ARRAY[1],
  'Usage counter is correctly incremented'
);

-- Test 13: Remaining quota is calculated correctly
SELECT results_eq(
  'SELECT remaining_quota FROM public.increment_usage_counter(''44444444-4444-4444-4444-444444444444''::uuid)',
  ARRAY[8], -- 10 - 2 = 8 (after second increment)
  'Remaining quota is calculated correctly'
);

-- Test 14: Quota exceeded prevention
-- First, max out the free user's quota
UPDATE public.usage_records 
SET conversions_used = 10 
WHERE user_id = '44444444-4444-4444-4444-444444444444'::uuid 
  AND period_start = public.get_current_period_start();

SELECT results_eq(
  'SELECT success FROM public.increment_usage_counter(''44444444-4444-4444-4444-444444444444''::uuid)',
  ARRAY[false],
  'increment_usage_counter prevents quota exceeded'
);

-- Test 15: Error message for quota exceeded
SELECT results_eq(
  'SELECT error_message FROM public.increment_usage_counter(''44444444-4444-4444-4444-444444444444''::uuid)',
  ARRAY['Quota exceeded'],
  'increment_usage_counter returns correct error message for quota exceeded'
);

-- Test 16-20: reset_monthly_usage() function
-- Test 16: Function requires service role
SELECT tests.authenticate_as('44444444-4444-4444-4444-444444444444'::uuid);
SELECT throws_ok(
  'SELECT public.reset_monthly_usage()',
  'Unauthorized: Only service role can reset usage',
  'reset_monthly_usage requires service role'
);

-- Test 17: Service role can reset usage
SELECT tests.authenticate_as_service_role();
SELECT lives_ok(
  'SELECT public.reset_monthly_usage()',
  'Service role can execute reset_monthly_usage'
);

-- Test 18: Usage is reset to 0
SELECT results_eq(
  'SELECT conversions_used FROM public.usage_records WHERE user_id = ''44444444-4444-4444-4444-444444444444''::uuid AND period_start = public.get_current_period_start()',
  ARRAY[0],
  'Usage is reset to 0 after monthly reset'
);

-- Test 19: Function returns correct count of reset users
SELECT ok(
  (SELECT users_reset FROM public.reset_monthly_usage()) >= 2,
  'reset_monthly_usage returns correct count of reset users'
);

-- Test 20: Function handles errors gracefully
SELECT results_eq(
  'SELECT errors_count FROM public.reset_monthly_usage()',
  ARRAY[0],
  'reset_monthly_usage reports no errors for valid data'
);

-- Test 21-25: check_user_role() function
-- Test 21: Returns correct authentication status for authenticated user
SELECT tests.authenticate_as('44444444-4444-4444-4444-444444444444'::uuid);
SELECT results_eq(
  'SELECT is_authenticated FROM public.check_user_role()',
  ARRAY[true],
  'check_user_role returns true for authenticated user'
);

-- Test 22: Returns correct service role status for regular user
SELECT results_eq(
  'SELECT is_service_role FROM public.check_user_role()',
  ARRAY[false],
  'check_user_role returns false service role status for regular user'
);

-- Test 23: Returns correct email verification status
SELECT results_eq(
  'SELECT email_verified FROM public.check_user_role()',
  ARRAY[true], -- Set by create_test_user_with_subscription
  'check_user_role returns correct email verification status'
);

-- Test 24: Returns correct plan information
SELECT results_eq(
  'SELECT plan_id FROM public.check_user_role()',
  ARRAY['free'],
  'check_user_role returns correct plan information'
);

-- Test 25: Service role authentication
SELECT tests.authenticate_as_service_role();
SELECT results_eq(
  'SELECT is_service_role FROM public.check_user_role()',
  ARRAY[true],
  'check_user_role returns true for service role'
);

-- Clean up test data
DELETE FROM public.usage_records WHERE user_id IN ('44444444-4444-4444-4444-444444444444'::uuid, '55555555-5555-5555-5555-555555555555'::uuid);
DELETE FROM public.user_subscriptions WHERE user_id IN ('44444444-4444-4444-4444-444444444444'::uuid, '55555555-5555-5555-5555-555555555555'::uuid);
DELETE FROM public.profiles WHERE id IN ('44444444-4444-4444-4444-444444444444'::uuid, '55555555-5555-5555-5555-555555555555'::uuid);
DELETE FROM auth.users WHERE id IN ('44444444-4444-4444-4444-444444444444'::uuid, '55555555-5555-5555-5555-555555555555'::uuid);

-- Reset feature flags to original state
UPDATE public.feature_flags SET 
  is_enabled = true, 
  rollout_percentage = 0, 
  target_users = NULL 
WHERE flag_name = 'auth_enabled';

UPDATE public.feature_flags SET 
  is_enabled = false, 
  rollout_percentage = 0, 
  target_users = NULL 
WHERE flag_name = 'billing_enabled';

-- Clean up test functions
DROP FUNCTION IF EXISTS tests.create_test_user_with_subscription(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS tests.authenticate_as_service_role();
DROP FUNCTION IF EXISTS tests.authenticate_as(UUID);

SELECT * FROM finish();

ROLLBACK;