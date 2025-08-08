# Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Supabase Configuration](#supabase-configuration)
4. [Stripe Configuration](#stripe-configuration)
5. [Vercel Deployment](#vercel-deployment)
6. [Environment Variables](#environment-variables)
7. [Database Migration](#database-migration)
8. [Edge Functions Deployment](#edge-functions-deployment)
9. [DNS and Domain Setup](#dns-and-domain-setup)
10. [Production Checklist](#production-checklist)
11. [Rollback Procedures](#rollback-procedures)
12. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

### Required Accounts
- **GitHub Account**: For code repository and version control
- **Vercel Account**: For frontend hosting and serverless functions
- **Supabase Account**: For backend services (database, auth, storage)
- **Stripe Account**: For payment processing
- **Domain Registrar**: For custom domain (optional)

### Development Tools
- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher
- **Git**: Latest version
- **Supabase CLI**: For database management
- **Vercel CLI**: For deployment management (optional)

### System Requirements
- **Operating System**: macOS, Linux, or Windows with WSL
- **Memory**: Minimum 4GB RAM
- **Storage**: At least 1GB free space
- **Network**: Stable internet connection

## Environment Setup

### Local Development Setup

1. **Clone Repository**
```bash
git clone https://github.com/your-username/image-converter-app.git
cd image-converter-app
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.local.example .env.local
# Edit .env.local with your configuration values
```

4. **Verify Setup**
```bash
# Test local development server
python -m http.server 8000
# or
npx serve .
```

### Project Structure Verification

Ensure your project has the following structure:
```
MAIN-image-converter-app/
├── api/
│   └── cron/
│       └── cleanup.js
├── js/
│   ├── auth-manager.js
│   ├── quota-manager.js
│   ├── dashboard.js
│   └── [other modules]
├── supabase/
│   ├── functions/
│   │   ├── quota-check/
│   │   └── stripe-webhook/
│   └── migrations/
├── docs/
├── tools/
├── styles/
├── package.json
├── vercel.json
└── .env.local.example
```

## Supabase Configuration

### 1. Create Supabase Project

1. **Sign Up/Login**: Go to [supabase.com](https://supabase.com)
2. **New Project**: Click "New Project"
3. **Project Details**:
   - Name: `image-converter-app`
   - Database Password: Generate strong password
   - Region: Choose closest to your users
4. **Wait for Setup**: Project creation takes 2-3 minutes

### 2. Database Setup

1. **Access SQL Editor**: In Supabase dashboard, go to SQL Editor
2. **Run Migration**: Copy and paste the migration script:

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'agency')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled')),
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment subscriptions table
CREATE TABLE payment_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('pro', 'agency')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User files table
CREATE TABLE user_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  share_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage analytics table
CREATE TABLE usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tool_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences table
CREATE TABLE user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tool_type TEXT NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tool_type)
);

-- Monthly usage table
CREATE TABLE monthly_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month_year TEXT NOT NULL,
  conversions_count INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- Stripe events table for idempotency
CREATE TABLE stripe_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions" ON payment_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own files" ON user_files
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own analytics" ON usage_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON monthly_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_files_user_id ON user_files(user_id);
CREATE INDEX idx_user_files_created_at ON user_files(created_at DESC);
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_created_at ON usage_analytics(created_at DESC);
CREATE INDEX idx_monthly_usage_user_month ON monthly_usage(user_id, month_year);
CREATE INDEX idx_payment_subscriptions_user_id ON payment_subscriptions(user_id);
CREATE INDEX idx_stripe_events_event_id ON stripe_events(event_id);
```

### 3. Authentication Setup

1. **Navigate to Authentication**: In Supabase dashboard
2. **Configure Providers**:
   - **Email**: Enable email authentication
   - **Google**: Add Google OAuth credentials
   - **GitHub**: Add GitHub OAuth credentials
3. **URL Configuration**:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`

### 4. Storage Setup

1. **Navigate to Storage**: In Supabase dashboard
2. **Create Bucket**: Name it `user-files`
3. **Configure Policies**:
```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view own files
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete own files
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
```

### 5. Get Supabase Credentials

1. **Project Settings**: Go to Settings → API
2. **Copy Values**:
   - Project URL
   - Anon (public) key
   - Service role key (keep secure)

## Stripe Configuration

### 1. Create Stripe Account

1. **Sign Up**: Go to [stripe.com](https://stripe.com)
2. **Verify Account**: Complete business verification
3. **Activate Account**: Enable live payments

### 2. Create Products and Prices

1. **Navigate to Products**: In Stripe dashboard
2. **Create Pro Plan**:
   - Name: "Pro Plan"
   - Price: $9.00 USD
   - Billing: Monthly recurring
   - Copy the Price ID (starts with `price_`)
3. **Create Agency Plan**:
   - Name: "Agency Plan"
   - Price: $49.00 USD
   - Billing: Monthly recurring
   - Copy the Price ID

### 3. Configure Webhooks

1. **Navigate to Webhooks**: In Stripe dashboard
2. **Add Endpoint**: 
   - URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Events to send:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
3. **Copy Webhook Secret**: Save the signing secret

### 4. Get Stripe Keys

1. **Navigate to API Keys**: In Stripe dashboard
2. **Copy Keys**:
   - Publishable key (starts with `pk_`)
   - Secret key (starts with `sk_`)
   - Webhook signing secret (starts with `whsec_`)

## Vercel Deployment

### 1. Connect Repository

1. **Sign Up/Login**: Go to [vercel.com](https://vercel.com)
2. **Import Project**: Click "New Project"
3. **Connect GitHub**: Authorize Vercel to access your repository
4. **Select Repository**: Choose your image-converter-app repository

### 2. Configure Build Settings

1. **Framework Preset**: None (static site)
2. **Build Command**: Leave empty
3. **Output Directory**: Leave empty (uses root)
4. **Install Command**: `npm install`

### 3. Environment Variables

Add the following environment variables in Vercel dashboard:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key
STRIPE_SECRET_KEY=sk_live_your-secret-key
STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PRICE_PRO=price_your-pro-price-id
STRIPE_PRICE_AGENCY=price_your-agency-price-id
```

### 4. Deploy

1. **Click Deploy**: Vercel will build and deploy your app
2. **Wait for Completion**: Deployment takes 2-3 minutes
3. **Get URL**: Copy your deployment URL

## Environment Variables

### Complete Environment Variables List

Create a `.env.local` file with all required variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your-secret-key
STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PRICE_PRO=price_your-pro-price-id
STRIPE_PRICE_AGENCY=price_your-agency-price-id

# Plan Limits Configuration
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

# Application Configuration
APP_NAME=Image Converter App
APP_URL=https://your-domain.com
SUPPORT_EMAIL=support@your-domain.com

# Security Configuration
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_SOCIAL_LOGIN=true
ENABLE_FILE_SHARING=true
```

### Environment Variable Security

- **Never commit**: Add `.env.local` to `.gitignore`
- **Use different keys**: Separate test and production keys
- **Rotate regularly**: Change secrets periodically
- **Limit access**: Only necessary team members should have access

## Database Migration

### Using Supabase CLI

1. **Install Supabase CLI**:
```bash
npm install -g supabase
```

2. **Login to Supabase**:
```bash
supabase login
```

3. **Link Project**:
```bash
supabase link --project-ref your-project-ref
```

4. **Run Migrations**:
```bash
supabase db push
```

### Manual Migration

If CLI is not available, run the SQL migration script directly in the Supabase SQL editor.

## Edge Functions Deployment

### 1. Deploy Quota Check Function

```bash
supabase functions deploy quota-check
```

### 2. Deploy Stripe Webhook Function

```bash
supabase functions deploy stripe-webhook
```

### 3. Set Function Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_your-secret-key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

### 4. Test Functions

```bash
# Test quota check
curl -X POST https://your-project.supabase.co/functions/v1/quota-check \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"action_type": "upload", "file_size": 1048576}'

# Test webhook (use Stripe CLI)
stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
```

## DNS and Domain Setup

### 1. Custom Domain (Optional)

1. **Purchase Domain**: From your preferred registrar
2. **Add to Vercel**: In project settings, add custom domain
3. **Configure DNS**: Add CNAME record pointing to Vercel
4. **SSL Certificate**: Vercel automatically provisions SSL

### 2. Subdomain Setup

For staging environment:
1. **Create Subdomain**: `staging.your-domain.com`
2. **Deploy Branch**: Deploy `staging` branch to subdomain
3. **Environment Variables**: Use test keys for staging

## Production Checklist

### Pre-Deployment Checklist

- [ ] **Environment Variables**: All production variables configured
- [ ] **Database Migration**: Schema deployed and tested
- [ ] **Edge Functions**: All functions deployed and tested
- [ ] **Stripe Configuration**: Products, prices, and webhooks configured
- [ ] **Authentication**: OAuth providers configured with production URLs
- [ ] **Storage**: Bucket created with proper policies
- [ ] **DNS**: Domain configured and SSL certificate active
- [ ] **Monitoring**: Error tracking and analytics configured

### Security Checklist

- [ ] **HTTPS**: All traffic encrypted
- [ ] **Environment Variables**: No secrets in code
- [ ] **RLS Policies**: Database access properly restricted
- [ ] **CORS**: Proper origin restrictions
- [ ] **Rate Limiting**: API endpoints protected
- [ ] **Input Validation**: All user inputs sanitized
- [ ] **File Upload**: File type and size restrictions
- [ ] **Authentication**: Strong password requirements

### Performance Checklist

- [ ] **Database Indexes**: Proper indexes for queries
- [ ] **Image Optimization**: Images compressed and optimized
- [ ] **Caching**: Static assets cached
- [ ] **CDN**: Content delivery network configured
- [ ] **Bundle Size**: JavaScript bundles optimized
- [ ] **Lazy Loading**: Non-critical resources lazy loaded

### Testing Checklist

- [ ] **Unit Tests**: All modules tested
- [ ] **Integration Tests**: API endpoints tested
- [ ] **E2E Tests**: User flows tested
- [ ] **Load Testing**: Performance under load tested
- [ ] **Security Testing**: Vulnerability scan completed
- [ ] **Browser Testing**: Cross-browser compatibility verified

## Rollback Procedures

### Vercel Rollback

1. **Access Deployments**: Go to Vercel dashboard → Deployments
2. **Select Previous**: Choose last known good deployment
3. **Promote**: Click "Promote to Production"
4. **Verify**: Test critical functionality

### Database Rollback

1. **Backup Current**: Create database backup
2. **Restore Previous**: Restore from previous backup
3. **Update Schema**: Run rollback migrations if needed
4. **Verify Data**: Check data integrity

### Edge Functions Rollback

1. **Previous Version**: Deploy previous function version
```bash
supabase functions deploy quota-check --version previous
```
2. **Test Functions**: Verify functionality
3. **Monitor Logs**: Check for errors

### Emergency Rollback

For critical issues:

1. **Immediate**: Rollback Vercel deployment
2. **Communicate**: Notify users of temporary issues
3. **Investigate**: Identify root cause
4. **Fix Forward**: Implement fix and redeploy
5. **Post-Mortem**: Document incident and prevention

### Rollback Testing

Before any deployment:
1. **Test Rollback**: Verify rollback procedure works
2. **Document Steps**: Keep rollback instructions updated
3. **Time Estimate**: Know how long rollback takes
4. **Stakeholder Contact**: Have emergency contact list

## Monitoring and Maintenance

### Application Monitoring

1. **Vercel Analytics**: Monitor performance and errors
2. **Supabase Monitoring**: Track database and API usage
3. **Stripe Dashboard**: Monitor payment processing
4. **Custom Logging**: Application-specific logs

### Health Checks

Set up monitoring for:
- **Application Uptime**: Main site availability
- **API Endpoints**: Critical API functionality
- **Database**: Connection and query performance
- **Payment Processing**: Stripe webhook processing
- **File Storage**: Upload/download functionality

### Maintenance Tasks

#### Daily
- [ ] Check error logs
- [ ] Monitor usage metrics
- [ ] Verify payment processing

#### Weekly
- [ ] Review performance metrics
- [ ] Check security alerts
- [ ] Update dependencies (if needed)

#### Monthly
- [ ] Database maintenance
- [ ] Security audit
- [ ] Backup verification
- [ ] Cost optimization review

### Alerting

Configure alerts for:
- **High Error Rate**: >5% error rate
- **Database Issues**: Connection failures
- **Payment Failures**: Webhook processing errors
- **Storage Issues**: Upload failures
- **Performance**: Response time >2 seconds

### Backup Strategy

1. **Database**: Daily automated backups via Supabase
2. **Files**: Replicated in Supabase Storage
3. **Code**: Version controlled in Git
4. **Configuration**: Environment variables documented

---

**Deployment Support**

For deployment assistance:
- **Documentation**: Refer to this guide
- **Community**: Check GitHub discussions
- **Support**: Contact support@yourapp.com for critical issues

*Last updated: January 2024*