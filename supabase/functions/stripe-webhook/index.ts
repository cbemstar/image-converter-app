import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { checkRateLimits, getClientIP } from '../_shared/rate-limiter.ts'
import { validateString, validateRequestSize } from '../_shared/input-validator.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Webhook processing configuration
const WEBHOOK_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff in milliseconds
  PROCESSING_TIMEOUT: 30000, // 30 seconds
}

// Webhook event processor interface
interface WebhookProcessor {
  eventType: string
  process: (supabase: any, event: Stripe.Event) => Promise<WebhookResult>
}

interface WebhookResult {
  success: boolean
  message: string
  shouldRetry?: boolean
  metadata?: Record<string, any>
}

// Enhanced logging utility
const logWebhookEvent = async (
  supabase: any,
  eventId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, any>
) => {
  console.log(`[${level.toUpperCase()}] Webhook ${eventId}: ${message}`, metadata || {})
  
  // In production, you might want to send this to a logging service
  // For now, we'll just use console logging with structured format
}

// Process webhook with timeout protection
const processWebhookWithTimeout = async (
  supabase: any,
  stripe: Stripe,
  event: Stripe.Event
): Promise<WebhookResult> => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        message: 'Webhook processing timeout',
        shouldRetry: true
      })
    }, WEBHOOK_CONFIG.PROCESSING_TIMEOUT)

    processWebhookEvent(supabase, stripe, event)
      .then((result) => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeout)
        resolve({
          success: false,
          message: error.message,
          shouldRetry: !error.message.includes('Invalid') && !error.message.includes('Not found')
        })
      })
  })
}

// Main webhook event processor
const processWebhookEvent = async (
  supabase: any,
  stripe: Stripe,
  event: Stripe.Event
): Promise<WebhookResult> => {
  const processors: WebhookProcessor[] = [
    {
      eventType: 'checkout.session.completed',
      process: handleCheckoutCompleted
    },
    {
      eventType: 'customer.subscription.updated',
      process: handleSubscriptionUpdated
    },
    {
      eventType: 'customer.subscription.deleted',
      process: handleSubscriptionDeleted
    },
    {
      eventType: 'invoice.paid',
      process: handleInvoicePaid
    },
    {
      eventType: 'invoice.payment_failed',
      process: handlePaymentFailed
    }
  ]

  const processor = processors.find(p => p.eventType === event.type)
  
  if (!processor) {
    await logWebhookEvent(supabase, event.id, 'info', `Unhandled event type: ${event.type}`)
    return {
      success: true,
      message: `Event type ${event.type} not handled but acknowledged`
    }
  }

  await logWebhookEvent(supabase, event.id, 'info', `Processing ${event.type} event`)
  return await processor.process(supabase, event)
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  let eventId = 'unknown'

  try {
    // Validate request size first
    const sizeValidation = validateRequestSize(req)
    if (!sizeValidation.valid) {
      return new Response(
        JSON.stringify({ error: sizeValidation.errors[0] }),
        { 
          status: 413, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get client IP for rate limiting
    const clientIP = getClientIP(req)

    // Check rate limits for webhook processing
    const rateLimitResult = await checkRateLimits(undefined, clientIP, 'webhook')
    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.backoffSeconds || 60
      return new Response(
        JSON.stringify({
          error: rateLimitResult.reason || 'Rate limit exceeded',
          retry_after: retryAfter
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString()
          }
        }
      )
    }
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    
    if (!stripeSecretKey || !webhookSecret) {
      throw new Error('Missing required Stripe configuration')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check for manual retry header (bypasses signature verification)
    const isManualRetry = req.headers.get('X-Manual-Retry') === 'true'
    
    // Get the signature from headers
    const signature = req.headers.get('stripe-signature')
    if (!signature && !isManualRetry) {
      await logWebhookEvent(supabase, eventId, 'error', 'Missing stripe-signature header')
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the raw body
    const body = await req.text()
    if (!body) {
      await logWebhookEvent(supabase, eventId, 'error', 'Empty request body')
      return new Response(
        JSON.stringify({ error: 'Empty request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate body content
    const bodyValidation = validateString(body, 'request_body', { 
      required: true, 
      maxLength: 1024 * 1024 // 1MB max for webhook body
    })
    if (!bodyValidation.valid) {
      await logWebhookEvent(supabase, eventId, 'error', 'Invalid request body', {
        errors: bodyValidation.errors
      })
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body',
          details: bodyValidation.errors
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the webhook signature or handle manual retry
    let event: Stripe.Event
    try {
      if (isManualRetry) {
        // For manual retries, parse the event directly from the body
        event = JSON.parse(body)
        eventId = event.id
        await logWebhookEvent(supabase, eventId, 'info', 'Manual retry initiated', {
          eventType: event.type,
          created: event.created
        })
      } else {
        // Normal webhook processing with signature verification
        event = stripe.webhooks.constructEvent(body, signature!, webhookSecret)
        eventId = event.id
        await logWebhookEvent(supabase, eventId, 'info', 'Webhook signature verified', {
          eventType: event.type,
          created: event.created
        })
      }
    } catch (err) {
      await logWebhookEvent(supabase, eventId, 'error', 'Webhook signature verification failed', {
        error: err.message,
        signaturePresent: !!signature,
        isManualRetry
      })
      return new Response(
        JSON.stringify({ 
          error: 'Invalid signature or malformed event',
          details: 'Webhook signature verification failed'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Enhanced idempotency check with detailed logging
    const { data: existingEvent, error: checkError } = await supabase
      .from('webhook_events')
      .select('id, processed, processing_attempts, last_error, created_at')
      .eq('stripe_event_id', event.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      await logWebhookEvent(supabase, eventId, 'error', 'Database error during idempotency check', {
        error: checkError.message,
        code: checkError.code
      })
      return new Response(
        JSON.stringify({ error: 'Database error during idempotency check' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (existingEvent) {
      await logWebhookEvent(supabase, eventId, 'info', 'Event already exists', {
        processed: existingEvent.processed,
        attempts: existingEvent.processing_attempts,
        firstSeen: existingEvent.created_at
      })

      if (existingEvent.processed) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Event already processed',
            eventId: event.id,
            processedAt: existingEvent.created_at
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else {
        // Event exists but not processed - this might be a retry
        await logWebhookEvent(supabase, eventId, 'warn', 'Event exists but not processed - attempting retry', {
          attempts: existingEvent.processing_attempts,
          lastError: existingEvent.last_error
        })
      }
    }

    // Record or update the event for tracking
    const eventRecord = {
      stripe_event_id: event.id,
      event_type: event.type,
      processed: false,
      processing_attempts: existingEvent ? existingEvent.processing_attempts + 1 : 1,
      payload: event,
      created_at: new Date().toISOString()
    }

    if (existingEvent) {
      const { error: updateError } = await supabase
        .from('webhook_events')
        .update({
          processing_attempts: eventRecord.processing_attempts,
          payload: event
        })
        .eq('stripe_event_id', event.id)

      if (updateError) {
        await logWebhookEvent(supabase, eventId, 'error', 'Failed to update event record', {
          error: updateError.message
        })
      }
    } else {
      const { error: insertError } = await supabase
        .from('webhook_events')
        .insert(eventRecord)

      if (insertError) {
        await logWebhookEvent(supabase, eventId, 'error', 'Failed to insert event record', {
          error: insertError.message
        })
        return new Response(
          JSON.stringify({ error: 'Failed to record event' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Process the event with timeout and retry logic
    const result = await processWebhookWithTimeout(supabase, stripe, event)
    
    // Mark event as processed if successful
    if (result.success) {
      const { error: markProcessedError } = await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          last_error: null
        })
        .eq('stripe_event_id', event.id)

      if (markProcessedError) {
        await logWebhookEvent(supabase, eventId, 'warn', 'Failed to mark event as processed', {
          error: markProcessedError.message
        })
      }

      await logWebhookEvent(supabase, eventId, 'info', 'Event processed successfully', {
        processingTime: Date.now() - startTime,
        result: result.message
      })
    } else {
      // Record the error
      const { error: recordErrorUpdate } = await supabase
        .from('webhook_events')
        .update({
          last_error: result.message,
          processed: false
        })
        .eq('stripe_event_id', event.id)

      if (recordErrorUpdate) {
        await logWebhookEvent(supabase, eventId, 'warn', 'Failed to record processing error', {
          error: recordErrorUpdate.message
        })
      }

      await logWebhookEvent(supabase, eventId, 'error', 'Event processing failed', {
        processingTime: Date.now() - startTime,
        error: result.message,
        shouldRetry: result.shouldRetry
      })

      // Return appropriate status based on whether retry is recommended
      const statusCode = result.shouldRetry ? 500 : 400
      return new Response(
        JSON.stringify({
          error: result.message,
          eventId: event.id,
          shouldRetry: result.shouldRetry
        }),
        { 
          status: statusCode, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        eventId: event.id,
        processingTime: Date.now() - startTime,
        metadata: result.metadata
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    const processingTime = Date.now() - startTime
    await logWebhookEvent(null, eventId, 'error', 'Unexpected webhook processing error', {
      error: error.message,
      stack: error.stack,
      processingTime
    })

    // Try to record the error in the database if we have the event ID
    if (eventId !== 'unknown') {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        await supabase
          .from('webhook_events')
          .update({
            last_error: `Unexpected error: ${error.message}`,
            processed: false
          })
          .eq('stripe_event_id', eventId)
      } catch (dbError) {
        console.error('Failed to record error in database:', dbError)
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        eventId,
        processingTime
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function handleCheckoutCompleted(supabase: any, event: Stripe.Event): Promise<WebhookResult> {
  const session = event.data.object as Stripe.Checkout.Session
  
  await logWebhookEvent(supabase, event.id, 'info', 'Processing checkout.session.completed', {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription
  })

  if (!session.customer || !session.subscription) {
    throw new Error('Missing customer or subscription in checkout session')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', session.customer)
    .single()

  if (profileError) {
    throw new Error(`Failed to find user profile: ${profileError.message}`)
  }

  // Get subscription details from Stripe
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

  // Determine plan ID from price ID
  const priceId = subscription.items.data[0]?.price.id
  let planId = 'pro' // default
  
  // Get plan from database by stripe_price_id
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, monthly_conversions')
    .eq('stripe_price_id', priceId)
    .single()

  if (plan) {
    planId = plan.id
  } else {
    await logWebhookEvent(supabase, event.id, 'warn', 'Plan not found for price ID, using default', {
      priceId,
      defaultPlan: planId
    })
  }

  // Insert/update subscription record
  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: profile.id,
      plan_id: planId,
      stripe_customer_id: session.customer,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    }, {
      onConflict: 'stripe_subscription_id'
    })

  if (subscriptionError) {
    throw new Error(`Failed to create subscription record: ${subscriptionError.message}`)
  }

  // Update usage record for new plan
  const conversionsLimit = plan?.monthly_conversions || 500 // Default for pro plan
  const { error: usageError } = await supabase
    .from('usage_records')
    .upsert({
      user_id: profile.id,
      period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
      conversions_used: 0,
      conversions_limit: conversionsLimit
    }, {
      onConflict: 'user_id,period_start'
    })

  if (usageError) {
    await logWebhookEvent(supabase, event.id, 'warn', 'Failed to update usage record', {
      error: usageError.message
    })
  }

  await logWebhookEvent(supabase, event.id, 'info', 'Checkout completed successfully', {
    userId: profile.id,
    planId,
    subscriptionId: subscription.id
  })

  return { 
    success: true, 
    message: 'Checkout completed successfully',
    metadata: {
      userId: profile.id,
      planId,
      subscriptionId: subscription.id
    }
  }
}

async function handlePaymentFailed(supabase: any, event: Stripe.Event): Promise<WebhookResult> {
  const invoice = event.data.object as Stripe.Invoice
  
  await logWebhookEvent(supabase, event.id, 'info', 'Processing invoice.payment_failed', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription
  })

  if (!invoice.customer) {
    throw new Error('Missing customer in invoice')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', invoice.customer)
    .single()

  if (profileError) {
    throw new Error(`Failed to find user profile: ${profileError.message}`)
  }

  // Update subscription status to past_due
  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'past_due'
    })
    .eq('user_id', profile.id)
    .eq('stripe_customer_id', invoice.customer)

  if (subscriptionError) {
    throw new Error(`Failed to update subscription status: ${subscriptionError.message}`)
  }

  await logWebhookEvent(supabase, event.id, 'info', 'Payment failed handled successfully', {
    userId: profile.id,
    invoiceId: invoice.id
  })

  return { 
    success: true, 
    message: 'Payment failed handled successfully',
    metadata: {
      userId: profile.id,
      invoiceId: invoice.id,
      status: 'past_due'
    }
  }
}

async function handleSubscriptionUpdated(supabase: any, event: Stripe.Event): Promise<WebhookResult> {
  const subscription = event.data.object as Stripe.Subscription
  
  await logWebhookEvent(supabase, event.id, 'info', 'Processing customer.subscription.updated', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status
  })

  if (!subscription.customer) {
    throw new Error('Missing customer in subscription')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (profileError) {
    throw new Error(`Failed to find user profile: ${profileError.message}`)
  }

  // Determine plan ID from price ID
  const priceId = subscription.items.data[0]?.price.id
  let planId = 'pro' // default
  
  // Get plan from database by stripe_price_id
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, monthly_conversions')
    .eq('stripe_price_id', priceId)
    .single()

  if (plan) {
    planId = plan.id
  } else {
    await logWebhookEvent(supabase, event.id, 'warn', 'Plan not found for price ID, using default', {
      priceId,
      defaultPlan: planId
    })
  }

  // Update subscription record
  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .update({
      plan_id: planId,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end
    })
    .eq('stripe_subscription_id', subscription.id)

  if (subscriptionError) {
    throw new Error(`Failed to update subscription record: ${subscriptionError.message}`)
  }

  // Update usage record if plan changed
  if (plan) {
    const { error: usageError } = await supabase
      .from('usage_records')
      .update({
        conversions_limit: plan.monthly_conversions
      })
      .eq('user_id', profile.id)
      .eq('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])

    if (usageError) {
      await logWebhookEvent(supabase, event.id, 'warn', 'Failed to update usage limit', {
        error: usageError.message
      })
    }
  }

  await logWebhookEvent(supabase, event.id, 'info', 'Subscription updated successfully', {
    userId: profile.id,
    planId,
    status: subscription.status
  })

  return { 
    success: true, 
    message: 'Subscription updated successfully',
    metadata: {
      userId: profile.id,
      planId,
      status: subscription.status,
      subscriptionId: subscription.id
    }
  }
}

async function handleSubscriptionDeleted(supabase: any, event: Stripe.Event): Promise<WebhookResult> {
  const subscription = event.data.object as Stripe.Subscription
  
  await logWebhookEvent(supabase, event.id, 'info', 'Processing customer.subscription.deleted', {
    subscriptionId: subscription.id,
    customerId: subscription.customer
  })

  if (!subscription.customer) {
    throw new Error('Missing customer in subscription')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (profileError) {
    throw new Error(`Failed to find user profile: ${profileError.message}`)
  }

  // Update subscription record status
  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'canceled'
    })
    .eq('stripe_subscription_id', subscription.id)

  if (subscriptionError) {
    throw new Error(`Failed to update subscription record: ${subscriptionError.message}`)
  }

  // Create new subscription to free plan
  const { error: freeSubscriptionError } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: profile.id,
      plan_id: 'free',
      status: 'active'
    })

  if (freeSubscriptionError) {
    await logWebhookEvent(supabase, event.id, 'warn', 'Failed to create free subscription', {
      error: freeSubscriptionError.message
    })
  }

  // Update usage record to free plan limits
  const { error: usageError } = await supabase
    .from('usage_records')
    .update({
      conversions_limit: 10 // Free plan limit
    })
    .eq('user_id', profile.id)
    .eq('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])

  if (usageError) {
    await logWebhookEvent(supabase, event.id, 'warn', 'Failed to update usage limit to free tier', {
      error: usageError.message
    })
  }

  await logWebhookEvent(supabase, event.id, 'info', 'Subscription deleted successfully', {
    userId: profile.id,
    downgradedToFree: true
  })

  return { 
    success: true, 
    message: 'Subscription deleted successfully',
    metadata: {
      userId: profile.id,
      downgradedToFree: true,
      subscriptionId: subscription.id
    }
  }
}

async function handleInvoicePaid(supabase: any, event: Stripe.Event): Promise<WebhookResult> {
  const invoice = event.data.object as Stripe.Invoice
  
  await logWebhookEvent(supabase, event.id, 'info', 'Processing invoice.paid', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription
  })

  if (!invoice.customer) {
    throw new Error('Missing customer in invoice')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', invoice.customer)
    .single()

  if (profileError) {
    throw new Error(`Failed to find user profile: ${profileError.message}`)
  }

  // Update subscription status to active if it was past_due
  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active'
    })
    .eq('user_id', profile.id)
    .eq('stripe_customer_id', invoice.customer)
    .in('status', ['past_due', 'unpaid'])

  if (subscriptionError) {
    await logWebhookEvent(supabase, event.id, 'warn', 'Failed to update subscription status', {
      error: subscriptionError.message
    })
  }

  // If this is a new billing period, reset usage counter
  if (invoice.subscription) {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
    
    const periodStart = new Date(subscription.current_period_start * 1000)
    const periodStartDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1).toISOString().split('T')[0]
    
    // Check if we need to create a new usage record for this period
    const { data: existingUsage } = await supabase
      .from('usage_records')
      .select('id')
      .eq('user_id', profile.id)
      .eq('period_start', periodStartDate)
      .single()

    if (!existingUsage) {
      // Get plan details
      const priceId = subscription.items.data[0]?.price.id
      const { data: plan } = await supabase
        .from('plans')
        .select('monthly_conversions')
        .eq('stripe_price_id', priceId)
        .single()

      const conversionsLimit = plan?.monthly_conversions || 500

      const { error: usageError } = await supabase
        .from('usage_records')
        .insert({
          user_id: profile.id,
          period_start: periodStartDate,
          period_end: new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).toISOString().split('T')[0],
          conversions_used: 0,
          conversions_limit: conversionsLimit
        })

      if (usageError) {
        await logWebhookEvent(supabase, event.id, 'warn', 'Failed to create new usage record', {
          error: usageError.message
        })
      }
    }
  }

  await logWebhookEvent(supabase, event.id, 'info', 'Invoice paid handled successfully', {
    userId: profile.id,
    invoiceId: invoice.id
  })

  return { 
    success: true, 
    message: 'Invoice paid handled successfully',
    metadata: {
      userId: profile.id,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription
    }
  }
}