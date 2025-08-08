-- Initial database schema for Supabase CMS integration
-- This migration creates all required tables with proper relationships and constraints

-- User profiles and preferences
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'agency')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled')),
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment subscriptions
CREATE TABLE payment_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('pro', 'agency')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File storage tracking
CREATE TABLE user_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  share_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage analytics
CREATE TABLE usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tool_type TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'conversion', 'upload', 'download'
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences per tool
CREATE TABLE user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tool_type TEXT NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tool_type)
);

-- Monthly usage tracking
CREATE TABLE monthly_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  conversions_count INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- Stripe webhook idempotency
CREATE TABLE stripe_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);
CREATE INDEX idx_payment_subscriptions_user_id ON payment_subscriptions(user_id);
CREATE INDEX idx_payment_subscriptions_stripe_id ON payment_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_files_user_id ON user_files(user_id);
CREATE INDEX idx_user_files_tool_type ON user_files(tool_type);
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_created_at ON usage_analytics(created_at);
CREATE INDEX idx_user_preferences_user_tool ON user_preferences(user_id, tool_type);
CREATE INDEX idx_monthly_usage_user_month ON monthly_usage(user_id, month_year);
CREATE INDEX idx_stripe_events_event_id ON stripe_events(event_id);

-- Enable Row Level Security on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- User profiles: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Payment subscriptions: Users can only view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON payment_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON payment_subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- User files: Users can only access their own files
CREATE POLICY "Users can manage own files" ON user_files
  FOR ALL USING (auth.uid() = user_id);

-- Usage analytics: Users can only view their own analytics
CREATE POLICY "Users can view own analytics" ON usage_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage analytics" ON usage_analytics
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- User preferences: Users can manage their own preferences
CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Monthly usage: Users can view their own usage
CREATE POLICY "Users can view own usage" ON monthly_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage" ON monthly_usage
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Stripe events: Only service role can access
CREATE POLICY "Service role can manage stripe events" ON stripe_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create functions for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, subscription_plan, subscription_status)
  VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER handle_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_payment_subscriptions
  BEFORE UPDATE ON payment_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_user_files
  BEFORE UPDATE ON user_files
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_user_preferences
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_monthly_usage
  BEFORE UPDATE ON monthly_usage
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();