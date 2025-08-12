-- Billing Integration Schema Migration
-- This migration creates the comprehensive billing and authentication system
-- for the image converter tool with proper RLS policies and constraints

-- Create plans table for subscription tiers
CREATE TABLE public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_conversions INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  plan_id TEXT REFERENCES public.plans(id) NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create usage_records table for monthly usage tracking
CREATE TABLE public.usage_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  conversions_used INTEGER DEFAULT 0,
  conversions_limit INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

-- Create conversions table for detailed tracking
-- Note: This table structure supports future migration to Stripe usage-based billing
-- Each conversion record can be used as a "Count per conversion" meter event
CREATE TABLE public.conversions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  original_filename TEXT NOT NULL,
  original_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  processing_time_ms INTEGER,
  storage_path TEXT,
  -- Fields to support future Stripe usage-based billing
  stripe_usage_record_id TEXT, -- For linking to Stripe usage records
  billing_period_start TIMESTAMPTZ, -- For usage aggregation
  billed_to_stripe BOOLEAN DEFAULT FALSE, -- Track if sent to Stripe
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhook_events table for reliability
CREATE TABLE public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_attempts INTEGER DEFAULT 0,
  last_error TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Create feature_flags table for controlled rollout
CREATE TABLE public.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  description TEXT,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_users TEXT[], -- Array of user IDs for targeted rollout
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_customer ON public.user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_stripe_subscription ON public.user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_usage_records_user_period ON public.usage_records(user_id, period_start);
CREATE INDEX idx_conversions_user_id ON public.conversions(user_id);
CREATE INDEX idx_conversions_created_at ON public.conversions(created_at);
CREATE INDEX idx_conversions_billing_period ON public.conversions(user_id, billing_period_start);
CREATE INDEX idx_conversions_stripe_billing ON public.conversions(billed_to_stripe, created_at);
CREATE INDEX idx_webhook_events_stripe_id ON public.webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed);
CREATE INDEX idx_feature_flags_name ON public.feature_flags(flag_name);

-- Enable Row Level Security
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for user_subscriptions table
CREATE POLICY "user_subscriptions_select_policy" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage subscriptions (for webhooks and admin operations)
CREATE POLICY "user_subscriptions_service_policy" ON public.user_subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for usage_records table (read-only for users, Edge Functions can update)
CREATE POLICY "usage_records_select_policy" ON public.usage_records
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can update usage records (Edge Functions only)
CREATE POLICY "usage_records_service_update_policy" ON public.usage_records
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');

-- Service role can insert usage records (for new users and resets)
CREATE POLICY "usage_records_service_insert_policy" ON public.usage_records
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for conversions table (read-only for users, Edge Functions can insert)
CREATE POLICY "conversions_select_policy" ON public.conversions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert conversions (Edge Functions only)
CREATE POLICY "conversions_service_insert_policy" ON public.conversions
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for plans table (public read access)
CREATE POLICY "plans_select_policy" ON public.plans
  FOR SELECT USING (is_active = true);

-- RLS Policies for webhook_events table (service role only)
CREATE POLICY "webhook_events_service_policy" ON public.webhook_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for feature_flags table (service role only)
CREATE POLICY "feature_flags_service_policy" ON public.feature_flags
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert default plans
INSERT INTO public.plans (id, name, description, monthly_conversions, price_cents, features) VALUES
  ('free', 'Free', 'Basic image conversion', 10, 0, '["Basic formats", "10 conversions/month"]'),
  ('pro', 'Pro', 'Advanced image conversion', 500, 999, '["All formats", "500 conversions/month", "Priority support"]'),
  ('unlimited', 'Unlimited', 'Unlimited image conversion', -1, 2999, '["All formats", "Unlimited conversions", "Priority support", "API access"]');

-- Insert default feature flags
INSERT INTO public.feature_flags (flag_name, is_enabled, description) VALUES
  ('auth_enabled', true, 'Enable authentication system'),
  ('billing_enabled', false, 'Enable billing and subscription features'),
  ('conversion_metering', false, 'Enable conversion usage tracking'),
  ('stripe_integration', false, 'Enable Stripe payment processing');

-- Function to automatically create user profile and default subscription
CREATE OR REPLACE FUNCTION public.handle_new_user_billing()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, email_verified)
  VALUES (NEW.id, NEW.email, NEW.email_confirmed_at IS NOT NULL);
  
  -- Create default subscription to free plan
  INSERT INTO public.user_subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active');
  
  -- Create initial usage record for current month
  INSERT INTO public.usage_records (
    user_id, 
    period_start, 
    period_end, 
    conversions_used, 
    conversions_limit
  ) VALUES (
    NEW.id,
    DATE_TRUNC('month', NOW())::DATE,
    (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    0,
    10 -- Free plan limit
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at_billing()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get current usage period start date
CREATE OR REPLACE FUNCTION public.get_current_period_start()
RETURNS DATE AS $$
BEGIN
  RETURN DATE_TRUNC('month', NOW())::DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has feature access
CREATE OR REPLACE FUNCTION public.check_feature_flag(flag_name TEXT, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  flag_record public.feature_flags%ROWTYPE;
  random_value INTEGER;
BEGIN
  -- Get flag record
  SELECT * INTO flag_record FROM public.feature_flags WHERE feature_flags.flag_name = check_feature_flag.flag_name;
  
  -- If flag doesn't exist, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If flag is disabled, return false
  IF NOT flag_record.is_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- If user is in target users list, return true
  IF user_id = ANY(flag_record.target_users) THEN
    RETURN TRUE;
  END IF;
  
  -- Check rollout percentage
  IF flag_record.rollout_percentage = 100 THEN
    RETURN TRUE;
  END IF;
  
  IF flag_record.rollout_percentage = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Use deterministic random based on user_id and flag_name for consistent rollout
  random_value := (hashtext(user_id::TEXT || flag_name) % 100);
  RETURN random_value < flag_record.rollout_percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current plan and usage
CREATE OR REPLACE FUNCTION public.get_user_usage_info(user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  plan_name TEXT,
  conversions_used INTEGER,
  conversions_limit INTEGER,
  period_start DATE,
  period_end DATE,
  can_convert BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name,
    ur.conversions_used,
    ur.conversions_limit,
    ur.period_start,
    ur.period_end,
    (ur.conversions_limit = -1 OR ur.conversions_used < ur.conversions_limit) as can_convert
  FROM public.usage_records ur
  JOIN public.user_subscriptions us ON us.user_id = ur.user_id
  JOIN public.plans p ON p.id = us.plan_id
  WHERE ur.user_id = get_user_usage_info.user_id
    AND ur.period_start = get_current_period_start()
    AND us.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter atomically (for Edge Functions only)
CREATE OR REPLACE FUNCTION public.increment_usage_counter(
  user_id UUID,
  conversion_details JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success BOOLEAN,
  remaining_quota INTEGER,
  error_message TEXT
) AS $$
DECLARE
  current_usage INTEGER;
  usage_limit INTEGER;
  updated_usage INTEGER;
BEGIN
  -- Check if caller has service role (Edge Functions only)
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RETURN QUERY SELECT FALSE, 0, 'Unauthorized: Only Edge Functions can increment usage';
    RETURN;
  END IF;

  -- Get current usage and limit
  SELECT ur.conversions_used, ur.conversions_limit
  INTO current_usage, usage_limit
  FROM public.usage_records ur
  WHERE ur.user_id = increment_usage_counter.user_id
    AND ur.period_start = get_current_period_start();

  -- Check if record exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Usage record not found for current period';
    RETURN;
  END IF;

  -- Check quota (unlimited = -1)
  IF usage_limit != -1 AND current_usage >= usage_limit THEN
    RETURN QUERY SELECT FALSE, (usage_limit - current_usage), 'Quota exceeded';
    RETURN;
  END IF;

  -- Increment usage atomically
  UPDATE public.usage_records
  SET conversions_used = conversions_used + 1,
      updated_at = NOW()
  WHERE user_id = increment_usage_counter.user_id
    AND period_start = get_current_period_start()
  RETURNING conversions_used INTO updated_usage;

  -- Calculate remaining quota
  RETURN QUERY SELECT 
    TRUE, 
    CASE 
      WHEN usage_limit = -1 THEN -1 -- Unlimited
      ELSE usage_limit - updated_usage
    END,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly usage (for scheduled jobs)
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS TABLE(
  users_reset INTEGER,
  errors_count INTEGER
) AS $$
DECLARE
  reset_count INTEGER := 0;
  error_count INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Only service role can execute this
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can reset usage';
  END IF;

  -- Loop through all active subscriptions
  FOR user_record IN 
    SELECT DISTINCT us.user_id, p.monthly_conversions
    FROM public.user_subscriptions us
    JOIN public.plans p ON p.id = us.plan_id
    WHERE us.status = 'active'
  LOOP
    BEGIN
      -- Create new usage record for current month
      INSERT INTO public.usage_records (
        user_id,
        period_start,
        period_end,
        conversions_used,
        conversions_limit
      ) VALUES (
        user_record.user_id,
        get_current_period_start(),
        (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
        0,
        user_record.monthly_conversions
      )
      ON CONFLICT (user_id, period_start) DO UPDATE SET
        conversions_used = 0,
        conversions_limit = EXCLUDED.conversions_limit,
        updated_at = NOW();
      
      reset_count := reset_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      -- Log error but continue processing
      RAISE WARNING 'Failed to reset usage for user %: %', user_record.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT reset_count, error_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user role and permissions
CREATE OR REPLACE FUNCTION public.check_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  is_authenticated BOOLEAN,
  is_service_role BOOLEAN,
  email_verified BOOLEAN,
  plan_id TEXT,
  plan_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (auth.uid() IS NOT NULL) as is_authenticated,
    (auth.jwt() ->> 'role' = 'service_role') as is_service_role,
    COALESCE(p.email_verified, FALSE) as email_verified,
    us.plan_id,
    us.status as plan_status
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON us.user_id = p.id AND us.status = 'active'
  WHERE p.id = COALESCE(check_user_role.user_id, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate usage statistics (for analytics)
CREATE OR REPLACE FUNCTION public.get_usage_statistics(
  start_date DATE DEFAULT (NOW() - INTERVAL '30 days')::DATE,
  end_date DATE DEFAULT NOW()::DATE
)
RETURNS TABLE(
  total_conversions BIGINT,
  unique_users BIGINT,
  avg_conversions_per_user NUMERIC,
  top_formats JSONB
) AS $$
BEGIN
  -- Only service role can access statistics
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can access statistics';
  END IF;

  RETURN QUERY
  WITH conversion_stats AS (
    SELECT 
      COUNT(*) as total_conversions,
      COUNT(DISTINCT user_id) as unique_users,
      target_format
    FROM public.conversions
    WHERE created_at::DATE BETWEEN start_date AND end_date
    GROUP BY target_format
  ),
  format_stats AS (
    SELECT jsonb_object_agg(target_format, total_conversions) as formats
    FROM conversion_stats
  )
  SELECT 
    SUM(cs.total_conversions)::BIGINT,
    MAX(cs.unique_users)::BIGINT,
    CASE 
      WHEN MAX(cs.unique_users) > 0 THEN 
        ROUND(SUM(cs.total_conversions)::NUMERIC / MAX(cs.unique_users), 2)
      ELSE 0
    END,
    COALESCE(fs.formats, '{}'::jsonb)
  FROM conversion_stats cs
  CROSS JOIN format_stats fs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile and subscription on signup
CREATE TRIGGER on_auth_user_created_billing
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_billing();

-- Add updated_at triggers
CREATE TRIGGER handle_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_billing();

CREATE TRIGGER handle_updated_at_user_subscriptions
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_billing();

CREATE TRIGGER handle_updated_at_usage_records
  BEFORE UPDATE ON public.usage_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_billing();

CREATE TRIGGER handle_updated_at_feature_flags
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_billing();