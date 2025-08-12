import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

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
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { user_id, email, name } = await req.json()

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, email' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if customer already exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError
    }

    if (existingProfile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ 
          customer_id: existingProfile.stripe_customer_id,
          message: 'Customer already exists'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: email,
      name: name || email.split('@')[0],
      metadata: {
        user_id: user_id
      }
    })

    // Update user profile with Stripe customer ID
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      // Don't throw here as the customer was created successfully
    }

    return new Response(
      JSON.stringify({ 
        customer_id: customer.id,
        message: 'Customer created successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Create customer error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})