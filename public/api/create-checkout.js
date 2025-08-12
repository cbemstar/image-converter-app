/**
 * Create Stripe Checkout Session API Endpoint
 * 
 * This endpoint creates Stripe checkout sessions with proper idempotency handling
 * and session ID reconciliation as specified in requirements 3.1 and 3.2
 */

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
  'Access-Control-Max-Age': '86400',
};

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Stripe
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    // Verify user authentication
    const userSupabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse request body
    const {
      plan_id,
      success_url,
      cancel_url,
      allow_promotion_codes = true,
      billing_address_collection = 'auto',
      customer_update = { address: 'auto', name: 'auto' }
    } = req.body;

    if (!plan_id || !success_url || !cancel_url) {
      return res.status(400).json({ 
        error: 'Missing required fields: plan_id, success_url, cancel_url' 
      });
    }

    // Get plan details from database
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, name, stripe_price_id, price_cents')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }

    if (!plan.stripe_price_id) {
      return res.status(400).json({ error: 'Plan does not have Stripe price configured' });
    }

    // Get user profile with Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Ensure user has Stripe customer ID
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: profile.email || user.email,
        name: user.user_metadata?.full_name || profile.email?.split('@')[0],
        metadata: {
          user_id: user.id,
          created_via: 'checkout-api'
        }
      }, {
        idempotencyKey: `customer-${user.id}-${Date.now()}`
      });

      customerId = customer.id;

      // Update profile with customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Get idempotency key from header or generate one
    const idempotencyKey = req.headers['x-idempotency-key'] || 
      `checkout-${user.id}-${plan_id}-${Date.now()}`;

    // Create checkout session with session ID reconciliation
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Use Stripe's {CHECKOUT_SESSION_ID} placeholder for state reconciliation
      success_url: `${success_url}${success_url.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}&success=true&plan=${plan_id}`,
      cancel_url: `${cancel_url}${cancel_url.includes('?') ? '&' : '?'}canceled=true&plan=${plan_id}`,
      allow_promotion_codes: allow_promotion_codes,
      billing_address_collection: billing_address_collection,
      customer_update: customer_update,
      // Enable automatic tax calculation if configured
      automatic_tax: {
        enabled: true,
      },
      // Add subscription metadata
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
          created_via: 'checkout-api'
        }
      },
      // Add session metadata
      metadata: {
        user_id: user.id,
        plan_id: plan_id,
        created_at: new Date().toISOString(),
        created_via: 'checkout-api'
      }
    }, {
      idempotencyKey: idempotencyKey
    });

    // Log checkout session creation
    console.log(`Checkout session created: ${session.id} for user ${user.id}, plan ${plan_id}`);

    // Return session details
    res.status(200).json({
      session_id: session.id,
      url: session.url,
      plan: {
        id: plan.id,
        name: plan.name,
        price_cents: plan.price_cents
      },
      customer_id: customerId,
      idempotency_key: idempotencyKey
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    
    // Handle Stripe errors specifically
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        error: 'Card error',
        details: error.message 
      });
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid request',
        details: error.message 
      });
    }
    
    if (error.type === 'StripeAPIError') {
      return res.status(500).json({ 
        error: 'Stripe API error',
        details: 'Payment processing temporarily unavailable' 
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
};