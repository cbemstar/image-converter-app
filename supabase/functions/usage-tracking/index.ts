/**
 * Usage Tracking Edge Function
 * Implements server-side conversion metering with service-role writes only
 * Requirements: 2.1, 2.2, 2.4, 2.5, 10.1, 10.2, 10.3
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { checkRateLimits, getClientIP } from '../_shared/rate-limiter.ts'
import { validateString, validateUUID, validateJSON } from '../_shared/input-validator.ts'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface UsageTrackingRequest {
  action: 'check_quota' | 'increment_usage' | 'get_usage'
  user_id?: string
  conversion_details?: {
    original_filename: string
    original_format: string
    target_format: string
    file_size_bytes: number
    processing_time_ms?: number
    storage_path?: string
  }
}

interface UsageResponse {
  success: boolean
  data?: any
  error?: string
  remaining_quota?: number
  can_convert?: boolean
}

/**
 * Main handler function
 */
serve(async (req: Request) => {
  const startTime = Date.now()
  
  try {
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders })
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405, corsHeaders)
    }

    // Get client IP for rate limiting
    const clientIP = getClientIP(req)

    // Parse and validate request body
    const body: UsageTrackingRequest = await req.json()
    const { action, user_id, conversion_details } = body

    // Validate input
    if (user_id) {
      const userIdValidation = validateUUID(user_id, 'user_id', false)
      if (!userIdValidation.valid) {
        return createErrorResponse(`Invalid user_id: ${userIdValidation.errors.join(', ')}`, 400, corsHeaders)
      }
    }

    const actionValidation = validateString(action, 'action', { required: true })
    if (!actionValidation.valid) {
      return createErrorResponse(`Invalid action: ${actionValidation.errors.join(', ')}`, 400, corsHeaders)
    }

    // Check rate limits for usage tracking requests
    const rateLimitResult = await checkRateLimits(user_id, clientIP, 'usage_tracking')
    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.backoffSeconds || 60
      return new Response(
        JSON.stringify({
          success: false,
          error: rateLimitResult.reason || 'Rate limit exceeded',
          retry_after: retryAfter
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': (rateLimitResult.remaining || 0).toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime?.toISOString() || ''
          }
        }
      )
    }

    // Validate required fields
    if (!action) {
      return createErrorResponse('Missing required field: action', 400, corsHeaders)
    }

    let result: UsageResponse

    switch (action) {
      case 'check_quota':
        if (!user_id) {
          return createErrorResponse('Missing required field: user_id for check_quota', 400, corsHeaders)
        }
        result = await checkUserQuota(user_id)
        break

      case 'increment_usage':
        if (!user_id || !conversion_details) {
          return createErrorResponse('Missing required fields: user_id, conversion_details for increment_usage', 400, corsHeaders)
        }
        result = await incrementUsageCounter(user_id, conversion_details)
        break

      case 'get_usage':
        if (!user_id) {
          return createErrorResponse('Missing required field: user_id for get_usage', 400, corsHeaders)
        }
        result = await getUserUsage(user_id)
        break

      default:
        return createErrorResponse('Invalid action type', 400, corsHeaders)
    }

    const processingTime = Date.now() - startTime

    return new Response(
      JSON.stringify({
        ...result,
        processing_time_ms: processingTime
      }),
      {
        status: result.success ? 200 : (result.error?.includes('Quota exceeded') ? 429 : 400),
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString()
        }
      }
    )

  } catch (error) {
    console.error('Usage tracking error:', error)
    
    const processingTime = Date.now() - startTime
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        processing_time_ms: processingTime
      }),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString()
        }
      }
    )
  }
})

/**
 * Check user's current quota status
 */
async function checkUserQuota(userId: string): Promise<UsageResponse> {
  try {
    // Use the database function to get user usage info
    const { data, error } = await supabase
      .rpc('get_user_usage_info', { user_id: userId })

    if (error) {
      console.error('Error checking user quota:', error)
      return {
        success: false,
        error: 'Failed to check quota: ' + error.message
      }
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'User usage record not found'
      }
    }

    const usageInfo = data[0]
    const remainingQuota = usageInfo.conversions_limit === -1 
      ? -1 // Unlimited
      : usageInfo.conversions_limit - usageInfo.conversions_used

    return {
      success: true,
      data: {
        plan_name: usageInfo.plan_name,
        conversions_used: usageInfo.conversions_used,
        conversions_limit: usageInfo.conversions_limit,
        period_start: usageInfo.period_start,
        period_end: usageInfo.period_end,
        can_convert: usageInfo.can_convert
      },
      remaining_quota: remainingQuota,
      can_convert: usageInfo.can_convert
    }

  } catch (error) {
    console.error('Error in checkUserQuota:', error)
    return {
      success: false,
      error: 'Failed to check quota'
    }
  }
}

/**
 * Increment usage counter atomically and record conversion
 */
async function incrementUsageCounter(
  userId: string, 
  conversionDetails: NonNullable<UsageTrackingRequest['conversion_details']>
): Promise<UsageResponse> {
  try {
    // Start a transaction to ensure atomicity
    const { data: incrementResult, error: incrementError } = await supabase
      .rpc('increment_usage_counter', { 
        user_id: userId,
        conversion_details: conversionDetails
      })

    if (incrementError) {
      console.error('Error incrementing usage counter:', incrementError)
      return {
        success: false,
        error: 'Failed to increment usage: ' + incrementError.message
      }
    }

    if (!incrementResult || incrementResult.length === 0) {
      return {
        success: false,
        error: 'No result from usage increment'
      }
    }

    const result = incrementResult[0]

    if (!result.success) {
      return {
        success: false,
        error: result.error_message,
        remaining_quota: result.remaining_quota
      }
    }

    // Record the conversion details
    const { error: conversionError } = await supabase
      .from('conversions')
      .insert({
        user_id: userId,
        original_filename: conversionDetails.original_filename,
        original_format: conversionDetails.original_format,
        target_format: conversionDetails.target_format,
        file_size_bytes: conversionDetails.file_size_bytes,
        processing_time_ms: conversionDetails.processing_time_ms,
        storage_path: conversionDetails.storage_path,
        billing_period_start: new Date().toISOString()
      })

    if (conversionError) {
      console.error('Error recording conversion:', conversionError)
      // Don't fail the request if conversion recording fails, but log it
      console.warn('Usage incremented but conversion recording failed')
    }

    return {
      success: true,
      data: {
        usage_incremented: true,
        conversion_recorded: !conversionError
      },
      remaining_quota: result.remaining_quota,
      can_convert: result.remaining_quota > 0 || result.remaining_quota === -1
    }

  } catch (error) {
    console.error('Error in incrementUsageCounter:', error)
    return {
      success: false,
      error: 'Failed to increment usage counter'
    }
  }
}

/**
 * Get user's current usage information
 */
async function getUserUsage(userId: string): Promise<UsageResponse> {
  try {
    // Get current period usage
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_user_usage_info', { user_id: userId })

    if (usageError) {
      console.error('Error getting user usage:', usageError)
      return {
        success: false,
        error: 'Failed to get usage: ' + usageError.message
      }
    }

    if (!usageData || usageData.length === 0) {
      return {
        success: false,
        error: 'User usage record not found'
      }
    }

    const usage = usageData[0]

    // Get recent conversions for history
    const { data: conversions, error: conversionsError } = await supabase
      .from('conversions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (conversionsError) {
      console.error('Error getting conversions:', conversionsError)
    }

    const remainingQuota = usage.conversions_limit === -1 
      ? -1 // Unlimited
      : usage.conversions_limit - usage.conversions_used

    return {
      success: true,
      data: {
        current_usage: {
          plan_name: usage.plan_name,
          conversions_used: usage.conversions_used,
          conversions_limit: usage.conversions_limit,
          period_start: usage.period_start,
          period_end: usage.period_end,
          can_convert: usage.can_convert
        },
        recent_conversions: conversions || [],
        remaining_quota: remainingQuota
      },
      remaining_quota: remainingQuota,
      can_convert: usage.can_convert
    }

  } catch (error) {
    console.error('Error in getUserUsage:', error)
    return {
      success: false,
      error: 'Failed to get user usage'
    }
  }
}

/**
 * Create standardized error response
 */
function createErrorResponse(message: string, status: number, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  )
}

console.log('Usage tracking Edge Function loaded')