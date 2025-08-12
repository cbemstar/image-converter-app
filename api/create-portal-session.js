/**
 * Create Stripe Customer Portal Session API Endpoint
 * 
 * This endpoint creates Stripe Customer Portal sessions with proper idempotency handling
 * and return URL configuration as specified in requirements 4.1, 4.2, 4.6, and 4.7
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
      return_url,
      flow_data = {}
    } = req.body;

    if (!return_url) {
      return res.status(400).json({ 
        error: 'Missing required field: return_url' 
      });
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

    if (!profile.stripe_customer_id) {
      return res.status(400).json({ 
        error: 'User does not have a Stripe customer ID. Please complete a purchase first.' 
      });
    }

    // Verify customer has active subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id, status, stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ 
        error: 'No active subscription found. Customer Portal requires an active subscription.' 
      });
    }

    // Get idempotency key from header or generate one
    const idempotencyKey = req.headers['x-idempotency-key'] || 
      `portal-${user.id}-${Date.now()}`;

    // Configure return URL with portal status parameter
    const configuredReturnUrl = `${return_url}${return_url.includes('?') ? '&' : '?'}portal=updated&timestamp=${Date.now()}`;

    // Create Customer Portal session with return URL configuration
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: configuredReturnUrl,
      // Configure what features are available in the portal
      flow_data: {
        type: 'subscription_update_confirm',
        after_completion: {
          type: 'redirect',
          redirect: {
            return_url: configuredReturnUrl
          }
        },
        ...flow_data
      }
    }, {
      idempotencyKey: idempotencyKey
    });

    // Log portal session creation
    console.log(`Customer Portal session created: ${portalSession.id} for user ${user.id}`);

    // Return session details
    res.status(200).json({
      portal_url: portalSession.url,
      session_id: portalSession.id,
      customer_id: profile.stripe_customer_id,
      return_url: configuredReturnUrl,
      idempotency_key: idempotencyKey,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        stripe_subscription_id: subscription.stripe_subscription_id
      }
    });

  } catch (error) {
    console.error('Create portal session error:', error);
    
    // Handle Stripe errors specifically
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid request',
        details: error.message 
      });
    }
    
    if (error.type === 'StripeAPIError') {
      return res.status(500).json({ 
        error: 'Stripe API error',
        details: 'Customer Portal temporarily unavailable' 
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
};