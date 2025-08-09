# Authentication Troubleshooting Guide

## Current Issues and Solutions

### 1. Environment Variables in Vercel

Make sure these environment variables are set in your Vercel project settings:

```
SUPABASE_URL=https://flsgsnupfogaphqdrtqi.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2dzbnVwZm9nYXBocWRydHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDU1ODAsImV4cCI6MjA2ODQ4MTU4MH0.tIeLTN7LT9rtKnnPHb18pi4S_jrN0DUZaB0HDhDcyEw
STRIPE_PUBLISHABLE_KEY=pk_live_51LTgh8BcmaVSn6Z1nQkl0Xc2lFlcaFvaBabebmyJr4fWmZqVk37uI2JBUoY9otwUVqmN2Xol9ZOdcjOdcy8MqHbS00QLT2xZxw
```

### 2. Supabase Configuration

In your Supabase project dashboard, check these settings:

#### Authentication Settings:
- Go to Authentication > Settings
- **Site URL**: Set to your production domain (e.g., `https://your-domain.vercel.app`)
- **Redirect URLs**: Add these URLs:
  ```
  https://your-domain.vercel.app/auth.html
  https://your-domain.vercel.app/index.html
  https://your-domain.vercel.app/
  http://localhost:3000/auth.html (for local development)
  http://localhost:5173/auth.html (for local development)
  ```

#### OAuth Providers:
1. **Google OAuth**:
   - Enable Google provider
   - Client ID: `426371779829-f91h1pvmbhge2pslohu23n4klqkv5j5g.apps.googleusercontent.com`
   - Client Secret: (You need to add this in Supabase dashboard)
   - Redirect URL: `https://flsgsnupfogaphqdrtqi.supabase.co/auth/v1/callback`

2. **GitHub OAuth**:
   - Enable GitHub provider
   - Client ID: `Ov23limZxZIpu9wUhbSm`
   - Client Secret: (You need to add this in Supabase dashboard)
   - Redirect URL: `https://flsgsnupfogaphqdrtqi.supabase.co/auth/v1/callback`

### 3. Google OAuth Configuration

In your Google Cloud Console:
1. Go to APIs & Credentials
2. Find your OAuth 2.0 Client ID
3. Add these to **Authorized redirect URIs**:
   ```
   https://flsgsnupfogaphqdrtqi.supabase.co/auth/v1/callback
   ```
4. Add these to **Authorized JavaScript origins**:
   ```
   https://your-domain.vercel.app
   https://flsgsnupfogaphqdrtqi.supabase.co
   ```

### 4. GitHub OAuth Configuration

In your GitHub App settings:
1. Go to Settings > Developer settings > OAuth Apps
2. Find your app with Client ID `Ov23limZxZIpu9wUhbSm`
3. Set **Authorization callback URL** to:
   ```
   https://flsgsnupfogaphqdrtqi.supabase.co/auth/v1/callback
   ```

### 5. Build Process

The app uses a build script to generate configuration. Make sure:
1. `npm run build` is set as the build command in Vercel
2. The build script runs `npm run generate:public-config`
3. This generates `js/public-config.js` with environment variables

### 6. Common Issues and Fixes

#### Issue: "Invalid login credentials"
- Check if the user exists in Supabase Auth dashboard
- Verify email/password are correct
- Check if email confirmation is required

#### Issue: "OAuth provider error"
- Verify OAuth provider is enabled in Supabase
- Check redirect URLs are correctly configured
- Ensure client secrets are set in Supabase dashboard

#### Issue: "CORS error"
- Add your domain to Supabase CORS settings
- Check Site URL in Supabase Auth settings

#### Issue: "Configuration not loaded"
- Verify environment variables are set in Vercel
- Check that build script runs successfully
- Ensure `js/public-config.js` is generated

### 7. Testing Steps

1. **Local Testing**:
   ```bash
   # Test configuration generation
   npm run generate:public-config
   
   # Open test-auth.html in browser
   open test-auth.html
   ```

2. **Production Testing**:
   - Deploy to Vercel
   - Check browser console for errors
   - Test sign in with email/password
   - Test OAuth providers

### 8. Debug Information

Add this to any page to debug auth issues:
```javascript
console.log('Auth Debug:', {
  publicEnv: !!window.PUBLIC_ENV,
  supabase: !!window.supabase,
  authManager: !!window.authManager,
  config: window.PUBLIC_ENV
});
```

### 9. Next Steps

1. ✅ Environment variables added to Vercel
2. ⏳ Configure Supabase redirect URLs
3. ⏳ Configure OAuth providers
4. ⏳ Test authentication flow
5. ⏳ Deploy and verify production

## Quick Fix Checklist

- [ ] Environment variables set in Vercel
- [ ] Supabase Site URL configured
- [ ] Supabase Redirect URLs added
- [ ] Google OAuth redirect URIs configured
- [ ] GitHub OAuth callback URL configured
- [ ] Build command set to `npm run build`
- [ ] Test authentication locally
- [ ] Deploy and test in production