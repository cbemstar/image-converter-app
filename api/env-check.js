// api/env-check.js
module.exports = async (req, res) => {
  res.json({
    HAS_SUPABASE_URL: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    HAS_SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    HAS_STRIPE_PUBLISHABLE: Boolean(process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    HAS_STRIPE_SECRET: Boolean(process.env.STRIPE_SECRET_KEY),
    HAS_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET)
  });
};

