/**
 * Security Cleanup Edge Function
 * Periodically cleans up old rate limiting records and expired suspensions
 * Requirements: 10.1, 10.2, 10.3
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders, createErrorResponse, createSuccessResponse, handleOptions, validateMethod } from '../_shared/auth-utils.ts'
import { cleanupOldRecords } from '../_shared/rate-limiter.ts'

const serviceSupabase = createServiceClient()

/**
 * Main handler function
 */
serve(async (req: Request) => {
  const startTime = Date.now()
  
  try {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return handleOptions()
    }

    // Only allow POST requests
    validateMethod(req, ['POST'])

    // Authenticate service role (this should be called by cron or admin only)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
      return createErrorResponse('Service role access required', 403)
    }

    console.log('Starting security cleanup...')

    // Clean up old rate limit records
    await cleanupOldRecords()

    // Clean up expired suspensions
    const expiredSuspensionsResult = await cleanupExpiredSuspensions()

    // Clean up old suspicious activities (keep for 90 days)
    const oldActivitiesResult = await cleanupOldSuspiciousActivities()

    // Clean up old admin actions (keep for 1 year)
    const oldAdminActionsResult = await cleanupOldAdminActions()

    const processingTime = Date.now() - startTime

    const result = {
      message: 'Security cleanup completed',
      expired_suspensions_cleaned: expiredSuspensionsResult.count,
      old_activities_cleaned: oldActivitiesResult.count,
      old_admin_actions_cleaned: oldAdminActionsResult.count,
      processing_time_ms: processingTime
    }

    console.log('Security cleanup completed:', result)

    return createSuccessResponse(result, processingTime)

  } catch (error) {
    console.error('Security cleanup error:', error)
    const processingTime = Date.now() - startTime
    return createErrorResponse('Cleanup failed: ' + error.message, 500)
  }
})

/**
 * Clean up expired account suspensions
 */
async function cleanupExpiredSuspensions(): Promise<{ count: number }> {
  try {
    const { error } = await serviceSupabase
      .from('account_suspensions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())

    if (error) {
      console.error('Error cleaning up expired suspensions:', error)
      return { count: 0 }
    }

    // Get count of updated records
    const { data: expiredSuspensions, error: countError } = await serviceSupabase
      .from('account_suspensions')
      .select('id')
      .eq('is_active', false)
      .lt('expires_at', new Date().toISOString())
      .gte('updated_at', new Date(Date.now() - 60000).toISOString()) // Updated in last minute

    if (countError) {
      console.error('Error counting expired suspensions:', countError)
      return { count: 0 }
    }

    const count = expiredSuspensions?.length || 0
    console.log(`Cleaned up ${count} expired suspensions`)

    return { count }

  } catch (error) {
    console.error('Error in cleanupExpiredSuspensions:', error)
    return { count: 0 }
  }
}

/**
 * Clean up old suspicious activities (older than 90 days)
 */
async function cleanupOldSuspiciousActivities(): Promise<{ count: number }> {
  try {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago

    const { data: oldActivities, error: selectError } = await serviceSupabase
      .from('suspicious_activities')
      .select('id')
      .lt('created_at', cutoffDate.toISOString())

    if (selectError) {
      console.error('Error selecting old suspicious activities:', selectError)
      return { count: 0 }
    }

    const count = oldActivities?.length || 0

    if (count > 0) {
      const { error: deleteError } = await serviceSupabase
        .from('suspicious_activities')
        .delete()
        .lt('created_at', cutoffDate.toISOString())

      if (deleteError) {
        console.error('Error deleting old suspicious activities:', deleteError)
        return { count: 0 }
      }

      console.log(`Cleaned up ${count} old suspicious activities`)
    }

    return { count }

  } catch (error) {
    console.error('Error in cleanupOldSuspiciousActivities:', error)
    return { count: 0 }
  }
}

/**
 * Clean up old admin actions (older than 1 year)
 */
async function cleanupOldAdminActions(): Promise<{ count: number }> {
  try {
    const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago

    const { data: oldActions, error: selectError } = await serviceSupabase
      .from('admin_actions')
      .select('id')
      .lt('created_at', cutoffDate.toISOString())

    if (selectError) {
      console.error('Error selecting old admin actions:', selectError)
      return { count: 0 }
    }

    const count = oldActions?.length || 0

    if (count > 0) {
      const { error: deleteError } = await serviceSupabase
        .from('admin_actions')
        .delete()
        .lt('created_at', cutoffDate.toISOString())

      if (deleteError) {
        console.error('Error deleting old admin actions:', deleteError)
        return { count: 0 }
      }

      console.log(`Cleaned up ${count} old admin actions`)
    }

    return { count }

  } catch (error) {
    console.error('Error in cleanupOldAdminActions:', error)
    return { count: 0 }
  }
}

console.log('Security cleanup Edge Function loaded')