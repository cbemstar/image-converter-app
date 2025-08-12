/**
 * Monthly Usage Reset Scheduled Function
 * Automatically resets usage counters at the beginning of each month
 * This function should be called via cron job or scheduled task
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders, createErrorResponse, createSuccessResponse, handleOptions, validateMethod, logExecution } from '../_shared/auth-utils.ts'

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

    // Validate method
    validateMethod(req, ['POST'])

    // Verify this is a scheduled call (check for cron header or service role)
    const cronHeader = req.headers.get('X-Cron-Signature')
    const authHeader = req.headers.get('Authorization')
    
    if (!cronHeader && (!authHeader || !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!))) {
      return createErrorResponse('Unauthorized: This function can only be called by scheduled tasks or service role', 401)
    }

    console.log('Starting monthly usage reset...')

    const supabase = createServiceClient()

    // Call the database function to reset usage
    const { data, error } = await supabase.rpc('reset_monthly_usage')

    if (error) {
      console.error('Error resetting monthly usage:', error)
      logExecution('monthly-reset', startTime, false, error.message)
      return createErrorResponse('Failed to reset monthly usage: ' + error.message, 500)
    }

    const result = data[0]
    
    console.log(`Monthly usage reset completed: ${result.users_reset} users reset, ${result.errors_count} errors`)

    // Log the reset operation
    await supabase
      .from('webhook_events')
      .insert({
        stripe_event_id: `monthly_reset_${Date.now()}`,
        event_type: 'monthly_usage_reset',
        processed: true,
        payload: {
          users_reset: result.users_reset,
          errors_count: result.errors_count,
          reset_date: new Date().toISOString()
        }
      })

    logExecution('monthly-reset', startTime, true)

    return createSuccessResponse({
      message: 'Monthly usage reset completed successfully',
      users_reset: result.users_reset,
      errors_count: result.errors_count,
      reset_date: new Date().toISOString()
    }, Date.now() - startTime)

  } catch (error) {
    console.error('Monthly reset error:', error)
    logExecution('monthly-reset', startTime, false, error.message)
    
    return createErrorResponse('Internal server error: ' + error.message, 500)
  }
})

console.log('Monthly reset scheduled function loaded')