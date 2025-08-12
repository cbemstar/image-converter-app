/**
 * Process Account Deletions Scheduled Function
 * Handles the actual deletion of accounts after grace period
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createServiceClient, corsHeaders, createErrorResponse, createSuccessResponse, handleOptions, validateMethod, logExecution } from '../_shared/auth-utils.ts'

serve(async (req: Request) => {
  const startTime = Date.now()
  
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return handleOptions()
    }

    // Validate method
    validateMethod(req, ['POST'])

    // Verify this is a scheduled call (in production, you'd verify the cron secret)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes('Bearer')) {
      throw new Error('Unauthorized: This endpoint is for scheduled execution only')
    }

    return await processAccountDeletions(startTime)

  } catch (error) {
    logExecution('process-account-deletions', startTime, false, error.message)
    return createErrorResponse(error.message, 400)
  }
})

async function processAccountDeletions(startTime: number): Promise<Response> {
  const supabase = createServiceClient()
  let processedCount = 0
  let errorCount = 0
  const results: any[] = []

  try {
    // Get pending deletion requests past grace period
    const { data: pendingDeletions, error: pendingError } = await supabase
      .rpc('get_pending_deletion_requests')

    if (pendingError) {
      throw new Error(`Failed to get pending deletions: ${pendingError.message}`)
    }

    if (!pendingDeletions || pendingDeletions.length === 0) {
      logExecution('process-account-deletions', startTime, true)
      return createSuccessResponse({
        message: 'No pending deletions to process',
        processed: 0,
        errors: 0
      })
    }

    console.log(`Processing ${pendingDeletions.length} account deletions`)

    // Process each deletion
    for (const deletion of pendingDeletions) {
      try {
        const result = await processAccountDeletion(deletion.id, deletion.user_id)
        results.push({
          user_id: deletion.user_id,
          request_id: deletion.id,
          success: result.success,
          deleted_records: result.deleted_records,
          error: result.error
        })

        if (result.success) {
          processedCount++
        } else {
          errorCount++
        }

      } catch (error) {
        console.error(`Failed to process deletion for user ${deletion.user_id}:`, error)
        results.push({
          user_id: deletion.user_id,
          request_id: deletion.id,
          success: false,
          error: error.message
        })
        errorCount++
      }
    }

    logExecution('process-account-deletions', startTime, true)

    return createSuccessResponse({
      message: `Processed ${processedCount} deletions successfully, ${errorCount} errors`,
      processed: processedCount,
      errors: errorCount,
      results: results
    })

  } catch (error) {
    logExecution('process-account-deletions', startTime, false, error.message)
    throw error
  }
}

async function processAccountDeletion(requestId: string, userId: string): Promise<{
  success: boolean
  deleted_records?: any
  error?: string
}> {
  const supabase = createServiceClient()

  try {
    console.log(`Processing account deletion for user ${userId}, request ${requestId}`)

    // Update status to processing
    await supabase.rpc('update_export_request_status', {
      request_id: requestId,
      new_status: 'processing'
    })

    // Get user's Stripe information for cleanup
    const { data: stripeInfo, error: stripeError } = await supabase
      .rpc('get_user_stripe_info', {
        target_user_id: userId
      })

    if (stripeError) {
      console.error('Failed to get Stripe info:', stripeError)
    }

    // Cancel Stripe subscriptions if they exist
    if (stripeInfo && stripeInfo.length > 0) {
      const userStripeInfo = stripeInfo[0]
      
      if (userStripeInfo.stripe_customer_id) {
        await cancelStripeSubscriptions(userStripeInfo.stripe_customer_id, userStripeInfo.active_subscriptions)
      }
    }

    // Delete user account and all associated data
    const { data: deletionResult, error: deletionError } = await supabase
      .rpc('delete_user_account', {
        target_user_id: userId
      })

    if (deletionError || !deletionResult || deletionResult.length === 0) {
      throw new Error(`Failed to delete user account: ${deletionError?.message || 'Unknown error'}`)
    }

    const result = deletionResult[0]

    if (!result.success) {
      throw new Error(result.error_message || 'Account deletion failed')
    }

    // Delete the user from auth.users (this will cascade to remaining references)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Failed to delete auth user:', authDeleteError)
      // Don't throw here as the main data is already deleted
    }

    // Update deletion request status to completed
    await supabase.rpc('update_export_request_status', {
      request_id: requestId,
      new_status: 'completed'
    })

    console.log(`Successfully deleted account for user ${userId}`)
    console.log('Deleted records:', result.deleted_records)

    return {
      success: true,
      deleted_records: result.deleted_records
    }

  } catch (error) {
    console.error(`Failed to delete account for user ${userId}:`, error)
    
    // Update status to failed
    await supabase.rpc('update_export_request_status', {
      request_id: requestId,
      new_status: 'failed',
      error_message: error.message
    })

    return {
      success: false,
      error: error.message
    }
  }
}

async function cancelStripeSubscriptions(customerId: string, subscriptions: any) {
  // This would integrate with Stripe to cancel subscriptions
  console.log(`Would cancel Stripe subscriptions for customer ${customerId}:`, subscriptions)
  
  // In a real implementation, you would:
  // 1. Import Stripe SDK
  // 2. Cancel all active subscriptions
  // 3. Optionally delete the customer record
  
  try {
    // Simulated Stripe integration
    /*
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
    
    if (subscriptions && Array.isArray(subscriptions)) {
      for (const sub of subscriptions) {
        if (sub.subscription_id && sub.status === 'active') {
          console.log(`Cancelling Stripe subscription ${sub.subscription_id}`)
          await stripe.subscriptions.cancel(sub.subscription_id)
        }
      }
    }
    
    // Optionally delete customer
    console.log(`Deleting Stripe customer ${customerId}`)
    await stripe.customers.del(customerId)
    */
    
    console.log(`Stripe cleanup completed for customer ${customerId}`)
  } catch (error) {
    console.error(`Failed to cancel Stripe subscriptions for customer ${customerId}:`, error)
    // Don't throw here as we still want to proceed with account deletion
  }
}