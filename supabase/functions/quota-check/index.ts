import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QuotaCheckRequest {
  user_id: string;
  action_type: 'storage' | 'conversion' | 'api_call';
  file_size?: number;
}

interface PlanLimits {
  storage: number;
  conversions: number;
  apiCalls: number;
  maxFileSize: number;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    storage: 52428800, // 50MB
    conversions: 500,
    apiCalls: 5000,
    maxFileSize: 26214400 // 25MB
  },
  pro: {
    storage: 2147483648, // 2GB
    conversions: 5000,
    apiCalls: 50000,
    maxFileSize: 104857600 // 100MB
  },
  agency: {
    storage: 21474836480, // 20GB
    conversions: 50000,
    apiCalls: 500000,
    maxFileSize: 262144000 // 250MB
  }
};

serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { user_id, action_type, file_size }: QuotaCheckRequest = await req.json()

    // Validate required fields
    if (!user_id || !action_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, action_type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Ensure response within 10 second limit (Supabase free tier constraint)
    if (Date.now() - startTime > 9000) {
      throw new Error('Function timeout approaching')
    }

    // Get user's current plan
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_plan')
      .eq('id', user_id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const userPlan = profile.subscription_plan || 'free'
    const planLimits = PLAN_LIMITS[userPlan]

    // Get current month for usage tracking
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Check quotas based on action type
    let quotaCheck;
    switch (action_type) {
      case 'storage':
        quotaCheck = await checkStorageQuota(supabase, user_id, planLimits, file_size)
        break
      case 'conversion':
        quotaCheck = await checkConversionQuota(supabase, user_id, currentMonth, planLimits)
        break
      case 'api_call':
        quotaCheck = await checkAndIncrementApiCalls(supabase, user_id, currentMonth, planLimits)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action_type' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

    if (!quotaCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Quota exceeded',
          quota_type: action_type,
          current_usage: quotaCheck.current_usage,
          limit: quotaCheck.limit,
          plan: userPlan
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        allowed: true,
        current_usage: quotaCheck.current_usage,
        limit: quotaCheck.limit,
        plan: userPlan
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Quota check error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function checkStorageQuota(supabase: any, user_id: string, planLimits: PlanLimits, file_size?: number) {
  // Get current storage usage
  const { data: files, error } = await supabase
    .from('user_files')
    .select('file_size')
    .eq('user_id', user_id)

  if (error) {
    throw new Error(`Failed to fetch user files: ${error.message}`)
  }

  const currentUsage = files.reduce((total: number, file: any) => total + (file.file_size || 0), 0)
  const newUsage = currentUsage + (file_size || 0)

  return {
    allowed: newUsage <= planLimits.storage,
    current_usage: currentUsage,
    limit: planLimits.storage
  }
}

async function checkConversionQuota(supabase: any, user_id: string, currentMonth: string, planLimits: PlanLimits) {
  // Get current month's conversion count
  const { data: usage, error } = await supabase
    .from('monthly_usage')
    .select('conversions_count')
    .eq('user_id', user_id)
    .eq('month_year', currentMonth)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to fetch usage data: ${error.message}`)
  }

  const currentUsage = usage?.conversions_count || 0

  return {
    allowed: currentUsage < planLimits.conversions,
    current_usage: currentUsage,
    limit: planLimits.conversions
  }
}

async function checkAndIncrementApiCalls(supabase: any, user_id: string, currentMonth: string, planLimits: PlanLimits) {
  // Upsert and increment API calls counter
  const { data: usage, error } = await supabase
    .from('monthly_usage')
    .upsert({
      user_id,
      month_year: currentMonth,
      api_calls: 1
    }, {
      onConflict: 'user_id,month_year',
      ignoreDuplicates: false
    })
    .select('api_calls')
    .single()

  if (error) {
    throw new Error(`Failed to update API calls: ${error.message}`)
  }

  const currentUsage = usage.api_calls

  return {
    allowed: currentUsage <= planLimits.apiCalls,
    current_usage: currentUsage,
    limit: planLimits.apiCalls
  }
}