/**
 * Environment Configuration for Frontend
 * This file loads API keys securely for client-side use
 * 
 * IMPORTANT: Only put PUBLIC keys here (like Supabase anon key and Stripe publishable key)
 * NEVER put secret keys in frontend code
 */

// Supabase Configuration (Frontend Safe)
window.SUPABASE_CONFIG = {
  SUPABASE_URL: 'https://flsgsnupfogaphqdrtqi.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2dzbnVwZm9nYXBocWRydHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDU1ODAsImV4cCI6MjA2ODQ4MTU4MH0.tIeLTN7LT9rtKnnPHb18pi4S_jrN0DUZaB0HDhDcyEw'
};

// Stripe Configuration (Frontend Safe - Only Publishable Key)
window.STRIPE_CONFIG = {
  STRIPE_PUBLISHABLE_KEY: 'pk_live_51LTgh8BcmaVSn6Z1nQkl0Xc2lFlcaFvaBabebmyJr4fWmZqVk37uI2JBUoY9otwUVqmN2Xol9ZOdcjOdcy8MqHbS00QLT2xZxw' // Replace with your actual Stripe publishable key
};

// OAuth Configuration (if using GitHub/Google auth)
window.OAUTH_CONFIG = {
  // These would be set in your Supabase config.toml file
  GITHUB_CLIENT_ID: 'Ov23limZxZIpu9wUhbSm', // Replace if using GitHub auth
  GOOGLE_CLIENT_ID: '426371779829-f91h1pvmbhge2pslohu23n4klqkv5j5g.apps.googleusercontent.com'  // Replace if using Google auth
};

console.log('Environment configuration loaded');