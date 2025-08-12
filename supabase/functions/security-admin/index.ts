/**
 * Security Administration Edge Function
 * Provides manual account review and suspension tools for administrators
 * Requirements: 10.6
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders, createErrorResponse, createSuccessResponse, handleOptions, validateMethod } from '../_shared/auth-utils.ts'
import { suspendAccount, checkSuspensionStatus } from '../_shared/rate-limiter.ts'
import { validateString, validateNumber, validateUUID, validateJSON } from '../_shared/input-validator.ts'

const serviceSupabase = createServiceClient()

interface AdminAction {
  action: 'suspend_user' | 'suspend_ip' | 'unsuspend_user' | 'unsuspend_ip' | 'get_suspicious_activities' | 'review_activity' | 'get_rate_limit_stats'
  user_id?: string
  ip_address?: string
  reason?: string
  duration_hours?: number
  activity_id?: string
  reviewer_notes?: string
}

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

    // Authenticate admin user (service role required for admin functions)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
      return createErrorResponse('Admin access required', 403)
    }

    // Parse and validate request body
    const body = await req.json()
    const actionValidation = validateAdminAction(body)
    
    if (!actionValidation.valid) {
      return createErrorResponse(
        `Invalid request: ${actionValidation.errors.join(', ')}`,
        400
      )
    }

    const action = actionValidation.sanitized as AdminAction

    // Route to appropriate handler
    let result
    switch (action.action) {
      case 'suspend_user':
        result = await handleSuspendUser(action)
        break
      case 'suspend_ip':
        result = await handleSuspendIP(action)
        break
      case 'unsuspend_user':
        result = await handleUnsuspendUser(action)
        break
      case 'unsuspend_ip':
        result = await handleUnsuspendIP(action)
        break
      case 'get_suspicious_activities':
        result = await handleGetSuspiciousActivities()
        break
      case 'review_activity':
        result = await handleReviewActivity(action)
        break
      case 'get_rate_limit_stats':
        result = await handleGetRateLimitStats()
        break
      default:
        return createErrorResponse('Unknown action', 400)
    }

    const processingTime = Date.now() - startTime
    return createSuccessResponse(result, processingTime)

  } catch (error) {
    console.error('Security admin error:', error)
    const processingTime = Date.now() - startTime
    return createErrorResponse('Internal server error', 500)
  }
})

/**
 * Validate admin action request
 */
function validateAdminAction(body: any): { valid: boolean; errors: string[]; sanitized?: AdminAction } {
  const errors: string[] = []
  const sanitized: any = {}

  // Validate action
  const actionValidation = validateString(body.action, 'action', { required: true })
  if (!actionValidation.valid) {
    errors.push(...actionValidation.errors)
  } else {
    const allowedActions = [
      'suspend_user', 'suspend_ip', 'unsuspend_user', 'unsuspend_ip',
      'get_suspicious_activities', 'review_activity', 'get_rate_limit_stats'
    ]
    
    if (!allowedActions.includes(actionValidation.sanitized as string)) {
      errors.push('Invalid action')
    } else {
      sanitized.action = actionValidation.sanitized
    }
  }

  // Validate user_id if provided
  if (body.user_id !== undefined) {
    const userIdValidation = validateUUID(body.user_id, 'user_id', false)
    if (!userIdValidation.valid) {
      errors.push(...userIdValidation.errors)
    } else {
      sanitized.user_id = userIdValidation.sanitized
    }
  }

  // Validate ip_address if provided
  if (body.ip_address !== undefined) {
    const ipValidation = validateString(body.ip_address, 'ip_address', { maxLength: 45 })
    if (!ipValidation.valid) {
      errors.push(...ipValidation.errors)
    } else {
      sanitized.ip_address = ipValidation.sanitized
    }
  }

  // Validate reason if provided
  if (body.reason !== undefined) {
    const reasonValidation = validateString(body.reason, 'reason', { maxLength: 500 })
    if (!reasonValidation.valid) {
      errors.push(...reasonValidation.errors)
    } else {
      sanitized.reason = reasonValidation.sanitized
    }
  }

  // Validate duration_hours if provided
  if (body.duration_hours !== undefined) {
    const durationValidation = validateNumber(body.duration_hours, 'duration_hours', {
      min: 1,
      max: 8760, // 1 year max
      integer: true
    })
    if (!durationValidation.valid) {
      errors.push(...durationValidation.errors)
    } else {
      sanitized.duration_hours = durationValidation.sanitized
    }
  }

  // Validate activity_id if provided
  if (body.activity_id !== undefined) {
    const activityIdValidation = validateUUID(body.activity_id, 'activity_id', false)
    if (!activityIdValidation.valid) {
      errors.push(...activityIdValidation.errors)
    } else {
      sanitized.activity_id = activityIdValidation.sanitized
    }
  }

  // Validate reviewer_notes if provided
  if (body.reviewer_notes !== undefined) {
    const notesValidation = validateString(body.reviewer_notes, 'reviewer_notes', { maxLength: 1000 })
    if (!notesValidation.valid) {
      errors.push(...notesValidation.errors)
    } else {
      sanitized.reviewer_notes = notesValidation.sanitized
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  }
}

/**
 * Handle user suspension
 */
async function handleSuspendUser(action: AdminAction) {
  if (!action.user_id) {
    throw new Error('user_id is required for user suspension')
  }

  const reason = action.reason || 'Manual admin suspension'
  const durationHours = action.duration_hours || 24

  // Check if user exists
  const { data: user, error: userError } = await serviceSupabase.auth.admin.getUserById(action.user_id)
  if (userError || !user) {
    throw new Error('User not found')
  }

  // Check current suspension status
  const suspensionStatus = await checkSuspensionStatus(action.user_id)
  if (suspensionStatus.suspended) {
    return {
      message: 'User is already suspended',
      current_suspension: suspensionStatus
    }
  }

  // Suspend the user
  const success = await suspendAccount(action.user_id, undefined, reason, durationHours)
  if (!success) {
    throw new Error('Failed to suspend user')
  }

  // Log the admin action
  await logAdminAction('suspend_user', {
    target_user_id: action.user_id,
    reason,
    duration_hours: durationHours
  })

  return {
    message: 'User suspended successfully',
    user_id: action.user_id,
    reason,
    duration_hours: durationHours,
    expires_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
  }
}

/**
 * Handle IP suspension
 */
async function handleSuspendIP(action: AdminAction) {
  if (!action.ip_address) {
    throw new Error('ip_address is required for IP suspension')
  }

  const reason = action.reason || 'Manual admin IP suspension'
  const durationHours = action.duration_hours || 24

  // Check current suspension status
  const suspensionStatus = await checkSuspensionStatus(undefined, action.ip_address)
  if (suspensionStatus.suspended) {
    return {
      message: 'IP is already suspended',
      current_suspension: suspensionStatus
    }
  }

  // Suspend the IP
  const success = await suspendAccount(undefined, action.ip_address, reason, durationHours)
  if (!success) {
    throw new Error('Failed to suspend IP')
  }

  // Log the admin action
  await logAdminAction('suspend_ip', {
    target_ip: action.ip_address,
    reason,
    duration_hours: durationHours
  })

  return {
    message: 'IP suspended successfully',
    ip_address: action.ip_address,
    reason,
    duration_hours: durationHours,
    expires_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
  }
}

/**
 * Handle user unsuspension
 */
async function handleUnsuspendUser(action: AdminAction) {
  if (!action.user_id) {
    throw new Error('user_id is required for user unsuspension')
  }

  // Deactivate current suspensions
  const { error } = await serviceSupabase
    .from('account_suspensions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', action.user_id)
    .eq('is_active', true)

  if (error) {
    throw new Error('Failed to unsuspend user: ' + error.message)
  }

  // Log the admin action
  await logAdminAction('unsuspend_user', {
    target_user_id: action.user_id,
    reason: action.reason || 'Manual admin unsuspension'
  })

  return {
    message: 'User unsuspended successfully',
    user_id: action.user_id
  }
}

/**
 * Handle IP unsuspension
 */
async function handleUnsuspendIP(action: AdminAction) {
  if (!action.ip_address) {
    throw new Error('ip_address is required for IP unsuspension')
  }

  // Deactivate current suspensions
  const { error } = await serviceSupabase
    .from('account_suspensions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('ip_address', action.ip_address)
    .eq('is_active', true)

  if (error) {
    throw new Error('Failed to unsuspend IP: ' + error.message)
  }

  // Log the admin action
  await logAdminAction('unsuspend_ip', {
    target_ip: action.ip_address,
    reason: action.reason || 'Manual admin unsuspension'
  })

  return {
    message: 'IP unsuspended successfully',
    ip_address: action.ip_address
  }
}

/**
 * Get suspicious activities for review
 */
async function handleGetSuspiciousActivities() {
  const { data: activities, error } = await serviceSupabase
    .from('suspicious_activities')
    .select(`
      *,
      profiles:user_id(email, full_name)
    `)
    .eq('reviewed', false)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error('Failed to fetch suspicious activities: ' + error.message)
  }

  return {
    activities: activities || [],
    count: activities?.length || 0
  }
}

/**
 * Review a suspicious activity
 */
async function handleReviewActivity(action: AdminAction) {
  if (!action.activity_id) {
    throw new Error('activity_id is required for activity review')
  }

  const { error } = await serviceSupabase
    .from('suspicious_activities')
    .update({
      reviewed: true,
      reviewer_notes: action.reviewer_notes,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', action.activity_id)

  if (error) {
    throw new Error('Failed to review activity: ' + error.message)
  }

  // Log the admin action
  await logAdminAction('review_activity', {
    activity_id: action.activity_id,
    reviewer_notes: action.reviewer_notes
  })

  return {
    message: 'Activity reviewed successfully',
    activity_id: action.activity_id
  }
}

/**
 * Get rate limiting statistics
 */
async function handleGetRateLimitStats() {
  try {
    // Get stats from the database function
    const { data: stats, error } = await serviceSupabase.rpc('get_rate_limit_stats', { time_window_minutes: 60 })

    if (error) {
      throw new Error('Failed to get rate limit stats: ' + error.message)
    }

    // Get current active suspensions
    const { data: suspensions, error: suspensionError } = await serviceSupabase
      .from('account_suspensions')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())

    if (suspensionError) {
      console.error('Failed to get suspension stats:', suspensionError)
    }

    // Get recent suspicious activities
    const { data: recentActivities, error: activitiesError } = await serviceSupabase
      .from('suspicious_activities')
      .select('activity_type, severity, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (activitiesError) {
      console.error('Failed to get activity stats:', activitiesError)
    }

    return {
      rate_limit_stats: stats || [],
      active_suspensions: {
        count: suspensions?.length || 0,
        suspensions: suspensions || []
      },
      recent_suspicious_activities: {
        count: recentActivities?.length || 0,
        activities: recentActivities || []
      },
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    throw new Error('Failed to compile rate limit statistics: ' + error.message)
  }
}

/**
 * Log admin actions for audit trail
 */
async function logAdminAction(action: string, details: Record<string, any>) {
  try {
    const { error } = await serviceSupabase
      .from('admin_actions')
      .insert({
        action,
        details,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Failed to log admin action:', error)
    }
  } catch (error) {
    console.error('Error logging admin action:', error)
  }
}

console.log('Security admin Edge Function loaded')