/**
 * Input Validation and Sanitization System
 * Implements comprehensive input validation for all API endpoints
 * Requirements: 10.4, 10.5
 */

// File size limits (configurable via environment variables)
const VALIDATION_LIMITS = {
  MAX_FILE_SIZE: parseInt(Deno.env.get('MAX_FILE_SIZE') || '52428800'), // 50MB default
  MAX_FILENAME_LENGTH: parseInt(Deno.env.get('MAX_FILENAME_LENGTH') || '255'),
  MAX_STRING_LENGTH: parseInt(Deno.env.get('MAX_STRING_LENGTH') || '1000'),
  MAX_JSON_DEPTH: parseInt(Deno.env.get('MAX_JSON_DEPTH') || '10'),
  MAX_ARRAY_LENGTH: parseInt(Deno.env.get('MAX_ARRAY_LENGTH') || '100'),
  MAX_REQUEST_SIZE: parseInt(Deno.env.get('MAX_REQUEST_SIZE') || '104857600'), // 100MB default
}

// Allowed file types for uploads
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml'
]

const ALLOWED_OUTPUT_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif']

// Dangerous patterns to detect
const DANGEROUS_PATTERNS = {
  SQL_INJECTION: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(--|\/\*|\*\/|;)/g,
    /(\b(INFORMATION_SCHEMA|SYS\.)\b)/gi
  ],
  XSS: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi
  ],
  PATH_TRAVERSAL: [
    /\.\.\//g,
    /\.\.\\g,
    /\.\.\\/g,
    /\/\.\.\//g,
    /\\\.\.\\g
  ],
  COMMAND_INJECTION: [
    /[;&|`$(){}[\]]/g,
    /\b(rm|del|format|shutdown|reboot|kill|ps|ls|cat|more|less)\b/gi
  ]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  sanitized?: any
  warnings?: string[]
}

export interface FileValidationResult extends ValidationResult {
  fileInfo?: {
    name: string
    size: number
    type: string
    extension: string
  }
}

/**
 * Validate and sanitize string input
 */
export function validateString(
  input: any,
  fieldName: string,
  options: {
    required?: boolean
    maxLength?: number
    minLength?: number
    pattern?: RegExp
    allowEmpty?: boolean
  } = {}
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Type check
  if (typeof input !== 'string') {
    if (options.required) {
      errors.push(`${fieldName} must be a string`)
      return { valid: false, errors }
    }
    if (input === null || input === undefined) {
      return { valid: true, errors: [], sanitized: '' }
    }
    // Try to convert to string
    input = String(input)
    warnings.push(`${fieldName} was converted to string`)
  }
  
  // Required check
  if (options.required && (!input || input.trim().length === 0)) {
    errors.push(`${fieldName} is required`)
  }
  
  // Empty check
  if (!options.allowEmpty && input.trim().length === 0 && !options.required) {
    return { valid: true, errors: [], sanitized: '', warnings }
  }
  
  // Length checks
  const maxLength = options.maxLength || VALIDATION_LIMITS.MAX_STRING_LENGTH
  if (input.length > maxLength) {
    errors.push(`${fieldName} exceeds maximum length of ${maxLength} characters`)
  }
  
  if (options.minLength && input.length < options.minLength) {
    errors.push(`${fieldName} must be at least ${options.minLength} characters`)
  }
  
  // Pattern check
  if (options.pattern && !options.pattern.test(input)) {
    errors.push(`${fieldName} format is invalid`)
  }
  
  // Security checks
  const securityResult = checkForDangerousPatterns(input, fieldName)
  errors.push(...securityResult.errors)
  warnings.push(...securityResult.warnings)
  
  // Sanitize
  const sanitized = sanitizeString(input, maxLength)
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Validate numeric input
 */
export function validateNumber(
  input: any,
  fieldName: string,
  options: {
    required?: boolean
    min?: number
    max?: number
    integer?: boolean
  } = {}
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Type and conversion check
  let numValue: number
  if (typeof input === 'number') {
    numValue = input
  } else if (typeof input === 'string') {
    numValue = parseFloat(input)
    if (isNaN(numValue)) {
      errors.push(`${fieldName} must be a valid number`)
      return { valid: false, errors }
    }
    warnings.push(`${fieldName} was converted from string to number`)
  } else {
    if (options.required) {
      errors.push(`${fieldName} must be a number`)
      return { valid: false, errors }
    }
    return { valid: true, errors: [], sanitized: undefined, warnings }
  }
  
  // Required check
  if (options.required && (isNaN(numValue) || numValue === null || numValue === undefined)) {
    errors.push(`${fieldName} is required`)
  }
  
  // Range checks
  if (options.min !== undefined && numValue < options.min) {
    errors.push(`${fieldName} must be at least ${options.min}`)
  }
  
  if (options.max !== undefined && numValue > options.max) {
    errors.push(`${fieldName} must be at most ${options.max}`)
  }
  
  // Integer check
  if (options.integer && !Number.isInteger(numValue)) {
    errors.push(`${fieldName} must be an integer`)
  }
  
  // Infinity and NaN checks
  if (!isFinite(numValue)) {
    errors.push(`${fieldName} must be a finite number`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: numValue,
    warnings
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: any, fieldName: string = 'email', required: boolean = true): ValidationResult {
  const stringResult = validateString(email, fieldName, { 
    required, 
    maxLength: 254, // RFC 5321 limit
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  })
  
  if (!stringResult.valid) {
    return stringResult
  }
  
  // Additional email-specific checks
  const emailStr = stringResult.sanitized as string
  const errors: string[] = []
  
  // Check for dangerous characters in email
  if (/[<>\"'\\]/.test(emailStr)) {
    errors.push(`${fieldName} contains invalid characters`)
  }
  
  // Check email length limits (local@domain)
  const [local, domain] = emailStr.split('@')
  if (local && local.length > 64) {
    errors.push(`${fieldName} local part exceeds 64 characters`)
  }
  
  if (domain && domain.length > 253) {
    errors.push(`${fieldName} domain part exceeds 253 characters`)
  }
  
  return {
    valid: errors.length === 0,
    errors: [...stringResult.errors, ...errors],
    sanitized: emailStr.toLowerCase().trim(),
    warnings: stringResult.warnings
  }
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: any, fieldName: string = 'id', required: boolean = true): ValidationResult {
  const stringResult = validateString(uuid, fieldName, {
    required,
    maxLength: 36,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  })
  
  if (!stringResult.valid) {
    return stringResult
  }
  
  return {
    valid: true,
    errors: [],
    sanitized: (stringResult.sanitized as string).toLowerCase(),
    warnings: stringResult.warnings
  }
}

/**
 * Validate file upload
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number
    allowedTypes?: string[]
    maxFilenameLength?: number
  } = {}
): FileValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!file || !(file instanceof File)) {
    errors.push('Invalid file object')
    return { valid: false, errors }
  }
  
  // Size validation
  const maxSize = options.maxSize || VALIDATION_LIMITS.MAX_FILE_SIZE
  if (file.size > maxSize) {
    errors.push(`File size exceeds maximum limit of ${formatFileSize(maxSize)}`)
  }
  
  if (file.size === 0) {
    errors.push('File is empty')
  }
  
  // Type validation
  const allowedTypes = options.allowedTypes || ALLOWED_IMAGE_TYPES
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`)
  }
  
  // Filename validation
  const maxFilenameLength = options.maxFilenameLength || VALIDATION_LIMITS.MAX_FILENAME_LENGTH
  if (file.name.length > maxFilenameLength) {
    errors.push(`Filename exceeds maximum length of ${maxFilenameLength} characters`)
  }
  
  // Check for dangerous filename patterns
  const filenameResult = validateFilename(file.name)
  errors.push(...filenameResult.errors)
  warnings.push(...filenameResult.warnings)
  
  // Extract file extension
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  
  const fileInfo = {
    name: file.name,
    size: file.size,
    type: file.type,
    extension
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fileInfo
  }
}

/**
 * Validate filename for security issues
 */
export function validateFilename(filename: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check for path traversal
  if (DANGEROUS_PATTERNS.PATH_TRAVERSAL.some(pattern => pattern.test(filename))) {
    errors.push('Filename contains path traversal patterns')
  }
  
  // Check for dangerous characters
  if (/[<>:"|?*\x00-\x1f]/.test(filename)) {
    errors.push('Filename contains invalid characters')
  }
  
  // Check for reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
  const baseName = filename.split('.')[0].toUpperCase()
  if (reservedNames.includes(baseName)) {
    errors.push('Filename uses reserved system name')
  }
  
  // Check for hidden files
  if (filename.startsWith('.')) {
    warnings.push('Filename starts with dot (hidden file)')
  }
  
  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate JSON object with depth and size limits
 */
export function validateJSON(
  input: any,
  fieldName: string,
  options: {
    required?: boolean
    maxDepth?: number
    maxKeys?: number
    allowedKeys?: string[]
  } = {}
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Required check
  if (options.required && (input === null || input === undefined)) {
    errors.push(`${fieldName} is required`)
    return { valid: false, errors }
  }
  
  if (input === null || input === undefined) {
    return { valid: true, errors: [], sanitized: null, warnings }
  }
  
  // Type check
  if (typeof input !== 'object' || Array.isArray(input)) {
    errors.push(`${fieldName} must be an object`)
    return { valid: false, errors }
  }
  
  // Check depth
  const maxDepth = options.maxDepth || VALIDATION_LIMITS.MAX_JSON_DEPTH
  const depth = getObjectDepth(input)
  if (depth > maxDepth) {
    errors.push(`${fieldName} exceeds maximum depth of ${maxDepth}`)
  }
  
  // Check number of keys
  const keys = Object.keys(input)
  const maxKeys = options.maxKeys || 100
  if (keys.length > maxKeys) {
    errors.push(`${fieldName} exceeds maximum number of keys (${maxKeys})`)
  }
  
  // Check allowed keys
  if (options.allowedKeys) {
    const invalidKeys = keys.filter(key => !options.allowedKeys!.includes(key))
    if (invalidKeys.length > 0) {
      errors.push(`${fieldName} contains invalid keys: ${invalidKeys.join(', ')}`)
    }
  }
  
  // Sanitize object recursively
  const sanitized = sanitizeObject(input, maxDepth)
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Validate array with size limits
 */
export function validateArray(
  input: any,
  fieldName: string,
  options: {
    required?: boolean
    maxLength?: number
    minLength?: number
    itemValidator?: (item: any, index: number) => ValidationResult
  } = {}
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Required check
  if (options.required && (input === null || input === undefined)) {
    errors.push(`${fieldName} is required`)
    return { valid: false, errors }
  }
  
  if (input === null || input === undefined) {
    return { valid: true, errors: [], sanitized: [], warnings }
  }
  
  // Type check
  if (!Array.isArray(input)) {
    errors.push(`${fieldName} must be an array`)
    return { valid: false, errors }
  }
  
  // Length checks
  const maxLength = options.maxLength || VALIDATION_LIMITS.MAX_ARRAY_LENGTH
  if (input.length > maxLength) {
    errors.push(`${fieldName} exceeds maximum length of ${maxLength}`)
  }
  
  if (options.minLength && input.length < options.minLength) {
    errors.push(`${fieldName} must have at least ${options.minLength} items`)
  }
  
  // Validate items
  const sanitizedItems: any[] = []
  if (options.itemValidator) {
    input.forEach((item, index) => {
      const itemResult = options.itemValidator!(item, index)
      if (!itemResult.valid) {
        errors.push(`${fieldName}[${index}]: ${itemResult.errors.join(', ')}`)
      } else {
        sanitizedItems.push(itemResult.sanitized)
      }
      warnings.push(...(itemResult.warnings || []))
    })
  } else {
    sanitizedItems.push(...input)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: sanitizedItems,
    warnings
  }
}

/**
 * Check for dangerous patterns in input
 */
function checkForDangerousPatterns(input: string, fieldName: string): { errors: string[], warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // SQL Injection check
  if (DANGEROUS_PATTERNS.SQL_INJECTION.some(pattern => pattern.test(input))) {
    errors.push(`${fieldName} contains potential SQL injection patterns`)
  }
  
  // XSS check
  if (DANGEROUS_PATTERNS.XSS.some(pattern => pattern.test(input))) {
    errors.push(`${fieldName} contains potential XSS patterns`)
  }
  
  // Path traversal check
  if (DANGEROUS_PATTERNS.PATH_TRAVERSAL.some(pattern => pattern.test(input))) {
    errors.push(`${fieldName} contains path traversal patterns`)
  }
  
  // Command injection check
  if (DANGEROUS_PATTERNS.COMMAND_INJECTION.some(pattern => pattern.test(input))) {
    warnings.push(`${fieldName} contains potential command injection patterns`)
  }
  
  return { errors, warnings }
}

/**
 * Sanitize string input
 */
function sanitizeString(input: string, maxLength: number): string {
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, maxLength)
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any, maxDepth: number, currentDepth: number = 0): any {
  if (currentDepth >= maxDepth) {
    return '[Object too deep]'
  }
  
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj, VALIDATION_LIMITS.MAX_STRING_LENGTH)
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.slice(0, VALIDATION_LIMITS.MAX_ARRAY_LENGTH).map(item => 
      sanitizeObject(item, maxDepth, currentDepth + 1)
    )
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {}
    const keys = Object.keys(obj).slice(0, 100) // Limit number of keys
    
    for (const key of keys) {
      const sanitizedKey = sanitizeString(key, 100)
      sanitized[sanitizedKey] = sanitizeObject(obj[key], maxDepth, currentDepth + 1)
    }
    
    return sanitized
  }
  
  return String(obj)
}

/**
 * Get object depth
 */
function getObjectDepth(obj: any, currentDepth: number = 0): number {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return currentDepth
  }
  
  let maxDepth = currentDepth
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const depth = getObjectDepth(obj[key], currentDepth + 1)
      maxDepth = Math.max(maxDepth, depth)
    }
  }
  
  return maxDepth
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Validate conversion parameters
 */
export function validateConversionParams(params: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}
  
  // Validate target_format
  const formatResult = validateString(params.target_format, 'target_format', {
    required: true,
    maxLength: 10
  })
  
  if (!formatResult.valid) {
    errors.push(...formatResult.errors)
  } else {
    const format = (formatResult.sanitized as string).toLowerCase()
    if (!ALLOWED_OUTPUT_FORMATS.includes(format)) {
      errors.push(`Invalid target format. Allowed formats: ${ALLOWED_OUTPUT_FORMATS.join(', ')}`)
    } else {
      sanitized.target_format = format
    }
  }
  
  // Validate quality (optional)
  if (params.quality !== undefined) {
    const qualityResult = validateNumber(params.quality, 'quality', {
      min: 1,
      max: 100,
      integer: true
    })
    
    if (!qualityResult.valid) {
      errors.push(...qualityResult.errors)
    } else {
      sanitized.quality = qualityResult.sanitized
    }
  }
  
  // Validate max_width (optional)
  if (params.max_width !== undefined) {
    const widthResult = validateNumber(params.max_width, 'max_width', {
      min: 1,
      max: 10000,
      integer: true
    })
    
    if (!widthResult.valid) {
      errors.push(...widthResult.errors)
    } else {
      sanitized.max_width = widthResult.sanitized
    }
  }
  
  // Validate max_height (optional)
  if (params.max_height !== undefined) {
    const heightResult = validateNumber(params.max_height, 'max_height', {
      min: 1,
      max: 10000,
      integer: true
    })
    
    if (!heightResult.valid) {
      errors.push(...heightResult.errors)
    } else {
      sanitized.max_height = heightResult.sanitized
    }
  }
  
  // Validate filename (optional)
  if (params.filename !== undefined) {
    const filenameResult = validateString(params.filename, 'filename', {
      maxLength: VALIDATION_LIMITS.MAX_FILENAME_LENGTH
    })
    
    if (!filenameResult.valid) {
      errors.push(...filenameResult.errors)
    } else {
      const nameValidation = validateFilename(filenameResult.sanitized as string)
      if (!nameValidation.valid) {
        errors.push(...nameValidation.errors)
      } else {
        sanitized.filename = filenameResult.sanitized
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Validate request size
 */
export function validateRequestSize(req: Request): ValidationResult {
  const contentLength = req.headers.get('content-length')
  
  if (contentLength) {
    const size = parseInt(contentLength)
    if (size > VALIDATION_LIMITS.MAX_REQUEST_SIZE) {
      return {
        valid: false,
        errors: [`Request size ${formatFileSize(size)} exceeds maximum limit of ${formatFileSize(VALIDATION_LIMITS.MAX_REQUEST_SIZE)}`]
      }
    }
  }
  
  return { valid: true, errors: [] }
}

/**
 * Validate API endpoint request body
 */
export function validateAPIRequest(
  body: any,
  endpoint: string,
  method: string = 'POST'
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  // Endpoint-specific validation
  switch (endpoint) {
    case 'usage-tracking':
      return validateUsageTrackingRequest(body)
    
    case 'quota-check':
      return validateQuotaCheckRequest(body)
    
    case 'image-conversion':
      return validateImageConversionRequest(body)
    
    case 'stripe-webhook':
      return validateStripeWebhookRequest(body)
    
    case 'security-admin':
      return validateSecurityAdminRequest(body)
    
    default:
      // Generic validation for unknown endpoints
      return validateGenericRequest(body)
  }
}

/**
 * Validate usage tracking request
 */
function validateUsageTrackingRequest(body: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  // Validate action
  const actionResult = validateString(body.action, 'action', {
    required: true,
    maxLength: 50
  })
  
  if (!actionResult.valid) {
    errors.push(...actionResult.errors)
  } else {
    const allowedActions = ['check_quota', 'increment_usage', 'get_usage', 'reset_usage']
    const action = actionResult.sanitized as string
    
    if (!allowedActions.includes(action)) {
      errors.push(`Invalid action. Allowed actions: ${allowedActions.join(', ')}`)
    } else {
      sanitized.action = action
    }
  }

  // Validate user_id (optional for some actions)
  if (body.user_id !== undefined) {
    const userIdResult = validateUUID(body.user_id, 'user_id')
    if (!userIdResult.valid) {
      errors.push(...userIdResult.errors)
    } else {
      sanitized.user_id = userIdResult.sanitized
    }
  }

  // Validate conversion_details if present
  if (body.conversion_details !== undefined) {
    const detailsResult = validateConversionDetails(body.conversion_details)
    if (!detailsResult.valid) {
      errors.push(...detailsResult.errors)
    } else {
      sanitized.conversion_details = detailsResult.sanitized
    }
    warnings.push(...(detailsResult.warnings || []))
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Validate quota check request
 */
function validateQuotaCheckRequest(body: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  // Validate user_id
  const userIdResult = validateUUID(body.user_id, 'user_id', true)
  if (!userIdResult.valid) {
    errors.push(...userIdResult.errors)
  } else {
    sanitized.user_id = userIdResult.sanitized
  }

  // Validate action_type
  const actionResult = validateString(body.action_type, 'action_type', {
    required: true,
    maxLength: 50
  })
  
  if (!actionResult.valid) {
    errors.push(...actionResult.errors)
  } else {
    const allowedActions = ['conversion', 'storage', 'api_call']
    const action = actionResult.sanitized as string
    
    if (!allowedActions.includes(action)) {
      errors.push(`Invalid action_type. Allowed types: ${allowedActions.join(', ')}`)
    } else {
      sanitized.action_type = action
    }
  }

  // Validate file_size (optional)
  if (body.file_size !== undefined) {
    const sizeResult = validateNumber(body.file_size, 'file_size', {
      min: 0,
      max: VALIDATION_LIMITS.MAX_FILE_SIZE,
      integer: true
    })
    
    if (!sizeResult.valid) {
      errors.push(...sizeResult.errors)
    } else {
      sanitized.file_size = sizeResult.sanitized
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Validate image conversion request body (for form data parameters)
 */
function validateImageConversionRequest(body: any): ValidationResult {
  // This is handled separately in the conversion function
  // since it deals with multipart form data
  return { valid: true, errors: [] }
}

/**
 * Validate Stripe webhook request
 */
function validateStripeWebhookRequest(body: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  // Stripe webhooks have a specific structure
  // We mainly validate the event structure
  if (body.id) {
    const idResult = validateString(body.id, 'id', {
      required: true,
      maxLength: 100,
      pattern: /^evt_[a-zA-Z0-9]+$/
    })
    
    if (!idResult.valid) {
      errors.push(...idResult.errors)
    } else {
      sanitized.id = idResult.sanitized
    }
  }

  if (body.type) {
    const typeResult = validateString(body.type, 'type', {
      required: true,
      maxLength: 100
    })
    
    if (!typeResult.valid) {
      errors.push(...typeResult.errors)
    } else {
      sanitized.type = typeResult.sanitized
    }
  }

  // Validate data object
  if (body.data) {
    const dataResult = validateJSON(body.data, 'data', {
      maxDepth: 5,
      maxKeys: 50
    })
    
    if (!dataResult.valid) {
      errors.push(...dataResult.errors)
    } else {
      sanitized.data = dataResult.sanitized
    }
    warnings.push(...(dataResult.warnings || []))
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Validate security admin request
 */
function validateSecurityAdminRequest(body: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  // Validate action
  const actionResult = validateString(body.action, 'action', {
    required: true,
    maxLength: 50
  })
  
  if (!actionResult.valid) {
    errors.push(...actionResult.errors)
  } else {
    const allowedActions = [
      'suspend_user', 'unsuspend_user', 'get_user_activity', 
      'clear_rate_limits', 'get_suspicious_activity', 'block_ip'
    ]
    const action = actionResult.sanitized as string
    
    if (!allowedActions.includes(action)) {
      errors.push(`Invalid action. Allowed actions: ${allowedActions.join(', ')}`)
    } else {
      sanitized.action = action
    }
  }

  // Validate target (user_id or IP)
  if (body.target) {
    const targetResult = validateString(body.target, 'target', {
      required: false,
      maxLength: 100
    })
    
    if (!targetResult.valid) {
      errors.push(...targetResult.errors)
    } else {
      sanitized.target = targetResult.sanitized
    }
  }

  // Validate reason (for suspension actions)
  if (body.reason) {
    const reasonResult = validateString(body.reason, 'reason', {
      maxLength: 500
    })
    
    if (!reasonResult.valid) {
      errors.push(...reasonResult.errors)
    } else {
      sanitized.reason = reasonResult.sanitized
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Validate conversion details object
 */
function validateConversionDetails(details: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  // Validate original_filename
  const filenameResult = validateString(details.original_filename, 'original_filename', {
    required: true,
    maxLength: VALIDATION_LIMITS.MAX_FILENAME_LENGTH
  })
  
  if (!filenameResult.valid) {
    errors.push(...filenameResult.errors)
  } else {
    const nameValidation = validateFilename(filenameResult.sanitized as string)
    if (!nameValidation.valid) {
      errors.push(...nameValidation.errors)
    } else {
      sanitized.original_filename = filenameResult.sanitized
    }
    warnings.push(...(nameValidation.warnings || []))
  }

  // Validate original_format
  const originalFormatResult = validateString(details.original_format, 'original_format', {
    required: true,
    maxLength: 50
  })
  
  if (!originalFormatResult.valid) {
    errors.push(...originalFormatResult.errors)
  } else {
    sanitized.original_format = originalFormatResult.sanitized
  }

  // Validate target_format
  const targetFormatResult = validateString(details.target_format, 'target_format', {
    required: true,
    maxLength: 10
  })
  
  if (!targetFormatResult.valid) {
    errors.push(...targetFormatResult.errors)
  } else {
    const format = (targetFormatResult.sanitized as string).toLowerCase()
    if (!ALLOWED_OUTPUT_FORMATS.includes(format)) {
      errors.push(`Invalid target format. Allowed formats: ${ALLOWED_OUTPUT_FORMATS.join(', ')}`)
    } else {
      sanitized.target_format = format
    }
  }

  // Validate file_size_bytes
  const sizeResult = validateNumber(details.file_size_bytes, 'file_size_bytes', {
    required: true,
    min: 1,
    max: VALIDATION_LIMITS.MAX_FILE_SIZE,
    integer: true
  })
  
  if (!sizeResult.valid) {
    errors.push(...sizeResult.errors)
  } else {
    sanitized.file_size_bytes = sizeResult.sanitized
  }

  // Validate processing_time_ms (optional)
  if (details.processing_time_ms !== undefined) {
    const timeResult = validateNumber(details.processing_time_ms, 'processing_time_ms', {
      min: 0,
      max: 300000, // 5 minutes max
      integer: true
    })
    
    if (!timeResult.valid) {
      errors.push(...timeResult.errors)
    } else {
      sanitized.processing_time_ms = timeResult.sanitized
    }
  }

  // Validate storage_path (optional)
  if (details.storage_path !== undefined) {
    const pathResult = validateString(details.storage_path, 'storage_path', {
      maxLength: 500
    })
    
    if (!pathResult.valid) {
      errors.push(...pathResult.errors)
    } else {
      // Additional path validation
      const path = pathResult.sanitized as string
      if (path.includes('..') || path.includes('//')) {
        errors.push('Invalid storage path')
      } else {
        sanitized.storage_path = path
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Generic request validation for unknown endpoints
 */
function validateGenericRequest(body: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Basic JSON structure validation
  const jsonResult = validateJSON(body, 'request_body', {
    maxDepth: VALIDATION_LIMITS.MAX_JSON_DEPTH,
    maxKeys: 50
  })
  
  if (!jsonResult.valid) {
    errors.push(...jsonResult.errors)
  }
  
  warnings.push(...(jsonResult.warnings || []))
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: jsonResult.sanitized,
    warnings
  }
}

/**
 * Validate and sanitize URL parameters
 */
export function validateURLParams(url: URL): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  for (const [key, value] of url.searchParams.entries()) {
    // Validate parameter key
    const keyResult = validateString(key, 'parameter_key', {
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/
    })
    
    if (!keyResult.valid) {
      errors.push(`Invalid parameter key "${key}": ${keyResult.errors.join(', ')}`)
      continue
    }

    // Validate parameter value
    const valueResult = validateString(value, `parameter_${key}`, {
      maxLength: 1000
    })
    
    if (!valueResult.valid) {
      errors.push(`Invalid parameter value for "${key}": ${valueResult.errors.join(', ')}`)
    } else {
      sanitized[key] = valueResult.sanitized
    }
    
    warnings.push(...(valueResult.warnings || []))
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Validate HTTP headers
 */
export function validateHeaders(headers: Headers): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  // Check for required headers
  const requiredHeaders = ['content-type']
  for (const header of requiredHeaders) {
    if (!headers.get(header)) {
      warnings.push(`Missing recommended header: ${header}`)
    }
  }

  // Validate specific headers
  const contentType = headers.get('content-type')
  if (contentType) {
    const typeResult = validateString(contentType, 'content-type', {
      maxLength: 200
    })
    
    if (!typeResult.valid) {
      errors.push(...typeResult.errors)
    } else {
      sanitized['content-type'] = typeResult.sanitized
    }
  }

  const userAgent = headers.get('user-agent')
  if (userAgent) {
    const uaResult = validateString(userAgent, 'user-agent', {
      maxLength: 500
    })
    
    if (!uaResult.valid) {
      warnings.push(`Invalid user-agent header: ${uaResult.errors.join(', ')}`)
    } else {
      sanitized['user-agent'] = uaResult.sanitized
      
      // Check for suspicious user agents
      const suspiciousPatterns = [
        /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zap/i,
        /burp/i, /w3af/i, /acunetix/i, /nessus/i
      ]
      
      if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
        warnings.push('Suspicious user-agent detected')
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    warnings
  }
}

/**
 * Comprehensive request validation
 */
export async function validateCompleteRequest(
  req: Request,
  endpoint: string
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: any = {}

  try {
    // 1. Validate request size
    const sizeResult = validateRequestSize(req)
    if (!sizeResult.valid) {
      errors.push(...sizeResult.errors)
    }

    // 2. Validate headers
    const headerResult = validateHeaders(req.headers)
    if (!headerResult.valid) {
      errors.push(...headerResult.errors)
    }
    warnings.push(...(headerResult.warnings || []))
    sanitized.headers = headerResult.sanitized

    // 3. Validate URL parameters
    const url = new URL(req.url)
    const paramResult = validateURLParams(url)
    if (!paramResult.valid) {
      errors.push(...paramResult.errors)
    }
    warnings.push(...(paramResult.warnings || []))
    sanitized.params = paramResult.sanitized

    // 4. Validate request body (if present)
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        try {
          const body = await req.json()
          const bodyResult = validateAPIRequest(body, endpoint, req.method)
          
          if (!bodyResult.valid) {
            errors.push(...bodyResult.errors)
          }
          warnings.push(...(bodyResult.warnings || []))
          sanitized.body = bodyResult.sanitized
        } catch (parseError) {
          errors.push('Invalid JSON in request body')
        }
      } else if (contentType.includes('multipart/form-data')) {
        // For multipart data, validation is handled in the specific endpoint
        warnings.push('Multipart form data - validation deferred to endpoint handler')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized,
      warnings
    }

  } catch (error) {
    return {
      valid: false,
      errors: [`Request validation error: ${error.message}`],
      warnings
    }
  }
}

console.log('Input validator module loaded with limits:', VALIDATION_LIMITS)