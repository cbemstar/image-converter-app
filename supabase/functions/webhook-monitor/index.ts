import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookMetrics {
  totalEvents: number
  processedEvents: number
  failedEvents: number
  successRate: number
  avgProcessingTime: number
  eventsByType: Record<string, number>
  recentFailures: Array<{
    eventId: string
    eventType: string
    error: string
    attempts: number
    createdAt: string
  }>
}

interface DLQItem {
  id: string
  stripe_event_id: string
  event_type: string
  processing_attempts: number
  last_error: string
  payload: any
  created_at: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()

    switch (action) {
      case 'metrics':
        return await getWebhookMetrics(supabase)
      case 'dlq':
        return await getDeadLetterQueue(supabase)
      case 'retry':
        return await retryFailedWebhook(supabase, req)
      case 'alert':
        return await checkAndSendAlerts(supabase)
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

  } catch (error) {
    console.error('Webhook monitor error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function getWebhookMetrics(supabase: any): Promise<Response> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Get overall metrics
  const { data: allEvents, error: allEventsError } = await supabase
    .from('webhook_events')
    .select('processed, event_type, created_at, processing_attempts, last_error, stripe_event_id')
    .gte('created_at', twentyFourHoursAgo)

  if (allEventsError) {
    throw new Error(`Failed to fetch webhook events: ${allEventsError.message}`)
  }

  const totalEvents = allEvents.length
  const processedEvents = allEvents.filter((e: any) => e.processed).length
  const failedEvents = allEvents.filter((e: any) => !e.processed && e.processing_attempts >= 3).length
  const successRate = totalEvents > 0 ? (processedEvents / totalEvents) * 100 : 0

  // Calculate average processing time (simplified - would need actual timing data)
  const avgProcessingTime = 2500 // Placeholder - in production, track actual processing times

  // Group events by type
  const eventsByType = allEvents.reduce((acc: Record<string, number>, event: any) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1
    return acc
  }, {})

  // Get recent failures for DLQ
  const recentFailures = allEvents
    .filter((e: any) => !e.processed && e.last_error)
    .slice(0, 10)
    .map((e: any) => ({
      eventId: e.stripe_event_id,
      eventType: e.event_type,
      error: e.last_error,
      attempts: e.processing_attempts,
      createdAt: e.created_at
    }))

  const metrics: WebhookMetrics = {
    totalEvents,
    processedEvents,
    failedEvents,
    successRate: Math.round(successRate * 100) / 100,
    avgProcessingTime,
    eventsByType,
    recentFailures
  }

  return new Response(
    JSON.stringify(metrics),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

async function getDeadLetterQueue(supabase: any): Promise<Response> {
  // Get events that have failed 3+ times and are not processed
  const { data: dlqEvents, error: dlqError } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('processed', false)
    .gte('processing_attempts', 3)
    .order('created_at', { ascending: false })
    .limit(50)

  if (dlqError) {
    throw new Error(`Failed to fetch DLQ events: ${dlqError.message}`)
  }

  const dlqItems: DLQItem[] = dlqEvents.map((event: any) => ({
    id: event.id,
    stripe_event_id: event.stripe_event_id,
    event_type: event.event_type,
    processing_attempts: event.processing_attempts,
    last_error: event.last_error,
    payload: event.payload,
    created_at: event.created_at
  }))

  return new Response(
    JSON.stringify({
      count: dlqItems.length,
      items: dlqItems
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

async function retryFailedWebhook(supabase: any, req: Request): Promise<Response> {
  const body = await req.json()
  const { eventId } = body

  if (!eventId) {
    return new Response(
      JSON.stringify({ error: 'Missing eventId' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  // Get the failed event
  const { data: event, error: eventError } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('stripe_event_id', eventId)
    .single()

  if (eventError || !event) {
    return new Response(
      JSON.stringify({ error: 'Event not found' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  // Reset the event for retry
  const { error: resetError } = await supabase
    .from('webhook_events')
    .update({
      processed: false,
      processing_attempts: 0,
      last_error: null
    })
    .eq('stripe_event_id', eventId)

  if (resetError) {
    throw new Error(`Failed to reset event: ${resetError.message}`)
  }

  // Trigger webhook reprocessing by calling the webhook endpoint
  try {
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-webhook`
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    
    // Reconstruct the webhook payload
    const webhookPayload = JSON.stringify(event.payload)
    
    // Note: In a real implementation, you'd need to generate a proper Stripe signature
    // For manual retries, you might want to bypass signature verification or use a special header
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'X-Manual-Retry': 'true' // Special header to indicate manual retry
      },
      body: webhookPayload
    })

    const result = await response.json()

    return new Response(
      JSON.stringify({
        success: response.ok,
        message: response.ok ? 'Event retry initiated' : 'Event retry failed',
        details: result
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (retryError) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to initiate retry',
        error: retryError.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

async function checkAndSendAlerts(supabase: any): Promise<Response> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const alerts = []

  // Check for high failure rate
  const { data: recentEvents, error: recentError } = await supabase
    .from('webhook_events')
    .select('processed')
    .gte('created_at', oneHourAgo)

  if (!recentError && recentEvents.length > 0) {
    const failureRate = (recentEvents.filter((e: any) => !e.processed).length / recentEvents.length) * 100
    
    if (failureRate > 20) { // Alert if failure rate > 20%
      alerts.push({
        type: 'high_failure_rate',
        severity: 'warning',
        message: `Webhook failure rate is ${failureRate.toFixed(1)}% in the last hour`,
        threshold: '20%',
        actual: `${failureRate.toFixed(1)}%`
      })
    }
  }

  // Check for events stuck in DLQ
  const { data: dlqEvents, error: dlqError } = await supabase
    .from('webhook_events')
    .select('count')
    .eq('processed', false)
    .gte('processing_attempts', 3)

  if (!dlqError && dlqEvents.length > 0) {
    alerts.push({
      type: 'dlq_items',
      severity: 'error',
      message: `${dlqEvents.length} webhook events are stuck in dead letter queue`,
      count: dlqEvents.length
    })
  }

  // Check for processing delays
  const { data: oldUnprocessed, error: oldError } = await supabase
    .from('webhook_events')
    .select('count')
    .eq('processed', false)
    .lt('processing_attempts', 3)
    .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // 10 minutes old

  if (!oldError && oldUnprocessed.length > 0) {
    alerts.push({
      type: 'processing_delay',
      severity: 'warning',
      message: `${oldUnprocessed.length} webhook events are delayed in processing`,
      count: oldUnprocessed.length
    })
  }

  // In a real implementation, you would send these alerts to your monitoring system
  // For now, we'll just log them and return the alert data
  if (alerts.length > 0) {
    console.log('WEBHOOK ALERTS:', JSON.stringify(alerts, null, 2))
    
    // Here you could integrate with services like:
    // - Slack webhooks
    // - PagerDuty
    // - Email notifications
    // - Discord webhooks
    // - Custom monitoring dashboards
  }

  return new Response(
    JSON.stringify({
      alertsGenerated: alerts.length,
      alerts: alerts
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}