-- Privacy and Data Export Schema Migration
-- This migration creates tables and functions for GDPR-compliant data export and deletion

-- Create data_export_requests table for tracking export requests
CREATE TABLE public.data_export_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  export_format TEXT DEFAULT 'json' CHECK (export_format IN ('json', 'csv')),
  file_path TEXT, -- Path to generated export file
  file_size_bytes INTEGER,
  download_url TEXT, -- Signed URL for download
  download_expires_at TIMESTAMPTZ,
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ NOT NULL, -- SLA deadline (30 days from request)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit_logs table for tracking data operations
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  performed_by UUID REFERENCES auth.users(id), -- For admin actions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_data_export_requests_user_id ON public.data_export_requests(user_id);
CREATE INDEX idx_data_export_requests_status ON public.data_export_requests(status);
CREATE INDEX idx_data_export_requests_sla_deadline ON public.data_export_requests(sla_deadline);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable Row Level Security
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_export_requests table
CREATE POLICY "data_export_requests_select_policy" ON public.data_export_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "data_export_requests_insert_policy" ON public.data_export_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can manage all export requests
CREATE POLICY "data_export_requests_service_policy" ON public.data_export_requests
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for audit_logs table
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all audit logs
CREATE POLICY "audit_logs_service_policy" ON public.audit_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to create data export request
CREATE OR REPLACE FUNCTION public.request_data_export(
  export_type TEXT DEFAULT 'export',
  format TEXT DEFAULT 'json'
)
RETURNS TABLE(
  request_id UUID,
  sla_deadline TIMESTAMPTZ,
  estimated_completion TEXT
) AS $
DECLARE
  new_request_id UUID;
  deadline TIMESTAMPTZ;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check for existing pending requests
  IF EXISTS (
    SELECT 1 FROM public.data_export_requests 
    WHERE user_id = auth.uid() 
      AND request_type = export_type 
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A % request is already in progress', export_type;
  END IF;

  -- Calculate SLA deadline (30 days from now)
  deadline := NOW() + INTERVAL '30 days';

  -- Create export request
  INSERT INTO public.data_export_requests (
    user_id,
    request_type,
    export_format,
    sla_deadline
  ) VALUES (
    auth.uid(),
    export_type,
    format,
    deadline
  ) RETURNING id INTO new_request_id;

  -- Log the request
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    new_values
  ) VALUES (
    auth.uid(),
    'data_export_requested',
    'data_export_request',
    new_request_id::TEXT,
    jsonb_build_object(
      'request_type', export_type,
      'format', format,
      'sla_deadline', deadline
    )
  );

  RETURN QUERY SELECT 
    new_request_id,
    deadline,
    'Within 30 days'::TEXT;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive user data for export
CREATE OR REPLACE FUNCTION public.get_user_export_data(target_user_id UUID)
RETURNS JSONB AS $
DECLARE
  user_data JSONB;
  profile_data JSONB;
  subscription_data JSONB;
  usage_data JSONB;
  conversion_data JSONB;
  export_data JSONB;
BEGIN
  -- Only service role can execute this function
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can export user data';
  END IF;

  -- Get user profile data
  SELECT jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'email_verified', p.email_verified,
    'stripe_customer_id', p.stripe_customer_id,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO profile_data
  FROM public.profiles p
  WHERE p.id = target_user_id;

  -- Get subscription data
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', us.id,
      'plan_id', us.plan_id,
      'plan_name', p.name,
      'plan_description', p.description,
      'monthly_conversions', p.monthly_conversions,
      'price_cents', p.price_cents,
      'stripe_customer_id', us.stripe_customer_id,
      'stripe_subscription_id', us.stripe_subscription_id,
      'status', us.status,
      'current_period_start', us.current_period_start,
      'current_period_end', us.current_period_end,
      'cancel_at_period_end', us.cancel_at_period_end,
      'created_at', us.created_at,
      'updated_at', us.updated_at
    )
  ) INTO subscription_data
  FROM public.user_subscriptions us
  JOIN public.plans p ON p.id = us.plan_id
  WHERE us.user_id = target_user_id;

  -- Get usage records
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ur.id,
      'period_start', ur.period_start,
      'period_end', ur.period_end,
      'conversions_used', ur.conversions_used,
      'conversions_limit', ur.conversions_limit,
      'created_at', ur.created_at,
      'updated_at', ur.updated_at
    )
  ) INTO usage_data
  FROM public.usage_records ur
  WHERE ur.user_id = target_user_id;

  -- Get conversion history
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'original_filename', c.original_filename,
      'original_format', c.original_format,
      'target_format', c.target_format,
      'file_size_bytes', c.file_size_bytes,
      'processing_time_ms', c.processing_time_ms,
      'storage_path', c.storage_path,
      'stripe_usage_record_id', c.stripe_usage_record_id,
      'billing_period_start', c.billing_period_start,
      'billed_to_stripe', c.billed_to_stripe,
      'created_at', c.created_at
    )
  ) INTO conversion_data
  FROM public.conversions c
  WHERE c.user_id = target_user_id;

  -- Get export request history
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', der.id,
      'request_type', der.request_type,
      'status', der.status,
      'export_format', der.export_format,
      'file_size_bytes', der.file_size_bytes,
      'processing_started_at', der.processing_started_at,
      'processing_completed_at', der.processing_completed_at,
      'sla_deadline', der.sla_deadline,
      'created_at', der.created_at
    )
  ) INTO export_data
  FROM public.data_export_requests der
  WHERE der.user_id = target_user_id;

  -- Combine all data
  user_data := jsonb_build_object(
    'export_metadata', jsonb_build_object(
      'exported_at', NOW(),
      'export_version', '1.0',
      'user_id', target_user_id
    ),
    'profile', profile_data,
    'subscriptions', COALESCE(subscription_data, '[]'::jsonb),
    'usage_records', COALESCE(usage_data, '[]'::jsonb),
    'conversions', COALESCE(conversion_data, '[]'::jsonb),
    'export_requests', COALESCE(export_data, '[]'::jsonb)
  );

  RETURN user_data;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update export request status
CREATE OR REPLACE FUNCTION public.update_export_request_status(
  request_id UUID,
  new_status TEXT,
  file_path TEXT DEFAULT NULL,
  file_size_bytes INTEGER DEFAULT NULL,
  download_url TEXT DEFAULT NULL,
  download_expires_at TIMESTAMPTZ DEFAULT NULL,
  error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $
BEGIN
  -- Only service role can update export requests
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can update export requests';
  END IF;

  UPDATE public.data_export_requests
  SET 
    status = new_status,
    file_path = COALESCE(update_export_request_status.file_path, data_export_requests.file_path),
    file_size_bytes = COALESCE(update_export_request_status.file_size_bytes, data_export_requests.file_size_bytes),
    download_url = COALESCE(update_export_request_status.download_url, data_export_requests.download_url),
    download_expires_at = COALESCE(update_export_request_status.download_expires_at, data_export_requests.download_expires_at),
    error_message = COALESCE(update_export_request_status.error_message, data_export_requests.error_message),
    processing_started_at = CASE 
      WHEN new_status = 'processing' AND processing_started_at IS NULL THEN NOW()
      ELSE processing_started_at
    END,
    processing_completed_at = CASE 
      WHEN new_status IN ('completed', 'failed') THEN NOW()
      ELSE processing_completed_at
    END,
    updated_at = NOW()
  WHERE id = request_id;

  RETURN FOUND;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending export requests (for processing)
CREATE OR REPLACE FUNCTION public.get_pending_export_requests()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  request_type TEXT,
  export_format TEXT,
  created_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ
) AS $
BEGIN
  -- Only service role can access pending requests
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can access pending requests';
  END IF;

  RETURN QUERY
  SELECT 
    der.id,
    der.user_id,
    der.request_type,
    der.export_format,
    der.created_at,
    der.sla_deadline
  FROM public.data_export_requests der
  WHERE der.status = 'pending'
  ORDER BY der.created_at ASC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired download URLs
CREATE OR REPLACE FUNCTION public.cleanup_expired_exports()
RETURNS INTEGER AS $
DECLARE
  cleanup_count INTEGER;
BEGIN
  -- Only service role can cleanup exports
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can cleanup exports';
  END IF;

  UPDATE public.data_export_requests
  SET 
    download_url = NULL,
    download_expires_at = NULL,
    updated_at = NOW()
  WHERE download_expires_at < NOW()
    AND download_url IS NOT NULL;

  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at triggers
CREATE TRIGGER handle_updated_at_data_export_requests
  BEFORE UPDATE ON public.data_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_billing();

-- Add audit logging trigger for data export requests
CREATE OR REPLACE FUNCTION public.audit_data_export_changes()
RETURNS TRIGGER AS $
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values
    ) VALUES (
      NEW.user_id,
      'data_export_status_changed',
      'data_export_request',
      NEW.id::TEXT,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_data_export_requests
  AFTER UPDATE ON public.data_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_data_export_changes();

-- Function to handle complete account deletion
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  deleted_records JSONB,
  error_message TEXT
) AS $
DECLARE
  deleted_counts JSONB := '{}'::jsonb;
  stripe_customer_id_val TEXT;
  active_subscription_id TEXT;
BEGIN
  -- Only service role can execute this function
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can delete user accounts';
  END IF;

  -- Get Stripe customer ID and active subscription for cleanup
  SELECT stripe_customer_id INTO stripe_customer_id_val
  FROM public.profiles
  WHERE id = target_user_id;

  SELECT stripe_subscription_id INTO active_subscription_id
  FROM public.user_subscriptions
  WHERE user_id = target_user_id AND status = 'active'
  LIMIT 1;

  -- Log the deletion request
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    new_values
  ) VALUES (
    target_user_id,
    'account_deletion_started',
    'user_account',
    target_user_id::TEXT,
    jsonb_build_object(
      'stripe_customer_id', stripe_customer_id_val,
      'active_subscription_id', active_subscription_id,
      'deletion_timestamp', NOW()
    )
  );

  -- Delete data export requests
  WITH deleted_exports AS (
    DELETE FROM public.data_export_requests
    WHERE user_id = target_user_id
    RETURNING id
  )
  SELECT jsonb_set(
    deleted_counts,
    '{data_export_requests}',
    to_jsonb(count(*))
  ) INTO deleted_counts
  FROM deleted_exports;

  -- Delete conversions
  WITH deleted_conversions AS (
    DELETE FROM public.conversions
    WHERE user_id = target_user_id
    RETURNING id
  )
  SELECT jsonb_set(
    deleted_counts,
    '{conversions}',
    to_jsonb(count(*))
  ) INTO deleted_counts
  FROM deleted_conversions;

  -- Delete usage records
  WITH deleted_usage AS (
    DELETE FROM public.usage_records
    WHERE user_id = target_user_id
    RETURNING id
  )
  SELECT jsonb_set(
    deleted_counts,
    '{usage_records}',
    to_jsonb(count(*))
  ) INTO deleted_counts
  FROM deleted_usage;

  -- Delete user subscriptions
  WITH deleted_subscriptions AS (
    DELETE FROM public.user_subscriptions
    WHERE user_id = target_user_id
    RETURNING id
  )
  SELECT jsonb_set(
    deleted_counts,
    '{user_subscriptions}',
    to_jsonb(count(*))
  ) INTO deleted_counts
  FROM deleted_subscriptions;

  -- Delete audit logs for this user (except the deletion log)
  WITH deleted_audit_logs AS (
    DELETE FROM public.audit_logs
    WHERE user_id = target_user_id
      AND action != 'account_deletion_started'
    RETURNING id
  )
  SELECT jsonb_set(
    deleted_counts,
    '{audit_logs}',
    to_jsonb(count(*))
  ) INTO deleted_counts
  FROM deleted_audit_logs;

  -- Delete profile
  WITH deleted_profiles AS (
    DELETE FROM public.profiles
    WHERE id = target_user_id
    RETURNING id
  )
  SELECT jsonb_set(
    deleted_counts,
    '{profiles}',
    to_jsonb(count(*))
  ) INTO deleted_counts
  FROM deleted_profiles;

  -- Log successful deletion
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    new_values
  ) VALUES (
    target_user_id,
    'account_deletion_completed',
    'user_account',
    target_user_id::TEXT,
    jsonb_build_object(
      'deleted_records', deleted_counts,
      'stripe_customer_id', stripe_customer_id_val,
      'active_subscription_id', active_subscription_id,
      'completion_timestamp', NOW()
    )
  );

  RETURN QUERY SELECT 
    TRUE,
    deleted_counts,
    NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    new_values
  ) VALUES (
    target_user_id,
    'account_deletion_failed',
    'user_account',
    target_user_id::TEXT,
    jsonb_build_object(
      'error_message', SQLERRM,
      'error_timestamp', NOW()
    )
  );

  RETURN QUERY SELECT 
    FALSE,
    '{}'::jsonb,
    SQLERRM;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's Stripe information for cleanup
CREATE OR REPLACE FUNCTION public.get_user_stripe_info(target_user_id UUID)
RETURNS TABLE(
  stripe_customer_id TEXT,
  active_subscriptions JSONB
) AS $
BEGIN
  -- Only service role can execute this function
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can access Stripe info';
  END IF;

  RETURN QUERY
  SELECT 
    p.stripe_customer_id,
    jsonb_agg(
      jsonb_build_object(
        'subscription_id', us.stripe_subscription_id,
        'plan_id', us.plan_id,
        'status', us.status,
        'current_period_end', us.current_period_end
      )
    ) FILTER (WHERE us.stripe_subscription_id IS NOT NULL)
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON us.user_id = p.id
  WHERE p.id = target_user_id
  GROUP BY p.stripe_customer_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark account for deletion (soft delete with grace period)
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS TABLE(
  request_id UUID,
  sla_deadline TIMESTAMPTZ,
  grace_period_end TIMESTAMPTZ
) AS $
DECLARE
  new_request_id UUID;
  deadline TIMESTAMPTZ;
  grace_end TIMESTAMPTZ;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check for existing pending deletion requests
  IF EXISTS (
    SELECT 1 FROM public.data_export_requests 
    WHERE user_id = auth.uid() 
      AND request_type = 'deletion' 
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'An account deletion request is already in progress';
  END IF;

  -- Calculate deadlines
  deadline := NOW() + INTERVAL '30 days'; -- SLA deadline
  grace_end := NOW() + INTERVAL '7 days'; -- Grace period for cancellation

  -- Create deletion request
  INSERT INTO public.data_export_requests (
    user_id,
    request_type,
    sla_deadline
  ) VALUES (
    auth.uid(),
    'deletion',
    deadline
  ) RETURNING id INTO new_request_id;

  -- Log the request
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    new_values
  ) VALUES (
    auth.uid(),
    'account_deletion_requested',
    'data_export_request',
    new_request_id::TEXT,
    jsonb_build_object(
      'sla_deadline', deadline,
      'grace_period_end', grace_end
    )
  );

  RETURN QUERY SELECT 
    new_request_id,
    deadline,
    grace_end;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel account deletion request (during grace period)
CREATE OR REPLACE FUNCTION public.cancel_account_deletion(request_id UUID)
RETURNS BOOLEAN AS $
DECLARE
  request_record public.data_export_requests%ROWTYPE;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get the deletion request
  SELECT * INTO request_record
  FROM public.data_export_requests
  WHERE id = request_id
    AND user_id = auth.uid()
    AND request_type = 'deletion';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion request not found';
  END IF;

  -- Check if request can be cancelled
  IF request_record.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Cannot cancel deletion request with status: %', request_record.status;
  END IF;

  -- Check grace period (7 days from creation)
  IF request_record.created_at + INTERVAL '7 days' < NOW() THEN
    RAISE EXCEPTION 'Grace period for cancellation has expired';
  END IF;

  -- Update request status to cancelled
  UPDATE public.data_export_requests
  SET 
    status = 'failed',
    error_message = 'Cancelled by user',
    processing_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = request_id;

  -- Log the cancellation
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    new_values
  ) VALUES (
    auth.uid(),
    'account_deletion_cancelled',
    'data_export_request',
    request_id::TEXT,
    jsonb_build_object(
      'cancelled_at', NOW(),
      'reason', 'user_requested'
    )
  );

  RETURN TRUE;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending deletion requests (for processing)
CREATE OR REPLACE FUNCTION public.get_pending_deletion_requests()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  grace_period_expired BOOLEAN
) AS $
BEGIN
  -- Only service role can access pending deletion requests
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can access pending deletion requests';
  END IF;

  RETURN QUERY
  SELECT 
    der.id,
    der.user_id,
    der.created_at,
    der.sla_deadline,
    (der.created_at + INTERVAL '7 days' < NOW()) as grace_period_expired
  FROM public.data_export_requests der
  WHERE der.request_type = 'deletion'
    AND der.status = 'pending'
    AND der.created_at + INTERVAL '7 days' < NOW() -- Grace period expired
  ORDER BY der.created_at ASC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;