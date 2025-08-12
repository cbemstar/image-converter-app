/**
 * Rate Limiting and Abuse Detection System
 * Implements per-user and per-IP rate limiting with configurable thresholds
 * Requirements: 10.1, 10.2, 10.3, 10.6
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Environment variables with defaults
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Rate limiting configuration (configurable via environment variables)
const RATE_LIMITS = {
  USER_CONVERSIONS_PER_MINUTE: parseInt(Deno.env.get('USER_CONVERSIONS_PER_MINUTE') || '30'),
  IP_REQUESTS_PER_MINUTE: parseInt(Deno.env.get('IP_REQUESTS_PER_MINUTE') || '120'),
  SUSPICIOUS_ACTIVITY_THRESHOLD: parseInt(Deno.env.get('SUSPICIOUS_ACTIVITY_THRESHOLD') || '100'),
  ABUSE_DETECTION_WINDOW_HOURS: parseInt(Deno.env.get('ABUSE_DETECTION_WINDOW_HOURS') || '24'),
  MAX_BACKOFF_MINUTES: parseInt(Deno.env.get('MAX_BACKOFF_MINUTES') || '60'),
}

// Create service client for database operations
const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  backoffSeconds?: number
  reason?: string
}

export interface SuspiciousActivity {
  userId?: string
  ipAddress: string
  activityType: 'rapid_requests' | 'quota_abuse' | 'failed_auth' | 'suspicious_pattern'
  severity: 'low' | 'medium' | 'high'
  details: Record<string, any>
}

/**
 * Initialize rate limiting tables if they don't exist
 */
export async function initializeRateLimitTables() {
  try {
    // Create rate_limit_records table
    await serviceSupabase.rpc('create_rate_limit_tables')
    console.log('Rate limiting tables initialized')
  } catch (error) {
    console.error('Failed to initialize rate limiting tables:', error)
  }
}

/**
 * Check user-based rate limit for conversions
 */
export async function checkUserRateLimit(userId: string): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - 60 * 1000) // 1 minute window
  const identifier = `user:${userId}:conversions`
  
  try {
    // Get current count for this user in the last minute
    const { data: records, error } = await serviceSupabase
      .from('rate_limit_records')
      .select('*')
      .eq('identifier', identifier)
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error checking user rate limit:', error)
      return {
        allowed: true, // Fail open
        remaining: RATE_LIMITS.USER_CONVERSIONS_PER_MINUTE,
        resetTime: new Date(Date.now() + 60 * 1000)
      }
    }
    
    const currentCount = records?.length || 0
    const remaining = Math.max(0, RATE_LIMITS.USER_CONVERSIONS_PER_MINUTE - currentCount)
    
    if (currentCount >= RATE_LIMITS.USER_CONVERSIONS_PER_MINUTE) {
      // Check for exponential backoff
      const backoffSeconds = calculateBackoff(currentCount, RATE_LIMITS.USER_CONVERSIONS_PER_MINUTE)
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60 * 1000),
        backoffSeconds,
        reason: 'User conversion rate limit exceeded'
      }
    }
    
    return {
      allowed: true,
      remaining,
      resetTime: new Date(Date.now() + 60 * 1000)
    }
    
  } catch (error) {
    console.error('Error in checkUserRateLimit:', error)
    return {
      allowed: true, // Fail open
      remaining: RATE_LIMITS.USER_CONVERSIONS_PER_MINUTE,
      resetTime: new Date(Date.now() + 60 * 1000)
    }
  }
}

/**
 * Check IP-based rate limit for all requests
 */
export async function checkIPRateLimit(ipAddress: string): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - 60 * 1000) // 1 minute window
  const identifier = `ip:${ipAddress}:requests`
  
  try {
    // Get current count for this IP in the last minute
    const { data: records, error } = await serviceSupabase
      .from('rate_limit_records')
      .select('*')
      .eq('identifier', identifier)
      .gte('created_at', windowStart.toISOString())
    
    if (error) {
      console.error('Error checking IP rate limit:', error)
      return {
        allowed: true, // Fail open
        remaining: RATE_LIMITS.IP_REQUESTS_PER_MINUTE,
        resetTime: new Date(Date.now() + 60 * 1000)
      }
    }
    
    const currentCount = records?.length || 0
    const remaining = Math.max(0, RATE_LIMITS.IP_REQUESTS_PER_MINUTE - currentCount)
    
    if (currentCount >= RATE_LIMITS.IP_REQUESTS_PER_MINUTE) {
      const backoffSeconds = calculateBackoff(currentCount, RATE_LIMITS.IP_REQUESTS_PER_MINUTE)
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60 * 1000),
        backoffSeconds,
        reason: 'IP rate limit exceeded'
      }
    }
    
    return {
      allowed: true,
      remaining,
      resetTime: new Date(Date.now() + 60 * 1000)
    }
    
  } catch (error) {
    console.error('Error in checkIPRateLimit:', error)
    return {
      allowed: true, // Fail open
      remaining: RATE_LIMITS.IP_REQUESTS_PER_MINUTE,
      resetTime: new Date(Date.now() + 60 * 1000)
    }
  }
}

/**
 * Record a rate limit event
 */
export async function recordRateLimitEvent(
  identifier: string, 
  userId?: string, 
  ipAddress?: string,
  metadata?: Record<string, any>
) {
  try {
    const { error } = await serviceSupabase
      .from('rate_limit_records')
      .insert({
        identifier,
        user_id: userId,
        ip_address: ipAddress,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Error recording rate limit event:', error)
    }
  } catch (error) {
    console.error('Error in recordRateLimitEvent:', error)
  }
}

/**
 * Calculate exponential backoff in seconds
 */
function calculateBackoff(currentCount: number, limit: number): number {
  const excessRequests = currentCount - limit
  const backoffSeconds = Math.min(
    Math.pow(2, Math.min(excessRequests, 10)) * 5, // Cap at 2^10 * 5 = 5120 seconds
    RATE_LIMITS.MAX_BACKOFF_MINUTES * 60
  )
  return backoffSeconds
}

/**
 * Detect suspicious activity patterns
 */
export async function detectSuspiciousActivity(
  userId?: string, 
  ipAddress?: string
): Promise<SuspiciousActivity[]> {
  const suspiciousActivities: SuspiciousActivity[] = []
  const windowStart = new Date(Date.now() - RATE_LIMITS.ABUSE_DETECTION_WINDOW_HOURS * 60 * 60 * 1000)
  
  try {
    // Check for rapid requests from IP
    if (ipAddress) {
      const { data: ipRecords, error: ipError } = await serviceSupabase
        .from('rate_limit_records')
        .select('*')
        .eq('ip_address', ipAddress)
        .gte('created_at', windowStart.toISOString())
      
      if (!ipError && ipRecords && ipRecords.length > RATE_LIMITS.SUSPICIOUS_ACTIVITY_THRESHOLD) {
        suspiciousActivities.push({
          userId,
          ipAddress,
          activityType: 'rapid_requests',
          severity: 'high',
          details: {
            requestCount: ipRecords.length,
            timeWindow: RATE_LIMITS.ABUSE_DETECTION_WINDOW_HOURS,
            threshold: RATE_LIMITS.SUSPICIOUS_ACTIVITY_THRESHOLD
          }
        })
      }
    }
    
    // Check for quota abuse patterns
    if (userId) {
      const { data: userRecords, error: userError } = await serviceSupabase
        .from('rate_limit_records')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', windowStart.toISOString())
      
      if (!userError && userRecords && userRecords.length > RATE_LIMITS.SUSPICIOUS_ACTIVITY_THRESHOLD / 2) {
        suspiciousActivities.push({
          userId,
          ipAddress: ipAddress || 'unknown',
          activityType: 'quota_abuse',
          severity: 'medium',
          details: {
            conversionAttempts: userRecords.length,
            timeWindow: RATE_LIMITS.ABUSE_DETECTION_WINDOW_HOURS,
            threshold: RATE_LIMITS.SUSPICIOUS_ACTIVITY_THRESHOLD / 2
          }
        })
      }
    }
    
    // Check for suspicious patterns (multiple IPs for same user)
    if (userId) {
      const { data: userIPs, error: ipError } = await serviceSupabase
        .from('rate_limit_records')
        .select('ip_address')
        .eq('user_id', userId)
        .gte('created_at', windowStart.toISOString())
      
      if (!ipError && userIPs) {
        const uniqueIPs = new Set(userIPs.map(record => record.ip_address).filter(Boolean))
        
        if (uniqueIPs.size > 10) { // More than 10 different IPs in 24 hours
          suspiciousActivities.push({
            userId,
            ipAddress: ipAddress || 'multiple',
            activityType: 'suspicious_pattern',
            severity: 'medium',
            details: {
              uniqueIPCount: uniqueIPs.size,
              timeWindow: RATE_LIMITS.ABUSE_DETECTION_WINDOW_HOURS,
              threshold: 10
            }
          })
        }
      }
    }
    
  } catch (error) {
    console.error('Error detecting suspicious activity:', error)
  }
  
  return suspiciousActivities
}

/**
 * Log suspicious activity for review
 */
export async function logSuspiciousActivity(activity: SuspiciousActivity) {
  try {
    const { error } = await serviceSupabase
      .from('suspicious_activities')
      .insert({
        user_id: activity.userId,
        ip_address: activity.ipAddress,
        activity_type: activity.activityType,
        severity: activity.severity,
        details: activity.details,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Error logging suspicious activity:', error)
    }
    
    // Send alert for high severity activities
    if (activity.severity === 'high') {
      await sendAbusAlert(activity)
    }
    
  } catch (error) {
    console.error('Error in logSuspiciousActivity:', error)
  }
}

/**
 * Send abuse alert to administrators
 */
async function sendAbusAlert(activity: SuspiciousActivity) {
  try {
    // Log to console for now - in production, this would send to monitoring system
    console.warn('HIGH SEVERITY ABUSE DETECTED:', {
      userId: activity.userId,
      ipAddress: activity.ipAddress,
      activityType: activity.activityType,
      details: activity.details,
      timestamp: new Date().toISOString()
    })
    
    // TODO: Integrate with monitoring/alerting system
    // await sendToMonitoringSystem(activity)
    
  } catch (error) {
    console.error('Error sending abuse alert:', error)
  }
}

/**
 * Check if user or IP is currently suspended
 */
export async function checkSuspensionStatus(userId?: string, ipAddress?: string): Promise<{
  suspended: boolean
  reason?: string
  expiresAt?: Date
}> {
  try {
    let query = serviceSupabase
      .from('account_suspensions')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
    
    if (userId) {
      query = query.eq('user_id', userId)
    } else if (ipAddress) {
      query = query.eq('ip_address', ipAddress)
    } else {
      return { suspended: false }
    }
    
    const { data: suspensions, error } = await query.limit(1)
    
    if (error) {
      console.error('Error checking suspension status:', error)
      return { suspended: false } // Fail open
    }
    
    if (suspensions && suspensions.length > 0) {
      const suspension = suspensions[0]
      return {
        suspended: true,
        reason: suspension.reason,
        expiresAt: new Date(suspension.expires_at)
      }
    }
    
    return { suspended: false }
    
  } catch (error) {
    console.error('Error in checkSuspensionStatus:', error)
    return { suspended: false } // Fail open
  }
}

/**
 * Suspend user or IP address
 */
export async function suspendAccount(
  userId?: string,
  ipAddress?: string,
  reason: string = 'Automated abuse detection',
  durationHours: number = 24
) {
  try {
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)
    
    const { error } = await serviceSupabase
      .from('account_suspensions')
      .insert({
        user_id: userId,
        ip_address: ipAddress,
        reason,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Error suspending account:', error)
      return false
    }
    
    console.log(`Account suspended: ${userId || ipAddress} for ${durationHours} hours - ${reason}`)
    return true
    
  } catch (error) {
    console.error('Error in suspendAccount:', error)
    return false
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(req: Request): string {
  // Check various headers for the real IP
  const forwardedFor = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const cfConnectingIP = req.headers.get('cf-connecting-ip')
  
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  
  // Fallback to a default if no IP is found
  return 'unknown'
}

/**
 * Comprehensive rate limit check combining user and IP limits
 */
export async function checkRateLimits(
  userId?: string,
  ipAddress?: string,
  endpoint: string = 'general'
): Promise<{
  allowed: boolean
  reason?: string
  backoffSeconds?: number
  remaining?: number
  resetTime?: Date
}> {
  try {
    // Check suspension status first
    const suspensionCheck = await checkSuspensionStatus(userId, ipAddress)
    if (suspensionCheck.suspended) {
      return {
        allowed: false,
        reason: `Account suspended: ${suspensionCheck.reason}`,
        backoffSeconds: suspensionCheck.expiresAt ? 
          Math.floor((suspensionCheck.expiresAt.getTime() - Date.now()) / 1000) : 
          3600
      }
    }
    
    // Check IP rate limit
    if (ipAddress) {
      const ipLimit = await checkIPRateLimit(ipAddress)
      if (!ipLimit.allowed) {
        return {
          allowed: false,
          reason: ipLimit.reason,
          backoffSeconds: ipLimit.backoffSeconds,
          remaining: ipLimit.remaining,
          resetTime: ipLimit.resetTime
        }
      }
    }
    
    // Check user rate limit for conversion endpoints
    if (userId && endpoint === 'conversion') {
      const userLimit = await checkUserRateLimit(userId)
      if (!userLimit.allowed) {
        return {
          allowed: false,
          reason: userLimit.reason,
          backoffSeconds: userLimit.backoffSeconds,
          remaining: userLimit.remaining,
          resetTime: userLimit.resetTime
        }
      }
    }
    
    // Record the request
    if (userId || ipAddress) {
      const identifier = userId ? 
        `user:${userId}:${endpoint}` : 
        `ip:${ipAddress}:${endpoint}`
      
      await recordRateLimitEvent(identifier, userId, ipAddress, { endpoint })
    }
    
    // Check for suspicious activity
    const suspiciousActivities = await detectSuspiciousActivity(userId, ipAddress)
    for (const activity of suspiciousActivities) {
      await logSuspiciousActivity(activity)
      
      // Auto-suspend for high severity activities
      if (activity.severity === 'high') {
        await suspendAccount(userId, ipAddress, `Automated suspension: ${activity.activityType}`, 24)
        return {
          allowed: false,
          reason: 'Account automatically suspended due to suspicious activity',
          backoffSeconds: 24 * 60 * 60 // 24 hours
        }
      }
    }
    
    return { allowed: true }
    
  } catch (error) {
    console.error('Error in checkRateLimits:', error)
    return { allowed: true } // Fail open
  }
}

/**
 * Clean up old rate limit records (should be called periodically)
 */
export async function cleanupOldRecords() {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    const { error } = await serviceSupabase
      .from('rate_limit_records')
      .delete()
      .lt('created_at', cutoffTime.toISOString())
    
    if (error) {
      console.error('Error cleaning up old rate limit records:', error)
    } else {
      console.log('Old rate limit records cleaned up')
    }
    
  } catch (error) {
    console.error('Error in cleanupOldRecords:', error)
  }
}

console.log('Rate limiter module loaded with configuration:', RATE_LIMITS)