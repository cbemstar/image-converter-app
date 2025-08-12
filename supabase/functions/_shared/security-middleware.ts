/**
 * Security Middleware for Edge Functions
 * Provides comprehensive security checks including rate limiting, input validation, and abuse detection
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { checkRateLimits, getClientIP, detectSuspiciousActivity, logSuspiciousActivity } from './rate-limiter.ts'
import { validateCompleteRequest, validateAPIRequest, validateRequestSize, validateString, validateJSON } from './input-validator.ts'
import { fileSecurityScanner, SecurityThreat } from './file-security-scanner.ts'
import { corsHeaders, createErrorResponse } from './auth-utils.ts'

export interface SecurityConfig {
  enableRateLimit?: boolean
  enableInputValidation?: boolean
  enableSuspiciousActivityDetection?: boolean
  endpoint?: string
  maxRequestSize?: number
  requireAuth?: boolean
  allowedMethods?: string[]
  customValidation?: (req: Request) => Promise<{ valid: boolean; errors: string[] }>
}

export interface SecurityResult {
  allowed: boolean
  response?: Response
  clientIP?: string
  userId?: string
  warnings?: string[]
}

/**
 * Comprehensive security middleware for Edge Functions
 */
export async function securityMiddleware(
  req: Request,
  config: SecurityConfig = {}
): Promise<SecurityResult> {
  const {
    enableRateLimit = true,
    enableInputValidation = true,
    enableSuspiciousActivityDetection = true,
    endpoint = 'general',
    maxRequestSize = 100 * 1024 * 1024, // 100MB default
    requireAuth = false,
    allowedMethods = ['POST', 'GET'],
    customValidation
  } = config

  const warnings: string[] = []
  let userId: string | undefined
  let clientIP: string | undefined

  try {
    // 1. Method validation
    if (!allowedMethods.includes(req.method)) {
      return {
        allowed: false,
        response: createErrorResponse(`Method ${req.method} not allowed`, 405)
      }
    }

    // 2. Request size validation
    if (enableInputValidation) {
      const sizeValidation = validateRequestSize(req)
      if (!sizeValidation.valid) {
        return {
          allowed: false,
          response: createErrorResponse(sizeValidation.errors[0], 413)
        }
      }
    }

    // 3. Get client IP
    clientIP = getClientIP(req)

    // 4. Authentication check (if required)
    if (requireAuth) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return {
          allowed: false,
          response: createErrorResponse('Authentication required', 401)
        }
      }

      // Extract user ID from auth header if possible
      try {
        // This is a simplified extraction - in practice you'd validate the JWT
        const token = authHeader.replace('Bearer ', '')
        // For now, we'll skip JWT validation and assume the token is valid
        // In production, you'd validate the JWT and extract the user ID
        userId = 'extracted-from-jwt' // Placeholder
      } catch (error) {
        warnings.push('Failed to extract user ID from auth token')
      }
    }

    // 5. Rate limiting
    if (enableRateLimit) {
      const rateLimitResult = await checkRateLimits(userId, clientIP, endpoint)
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.backoffSeconds || 60
        
        const response = new Response(
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

        return {
          allowed: false,
          response,
          clientIP,
          userId
        }
      }
    }

    // 6. Comprehensive input validation
    if (enableInputValidation) {
      try {
        // Use comprehensive request validation
        const validationResult = await validateCompleteRequest(req, endpoint)
        
        if (!validationResult.valid) {
          return {
            allowed: false,
            response: createErrorResponse(
              `Input validation failed: ${validationResult.errors.join(', ')}`,
              400
            )
          }
        }
        
        warnings.push(...(validationResult.warnings || []))
        
        // Additional file upload validation for multipart requests
        const contentType = req.headers.get('content-type') || ''
        if (contentType.includes('multipart/form-data')) {
          const fileValidationResult = await validateFileUploads(req)
          
          if (!fileValidationResult.safe) {
            const criticalThreats = fileValidationResult.threats.filter(
              t => t.severity === 'critical' || t.severity === 'high'
            )
            
            if (criticalThreats.length > 0) {
              return {
                allowed: false,
                response: createErrorResponse(
                  `File security scan failed: ${criticalThreats[0].description}`,
                  400
                )
              }
            }
            
            // Log medium/low severity threats as warnings
            const mediumThreats = fileValidationResult.threats.filter(
              t => t.severity === 'medium' || t.severity === 'low'
            )
            warnings.push(...mediumThreats.map(t => `File security: ${t.description}`))
          }
          
          warnings.push(...fileValidationResult.warnings)
        }
        
      } catch (error) {
        warnings.push(`Input validation error: ${error.message}`)
      }
    }

    // 7. Custom validation
    if (customValidation) {
      try {
        const customResult = await customValidation(req)
        if (!customResult.valid) {
          return {
            allowed: false,
            response: createErrorResponse(
              `Custom validation failed: ${customResult.errors.join(', ')}`,
              400
            )
          }
        }
      } catch (error) {
        warnings.push(`Custom validation error: ${error.message}`)
      }
    }

    // 8. Suspicious activity detection
    if (enableSuspiciousActivityDetection && (userId || clientIP)) {
      try {
        const suspiciousActivities = await detectSuspiciousActivity(userId, clientIP)
        
        for (const activity of suspiciousActivities) {
          await logSuspiciousActivity(activity)
          warnings.push(`Suspicious activity detected: ${activity.activityType}`)
          
          // For high severity activities, we might want to block the request
          if (activity.severity === 'high') {
            return {
              allowed: false,
              response: createErrorResponse(
                'Request blocked due to suspicious activity',
                403
              )
            }
          }
        }
      } catch (error) {
        warnings.push(`Suspicious activity detection error: ${error.message}`)
      }
    }

    // 9. Security headers validation
    const securityHeadersResult = validateSecurityHeaders(req)
    warnings.push(...securityHeadersResult.warnings)

    return {
      allowed: true,
      clientIP,
      userId,
      warnings
    }

  } catch (error) {
    console.error('Security middleware error:', error)
    return {
      allowed: false,
      response: createErrorResponse('Security validation failed', 500),
      clientIP,
      userId
    }
  }
}

/**
 * Validate security-related headers
 */
function validateSecurityHeaders(req: Request): { warnings: string[] } {
  const warnings: string[] = []

  // Check for potentially dangerous headers
  const dangerousHeaders = [
    'x-forwarded-host',
    'x-original-host',
    'x-rewrite-url'
  ]

  for (const header of dangerousHeaders) {
    const value = req.headers.get(header)
    if (value) {
      warnings.push(`Potentially dangerous header detected: ${header}`)
    }
  }

  // Validate User-Agent
  const userAgent = req.headers.get('user-agent')
  if (userAgent) {
    // Check for suspicious user agents
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i
    ]

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent))
    if (isSuspicious) {
      warnings.push(`Suspicious user agent detected: ${userAgent}`)
    }
  }

  // Check for missing expected headers
  const expectedHeaders = ['content-type', 'accept']
  for (const header of expectedHeaders) {
    if (!req.headers.get(header)) {
      warnings.push(`Missing expected header: ${header}`)
    }
  }

  return { warnings }
}

/**
 * Sanitize request headers
 */
export function sanitizeHeaders(headers: Headers): Headers {
  const sanitized = new Headers()

  for (const [key, value] of headers.entries()) {
    // Skip potentially dangerous headers
    if (key.toLowerCase().startsWith('x-forwarded-') && 
        !['x-forwarded-for', 'x-forwarded-proto'].includes(key.toLowerCase())) {
      continue
    }

    // Sanitize header values
    const sanitizedValue = value
      .replace(/[<>\"']/g, '') // Remove HTML/script injection chars
      .trim()
      .substring(0, 1000) // Limit header value length

    sanitized.set(key, sanitizedValue)
  }

  return sanitized
}

/**
 * Create security response headers
 */
export function createSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  }
}

/**
 * Validate file upload security
 */
export async function validateFileUploadSecurity(
  file: File,
  allowedTypes: string[] = [],
  maxSize: number = 50 * 1024 * 1024
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = []
  const warnings: string[] = []

  // File size check
  if (file.size > maxSize) {
    errors.push(`File size ${file.size} exceeds maximum allowed size ${maxSize}`)
  }

  // File type check
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`)
  }

  // Filename security check
  const filename = file.name
  
  // Check for path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    errors.push('Filename contains path traversal characters')
  }

  // Check for dangerous extensions
  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.sh', '.ps1'
  ]

  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  if (dangerousExtensions.includes(extension)) {
    errors.push(`File extension ${extension} is not allowed`)
  }

  // Check for suspicious filenames
  const suspiciousPatterns = [
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
    /^\./,  // Hidden files
    /[<>:"|?*\x00-\x1f]/  // Invalid characters
  ]

  const baseName = filename.substring(0, filename.lastIndexOf('.') || filename.length)
  if (suspiciousPatterns.some(pattern => pattern.test(baseName))) {
    errors.push('Filename contains suspicious patterns')
  }

  // File content validation (basic magic number check)
  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer.slice(0, 16)) // First 16 bytes for magic number

    // Check if file content matches declared type
    if (file.type.startsWith('image/')) {
      const isValidImage = validateImageMagicNumbers(bytes, file.type)
      if (!isValidImage) {
        warnings.push('File content does not match declared image type')
      }
    }
  } catch (error) {
    warnings.push(`Could not validate file content: ${error.message}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate image magic numbers
 */
function validateImageMagicNumbers(bytes: Uint8Array, declaredType: string): boolean {
  const magicNumbers = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
    'image/bmp': [0x42, 0x4D],
    'image/tiff': [0x49, 0x49, 0x2A, 0x00] // Little endian TIFF
  }

  const expectedMagic = magicNumbers[declaredType as keyof typeof magicNumbers]
  if (!expectedMagic) {
    return true // Unknown type, can't validate
  }

  // Special case for WebP - need to check for WEBP signature at offset 8
  if (declaredType === 'image/webp') {
    return bytes.length >= 12 &&
           bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
           bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  }

  // Check if file starts with expected magic numbers
  return expectedMagic.every((byte, index) => bytes[index] === byte)
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  eventType: 'rate_limit' | 'validation_error' | 'suspicious_activity' | 'blocked_request',
  details: Record<string, any>,
  severity: 'low' | 'medium' | 'high' = 'medium'
) {
  try {
    console.log(`[SECURITY-${severity.toUpperCase()}] ${eventType}:`, details)
    
    // In production, you might want to send this to a security monitoring service
    // await sendToSecurityMonitoring({ eventType, details, severity, timestamp: new Date() })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

/**
 * Validate file uploads in multipart requests
 */
async function validateFileUploads(req: Request): Promise<{
  safe: boolean
  threats: SecurityThreat[]
  warnings: string[]
}> {
  const threats: SecurityThreat[] = []
  const warnings: string[] = []

  try {
    // Clone request to avoid consuming the body
    const clonedReq = req.clone()
    const formData = await clonedReq.formData()

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // Scan each file for security threats
        const scanResult = await fileSecurityScanner.scanFile(value)
        
        threats.push(...scanResult.threats)
        warnings.push(...scanResult.warnings)
        
        // Log scan results
        if (!scanResult.safe) {
          await logSecurityEvent('file_upload_threat', {
            filename: value.name,
            size: value.size,
            type: value.type,
            threats: scanResult.threats.length,
            scanTime: scanResult.scanTime
          }, 'high')
        }
      }
    }

  } catch (error) {
    warnings.push(`File upload validation error: ${error.message}`)
  }

  return {
    safe: !threats.some(t => t.severity === 'critical' || t.severity === 'high'),
    threats,
    warnings
  }
}

/**
 * Enhanced SQL injection detection
 */
export function detectSQLInjection(input: string): { detected: boolean; patterns: string[] } {
  const sqlPatterns = [
    // Union-based injection
    /(\bunion\b.*\bselect\b)/gi,
    /(\bselect\b.*\bunion\b)/gi,
    
    // Boolean-based injection
    /(\bor\b\s+\d+\s*=\s*\d+)/gi,
    /(\band\b\s+\d+\s*=\s*\d+)/gi,
    /(\bor\b\s+['"].*['"])/gi,
    
    // Time-based injection
    /(\bwaitfor\b\s+\bdelay\b)/gi,
    /(\bsleep\s*\()/gi,
    /(\bbenchmark\s*\()/gi,
    
    // Error-based injection
    /(\bconvert\s*\()/gi,
    /(\bcast\s*\()/gi,
    /(\bextractvalue\s*\()/gi,
    
    // Stacked queries
    /;\s*(drop|delete|insert|update|create|alter)\b/gi,
    
    // Comment injection
    /(\/\*.*\*\/)/g,
    /(--[^\r\n]*)/g,
    /(#[^\r\n]*)/g,
    
    // Information schema
    /(\binformation_schema\b)/gi,
    /(\bsys\.\b)/gi,
    /(\bmaster\.\b)/gi,
    
    // Database functions
    /(\bversion\s*\(\))/gi,
    /(\buser\s*\(\))/gi,
    /(\bdatabase\s*\(\))/gi,
    /(\bschema\s*\(\))/gi
  ]

  const detectedPatterns: string[] = []

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.toString())
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns
  }
}

/**
 * Enhanced XSS detection
 */
export function detectXSS(input: string): { detected: boolean; patterns: string[] } {
  const xssPatterns = [
    // Script tags
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<script[^>]*>.*?<\/script>/gi,
    
    // Event handlers
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /on\w+\s*=\s*[^"'\s>]+/gi,
    
    // JavaScript protocol
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /data\s*:\s*text\/html/gi,
    
    // HTML injection
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^>]*>/gi,
    /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
    
    // Style injection
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    /style\s*=\s*["'][^"']*expression\s*\(/gi,
    
    // Meta refresh
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
    
    // Link injection
    /<link\b[^>]*>/gi,
    
    // Base tag
    /<base\b[^>]*>/gi,
    
    // Import
    /@import\b/gi,
    
    // Expression
    /expression\s*\(/gi,
    
    // Encoded attacks
    /&#x?[0-9a-f]+;?/gi,
    /%[0-9a-f]{2}/gi
  ]

  const detectedPatterns: string[] = []

  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.toString())
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns
  }
}

/**
 * Command injection detection
 */
export function detectCommandInjection(input: string): { detected: boolean; patterns: string[] } {
  const commandPatterns = [
    // Command separators
    /[;&|`$(){}[\]]/g,
    
    // Common dangerous commands
    /\b(rm|del|format|shutdown|reboot|kill|ps|ls|cat|more|less|head|tail|grep|find|wget|curl|nc|netcat|telnet|ssh|ftp|tftp|ping|nslookup|dig|whoami|id|uname|pwd|cd|mkdir|rmdir|cp|mv|chmod|chown|su|sudo|passwd|crontab|at|batch|nohup|screen|tmux)\b/gi,
    
    // File operations
    /\b(\/bin\/|\/usr\/bin\/|\/sbin\/|\/usr\/sbin\/|cmd\.exe|powershell\.exe|bash|sh|zsh|fish|csh|tcsh)\b/gi,
    
    // Redirection
    /[<>]+/g,
    
    // Environment variables
    /\$\w+/g,
    /\$\{[^}]+\}/g,
    
    // Backticks
    /`[^`]+`/g,
    
    // Process substitution
    /\$\([^)]+\)/g
  ]

  const detectedPatterns: string[] = []

  for (const pattern of commandPatterns) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.toString())
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns
  }
}

/**
 * Path traversal detection
 */
export function detectPathTraversal(input: string): { detected: boolean; patterns: string[] } {
  const pathPatterns = [
    // Directory traversal
    /\.\.\//g,
    /\.\.\\g,
    /\.\.\\/g,
    /\/\.\.\//g,
    /\\\.\.\\g,
    
    // Encoded traversal
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
    /%252e%252e%252f/gi,
    
    // Unicode traversal
    /\u002e\u002e\u002f/g,
    /\u002e\u002e\u005c/g,
    
    // Absolute paths
    /^\/[a-zA-Z]/,
    /^[a-zA-Z]:\\/,
    
    // System directories
    /\b(\/etc\/|\/var\/|\/tmp\/|\/usr\/|\/bin\/|\/sbin\/|\/home\/|\/root\/|C:\\Windows\\|C:\\Program Files\\|C:\\Users\\)\b/gi
  ]

  const detectedPatterns: string[] = []

  for (const pattern of pathPatterns) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.toString())
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns
  }
}

/**
 * Comprehensive input sanitization
 */
export function sanitizeInput(input: string, options: {
  allowHTML?: boolean
  allowScripts?: boolean
  maxLength?: number
  removeControlChars?: boolean
} = {}): string {
  const {
    allowHTML = false,
    allowScripts = false,
    maxLength = 10000,
    removeControlChars = true
  } = options

  let sanitized = input

  // Trim and limit length
  sanitized = sanitized.trim().substring(0, maxLength)

  // Remove control characters
  if (removeControlChars) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  }

  // Remove or escape HTML if not allowed
  if (!allowHTML) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  // Remove scripts even if HTML is allowed
  if (!allowScripts) {
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  }

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ')

  return sanitized
}

console.log('Security middleware loaded')