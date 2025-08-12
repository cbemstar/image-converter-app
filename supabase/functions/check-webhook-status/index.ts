import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify user authentication
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { session_id } = await req.json()

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check for processed webhook events related to this session
    const { data: webhookEvents, error: webhookError } = await supabase
      .from('webhook_events')
      .select('id, event_type, processed, created_at')
      .eq('processed', true)
      .like('payload->object->id', `%${session_id}%`)
      .order('created_at', { ascending: false })
      .limit(5)

    if (webhookError) {
      throw webhookError
    }

    // Check if checkout.session.completed event was processed
    const checkoutCompleted = webhookEvents?.find(event => 
      event.event_type === 'checkout.session.completed'
    )

    // Also check user's subscription status as additional verification
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id, status, stripe_subscription_id, updated_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    // Consider processed if we have either:
    // 1. A processed checkout.session.completed webhook, OR
    // 2. An active subscription that was recently updated (within last 5 minutes)
    const recentlyUpdated = subscription && 
      new Date(subscription.updated_at) > new Date(Date.now() - 5 * 60 * 1000)

    const processed = Boolean(checkoutCompleted || recentlyUpdated)

    return new Response(
      JSON.stringify({
        processed,
        webhook_events: webhookEvents?.length || 0,
        checkout_completed: Boolean(checkoutCompleted),
        active_subscription: Boolean(subscription),
        recently_updated: Boolean(recentlyUpdated)
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Check webhook status error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})