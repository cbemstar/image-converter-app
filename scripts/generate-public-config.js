// scripts/generate-public-config.js
const fs = require('fs');
const path = require('path');

// Only PUBLIC values (safe for browser):
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY })) {
  if (!v) {
    console.error(`[build] Missing ${k} in environment. Set it in Vercel.`);
    process.exit(1);
  }
}

// Create both js and public/js directories
fs.mkdirSync('js', { recursive: true });
fs.mkdirSync('public/js', { recursive: true });

const out = `window.PUBLIC_ENV=${JSON.stringify({
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  STRIPE_PUBLISHABLE_KEY: STRIPE_PUBLISHABLE_KEY || null
})};`;

// Write to both locations
fs.writeFileSync(path.join('js', 'public-config.js'), out);
fs.writeFileSync(path.join('public', 'js', 'public-config.js'), out);
console.log('[build] Wrote js/public-config.js and public/js/public-config.js');

