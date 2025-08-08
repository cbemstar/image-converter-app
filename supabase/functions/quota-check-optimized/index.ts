/**
 * Optimized Quota Check Edge Function
 * Implements caching, bundle size optimization, and cold start reduction
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Plan limits configuration (cached in memory)
const PLAN_LIMITS = {
  free: {
    storage: 52428800,      // 50MB
    conversions: 500,
    apiCalls: 5000,
    maxFileSize: 26214400   // 25MB
  },
  pro: {
    storage: 2147483648,    // 2GB
    conversions: 5000,
    apiCalls: 50000,
    maxFileSize: 104857600  // 100MB
  },
  agency: {
    storage: 21474836480,   // 20GB
    conversions: 50000,
    apiCalls: 500000,
    maxFileSize: 262144000  // 250MB
  }
} as const

// In-memory cache for user profiles (reduces DB queries)
const profileCache = new Map<string, { plan: string; cachedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Response cache for identical requests
const responseCache = new Map<string, { response: any; cachedAt: number }>()
const RESPONSE_CACHE_TTL = 30 * 1000 // 30 seconds

// Initialize Supabase client (reused across requests)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const body = await req.json()
    const { user_id, action_type, file_size = 0 } = body

    // Validate required fields
    if (!user_id || !action_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, action_type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create cache key for response caching
    const cacheKey = `${user_id}_${action_type}_${file_size}`
    
    // Check response cache first
    const cachedResponse = responseCache.get(cacheKey)
    if (cachedResponse && (Date.now() - cachedResponse.cachedAt) < RESPONSE_CACHE_TTL) {
      return new Response(
        JSON.stringify(cachedResponse.response),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
          }
        }
      )
    }

    // Get user plan (with caching)
    const userPlan = await getUserPlan(user_id)
    const planLimits = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free

    // Check quota based on action type
    let quotaResult
    switch (action_type) {
      case 'storage':
        quotaResult = await checkStorageQuota(user_id, file_size, planLimits)
        break
      case 'conversion':
        quotaResult = await checkConversionQuota(user_id, planLimits)
        break
      case 'api_call':
        quotaResult = await checkAndIncrementApiCalls(user_id, planLimits)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action_type' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

    // Cache successful response
    if (quotaResult.allowed) {
      responseCache.set(cacheKey, {
        response: quotaResult,
        cachedAt: Date.now()
      })
    }

    const processingTime = Date.now() - startTime
    
    return new Response(
      JSON.stringify({
        ...quotaResult,
        processing_time_ms: processingTime
      }),
      { 
        status: quotaResult.allowed ? 200 : 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache': 'MISS',
          'X-Processing-Time': processingTime.toString()
        }
      }
    )

  } catch (error) {
    console.error('Quota check error:', error)
    
    const processingTime = Date.now() - startTime
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        processing_time_ms: processingTime
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
 * Get user plan with caching
 */
async function getUserPlan(userId: string): Promise<string> {
  // Check cache first
  const cached = profileCache.get(userId)
  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL) {
    return cached.plan
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      return 'free' // Default to free plan on error
    }

    const plan = data?.subscription_plan || 'free'
    
    // Cache the result
    profileCache.set(userId, {
      plan,
      cachedAt: Date.now()
    })

    return plan

  } catch (error) {
    console.error('Error in getUserPlan:', error)
    return 'free'
  }
}

/**
 * Check storage quota
 */
async function checkStorageQuota(userId: string, fileSize: number, planLimits: any) {
  try {
    // Get current storage usage
    const { data: files, error } = await supabase
      .from('user_files')
      .select('file_size')
      .eq('user_id', userId)

    if (error) throw error

    const currentStorage = files?.reduce((total, file) => total + (file.file_size || 0), 0) || 0
    const newTotal = currentStorage + fileSize

    return {
      allowed: newTotal <= planLimits.storage && fileSize <= planLimits.maxFileSize,
      current_usage: currentStorage,
      limit: planLimits.storage,
      new_total: newTotal,
      percentage: (newTotal / planLimits.storage) * 100,
      quota_type: 'storage',
      file_size_allowed: fileSize <= planLimits.maxFileSize,
      max_file_size: planLimits.maxFileSize
    }

  } catch (error) {
    console.error('Storage quota check error:', error)
    return {
      allowed: false,
      error: 'Storage quota check failed',
      current_usage: 0,
      limit: planLimits.storage
    }
  }
}

/**
 * Check conversion quota
 */
async function checkConversionQuota(userId: string, planLimits: any) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    const { data, error } = await supabase
      .from('monthly_usage')
      .select('conversions_count')
      .eq('user_id', userId)
      .eq('month_year', currentMonth)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    const currentConversions = data?.conversions_count || 0
    const newTotal = currentConversions + 1

    return {
      allowed: newTotal <= planLimits.conversions,
      current_usage: currentConversions,
      limit: planLimits.conversions,
      new_total: newTotal,
      percentage: (newTotal / planLimits.conversions) * 100,
      quota_type: 'conversions'
    }

  } catch (error) {
    console.error('Conversion quota check error:', error)
    return {
      allowed: false,
      error: 'Conversion quota check failed',
      current_usage: 0,
      limit: planLimits.conversions
    }
  }
}

/**
 * Check and increment API calls
 */
async function checkAndIncrementApiCalls(userId: string, planLimits: any) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Use upsert to increment API calls atomically
    const { data, error } = await supabase
      .from('monthly_usage')
      .upsert({
        user_id: userId,
        month_year: currentMonth,
        api_calls: 1
      }, {
        onConflict: 'user_id,month_year',
        ignoreDuplicates: false
      })
      .select('api_calls')
      .single()

    if (error) throw error

    const currentApiCalls = data?.api_calls || 1

    return {
      allowed: currentApiCalls <= planLimits.apiCalls,
      current_usage: currentApiCalls,
      limit: planLimits.apiCalls,
      percentage: (currentApiCalls / planLimits.apiCalls) * 100,
      quota_type: 'api_calls'
    }

  } catch (error) {
    console.error('API calls quota check error:', error)
    return {
      allowed: false,
      error: 'API calls quota check failed',
      current_usage: 0,
      limit: planLimits.apiCalls
    }
  }
}

/**
 * Cleanup old cache entries periodically
 */
setInterval(() => {
  const now = Date.now()
  
  // Clean profile cache
  for (const [key, value] of profileCache.entries()) {
    if (now - value.cachedAt > CACHE_TTL) {
      profileCache.delete(key)
    }
  }
  
  // Clean response cache
  for (const [key, value] of responseCache.entries()) {
    if (now - value.cachedAt > RESPONSE_CACHE_TTL) {
      responseCache.delete(key)
    }
  }
}, 60000) // Clean every minute

console.log('Optimized quota check function loaded')