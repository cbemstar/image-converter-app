# Supabase Setup Guide

This guide will help you set up Supabase for the image converter app with CMS integration.

## Prerequisites

1. Node.js (v18 or higher)
2. npm or yarn
3. Supabase CLI
4. Stripe account (for payments)

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

## Step 2: Create Supabase Project

### Option A: Using Supabase Dashboard (Recommended for Production)

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up/login to your account
3. Click "New Project"
4. Choose your organization
5. Fill in project details:
   - Name: `image-converter-app`
   - Database Password: (generate a strong password)
   - Region: (choose closest to your users)
6. Click "Create new project"
7. Wait for the project to be created (2-3 minutes)

### Option B: Local Development Setup

```bash
# Initialize Supabase in your project
cd MAIN-image-converter-app
supabase init

# Start local Supabase services
supabase start
```

## Step 3: Configure Environment Variables

### For Production (Supabase Dashboard)

1. Go to your project dashboard
2. Navigate to Settings > API
3. Copy the following values:
   - Project URL
   - Project API keys (anon/public and service_role)

### For Local Development

After running `supabase start`, you'll see output like:
```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
JWT secret: your-jwt-secret
anon key: your-anon-key
service_role key: your-service-role-key
```

### Create Environment File

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key

# Stripe Configuration (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_your-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Plan Limits (already configured)
FREE_LIMIT_STORAGE=52428800
FREE_LIMIT_CONVERSIONS=500
FREE_LIMIT_API_CALLS=5000
FREE_LIMIT_MAX_FILE_SIZE=26214400

PRO_LIMIT_STORAGE=2147483648
PRO_LIMIT_CONVERSIONS=5000
PRO_LIMIT_API_CALLS=50000
PRO_LIMIT_MAX_FILE_SIZE=104857600

AGENCY_LIMIT_STORAGE=21474836480
AGENCY_LIMIT_CONVERSIONS=50000
AGENCY_LIMIT_API_CALLS=500000
AGENCY_LIMIT_MAX_FILE_SIZE=262144000
```

Generate the runtime configuration files (do not commit the output):

```bash
npm run build:config
```

This creates `js/supabase-config.js` and `js/public-config.js`, the sole
sources of Supabase runtime credentials. The frontend client
(`js/supabase-client.js`) reads the configuration from these files at
runtime.

## Step 4: Run Database Migrations

### For Production
```bash
# Link to your remote project
supabase link --project-ref your-project-ref

# Push migrations to remote database
supabase db push
```

### For Local Development
```bash
# Reset and apply migrations
supabase db reset

# Or apply migrations to running local instance
supabase migration up
```

## Step 5: Set up Authentication Providers

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client IDs
5. Set authorized redirect URIs:
   - Production: `https://your-project.supabase.co/auth/v1/callback`
   - Local: `http://127.0.0.1:54321/auth/v1/callback`
6. Copy Client ID and Client Secret
7. In Supabase Dashboard:
   - Go to Authentication > Providers
   - Enable Google provider
   - Add your Client ID and Client Secret

### GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in details:
   - Application name: `Image Converter App`
   - Homepage URL: `https://your-domain.com`
   - Authorization callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret
5. In Supabase Dashboard:
   - Go to Authentication > Providers
   - Enable GitHub provider
   - Add your Client ID and Client Secret

## Step 6: Deploy Edge Functions

### For Production
```bash
# Deploy quota-check function
supabase functions deploy quota-check

# Deploy stripe-webhook function
supabase functions deploy stripe-webhook
```

### For Local Development
```bash
# Functions are automatically available when running locally
# Access them at:
# http://127.0.0.1:54321/functions/v1/quota-check
# http://127.0.0.1:54321/functions/v1/stripe-webhook
```

## Step 7: Configure Stripe

### Create Products and Prices

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to Products
3. Create two products:

**Pro Plan:**
- Name: "Pro Plan"
- Price: $9/month
- Copy the Price ID (starts with `price_`)

**Agency Plan:**
- Name: "Agency Plan"  
- Price: $49/month
- Copy the Price ID (starts with `price_`)

### Update Price IDs

Edit `supabase/functions/stripe-webhook/index.ts` and update the price mapping:

```typescript
const priceIdToPlan: Record<string, string> = {
  'price_1234567890': 'pro',     // Replace with your actual Pro price ID
  'price_0987654321': 'agency'   // Replace with your actual Agency price ID
}
```

### Set up Webhook Endpoint

1. In Stripe Dashboard, go to Developers > Webhooks
2. Click "Add endpoint"
3. Set endpoint URL:
   - Production: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Local: Use ngrok or similar to expose local endpoint
4. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the webhook signing secret
6. Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

## Step 8: Configure Storage

### Create Storage Bucket

The migration includes a seed file that creates the storage bucket, but you can also create it manually:

1. In Supabase Dashboard, go to Storage
2. Create a new bucket named `user-files`
3. Set it to private (not public)
4. Configure file size limits and allowed MIME types as needed

### Storage Policies

The RLS policies for storage are created automatically by the seed file. They ensure users can only access their own files.

## Step 9: Test the Setup

### Local Testing

1. Start the local development server:
```bash
supabase start
```

2. Open Supabase Studio: `http://127.0.0.1:54323`
3. Check that all tables are created
4. Test authentication by creating a test user
5. Test file upload to storage
6. Test Edge Functions using the Functions tab in Studio

### Production Testing

1. Deploy your application to Vercel or your hosting platform
2. Test user registration and login
3. Test file uploads
4. Test Stripe payment flow (use test mode)
5. Check webhook delivery in Stripe Dashboard

## Step 10: Monitoring and Maintenance

### Set up Monitoring

1. In Supabase Dashboard, go to Settings > Billing
2. Set up usage alerts for:
   - Database size
   - API requests
   - Storage usage
   - Bandwidth

### Regular Maintenance

The system includes automatic cleanup via the nightly cron job that:
- Removes analytics data older than 90 days
- Optimizes database performance
- Cleans up orphaned files

## Troubleshooting

### Common Issues

1. **Migration fails**: Check your database permissions and connection
2. **Auth not working**: Verify OAuth provider configuration
3. **Edge Functions timeout**: Ensure functions complete within 10 seconds
4. **Storage uploads fail**: Check RLS policies and bucket configuration
5. **Stripe webhooks fail**: Verify webhook secret and endpoint URL

### Debug Commands

```bash
# Check Supabase status
supabase status

# View logs
supabase logs

# Reset local database
supabase db reset

# Check function logs
supabase functions logs quota-check
supabase functions logs stripe-webhook
```

### Getting Help

- Supabase Documentation: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Stripe Documentation: https://stripe.com/docs

## Security Checklist

- [ ] Environment variables are properly set
- [ ] RLS policies are enabled on all tables
- [ ] Storage bucket is private with proper policies
- [ ] Stripe webhook endpoints are secured
- [ ] OAuth providers are configured with correct redirect URIs
- [ ] Database passwords are strong and secure
- [ ] API keys are not exposed in client-side code

## Next Steps

After completing this setup:

1. Test all functionality thoroughly
2. Set up monitoring and alerts
3. Configure backup strategies
4. Plan for scaling if needed
5. Document any custom configurations
6. Set up CI/CD for database migrations

Your Supabase integration is now ready for the image converter app!