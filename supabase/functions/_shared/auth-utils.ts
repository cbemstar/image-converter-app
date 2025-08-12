/**
 * Shared authentication and utility functions for Edge Functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

/**
 * Create Supabase client with service role
 */
export const createServiceClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Create Supabase client from request authorization header
 */
export const createClientFromRequest = (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authHeader }
    }
  })
}

/**
 * Get authenticated user from request
 */
export const getUserFromRequest = async (req: Request) => {
  const supabase = createClientFromRequest(req)
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

/**
 * Verify service role access
 */
export const verifyServiceRole = (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('Service role access required')
  }
}

/**
 * Standard CORS headers
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

/**
 * Create standardized error response
 */
export const createErrorResponse = (message: string, status: number, headers = corsHeaders) => {
  return new Response(
    JSON.stringify({
      success: false,
      error: message
    }),
    {
      status,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    }
  )
}

/**
 * Create standardized success response
 */
export const createSuccessResponse = (data: any, processingTime?: number, headers = corsHeaders) => {
  const response = {
    success: true,
    data,
    ...(processingTime && { processing_time_ms: processingTime })
  }

  return new Response(
    JSON.stringify(response),
    {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        ...(processingTime && { 'X-Processing-Time': processingTime.toString() })
      }
    }
  )
}

/**
 * Handle preflight OPTIONS requests
 */
export const handleOptions = () => {
  return new Response(null, { status: 200, headers: corsHeaders })
}

/**
 * Validate request method
 */
export const validateMethod = (req: Request, allowedMethods: string[]) => {
  if (!allowedMethods.includes(req.method)) {
    throw new Error(`Method ${req.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`)
  }
}

/**
 * Get current period start date (first day of current month)
 */
export const getCurrentPeriodStart = (): string => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
}

/**
 * Get current period end date (last day of current month)
 */
export const getCurrentPeriodEnd = (): string => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
}

/**
 * Log function execution with timing
 */
export const logExecution = (functionName: string, startTime: number, success: boolean, error?: string) => {
  const duration = Date.now() - startTime
  console.log(`[${functionName}] ${success ? 'SUCCESS' : 'ERROR'} - ${duration}ms${error ? ` - ${error}` : ''}`)
}

/**
 * Validate required fields in request body
 */
export const validateRequiredFields = (body: any, requiredFields: string[]) => {
  const missingFields = requiredFields.filter(field => !body[field])
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
  }
}

/**
 * Sanitize and validate user input
 */
export const sanitizeInput = (input: string, maxLength = 255): string => {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string')
  }
  
  // Remove potentially dangerous characters
  const sanitized = input
    .replace(/[<>\"']/g, '') // Remove HTML/script injection chars
    .trim()
    .substring(0, maxLength)
  
  return sanitized
}

/**
 * Check if user has required permissions
 */
export const checkUserPermissions = async (userId: string, requiredPermission: string) => {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .rpc('check_user_role', { user_id: userId })
  
  if (error) {
    throw new Error('Failed to check user permissions: ' + error.message)
  }
  
  if (!data || data.length === 0) {
    throw new Error('User not found')
  }
  
  const userRole = data[0]
  
  // Basic permission checks
  switch (requiredPermission) {
    case 'email_verified':
      if (!userRole.email_verified) {
        throw new Error('Email verification required')
      }
      break
    case 'active_subscription':
      if (!userRole.plan_status || userRole.plan_status !== 'active') {
        throw new Error('Active subscription required')
      }
      break
    default:
      break
  }
  
  return userRole
}

/**
 * Rate limiting helper
 */
export const checkRateLimit = async (identifier: string, limit: number, windowMs: number) => {
  // This is a simple in-memory rate limiter
  // In production, you'd want to use Redis or similar
  const rateLimitKey = `rate_limit:${identifier}`
  
  // For now, we'll implement a basic check
  // In a real implementation, you'd store this in a persistent cache
  return true // Allow all requests for now
}

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Generate unique filename
 */
export const generateUniqueFilename = (originalName: string, userId: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split('.').pop() || 'bin'
  const baseName = originalName.split('.')[0] || 'file'
  
  return `${userId}/${timestamp}-${random}-${baseName}.${extension}`
}

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}