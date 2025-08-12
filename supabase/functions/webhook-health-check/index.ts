import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthCheckResult {
  timestamp: string
  overallHealth: 'healthy' | 'warning' | 'critical'
  metrics: {
    successRate24h: number
    avgProcessingTime: number
    dlqCount: number
    unprocessedCount: number
  }
  alerts: Array<{
    type: string
    severity: 'info' | 'warning' | 'error' | 'critical'
    message: string
    count?: number
    threshold?: string
    actual?: string
  }>
  recommendations: string[]
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

    const healthCheck = await performHealthCheck(supabase)

    // Send alerts if there are critical issues
    if (healthCheck.overallHealth === 'critical') {
      await sendCriticalAlert(healthCheck)
    }

    return new Response(
      JSON.stringify(healthCheck),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Health check error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Health check failed',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function performHealthCheck(supabase: any): Promise<HealthCheckResult> {
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const alerts = []
  const recommendations = []
  let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy'

  // Get 24-hour metrics
  const { data: events24h, error: events24hError } = await supabase
    .from('webhook_events')
    .select('processed, processing_attempts, created_at, processed_at')
    .gte('created_at', twentyFourHoursAgo.toISOString())

  if (events24hError) {
    throw new Error(`Failed to fetch 24h events: ${events24hError.message}`)
  }

  const totalEvents24h = events24h.length
  const processedEvents24h = events24h.filter((e: any) => e.processed).length
  const successRate24h = totalEvents24h > 0 ? (processedEvents24h / totalEvents24h) * 100 : 100

  // Calculate average processing time (simplified)
  const processedWithTiming = events24h.filter((e: any) => e.processed && e.processed_at)
  const avgProcessingTime = processedWithTiming.length > 0 
    ? processedWithTiming.reduce((sum: number, e: any) => {
        const processingTime = new Date(e.processed_at).getTime() - new Date(e.created_at).getTime()
        return sum + processingTime
      }, 0) / processedWithTiming.length
    : 0

  // Get DLQ count (failed 3+ times)
  const { data: dlqEvents, error: dlqError } = await supabase
    .from('webhook_events')
    .select('count')
    .eq('processed', false)
    .gte('processing_attempts', 3)

  const dlqCount = dlqError ? 0 : dlqEvents.length

  // Get unprocessed count (still retrying)
  const { data: unprocessedEvents, error: unprocessedError } = await supabase
    .from('webhook_events')
    .select('count')
    .eq('processed', false)
    .lt('processing_attempts', 3)

  const unprocessedCount = unprocessedError ? 0 : unprocessedEvents.length

  // Health checks and alerts
  
  // 1. Success rate check
  if (successRate24h < 95) {
    const severity = successRate24h < 80 ? 'critical' : 'warning'
    overallHealth = severity === 'critical' ? 'critical' : (overallHealth === 'healthy' ? 'warning' : overallHealth)
    
    alerts.push({
      type: 'low_success_rate',
      severity,
      message: `Webhook success rate is ${successRate24h.toFixed(1)}% (last 24h)`,
      threshold: '95%',
      actual: `${successRate24h.toFixed(1)}%`
    })

    recommendations.push('Investigate recent webhook failures and check Stripe webhook configuration')
  }

  // 2. DLQ check
  if (dlqCount > 0) {
    const severity = dlqCount > 10 ? 'critical' : 'error'
    overallHealth = severity === 'critical' ? 'critical' : (overallHealth === 'healthy' ? 'warning' : overallHealth)
    
    alerts.push({
      type: 'dlq_items',
      severity,
      message: `${dlqCount} webhook events are in dead letter queue`,
      count: dlqCount
    })

    recommendations.push('Review and manually retry failed webhook events in the DLQ')
  }

  // 3. Processing delay check
  if (unprocessedCount > 5) {
    const severity = unprocessedCount > 20 ? 'critical' : 'warning'
    overallHealth = severity === 'critical' ? 'critical' : (overallHealth === 'healthy' ? 'warning' : overallHealth)
    
    alerts.push({
      type: 'processing_backlog',
      severity,
      message: `${unprocessedCount} webhook events are pending processing`,
      count: unprocessedCount
    })

    recommendations.push('Check Edge Function performance and consider scaling webhook processing')
  }

  // 4. Processing time check
  if (avgProcessingTime > 10000) { // 10 seconds
    const severity = avgProcessingTime > 20000 ? 'warning' : 'info'
    overallHealth = overallHealth === 'healthy' && severity === 'warning' ? 'warning' : overallHealth
    
    alerts.push({
      type: 'slow_processing',
      severity,
      message: `Average webhook processing time is ${(avgProcessingTime / 1000).toFixed(1)}s`,
      threshold: '10s',
      actual: `${(avgProcessingTime / 1000).toFixed(1)}s`
    })

    recommendations.push('Optimize webhook processing logic and database queries')
  }

  // 5. Recent activity check
  const { data: recentEvents, error: recentError } = await supabase
    .from('webhook_events')
    .select('count')
    .gte('created_at', oneHourAgo.toISOString())

  const recentCount = recentError ? 0 : recentEvents.length

  if (recentCount === 0 && totalEvents24h > 0) {
    alerts.push({
      type: 'no_recent_activity',
      severity: 'warning',
      message: 'No webhook events received in the last hour',
      count: 0
    })

    recommendations.push('Verify Stripe webhook endpoint configuration and connectivity')
  }

  return {
    timestamp: now.toISOString(),
    overallHealth,
    metrics: {
      successRate24h: Math.round(successRate24h * 100) / 100,
      avgProcessingTime: Math.round(avgProcessingTime),
      dlqCount,
      unprocessedCount
    },
    alerts,
    recommendations
  }
}

async function sendCriticalAlert(healthCheck: HealthCheckResult): Promise<void> {
  // In a real implementation, you would send alerts to your monitoring system
  // Examples of integrations you could add:

  console.error('CRITICAL WEBHOOK HEALTH ALERT:', JSON.stringify(healthCheck, null, 2))

  // Slack webhook example:
  /*
  const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  if (slackWebhookUrl) {
    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Critical Webhook Health Alert`,
        attachments: [{
          color: 'danger',
          fields: [
            {
              title: 'Success Rate (24h)',
              value: `${healthCheck.metrics.successRate24h}%`,
              short: true
            },
            {
              title: 'DLQ Count',
              value: healthCheck.metrics.dlqCount.toString(),
              short: true
            },
            {
              title: 'Critical Issues',
              value: healthCheck.alerts
                .filter(a => a.severity === 'critical')
                .map(a => a.message)
                .join('\n'),
              short: false
            }
          ]
        }]
      })
    })
  }
  */

  // PagerDuty integration example:
  /*
  const pagerDutyIntegrationKey = Deno.env.get('PAGERDUTY_INTEGRATION_KEY')
  if (pagerDutyIntegrationKey) {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: pagerDutyIntegrationKey,
        event_action: 'trigger',
        payload: {
          summary: 'Critical Webhook Health Issues Detected',
          severity: 'critical',
          source: 'webhook-health-check',
          custom_details: healthCheck
        }
      })
    })
  }
  */

  // Email notification example:
  /*
  const emailApiKey = Deno.env.get('EMAIL_API_KEY')
  const alertEmail = Deno.env.get('ALERT_EMAIL')
  if (emailApiKey && alertEmail) {
    // Use your preferred email service (SendGrid, Mailgun, etc.)
  }
  */
}