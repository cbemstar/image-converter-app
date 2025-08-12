/**
 * Secure Edge Function Example
 * Demonstrates comprehensive security implementation with middleware
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { securityMiddleware, createSecurityHeaders, logSecurityEvent } from '../_shared/security-middleware.ts'
import { createServiceClient, corsHeaders, createErrorResponse, createSuccessResponse, handleOptions } from '../_shared/auth-utils.ts'
import { validateString, validateNumber, validateEmail, validateFile } from '../_shared/input-validator.ts'

const serviceSupabase = createServiceClient()

/**
 * Main handler function with comprehensive security
 */
serve(async (req: Request) => {
  const startTime = Date.now()
  
  try {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return handleOptions()
    }

    // Apply security middleware
    const securityResult = await securityMiddleware(req, {
      enableRateLimit: true,
      enableInputValidation: true,
      enableSuspiciousActivityDetection: true,
      endpoint: 'secure_example',
      requireAuth: true,
      allowedMethods: ['POST'],
      customValidation: async (request) => {
        // Custom validation example
        const userAgent = request.headers.get('user-agent')
        if (!userAgent || userAgent.length < 10) {
          return {
            valid: false,
            errors: ['Invalid or missing user agent']
          }
        }
        return { valid: true, errors: [] }
      }
    })

    // If security check failed, return the error response
    if (!securityResult.allowed) {
      if (securityResult.response) {
        return securityResult.response
      }
      return createErrorResponse('Security validation failed', 403)
    }

    // Log security warnings if any
    if (securityResult.warnings && securityResult.warnings.length > 0) {
      await logSecurityEvent('validation_error', {
        warnings: securityResult.warnings,
        clientIP: securityResult.clientIP,
        userId: securityResult.userId
      }, 'low')
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = await validateRequestBody(body)
    
    if (!validationResult.valid) {
      await logSecurityEvent('validation_error', {
        errors: validationResult.errors,
        clientIP: securityResult.clientIP,
        userId: securityResult.userId
      }, 'medium')
      
      return createErrorResponse(
        `Validation failed: ${validationResult.errors.join(', ')}`,
        400
      )
    }

    // Process the validated request
    const result = await processSecureRequest(validationResult.sanitized, securityResult)
    
    const processingTime = Date.now() - startTime
    
    // Create response with security headers
    const securityHeaders = createSecurityHeaders()
    
    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        processing_time_ms: processingTime
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          ...securityHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString()
        }
      }
    )

  } catch (error) {
    console.error('Secure example error:', error)
    
    await logSecurityEvent('blocked_request', {
      error: error.message,
      stack: error.stack
    }, 'high')
    
    const processingTime = Date.now() - startTime
    return createErrorResponse('Internal server error', 500)
  }
})

/**
 * Validate request body with comprehensive checks
 */
async function validateRequestBody(body: any): Promise<{
  valid: boolean
  errors: string[]
  sanitized?: any
  warnings?: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  // Validate action field
  const actionValidation = validateString(body.action, 'action', {
    required: true,
    maxLength: 50,
    pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/
  })
  
  if (!actionValidation.valid) {
    errors.push(...actionValidation.errors)
  } else {
    const allowedActions = ['create', 'update', 'delete', 'read']
    if (!allowedActions.includes(actionValidation.sanitized as string)) {
      errors.push('Invalid action. Allowed actions: ' + allowedActions.join(', '))
    } else {
      sanitized.action = actionValidation.sanitized
    }
  }

  // Validate email if provided
  if (body.email !== undefined) {
    const emailValidation = validateEmail(body.email, 'email', false)
    if (!emailValidation.valid) {
      errors.push(...emailValidation.errors)
    } else {
      sanitized.email = emailValidation.sanitized
    }
    warnings.push(...(emailValidation.warnings || []))
  }

  // Validate numeric fields
  if (body.count !== undefined) {
    const countValidation = validateNumber(body.count, 'count', {
      min: 1,
      max: 1000,
      integer: true
    })
    
    if (!countValidation.valid) {
      errors.push(...countValidation.errors)
    } else {
      sanitized.count = countValidation.sanitized
    }
    warnings.push(...(countValidation.warnings || []))
  }

  // Validate nested objects
  if (body.metadata !== undefined) {
    if (typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
      errors.push('metadata must be an object')
    } else {
      // Validate metadata fields
      const metadataErrors: string[] = []
      const sanitizedMetadata: any = {}

      for (const [key, value] of Object.entries(body.metadata)) {
        if (typeof key !== 'string' || key.length > 50) {
          metadataErrors.push(`Invalid metadata key: ${key}`)
          continue
        }

        if (typeof value === 'string') {
          const valueValidation = validateString(value, `metadata.${key}`, {
            maxLength: 500
          })
          
          if (!valueValidation.valid) {
            metadataErrors.push(...valueValidation.errors)
          } else {
            sanitizedMetadata[key] = valueValidation.sanitized
          }
        } else if (typeof value === 'number') {
          if (isFinite(value)) {
            sanitizedMetadata[key] = value
          } else {
            metadataErrors.push(`Invalid number value for metadata.${key}`)
          }
        } else if (typeof value === 'boolean') {
          sanitizedMetadata[key] = value
        } else {
          metadataErrors.push(`Unsupported value type for metadata.${key}`)
        }
      }

      if (metadataErrors.length > 0) {
        errors.push(...metadataErrors)
      } else {
        sanitized.metadata = sanitizedMetadata
      }
    }
  }

  // Validate array fields
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      errors.push('tags must be an array')
    } else {
      const sanitizedTags: string[] = []
      
      for (let i = 0; i < Math.min(body.tags.length, 20); i++) {
        const tag = body.tags[i]
        const tagValidation = validateString(tag, `tags[${i}]`, {
          required: true,
          maxLength: 50,
          pattern: /^[a-zA-Z0-9_-]+$/
        })
        
        if (!tagValidation.valid) {
          errors.push(...tagValidation.errors)
        } else {
          sanitizedTags.push(tagValidation.sanitized as string)
        }
      }
      
      if (body.tags.length > 20) {
        warnings.push('Only first 20 tags were processed')
      }
      
      sanitized.tags = sanitizedTags
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined,
    warnings
  }
}

/**
 * Process the secure request
 */
async function processSecureRequest(data: any, securityResult: any): Promise<any> {
  const { action, email, count, metadata, tags } = data

  // Log the secure operation
  await logSecurityEvent('blocked_request', {
    action,
    clientIP: securityResult.clientIP,
    userId: securityResult.userId,
    hasEmail: !!email,
    count,
    metadataKeys: metadata ? Object.keys(metadata) : [],
    tagCount: tags ? tags.length : 0
  }, 'low')

  // Simulate processing based on action
  switch (action) {
    case 'create':
      return await handleCreate(data)
    case 'update':
      return await handleUpdate(data)
    case 'delete':
      return await handleDelete(data)
    case 'read':
      return await handleRead(data)
    default:
      throw new Error('Unknown action')
  }
}

/**
 * Handle create action
 */
async function handleCreate(data: any): Promise<any> {
  // Simulate database operation with validation
  const record = {
    id: crypto.randomUUID(),
    ...data,
    created_at: new Date().toISOString(),
    status: 'active'
  }

  // In a real implementation, you would save to database
  console.log('Creating record:', record)

  return {
    message: 'Record created successfully',
    record_id: record.id,
    created_at: record.created_at
  }
}

/**
 * Handle update action
 */
async function handleUpdate(data: any): Promise<any> {
  // Simulate update operation
  const updateData = {
    ...data,
    updated_at: new Date().toISOString()
  }

  console.log('Updating record:', updateData)

  return {
    message: 'Record updated successfully',
    updated_at: updateData.updated_at
  }
}

/**
 * Handle delete action
 */
async function handleDelete(data: any): Promise<any> {
  // Simulate delete operation
  console.log('Deleting record with data:', data)

  return {
    message: 'Record deleted successfully',
    deleted_at: new Date().toISOString()
  }
}

/**
 * Handle read action
 */
async function handleRead(data: any): Promise<any> {
  // Simulate read operation
  const mockData = {
    id: crypto.randomUUID(),
    email: data.email || 'example@test.com',
    count: data.count || 1,
    metadata: data.metadata || {},
    tags: data.tags || [],
    created_at: new Date().toISOString(),
    status: 'active'
  }

  console.log('Reading record:', mockData)

  return {
    message: 'Record retrieved successfully',
    data: mockData
  }
}

console.log('Secure example Edge Function loaded')