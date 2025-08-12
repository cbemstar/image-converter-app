/**
 * Data Export Edge Function
 * Handles GDPR-compliant data export requests
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createServiceClient, getUserFromRequest, corsHeaders, createErrorResponse, createSuccessResponse, handleOptions, validateMethod, logExecution } from '../_shared/auth-utils.ts'

interface ExportRequest {
  format?: 'json' | 'csv'
}

interface ExportResponse {
  request_id: string
  sla_deadline: string
  estimated_completion: string
  status: string
}

serve(async (req: Request) => {
  const startTime = Date.now()
  
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return handleOptions()
    }

    // Validate method
    validateMethod(req, ['POST', 'GET'])

    if (req.method === 'POST') {
      return await handleExportRequest(req, startTime)
    } else if (req.method === 'GET') {
      return await handleGetExportStatus(req, startTime)
    }

  } catch (error) {
    logExecution('data-export', startTime, false, error.message)
    return createErrorResponse(error.message, 400)
  }
})

async function handleExportRequest(req: Request, startTime: number): Promise<Response> {
  try {
    // Authenticate user
    const user = await getUserFromRequest(req)
    
    // Parse request body
    const body: ExportRequest = await req.json().catch(() => ({}))
    const format = body.format || 'json'

    // Validate format
    if (!['json', 'csv'].includes(format)) {
      throw new Error('Invalid export format. Supported formats: json, csv')
    }

    // Create service client
    const supabase = createServiceClient()

    // Check if user has verified email (requirement for data export)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('User profile not found')
    }

    if (!profile.email_verified) {
      throw new Error('Email verification required for data export')
    }

    // Create export request using the database function
    const { data: exportRequest, error: exportError } = await supabase
      .rpc('request_data_export', {
        export_type: 'export',
        format: format
      })

    if (exportError) {
      throw new Error(`Failed to create export request: ${exportError.message}`)
    }

    if (!exportRequest || exportRequest.length === 0) {
      throw new Error('Failed to create export request')
    }

    const request = exportRequest[0]

    // Trigger background processing (in a real implementation, this would be a queue)
    // For now, we'll process it immediately in the background
    processExportInBackground(request.request_id, user.id, format)

    logExecution('data-export', startTime, true)

    return createSuccessResponse({
      request_id: request.request_id,
      sla_deadline: request.sla_deadline,
      estimated_completion: request.estimated_completion,
      status: 'pending',
      message: 'Export request created successfully. You will receive an email when the export is ready.'
    })

  } catch (error) {
    logExecution('data-export', startTime, false, error.message)
    throw error
  }
}

async function handleGetExportStatus(req: Request, startTime: number): Promise<Response> {
  try {
    // Authenticate user
    const user = await getUserFromRequest(req)
    
    // Get request ID from URL
    const url = new URL(req.url)
    const requestId = url.searchParams.get('request_id')

    if (!requestId) {
      // Return all export requests for the user
      const supabase = createServiceClient()
      
      const { data: requests, error } = await supabase
        .from('data_export_requests')
        .select(`
          id,
          request_type,
          status,
          export_format,
          file_size_bytes,
          download_url,
          download_expires_at,
          error_message,
          processing_started_at,
          processing_completed_at,
          sla_deadline,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch export requests: ${error.message}`)
      }

      logExecution('data-export', startTime, true)
      return createSuccessResponse({ requests: requests || [] })
    }

    // Get specific export request
    const supabase = createServiceClient()
    
    const { data: request, error } = await supabase
      .from('data_export_requests')
      .select(`
        id,
        request_type,
        status,
        export_format,
        file_size_bytes,
        download_url,
        download_expires_at,
        error_message,
        processing_started_at,
        processing_completed_at,
        sla_deadline,
        created_at
      `)
      .eq('id', requestId)
      .eq('user_id', user.id)
      .single()

    if (error || !request) {
      throw new Error('Export request not found')
    }

    logExecution('data-export', startTime, true)
    return createSuccessResponse(request)

  } catch (error) {
    logExecution('data-export', startTime, false, error.message)
    throw error
  }
}

async function processExportInBackground(requestId: string, userId: string, format: string) {
  // This would typically be handled by a background job queue
  // For now, we'll process it with a small delay to simulate async processing
  
  setTimeout(async () => {
    try {
      const supabase = createServiceClient()

      // Update status to processing
      await supabase.rpc('update_export_request_status', {
        request_id: requestId,
        new_status: 'processing'
      })

      // Get user data
      const { data: userData, error: dataError } = await supabase
        .rpc('get_user_export_data', {
          target_user_id: userId
        })

      if (dataError) {
        throw new Error(`Failed to get user data: ${dataError.message}`)
      }

      // Generate export file
      let exportContent: string
      let fileName: string
      let contentType: string

      if (format === 'json') {
        exportContent = JSON.stringify(userData, null, 2)
        fileName = `user-data-export-${userId}-${Date.now()}.json`
        contentType = 'application/json'
      } else {
        // Convert to CSV format
        exportContent = convertToCSV(userData)
        fileName = `user-data-export-${userId}-${Date.now()}.csv`
        contentType = 'text/csv'
      }

      // Store file in Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('exports')
        .upload(`${userId}/${fileName}`, new Blob([exportContent], { type: contentType }), {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload export file: ${uploadError.message}`)
      }

      // Generate signed URL (valid for 7 days)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('exports')
        .createSignedUrl(uploadData.path, 7 * 24 * 60 * 60) // 7 days

      if (signedUrlError) {
        throw new Error(`Failed to create signed URL: ${signedUrlError.message}`)
      }

      // Update export request with completion details
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

      await supabase.rpc('update_export_request_status', {
        request_id: requestId,
        new_status: 'completed',
        file_path: uploadData.path,
        file_size_bytes: new Blob([exportContent]).size,
        download_url: signedUrlData.signedUrl,
        download_expires_at: expiresAt.toISOString()
      })

      console.log(`Export completed for user ${userId}, request ${requestId}`)

    } catch (error) {
      console.error(`Export failed for user ${userId}, request ${requestId}:`, error)
      
      // Update status to failed
      const supabase = createServiceClient()
      await supabase.rpc('update_export_request_status', {
        request_id: requestId,
        new_status: 'failed',
        error_message: error.message
      })
    }
  }, 1000) // 1 second delay to simulate async processing
}

function convertToCSV(data: any): string {
  // Simple CSV conversion for user data
  const lines: string[] = []
  
  // Add header
  lines.push('Section,Field,Value')
  
  // Add profile data
  if (data.profile) {
    Object.entries(data.profile).forEach(([key, value]) => {
      lines.push(`Profile,${key},"${String(value).replace(/"/g, '""')}"`)
    })
  }
  
  // Add subscription data
  if (data.subscriptions && Array.isArray(data.subscriptions)) {
    data.subscriptions.forEach((sub: any, index: number) => {
      Object.entries(sub).forEach(([key, value]) => {
        lines.push(`Subscription ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`)
      })
    })
  }
  
  // Add usage data
  if (data.usage_records && Array.isArray(data.usage_records)) {
    data.usage_records.forEach((usage: any, index: number) => {
      Object.entries(usage).forEach(([key, value]) => {
        lines.push(`Usage Record ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`)
      })
    })
  }
  
  // Add conversion data
  if (data.conversions && Array.isArray(data.conversions)) {
    data.conversions.forEach((conversion: any, index: number) => {
      Object.entries(conversion).forEach(([key, value]) => {
        lines.push(`Conversion ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`)
      })
    })
  }
  
  return lines.join('\n')
}