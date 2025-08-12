/**
 * Account Deletion Edge Function
 * Handles GDPR-compliant account deletion requests with Stripe cleanup
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createServiceClient, getUserFromRequest, corsHeaders, createErrorResponse, createSuccessResponse, handleOptions, validateMethod, logExecution } from '../_shared/auth-utils.ts'

interface DeletionRequest {
  confirm?: boolean
}

interface CancelDeletionRequest {
  request_id: string
}

serve(async (req: Request) => {
  const startTime = Date.now()
  
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return handleOptions()
    }

    // Validate method
    validateMethod(req, ['POST', 'DELETE', 'GET'])

    if (req.method === 'POST') {
      return await handleDeletionRequest(req, startTime)
    } else if (req.method === 'DELETE') {
      return await handleCancelDeletion(req, startTime)
    } else if (req.method === 'GET') {
      return await handleGetDeletionStatus(req, startTime)
    }

  } catch (error) {
    logExecution('account-deletion', startTime, false, error.message)
    return createErrorResponse(error.message, 400)
  }
})

async function handleDeletionRequest(req: Request, startTime: number): Promise<Response> {
  try {
    // Authenticate user
    const user = await getUserFromRequest(req)
    
    // Parse request body
    const body: DeletionRequest = await req.json().catch(() => ({}))

    if (!body.confirm) {
      throw new Error('Account deletion must be explicitly confirmed')
    }

    // Create service client
    const supabase = createServiceClient()

    // Check if user has verified email (requirement for account deletion)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email_verified, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('User profile not found')
    }

    if (!profile.email_verified) {
      throw new Error('Email verification required for account deletion')
    }

    // Create deletion request using the database function
    const { data: deletionRequest, error: deletionError } = await supabase
      .rpc('request_account_deletion')

    if (deletionError) {
      throw new Error(`Failed to create deletion request: ${deletionError.message}`)
    }

    if (!deletionRequest || deletionRequest.length === 0) {
      throw new Error('Failed to create deletion request')
    }

    const request = deletionRequest[0]

    logExecution('account-deletion', startTime, true)

    return createSuccessResponse({
      request_id: request.request_id,
      sla_deadline: request.sla_deadline,
      grace_period_end: request.grace_period_end,
      status: 'pending',
      message: 'Account deletion request created successfully. You have 7 days to cancel this request. After that, your account will be permanently deleted within 30 days.',
      cancellation_instructions: 'To cancel this deletion request, use the cancellation endpoint within 7 days.'
    })

  } catch (error) {
    logExecution('account-deletion', startTime, false, error.message)
    throw error
  }
}

async function handleCancelDeletion(req: Request, startTime: number): Promise<Response> {
  try {
    // Authenticate user
    const user = await getUserFromRequest(req)
    
    // Parse request body
    const body: CancelDeletionRequest = await req.json()

    if (!body.request_id) {
      throw new Error('Request ID is required')
    }

    // Create service client
    const supabase = createServiceClient()

    // Cancel deletion request using the database function
    const { data: cancelled, error: cancelError } = await supabase
      .rpc('cancel_account_deletion', {
        request_id: body.request_id
      })

    if (cancelError) {
      throw new Error(`Failed to cancel deletion request: ${cancelError.message}`)
    }

    if (!cancelled) {
      throw new Error('Failed to cancel deletion request')
    }

    logExecution('account-deletion', startTime, true)

    return createSuccessResponse({
      message: 'Account deletion request cancelled successfully.',
      status: 'cancelled'
    })

  } catch (error) {
    logExecution('account-deletion', startTime, false, error.message)
    throw error
  }
}

async function handleGetDeletionStatus(req: Request, startTime: number): Promise<Response> {
  try {
    // Authenticate user
    const user = await getUserFromRequest(req)
    
    // Create service client
    const supabase = createServiceClient()
    
    // Get deletion requests for the user
    const { data: requests, error } = await supabase
      .from('data_export_requests')
      .select(`
        id,
        request_type,
        status,
        error_message,
        processing_started_at,
        processing_completed_at,
        sla_deadline,
        created_at
      `)
      .eq('user_id', user.id)
      .eq('request_type', 'deletion')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch deletion requests: ${error.message}`)
    }

    // Calculate grace period status for pending requests
    const requestsWithGracePeriod = (requests || []).map(request => {
      const gracePeriodEnd = new Date(request.created_at)
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7)
      
      return {
        ...request,
        grace_period_end: gracePeriodEnd.toISOString(),
        can_cancel: request.status === 'pending' && new Date() < gracePeriodEnd
      }
    })

    logExecution('account-deletion', startTime, true)
    return createSuccessResponse({ 
      requests: requestsWithGracePeriod,
      has_pending_deletion: requestsWithGracePeriod.some(r => r.status === 'pending')
    })

  } catch (error) {
    logExecution('account-deletion', startTime, false, error.message)
    throw error
  }
}

// Background processing function for actual account deletion
// This would typically be called by a scheduled job
export async function processAccountDeletions() {
  try {
    const supabase = createServiceClient()

    // Get pending deletion requests past grace period
    const { data: pendingDeletions, error: pendingError } = await supabase
      .rpc('get_pending_deletion_requests')

    if (pendingError) {
      console.error('Failed to get pending deletions:', pendingError)
      return
    }

    if (!pendingDeletions || pendingDeletions.length === 0) {
      console.log('No pending deletions to process')
      return
    }

    console.log(`Processing ${pendingDeletions.length} account deletions`)

    for (const deletion of pendingDeletions) {
      try {
        await processAccountDeletion(deletion.id, deletion.user_id)
      } catch (error) {
        console.error(`Failed to process deletion for user ${deletion.user_id}:`, error)
      }
    }

  } catch (error) {
    console.error('Error in processAccountDeletions:', error)
  }
}

async function processAccountDeletion(requestId: string, userId: string) {
  const supabase = createServiceClient()

  try {
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

  } catch (error) {
    console.error(`Failed to delete account for user ${userId}:`, error)
    
    // Update status to failed
    await supabase.rpc('update_export_request_status', {
      request_id: requestId,
      new_status: 'failed',
      error_message: error.message
    })
  }
}

async function cancelStripeSubscriptions(customerId: string, subscriptions: any) {
  // This would integrate with Stripe to cancel subscriptions
  // For now, we'll just log the action
  console.log(`Would cancel Stripe subscriptions for customer ${customerId}:`, subscriptions)
  
  // In a real implementation, you would:
  // 1. Import Stripe SDK
  // 2. Cancel all active subscriptions
  // 3. Optionally delete the customer record
  
  /*
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  
  if (subscriptions && Array.isArray(subscriptions)) {
    for (const sub of subscriptions) {
      if (sub.subscription_id && sub.status === 'active') {
        await stripe.subscriptions.cancel(sub.subscription_id)
      }
    }
  }
  
  // Optionally delete customer
  await stripe.customers.del(customerId)
  */
}