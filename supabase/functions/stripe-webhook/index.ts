import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the signature from headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
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

    // Verify the webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check for idempotency - ensure we don't process the same event twice
    const { data: existingEvent, error: checkError } = await supabase
      .from('stripe_events')
      .select('id')
      .eq('event_id', event.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking event idempotency:', checkError)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (existingEvent) {
      console.log('Event already processed:', event.id)
      return new Response(
        JSON.stringify({ success: true, message: 'Event already processed' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Record the event to prevent duplicate processing
    const { error: recordError } = await supabase
      .from('stripe_events')
      .insert({
        event_id: event.id,
        event_type: event.type
      })

    if (recordError) {
      console.error('Error recording event:', recordError)
      return new Response(
        JSON.stringify({ error: 'Failed to record event' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Process the event based on type
    let result
    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(supabase, event)
        break
      case 'invoice.payment_failed':
        result = await handlePaymentFailed(supabase, event)
        break
      case 'customer.subscription.updated':
        result = await handleSubscriptionUpdated(supabase, event)
        break
      case 'customer.subscription.deleted':
        result = await handleSubscriptionDeleted(supabase, event)
        break
      default:
        console.log('Unhandled event type:', event.type)
        result = { success: true, message: 'Event type not handled' }
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function handleCheckoutCompleted(supabase: any, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  
  if (!session.customer || !session.subscription) {
    throw new Error('Missing customer or subscription in checkout session')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
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

  // Determine plan type from price ID
  const priceId = subscription.items.data[0]?.price.id
  let planType = 'pro' // default
  
  // Map price IDs to plan types (update these with your actual Stripe price IDs)
  const priceIdToPlan: Record<string, string> = {
    'price_1234567890': 'pro',     // Replace with your actual Pro price ID
    'price_0987654321': 'agency',  // Replace with your actual Agency price ID
    'price_pro_monthly': 'pro',    // Fallback naming
    'price_agency_monthly': 'agency' // Fallback naming
  }
  
  if (priceId && priceIdToPlan[priceId]) {
    planType = priceIdToPlan[priceId]
  }

  // Insert/update subscription record
  const { error: subscriptionError } = await supabase
    .from('payment_subscriptions')
    .upsert({
      user_id: profile.id,
      stripe_subscription_id: subscription.id,
      plan_type: planType,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    }, {
      onConflict: 'stripe_subscription_id'
    })

  if (subscriptionError) {
    throw new Error(`Failed to create subscription record: ${subscriptionError.message}`)
  }

  // Update user profile with new plan
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      subscription_plan: planType,
      subscription_status: 'active'
    })
    .eq('id', profile.id)

  if (updateError) {
    throw new Error(`Failed to update user profile: ${updateError.message}`)
  }

  return { success: true, message: 'Checkout completed successfully' }
}

async function handlePaymentFailed(supabase: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  
  if (!invoice.customer) {
    throw new Error('Missing customer in invoice')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', invoice.customer)
    .single()

  if (profileError) {
    throw new Error(`Failed to find user profile: ${profileError.message}`)
  }

  // Update user profile status to past_due
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'past_due'
    })
    .eq('id', profile.id)

  if (updateError) {
    throw new Error(`Failed to update user profile: ${updateError.message}`)
  }

  return { success: true, message: 'Payment failed handled successfully' }
}

async function handleSubscriptionUpdated(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  
  if (!subscription.customer) {
    throw new Error('Missing customer in subscription')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (profileError) {
    throw new Error(`Failed to find user profile: ${profileError.message}`)
  }

  // Determine plan type from price ID
  const priceId = subscription.items.data[0]?.price.id
  let planType = 'pro' // default
  
  const priceIdToPlan: Record<string, string> = {
    'price_1234567890': 'pro',     // Replace with your actual Pro price ID
    'price_0987654321': 'agency',  // Replace with your actual Agency price ID
    'price_pro_monthly': 'pro',    // Fallback naming
    'price_agency_monthly': 'agency' // Fallback naming
  }
  
  if (priceId && priceIdToPlan[priceId]) {
    planType = priceIdToPlan[priceId]
  }

  // Update subscription record
  const { error: subscriptionError } = await supabase
    .from('payment_subscriptions')
    .update({
      plan_type: planType,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (subscriptionError) {
    throw new Error(`Failed to update subscription record: ${subscriptionError.message}`)
  }

  // Update user profile
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      subscription_plan: planType,
      subscription_status: subscription.status === 'active' ? 'active' : subscription.status
    })
    .eq('id', profile.id)

  if (updateError) {
    throw new Error(`Failed to update user profile: ${updateError.message}`)
  }

  return { success: true, message: 'Subscription updated successfully' }
}

async function handleSubscriptionDeleted(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  
  if (!subscription.customer) {
    throw new Error('Missing customer in subscription')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (profileError) {
    throw new Error(`Failed to find user profile: ${profileError.message}`)
  }

  // Update subscription record status
  const { error: subscriptionError } = await supabase
    .from('payment_subscriptions')
    .update({
      status: 'canceled'
    })
    .eq('stripe_subscription_id', subscription.id)

  if (subscriptionError) {
    throw new Error(`Failed to update subscription record: ${subscriptionError.message}`)
  }

  // Downgrade user to free plan
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      subscription_plan: 'free',
      subscription_status: 'active'
    })
    .eq('id', profile.id)

  if (updateError) {
    throw new Error(`Failed to update user profile: ${updateError.message}`)
  }

  return { success: true, message: 'Subscription deleted successfully' }
}