/**
 * Usage Management Utilities Edge Function
 * Implements monthly quota reset, usage analytics, and limit enforcement
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface UsageManagementRequest {
  action: 'reset_monthly_usage' | 'get_usage_analytics' | 'enforce_limits' | 'get_period_info' | 'cleanup_old_data'
  user_id?: string
  start_date?: string
  end_date?: string
  cleanup_days?: number
}

interface UsageManagementResponse {
  success: boolean
  data?: any
  error?: string
  processing_time?: number
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

    // Parse request body
    const body: UsageManagementRequest = await req.json()
    const { action } = body

    // Validate required fields
    if (!action) {
      return createErrorResponse('Missing required field: action', 400, corsHeaders)
    }

    let result: UsageManagementResponse

    switch (action) {
      case 'reset_monthly_usage':
        result = await resetMonthlyUsage()
        break

      case 'get_usage_analytics':
        result = await getUsageAnalytics(body.start_date, body.end_date)
        break

      case 'enforce_limits':
        result = await enforceLimits(body.user_id)
        break

      case 'get_period_info':
        result = await getPeriodInfo(body.user_id)
        break

      case 'cleanup_old_data':
        result = await cleanupOldData(body.cleanup_days || 90)
        break

      default:
        return createErrorResponse('Invalid action type', 400, corsHeaders)
    }

    const processingTime = Date.now() - startTime

    return new Response(
      JSON.stringify({
        ...result,
        processing_time: processingTime
      }),
      {
        status: result.success ? 200 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString()
        }
      }
    )

  } catch (error) {
    console.error('Usage management error:', error)
    
    const processingTime = Date.now() - startTime
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        processing_time: processingTime
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
 * Reset monthly usage for all users
 */
async function resetMonthlyUsage(): Promise<UsageManagementResponse> {
  try {
    console.log('Starting monthly usage reset...')
    
    // Use the database function to reset usage
    const { data, error } = await supabase.rpc('reset_monthly_usage')

    if (error) {
      console.error('Error resetting monthly usage:', error)
      return {
        success: false,
        error: 'Failed to reset monthly usage: ' + error.message
      }
    }

    const result = data[0]
    
    console.log(`Monthly usage reset completed: ${result.users_reset} users reset, ${result.errors_count} errors`)

    return {
      success: true,
      data: {
        users_reset: result.users_reset,
        errors_count: result.errors_count,
        reset_date: new Date().toISOString()
      }
    }

  } catch (error) {
    console.error('Error in resetMonthlyUsage:', error)
    return {
      success: false,
      error: 'Failed to reset monthly usage'
    }
  }
}

/**
 * Get usage analytics and reporting data
 */
async function getUsageAnalytics(startDate?: string, endDate?: string): Promise<UsageManagementResponse> {
  try {
    const start = startDate ? new Date(startDate).toISOString().split('T')[0] : 
                  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const end = endDate ? new Date(endDate).toISOString().split('T')[0] : 
                new Date().toISOString().split('T')[0]

    // Get usage statistics using the database function
    const { data: stats, error: statsError } = await supabase
      .rpc('get_usage_statistics', { 
        start_date: start, 
        end_date: end 
      })

    if (statsError) {
      console.error('Error getting usage statistics:', statsError)
      return {
        success: false,
        error: 'Failed to get usage statistics: ' + statsError.message
      }
    }

    // Get plan distribution
    const { data: planDistribution, error: planError } = await supabase
      .from('user_subscriptions')
      .select('plan_id, plans!inner(name)')
      .eq('status', 'active')

    if (planError) {
      console.error('Error getting plan distribution:', planError)
    }

    // Calculate plan distribution
    const planCounts = planDistribution?.reduce((acc: Record<string, number>, sub: any) => {
      const planName = sub.plans.name
      acc[planName] = (acc[planName] || 0) + 1
      return acc
    }, {}) || {}

    // Get top users by usage
    const { data: topUsers, error: topUsersError } = await supabase
      .from('usage_records')
      .select(`
        user_id,
        conversions_used,
        profiles!inner(email)
      `)
      .gte('period_start', start)
      .lte('period_end', end)
      .order('conversions_used', { ascending: false })
      .limit(10)

    if (topUsersError) {
      console.error('Error getting top users:', topUsersError)
    }

    const statisticsData = stats[0] || {
      total_conversions: 0,
      unique_users: 0,
      avg_conversions_per_user: 0,
      top_formats: {}
    }

    return {
      success: true,
      data: {
        period: { start_date: start, end_date: end },
        overview: {
          total_conversions: statisticsData.total_conversions,
          unique_users: statisticsData.unique_users,
          avg_conversions_per_user: statisticsData.avg_conversions_per_user
        },
        format_breakdown: statisticsData.top_formats,
        plan_distribution: planCounts,
        top_users: topUsers?.map((user: any) => ({
          email: user.profiles.email,
          conversions_used: user.conversions_used
        })) || []
      }
    }

  } catch (error) {
    console.error('Error in getUsageAnalytics:', error)
    return {
      success: false,
      error: 'Failed to get usage analytics'
    }
  }
}

/**
 * Enforce usage limits and identify violations
 */
async function enforceLimits(userId?: string): Promise<UsageManagementResponse> {
  try {
    let query = supabase
      .from('usage_records')
      .select(`
        user_id,
        conversions_used,
        conversions_limit,
        period_start,
        period_end,
        profiles!inner(email),
        user_subscriptions!inner(plan_id, status)
      `)
      .eq('period_start', getCurrentPeriodStart())

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: usageRecords, error } = await query

    if (error) {
      console.error('Error getting usage records for limit enforcement:', error)
      return {
        success: false,
        error: 'Failed to get usage records: ' + error.message
      }
    }

    const violations: any[] = []
    const warnings: any[] = []

    for (const record of usageRecords || []) {
      const usagePercentage = record.conversions_limit === -1 ? 0 : 
                             (record.conversions_used / record.conversions_limit) * 100

      if (record.conversions_limit !== -1 && record.conversions_used >= record.conversions_limit) {
        violations.push({
          user_id: record.user_id,
          email: record.profiles.email,
          plan_id: record.user_subscriptions.plan_id,
          conversions_used: record.conversions_used,
          conversions_limit: record.conversions_limit,
          overage: record.conversions_used - record.conversions_limit
        })
      } else if (usagePercentage >= 80) {
        warnings.push({
          user_id: record.user_id,
          email: record.profiles.email,
          plan_id: record.user_subscriptions.plan_id,
          conversions_used: record.conversions_used,
          conversions_limit: record.conversions_limit,
          usage_percentage: Math.round(usagePercentage)
        })
      }
    }

    return {
      success: true,
      data: {
        violations_count: violations.length,
        warnings_count: warnings.length,
        violations,
        warnings,
        checked_users: usageRecords?.length || 0
      }
    }

  } catch (error) {
    console.error('Error in enforceLimits:', error)
    return {
      success: false,
      error: 'Failed to enforce limits'
    }
  }
}

/**
 * Get usage period information
 */
async function getPeriodInfo(userId?: string): Promise<UsageManagementResponse> {
  try {
    const currentPeriodStart = getCurrentPeriodStart()
    const currentPeriodEnd = getCurrentPeriodEnd()
    const nextPeriodStart = getNextPeriodStart()
    
    const daysUntilReset = Math.ceil((new Date(nextPeriodStart).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    let userSpecificData = null
    if (userId) {
      const { data: userUsage, error: userError } = await supabase
        .rpc('get_user_usage_info', { user_id: userId })

      if (userError) {
        console.error('Error getting user usage info:', userError)
      } else if (userUsage && userUsage.length > 0) {
        const usage = userUsage[0]
        userSpecificData = {
          plan_name: usage.plan_name,
          conversions_used: usage.conversions_used,
          conversions_limit: usage.conversions_limit,
          can_convert: usage.can_convert,
          usage_percentage: usage.conversions_limit === -1 ? 0 : 
                           Math.round((usage.conversions_used / usage.conversions_limit) * 100)
        }
      }
    }

    return {
      success: true,
      data: {
        current_period: {
          start: currentPeriodStart,
          end: currentPeriodEnd,
          days_until_reset: daysUntilReset
        },
        next_period: {
          start: nextPeriodStart,
          end: getNextPeriodEnd()
        },
        user_data: userSpecificData
      }
    }

  } catch (error) {
    console.error('Error in getPeriodInfo:', error)
    return {
      success: false,
      error: 'Failed to get period info'
    }
  }
}

/**
 * Cleanup old data (conversions, usage records)
 */
async function cleanupOldData(cleanupDays: number): Promise<UsageManagementResponse> {
  try {
    const cutoffDate = new Date(Date.now() - cleanupDays * 24 * 60 * 60 * 1000).toISOString()
    
    // Clean up old conversion records
    const { data: deletedConversions, error: conversionsError } = await supabase
      .from('conversions')
      .delete()
      .lt('created_at', cutoffDate)
      .select('id')

    if (conversionsError) {
      console.error('Error cleaning up conversions:', conversionsError)
    }

    // Clean up old usage records (keep at least 12 months)
    const usageCutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const { data: deletedUsageRecords, error: usageError } = await supabase
      .from('usage_records')
      .delete()
      .lt('period_start', usageCutoffDate)
      .select('id')

    if (usageError) {
      console.error('Error cleaning up usage records:', usageError)
    }

    // Clean up old webhook events
    const { data: deletedWebhooks, error: webhookError } = await supabase
      .from('webhook_events')
      .delete()
      .lt('created_at', cutoffDate)
      .eq('processed', true)
      .select('id')

    if (webhookError) {
      console.error('Error cleaning up webhook events:', webhookError)
    }

    return {
      success: true,
      data: {
        cleanup_date: cutoffDate,
        deleted_conversions: deletedConversions?.length || 0,
        deleted_usage_records: deletedUsageRecords?.length || 0,
        deleted_webhook_events: deletedWebhooks?.length || 0,
        total_deleted: (deletedConversions?.length || 0) + 
                      (deletedUsageRecords?.length || 0) + 
                      (deletedWebhooks?.length || 0)
      }
    }

  } catch (error) {
    console.error('Error in cleanupOldData:', error)
    return {
      success: false,
      error: 'Failed to cleanup old data'
    }
  }
}

/**
 * Helper functions for date calculations
 */
function getCurrentPeriodStart(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
}

function getCurrentPeriodEnd(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
}

function getNextPeriodStart(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]
}

function getNextPeriodEnd(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0]
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

console.log('Usage management utilities Edge Function loaded')