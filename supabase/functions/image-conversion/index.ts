/**
 * Image Conversion Processing Edge Function
 * Implements image conversion with integrated usage metering, rate limiting, and input validation
 * Requirements: 2.3, 13.1, 13.2, 13.3, 13.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { checkRateLimits, getClientIP } from '../_shared/rate-limiter.ts'
import { validateFile, validateConversionParams, validateRequestSize } from '../_shared/input-validator.ts'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const SUPPORTED_INPUT_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff']
const SUPPORTED_OUTPUT_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif']

// Initialize Supabase clients
const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface ConversionRequest {
  target_format: string
  quality?: number
  max_width?: number
  max_height?: number
  filename?: string
}

interface ConversionResponse {
  success: boolean
  download_url?: string
  filename?: string
  file_size?: number
  processing_time?: number
  remaining_quota?: number
  error?: string
}

/**
 * Main handler function
 */
serve(async (req: Request) => {
  const startTime = Date.now()
  
  try {
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders })
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405, corsHeaders)
    }

    // Validate request size
    const sizeValidation = validateRequestSize(req)
    if (!sizeValidation.valid) {
      return createErrorResponse(sizeValidation.errors[0], 413, corsHeaders)
    }

    // Get client IP for rate limiting
    const clientIP = getClientIP(req)

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return createErrorResponse('Missing authorization header', 401, corsHeaders)
    }

    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) {
      return createErrorResponse('Unauthorized', 401, corsHeaders)
    }

    // Check rate limits (both IP and user-based for conversions)
    const rateLimitResult = await checkRateLimits(user.id, clientIP, 'conversion')
    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.backoffSeconds || 60
      return new Response(
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
    }

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const conversionParams = formData.get('params') as string

    if (!file) {
      return createErrorResponse('No file provided', 400, corsHeaders)
    }

    if (!conversionParams) {
      return createErrorResponse('No conversion parameters provided', 400, corsHeaders)
    }

    // Validate and sanitize conversion parameters
    let params: ConversionRequest
    try {
      const rawParams = JSON.parse(conversionParams)
      const paramValidation = validateConversionParams(rawParams)
      
      if (!paramValidation.valid) {
        return createErrorResponse(
          `Invalid parameters: ${paramValidation.errors.join(', ')}`, 
          400, 
          corsHeaders
        )
      }
      
      params = paramValidation.sanitized as ConversionRequest
    } catch (error) {
      return createErrorResponse('Invalid conversion parameters JSON', 400, corsHeaders)
    }

    // Validate file upload
    const fileValidation = validateFile(file)
    if (!fileValidation.valid) {
      return createErrorResponse(
        `File validation failed: ${fileValidation.errors.join(', ')}`, 
        400, 
        corsHeaders
      )
    }

    // Additional file and parameter validation
    const legacyValidationResult = validateFileAndParams(file, params)
    if (!legacyValidationResult.valid) {
      return createErrorResponse(legacyValidationResult.error!, 400, corsHeaders)
    }

    // Check user quota before processing
    const quotaCheck = await checkUserQuota(user.id)
    if (!quotaCheck.success) {
      return createErrorResponse(quotaCheck.error!, quotaCheck.can_convert ? 500 : 429, corsHeaders)
    }

    if (!quotaCheck.can_convert) {
      return createErrorResponse('Quota exceeded. Please upgrade your plan.', 429, corsHeaders)
    }

    // Process the image conversion
    const conversionResult = await processImageConversion(file, params)
    if (!conversionResult.success) {
      return createErrorResponse(conversionResult.error!, 500, corsHeaders)
    }

    // Store the converted file
    const storageResult = await storeConvertedFile(
      conversionResult.convertedBuffer!,
      conversionResult.filename!,
      user.id
    )
    if (!storageResult.success) {
      return createErrorResponse(storageResult.error!, 500, corsHeaders)
    }

    // Increment usage counter and record conversion
    const usageResult = await incrementUsage(user.id, {
      original_filename: file.name,
      original_format: file.type,
      target_format: params.target_format,
      file_size_bytes: file.size,
      processing_time_ms: conversionResult.processing_time,
      storage_path: storageResult.storage_path
    })

    if (!usageResult.success) {
      console.error('Failed to increment usage:', usageResult.error)
      // Don't fail the conversion if usage tracking fails, but log it
    }

    const processingTime = Date.now() - startTime

    const response: ConversionResponse = {
      success: true,
      download_url: storageResult.signed_url,
      filename: conversionResult.filename,
      file_size: conversionResult.convertedBuffer!.length,
      processing_time: processingTime,
      remaining_quota: usageResult.remaining_quota
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString()
        }
      }
    )

  } catch (error) {
    console.error('Image conversion error:', error)
    
    const processingTime = Date.now() - startTime
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        processing_time: processingTime
      }),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString()
        }
      }
    )
  }
})

/**
 * Validate file and conversion parameters
 */
function validateFileAndParams(file: File, params: ConversionRequest): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    }
  }

  // Check file type
  if (!SUPPORTED_INPUT_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported input format: ${file.type}. Supported formats: ${SUPPORTED_INPUT_FORMATS.join(', ')}`
    }
  }

  // Check target format
  if (!SUPPORTED_OUTPUT_FORMATS.includes(params.target_format.toLowerCase())) {
    return {
      valid: false,
      error: `Unsupported output format: ${params.target_format}. Supported formats: ${SUPPORTED_OUTPUT_FORMATS.join(', ')}`
    }
  }

  // Validate quality parameter
  if (params.quality !== undefined && (params.quality < 1 || params.quality > 100)) {
    return {
      valid: false,
      error: 'Quality must be between 1 and 100'
    }
  }

  // Validate dimensions
  if (params.max_width !== undefined && params.max_width < 1) {
    return {
      valid: false,
      error: 'Max width must be greater than 0'
    }
  }

  if (params.max_height !== undefined && params.max_height < 1) {
    return {
      valid: false,
      error: 'Max height must be greater than 0'
    }
  }

  return { valid: true }
}

/**
 * Check user quota using the usage tracking function
 */
async function checkUserQuota(userId: string): Promise<{ success: boolean; can_convert: boolean; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/usage-tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        action: 'check_quota',
        user_id: userId
      })
    })

    const result = await response.json()
    
    if (!result.success) {
      return {
        success: false,
        can_convert: false,
        error: result.error
      }
    }

    return {
      success: true,
      can_convert: result.can_convert
    }

  } catch (error) {
    console.error('Error checking quota:', error)
    return {
      success: false,
      can_convert: false,
      error: 'Failed to check quota'
    }
  }
}

/**
 * Process image conversion using Canvas API
 */
async function processImageConversion(
  file: File, 
  params: ConversionRequest
): Promise<{ success: boolean; convertedBuffer?: Uint8Array; filename?: string; processing_time?: number; error?: string }> {
  const conversionStart = Date.now()
  
  try {
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Create image from buffer
    const image = await createImageFromBuffer(uint8Array)
    
    // Calculate new dimensions if resizing is needed
    let { width, height } = calculateDimensions(
      image.width, 
      image.height, 
      params.max_width, 
      params.max_height
    )

    // Create canvas and draw image
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    
    ctx.drawImage(image, 0, 0, width, height)
    
    // Convert to target format
    const mimeType = `image/${params.target_format === 'jpg' ? 'jpeg' : params.target_format}`
    const quality = params.quality ? params.quality / 100 : 0.9
    
    const blob = await canvas.convertToBlob({
      type: mimeType,
      quality: quality
    })
    
    const convertedBuffer = new Uint8Array(await blob.arrayBuffer())
    
    // Generate filename
    const originalName = file.name.split('.')[0] || 'converted'
    const filename = `${originalName}.${params.target_format}`
    
    const processingTime = Date.now() - conversionStart
    
    return {
      success: true,
      convertedBuffer,
      filename,
      processing_time: processingTime
    }

  } catch (error) {
    console.error('Image conversion processing error:', error)
    return {
      success: false,
      error: 'Failed to process image conversion: ' + error.message
    }
  }
}

/**
 * Create image from buffer
 */
async function createImageFromBuffer(buffer: Uint8Array): Promise<ImageBitmap> {
  const blob = new Blob([buffer])
  return await createImageBitmap(blob)
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number, 
  originalHeight: number, 
  maxWidth?: number, 
  maxHeight?: number
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight
  
  if (maxWidth && width > maxWidth) {
    height = (height * maxWidth) / width
    width = maxWidth
  }
  
  if (maxHeight && height > maxHeight) {
    width = (width * maxHeight) / height
    height = maxHeight
  }
  
  return { width: Math.round(width), height: Math.round(height) }
}

/**
 * Store converted file in Supabase Storage
 */
async function storeConvertedFile(
  buffer: Uint8Array, 
  filename: string, 
  userId: string
): Promise<{ success: boolean; storage_path?: string; signed_url?: string; error?: string }> {
  try {
    const storagePath = `conversions/${userId}/${Date.now()}-${filename}`
    
    // Upload file to storage
    const { data: uploadData, error: uploadError } = await serviceSupabase.storage
      .from('converted-files')
      .upload(storagePath, buffer, {
        contentType: `image/${filename.split('.').pop()}`,
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return {
        success: false,
        error: 'Failed to upload converted file: ' + uploadError.message
      }
    }

    // Generate signed URL for download (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await serviceSupabase.storage
      .from('converted-files')
      .createSignedUrl(storagePath, 3600)

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError)
      return {
        success: false,
        error: 'Failed to generate download URL: ' + signedUrlError.message
      }
    }

    return {
      success: true,
      storage_path: storagePath,
      signed_url: signedUrlData.signedUrl
    }

  } catch (error) {
    console.error('Error storing converted file:', error)
    return {
      success: false,
      error: 'Failed to store converted file'
    }
  }
}

/**
 * Increment usage counter using the usage tracking function
 */
async function incrementUsage(
  userId: string, 
  conversionDetails: {
    original_filename: string
    original_format: string
    target_format: string
    file_size_bytes: number
    processing_time_ms?: number
    storage_path?: string
  }
): Promise<{ success: boolean; remaining_quota?: number; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/usage-tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        action: 'increment_usage',
        user_id: userId,
        conversion_details: conversionDetails
      })
    })

    const result = await response.json()
    
    return {
      success: result.success,
      remaining_quota: result.remaining_quota,
      error: result.error
    }

  } catch (error) {
    console.error('Error incrementing usage:', error)
    return {
      success: false,
      error: 'Failed to increment usage'
    }
  }
}

/**
 * Create standardized error response
 */
function createErrorResponse(message: string, status: number, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  )
}

console.log('Image conversion Edge Function loaded')