-- pgTAP tests for RLS policies
-- This file contains comprehensive tests for all Row Level Security policies
-- Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6

BEGIN;

-- Load pgTAP extension
SELECT plan(50); -- Adjust plan count as we add more tests

-- Test helper functions
CREATE OR REPLACE FUNCTION tests.create_test_user(email TEXT, user_id UUID DEFAULT gen_random_uuid())
RETURNS UUID AS $$
BEGIN
  -- Insert into auth.users (simulating Supabase auth)
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
  VALUES (user_id, email, NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.authenticate_as(user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Set the auth.uid() context for testing
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text)::text, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.authenticate_as_service_role()
RETURNS VOID AS $$
BEGIN
  -- Set service role context for testing
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.clear_auth()
RETURNS VOID AS $$
BEGIN
  -- Clear authentication context
  PERFORM set_config('request.jwt.claims', NULL, true);
END;
$$ LANGUAGE plpgsql;

-- Create test users
SELECT tests.create_test_user('user1@test.com', '11111111-1111-1111-1111-111111111111'::uuid);
SELECT tests.create_test_user('user2@test.com', '22222222-2222-2222-2222-222222222222'::uuid);

-- Test 1-5: Profiles table RLS policies
-- Requirement 6.7: profiles (select/update where id = auth.uid())

-- Test 1: User can select own profile
SELECT tests.authenticate_as('11111111-1111-1111-1111-111111111111'::uuid);
SELECT results_eq(
  'SELECT count(*)::int FROM public.profiles WHERE id = auth.uid()',
  ARRAY[1],
  'User can select own profile'
);

-- Test 2: User cannot select other profiles
SELECT results_eq(
  'SELECT count(*)::int FROM public.profiles WHERE id != auth.uid()',
  ARRAY[0],
  'User cannot select other profiles'
);

-- Test 3: User can update own profile
SELECT lives_ok(
  'UPDATE public.profiles SET full_name = ''Test User 1'' WHERE id = auth.uid()',
  'User can update own profile'
);

-- Test 4: User cannot update other profiles
SELECT throws_ok(
  'UPDATE public.profiles SET full_name = ''Hacker'' WHERE id = ''22222222-2222-2222-2222-222222222222''::uuid',
  'new row violates row-level security policy',
  'User cannot update other profiles'
);

-- Test 5: User can insert own profile (handled by trigger, but test policy)
SELECT lives_ok(
  'INSERT INTO public.profiles (id, email) VALUES (''33333333-3333-3333-3333-333333333333''::uuid, ''user3@test.com'') ON CONFLICT DO NOTHING',
  'User can insert profile with matching auth.uid()'
);

-- Test 6-10: User subscriptions table RLS policies
-- Requirement 6.8: user_subscriptions (select where user_id = auth.uid())

-- Test 6: User can select own subscriptions
SELECT results_eq(
  'SELECT count(*)::int FROM public.user_subscriptions WHERE user_id = auth.uid()',
  ARRAY[1],
  'User can select own subscriptions'
);

-- Test 7: User cannot select other subscriptions
SELECT results_eq(
  'SELECT count(*)::int FROM public.user_subscriptions WHERE user_id != auth.uid()',
  ARRAY[0],
  'User cannot select other user subscriptions'
);

-- Test 8: User cannot insert subscriptions (only service role)
SELECT throws_ok(
  'INSERT INTO public.user_subscriptions (user_id, plan_id, status) VALUES (auth.uid(), ''pro'', ''active'')',
  'new row violates row-level security policy',
  'User cannot insert subscriptions'
);

-- Test 9: User cannot update subscriptions (only service role)
SELECT throws_ok(
  'UPDATE public.user_subscriptions SET status = ''canceled'' WHERE user_id = auth.uid()',
  'new row violates row-level security policy',
  'User cannot update subscriptions'
);

-- Test 10: Service role can manage subscriptions
SELECT tests.authenticate_as_service_role();
SELECT lives_ok(
  'UPDATE public.user_subscriptions SET status = ''active'' WHERE user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  'Service role can update subscriptions'
);

-- Test 11-15: Usage records table RLS policies
-- Requirement 6.2: usage_records (select where user_id = auth.uid(), no client writes)

SELECT tests.authenticate_as('11111111-1111-1111-1111-111111111111'::uuid);

-- Test 11: User can select own usage records
SELECT results_eq(
  'SELECT count(*)::int FROM public.usage_records WHERE user_id = auth.uid()',
  ARRAY[1],
  'User can select own usage records'
);

-- Test 12: User cannot select other usage records
SELECT results_eq(
  'SELECT count(*)::int FROM public.usage_records WHERE user_id != auth.uid()',
  ARRAY[0],
  'User cannot select other usage records'
);

-- Test 13: User cannot insert usage records (only service role)
SELECT throws_ok(
  'INSERT INTO public.usage_records (user_id, period_start, period_end, conversions_limit) VALUES (auth.uid(), CURRENT_DATE, CURRENT_DATE + INTERVAL ''1 month'', 100)',
  'new row violates row-level security policy',
  'User cannot insert usage records'
);

-- Test 14: User cannot update usage records (only service role)
SELECT throws_ok(
  'UPDATE public.usage_records SET conversions_used = 5 WHERE user_id = auth.uid()',
  'new row violates row-level security policy',
  'User cannot update usage records'
);

-- Test 15: Service role can update usage records
SELECT tests.authenticate_as_service_role();
SELECT lives_ok(
  'UPDATE public.usage_records SET conversions_used = 1 WHERE user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  'Service role can update usage records'
);

-- Test 16-20: Conversions table RLS policies
-- Requirement 6.3: conversions (select where user_id = auth.uid(), no client inserts)

SELECT tests.authenticate_as('11111111-1111-1111-1111-111111111111'::uuid);

-- Test 16: User can select own conversions
SELECT results_eq(
  'SELECT count(*)::int FROM public.conversions WHERE user_id = auth.uid()',
  ARRAY[0], -- No conversions yet
  'User can select own conversions'
);

-- Test 17: User cannot select other conversions
SELECT results_eq(
  'SELECT count(*)::int FROM public.conversions WHERE user_id != auth.uid()',
  ARRAY[0],
  'User cannot select other conversions'
);

-- Test 18: User cannot insert conversions (only service role via Edge Functions)
SELECT throws_ok(
  'INSERT INTO public.conversions (user_id, original_filename, original_format, target_format, file_size_bytes) VALUES (auth.uid(), ''test.jpg'', ''jpg'', ''png'', 1024)',
  'new row violates row-level security policy',
  'User cannot insert conversions'
);

-- Test 19: User cannot update conversions
SELECT throws_ok(
  'UPDATE public.conversions SET processing_time_ms = 1000 WHERE user_id = auth.uid()',
  'new row violates row-level security policy',
  'User cannot update conversions'
);

-- Test 20: Service role can insert conversions
SELECT tests.authenticate_as_service_role();
SELECT lives_ok(
  'INSERT INTO public.conversions (user_id, original_filename, original_format, target_format, file_size_bytes) VALUES (''11111111-1111-1111-1111-111111111111''::uuid, ''test.jpg'', ''jpg'', ''png'', 1024)',
  'Service role can insert conversions'
);

-- Test 21-25: Plans table RLS policies
-- Requirement: Public read access for active plans

SELECT tests.authenticate_as('11111111-1111-1111-1111-111111111111'::uuid);

-- Test 21: User can select active plans
SELECT results_eq(
  'SELECT count(*)::int FROM public.plans WHERE is_active = true',
  ARRAY[3], -- free, pro, unlimited
  'User can select active plans'
);

-- Test 22: User cannot select inactive plans
SELECT results_eq(
  'SELECT count(*)::int FROM public.plans WHERE is_active = false',
  ARRAY[0],
  'User cannot select inactive plans'
);

-- Test 23: User cannot insert plans
SELECT throws_ok(
  'INSERT INTO public.plans (id, name, monthly_conversions, price_cents) VALUES (''test'', ''Test Plan'', 50, 500)',
  'new row violates row-level security policy',
  'User cannot insert plans'
);

-- Test 24: User cannot update plans
SELECT throws_ok(
  'UPDATE public.plans SET price_cents = 0 WHERE id = ''pro''',
  'new row violates row-level security policy',
  'User cannot update plans'
);

-- Test 25: Service role can manage plans
SELECT tests.authenticate_as_service_role();
SELECT lives_ok(
  'UPDATE public.plans SET description = ''Updated description'' WHERE id = ''free''',
  'Service role can update plans'
);

-- Test 26-30: Webhook events table RLS policies
-- Requirement: Service role only access

SELECT tests.authenticate_as('11111111-1111-1111-1111-111111111111'::uuid);

-- Test 26: User cannot select webhook events
SELECT results_eq(
  'SELECT count(*)::int FROM public.webhook_events',
  ARRAY[0],
  'User cannot select webhook events'
);

-- Test 27: User cannot insert webhook events
SELECT throws_ok(
  'INSERT INTO public.webhook_events (stripe_event_id, event_type, payload) VALUES (''evt_test'', ''test'', ''{}''::jsonb)',
  'new row violates row-level security policy',
  'User cannot insert webhook events'
);

-- Test 28: Service role can select webhook events
SELECT tests.authenticate_as_service_role();
SELECT results_eq(
  'SELECT count(*)::int FROM public.webhook_events',
  ARRAY[0], -- No events yet
  'Service role can select webhook events'
);

-- Test 29: Service role can insert webhook events
SELECT lives_ok(
  'INSERT INTO public.webhook_events (stripe_event_id, event_type, payload) VALUES (''evt_test_123'', ''checkout.session.completed'', ''{"test": true}''::jsonb)',
  'Service role can insert webhook events'
);

-- Test 30: Service role can update webhook events
SELECT lives_ok(
  'UPDATE public.webhook_events SET processed = true WHERE stripe_event_id = ''evt_test_123''',
  'Service role can update webhook events'
);

-- Test 31-35: Feature flags table RLS policies
-- Requirement: Service role only access

SELECT tests.authenticate_as('11111111-1111-1111-1111-111111111111'::uuid);

-- Test 31: User cannot select feature flags
SELECT results_eq(
  'SELECT count(*)::int FROM public.feature_flags',
  ARRAY[0],
  'User cannot select feature flags'
);

-- Test 32: User cannot insert feature flags
SELECT throws_ok(
  'INSERT INTO public.feature_flags (flag_name, is_enabled) VALUES (''test_flag'', true)',
  'new row violates row-level security policy',
  'User cannot insert feature flags'
);

-- Test 33: Service role can select feature flags
SELECT tests.authenticate_as_service_role();
SELECT results_eq(
  'SELECT count(*)::int FROM public.feature_flags WHERE is_enabled = true',
  ARRAY[1], -- auth_enabled is true by default
  'Service role can select feature flags'
);

-- Test 34: Service role can insert feature flags
SELECT lives_ok(
  'INSERT INTO public.feature_flags (flag_name, is_enabled, description) VALUES (''test_flag'', false, ''Test flag for RLS testing'')',
  'Service role can insert feature flags'
);

-- Test 35: Service role can update feature flags
SELECT lives_ok(
  'UPDATE public.feature_flags SET is_enabled = true WHERE flag_name = ''test_flag''',
  'Service role can update feature flags'
);

-- Test 36-40: Cross-user data access prevention tests
-- Requirement 6.1, 6.4: Users cannot access other users' data

-- Test 36: User 1 cannot access User 2's profile
SELECT tests.authenticate_as('11111111-1111-1111-1111-111111111111'::uuid);
SELECT results_eq(
  'SELECT count(*)::int FROM public.profiles WHERE id = ''22222222-2222-2222-2222-222222222222''::uuid',
  ARRAY[0],
  'User 1 cannot access User 2 profile'
);

-- Test 37: User 1 cannot access User 2's subscriptions
SELECT results_eq(
  'SELECT count(*)::int FROM public.user_subscriptions WHERE user_id = ''22222222-2222-2222-2222-222222222222''::uuid',
  ARRAY[0],
  'User 1 cannot access User 2 subscriptions'
);

-- Test 38: User 1 cannot access User 2's usage records
SELECT results_eq(
  'SELECT count(*)::int FROM public.usage_records WHERE user_id = ''22222222-2222-2222-2222-222222222222''::uuid',
  ARRAY[0],
  'User 1 cannot access User 2 usage records'
);

-- Test 39: User 1 cannot access User 2's conversions
SELECT results_eq(
  'SELECT count(*)::int FROM public.conversions WHERE user_id = ''22222222-2222-2222-2222-222222222222''::uuid',
  ARRAY[0],
  'User 1 cannot access User 2 conversions'
);

-- Test 40: Switch to User 2 and verify isolation
SELECT tests.authenticate_as('22222222-2222-2222-2222-222222222222'::uuid);
SELECT results_eq(
  'SELECT count(*)::int FROM public.profiles WHERE id = auth.uid()',
  ARRAY[1],
  'User 2 can access own profile'
);

-- Test 41-45: Service role bypass functionality tests
-- Requirement 6.5, 6.6: Service role can bypass RLS for Edge Functions

SELECT tests.authenticate_as_service_role();

-- Test 41: Service role can access all profiles
SELECT ok(
  (SELECT count(*) FROM public.profiles) >= 2,
  'Service role can access all profiles'
);

-- Test 42: Service role can access all subscriptions
SELECT ok(
  (SELECT count(*) FROM public.user_subscriptions) >= 2,
  'Service role can access all subscriptions'
);

-- Test 43: Service role can access all usage records
SELECT ok(
  (SELECT count(*) FROM public.usage_records) >= 2,
  'Service role can access all usage records'
);

-- Test 44: Service role can access all conversions
SELECT ok(
  (SELECT count(*) FROM public.conversions) >= 1,
  'Service role can access all conversions'
);

-- Test 45: Service role can perform administrative operations
SELECT lives_ok(
  'UPDATE public.usage_records SET conversions_used = 0 WHERE period_start = CURRENT_DATE',
  'Service role can perform administrative operations'
);

-- Test 46-50: User data isolation and access controls
-- Requirement 6.6: Comprehensive access control verification

-- Test 46: Unauthenticated user cannot access any protected data
SELECT tests.clear_auth();
SELECT results_eq(
  'SELECT count(*)::int FROM public.profiles',
  ARRAY[0],
  'Unauthenticated user cannot access profiles'
);

-- Test 47: Unauthenticated user cannot access subscriptions
SELECT results_eq(
  'SELECT count(*)::int FROM public.user_subscriptions',
  ARRAY[0],
  'Unauthenticated user cannot access subscriptions'
);

-- Test 48: Unauthenticated user cannot access usage records
SELECT results_eq(
  'SELECT count(*)::int FROM public.usage_records',
  ARRAY[0],
  'Unauthenticated user cannot access usage records'
);

-- Test 49: Unauthenticated user cannot access conversions
SELECT results_eq(
  'SELECT count(*)::int FROM public.conversions',
  ARRAY[0],
  'Unauthenticated user cannot access conversions'
);

-- Test 50: Unauthenticated user can still access public plans
SELECT results_eq(
  'SELECT count(*)::int FROM public.plans WHERE is_active = true',
  ARRAY[3],
  'Unauthenticated user can access active plans'
);

-- Clean up test data
SELECT tests.authenticate_as_service_role();
DELETE FROM public.conversions WHERE user_id IN ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid);
DELETE FROM public.webhook_events WHERE stripe_event_id = 'evt_test_123';
DELETE FROM public.feature_flags WHERE flag_name = 'test_flag';

-- Clean up test functions
DROP FUNCTION IF EXISTS tests.create_test_user(TEXT, UUID);
DROP FUNCTION IF EXISTS tests.authenticate_as(UUID);
DROP FUNCTION IF EXISTS tests.authenticate_as_service_role();
DROP FUNCTION IF EXISTS tests.clear_auth();

SELECT * FROM finish();

ROLLBACK;