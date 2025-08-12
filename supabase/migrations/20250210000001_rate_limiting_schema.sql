-- Rate Limiting and Abuse Prevention Schema
-- Requirements: 10.1, 10.2, 10.3, 10.6

-- Create rate_limit_records table for tracking requests
CREATE TABLE IF NOT EXISTS public.rate_limit_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- Format: "user:uuid:endpoint" or "ip:address:endpoint"
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  endpoint TEXT DEFAULT 'general',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON public.rate_limit_records(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_id ON public.rate_limit_records(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_address ON public.rate_limit_records(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at ON public.rate_limit_records(created_at);

-- Create suspicious_activities table for logging abuse patterns
CREATE TABLE IF NOT EXISTS public.suspicious_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('rapid_requests', 'quota_abuse', 'failed_auth', 'suspicious_pattern')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  details JSONB DEFAULT '{}',
  reviewed BOOLEAN DEFAULT FALSE,
  reviewer_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for suspicious activities
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_user_id ON public.suspicious_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_ip_address ON public.suspicious_activities(ip_address);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_severity ON public.suspicious_activities(severity);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_reviewed ON public.suspicious_activities(reviewed);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_created_at ON public.suspicious_activities(created_at);

-- Create account_suspensions table for managing suspended accounts
CREATE TABLE IF NOT EXISTS public.account_suspensions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  reason TEXT NOT NULL,
  suspended_by UUID REFERENCES auth.users(id), -- NULL for automated suspensions
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT suspension_target_check CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

-- Create indexes for account suspensions
CREATE INDEX IF NOT EXISTS idx_account_suspensions_user_id ON public.account_suspensions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_suspensions_ip_address ON public.account_suspensions(ip_address);
CREATE INDEX IF NOT EXISTS idx_account_suspensions_is_active ON public.account_suspensions(is_active);
CREATE INDEX IF NOT EXISTS idx_account_suspensions_expires_at ON public.account_suspensions(expires_at);

-- Create admin_actions table for audit trail
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id), -- NULL for service role actions
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for admin actions
CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON public.admin_actions(action);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user_id ON public.admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON public.admin_actions(created_at);

-- Create RLS policies for rate limiting tables

-- Rate limit records: Only service role can access
ALTER TABLE public.rate_limit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_records_service_only" ON public.rate_limit_records
  FOR ALL USING (auth.role() = 'service_role');

-- Suspicious activities: Only service role and admins can access
ALTER TABLE public.suspicious_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suspicious_activities_service_only" ON public.suspicious_activities
  FOR ALL USING (auth.role() = 'service_role');

-- Account suspensions: Users can read their own, service role can manage all
ALTER TABLE public.account_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_suspensions_user_read" ON public.account_suspensions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "account_suspensions_service_manage" ON public.account_suspensions
  FOR ALL USING (auth.role() = 'service_role');

-- Admin actions: Only service role can access
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_actions_service_only" ON public.admin_actions
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to initialize rate limiting tables (for backwards compatibility)
CREATE OR REPLACE FUNCTION create_rate_limit_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function is now a no-op since tables are created via migration
  -- Kept for backwards compatibility with rate-limiter.ts
  RETURN;
END;
$$;

-- Create function to clean up old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_records(hours_old INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limit_records 
  WHERE created_at < NOW() - (hours_old || ' hours')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Create function to get rate limit statistics
CREATE OR REPLACE FUNCTION get_rate_limit_stats(time_window_minutes INTEGER DEFAULT 60)
RETURNS TABLE (
  identifier_type TEXT,
  request_count BIGINT,
  unique_identifiers BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN rlr.identifier LIKE 'user:%' THEN 'user'
      WHEN rlr.identifier LIKE 'ip:%' THEN 'ip'
      ELSE 'other'
    END as identifier_type,
    COUNT(*) as request_count,
    COUNT(DISTINCT rlr.identifier) as unique_identifiers
  FROM public.rate_limit_records rlr
  WHERE rlr.created_at >= NOW() - (time_window_minutes || ' minutes')::INTERVAL
  GROUP BY identifier_type
  ORDER BY request_count DESC;
END;
$$;

-- Create function to check if user/IP is suspended
CREATE OR REPLACE FUNCTION is_suspended(check_user_id UUID DEFAULT NULL, check_ip_address TEXT DEFAULT NULL)
RETURNS TABLE (
  suspended BOOLEAN,
  reason TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as suspended,
    s.reason,
    s.expires_at
  FROM public.account_suspensions s
  WHERE s.is_active = TRUE 
    AND s.expires_at > NOW()
    AND (
      (check_user_id IS NOT NULL AND s.user_id = check_user_id) OR
      (check_ip_address IS NOT NULL AND s.ip_address = check_ip_address)
    )
  LIMIT 1;
  
  -- If no active suspension found, return not suspended
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE as suspended, NULL::TEXT as reason, NULL::TIMESTAMPTZ as expires_at;
  END IF;
END;
$$;

-- Create trigger to update updated_at on account_suspensions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_account_suspensions_updated_at
  BEFORE UPDATE ON public.account_suspensions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_records_composite ON public.rate_limit_records(identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_composite ON public.suspicious_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_suspensions_active ON public.account_suspensions(is_active, expires_at) WHERE is_active = TRUE;

COMMENT ON TABLE public.rate_limit_records IS 'Tracks API requests for rate limiting purposes';
COMMENT ON TABLE public.suspicious_activities IS 'Logs suspicious activity patterns for abuse detection';
COMMENT ON TABLE public.account_suspensions IS 'Manages temporary account and IP suspensions';
COMMENT ON TABLE public.admin_actions IS 'Audit trail for administrative security actions';

COMMENT ON FUNCTION cleanup_old_rate_limit_records IS 'Cleans up old rate limit records to prevent table bloat';
COMMENT ON FUNCTION get_rate_limit_stats IS 'Returns rate limiting statistics for monitoring';
COMMENT ON FUNCTION is_suspended IS 'Checks if a user or IP address is currently suspended';