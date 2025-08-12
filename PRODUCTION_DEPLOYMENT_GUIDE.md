# Production Deployment Guide

This guide provides step-by-step instructions for deploying the Image Converter application to production.

## Prerequisites

### Required Accounts and Services
- [ ] Supabase production project
- [ ] Stripe live account (verified and activated)
- [ ] Hosting platform account (Vercel, Netlify, etc.)
- [ ] Domain name and DNS access
- [ ] Email service for notifications (optional)

### Required Tools
- [ ] Node.js 18+ installed
- [ ] Supabase CLI installed and authenticated
- [ ] Git repository access
- [ ] Environment variables configured

## Pre-Deployment Checklist

### 1. Environment Configuration

Create a `.env.production` file with the following variables:

```bash
# Supabase Production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE=your-production-service-role-key

# Stripe Production (Live Keys)
STRIPE_SECRET_KEY=sk_live_your-secret-key
STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# OAuth Configuration
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=your-github-client-id
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your-github-secret
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-google-client-id
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-google-secret

# Site Configuration
SITE_URL=https://your-production-domain.com
ALLOWED_ORIGINS=https://your-production-domain.com

# Feature Flags
ENABLE_BILLING=true
ENABLE_OAUTH=true
ENABLE_MONITORING=true
ENABLE_RATE_LIMITING=true
```

### 2. Supabase Configuration

1. **Create Production Project**
   ```bash
   # Link to your production Supabase project
   supabase link --project-ref your-production-project-ref
   ```

2. **Configure Authentication**
   - Set site URL in Supabase Dashboard
   - Configure OAuth providers (GitHub, Google)
   - Set redirect URLs for production domain
   - Enable email confirmations

3. **Configure Storage**
   - Create storage buckets
   - Set up RLS policies for storage
   - Configure CDN settings

### 3. Stripe Configuration

1. **Account Verification**
   - Complete business verification
   - Add bank account for payouts
   - Configure tax settings

2. **Products and Pricing**
   ```bash
   npm run stripe:setup-prod
   ```

3. **Webhook Configuration**
   ```bash
   npm run stripe:configure-prod
   ```

4. **Tax Configuration**
   - Enable Stripe Tax (recommended)
   - Or configure manual tax rates for NZ GST (15%)

### 4. Domain and DNS Setup

1. **Domain Configuration**
   - Point domain to hosting platform
   - Configure SSL certificate
   - Set up CDN if needed

2. **DNS Records**
   - A record: `your-domain.com` → hosting IP
   - CNAME record: `www.your-domain.com` → `your-domain.com`
   - MX records for email (if applicable)

## Deployment Process

### Option 1: Automated Deployment Pipeline

```bash
# Run the complete deployment pipeline
npm run deploy:pipeline

# Or run in dry-run mode first
npm run deploy:pipeline-dry-run
```

The automated pipeline will:
1. Validate environment variables
2. Run pre-deployment tests
3. Build the application
4. Deploy database migrations
5. Configure Stripe integration
6. Set up monitoring
7. Deploy the application
8. Run post-deployment validation

### Option 2: Manual Step-by-Step Deployment

#### Step 1: Pre-deployment Tests
```bash
# Run all tests
npm run test:all

# Or run specific test suites
npm run test:db
npm run test:integration
npm run test:performance
```

#### Step 2: Build Application
```bash
# Generate production configuration
npm run generate:production-config

# Build application
npm run build:production
```

#### Step 3: Deploy Database
```bash
# Run database migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy
```

#### Step 4: Configure Stripe
```bash
# Set up products and pricing
npm run stripe:setup-prod

# Configure production settings
npm run stripe:configure-prod

# Validate webhook configuration
npm run stripe:validate-webhooks
```

#### Step 5: Deploy Application
```bash
# Deploy to Vercel (example)
vercel --prod

# Or deploy to your chosen platform
```

#### Step 6: Set Up Monitoring
```bash
# Set up monitoring infrastructure
npm run setup:monitoring

# Deploy health check function
supabase functions deploy health-check
```

## Post-Deployment Validation

### 1. Health Checks
```bash
# Test health endpoint
curl https://your-domain.com/api/health

# Or use the npm script
npm run health:check
```

### 2. Functionality Tests

1. **Authentication Flow**
   - [ ] Email signup and login
   - [ ] OAuth providers (GitHub, Google)
   - [ ] Email verification
   - [ ] Password reset

2. **Image Conversion**
   - [ ] File upload and conversion
   - [ ] Different format conversions
   - [ ] File size limits
   - [ ] Error handling

3. **Billing Integration**
   - [ ] Plan upgrade flow
   - [ ] Stripe Checkout integration
   - [ ] Customer Portal access
   - [ ] Webhook processing

4. **Usage Tracking**
   - [ ] Quota enforcement
   - [ ] Usage display
   - [ ] Monthly reset functionality

### 3. Performance Validation
```bash
# Run performance tests
npm run test:performance

# Run load tests
npm run test:load
```

### 4. Security Validation
- [ ] HTTPS enforcement
- [ ] Security headers
- [ ] RLS policy enforcement
- [ ] Webhook signature verification

## Monitoring and Alerting Setup

### 1. Health Monitoring
- Access monitoring dashboard: `https://your-domain.com/monitoring`
- Set up uptime monitoring with external service
- Configure health check alerts

### 2. Error Tracking
- Set up error tracking service (Sentry, LogRocket, etc.)
- Configure error alerts
- Set up performance monitoring

### 3. Business Metrics
- Monitor conversion usage
- Track subscription metrics
- Set up revenue alerts

## Backup and Recovery

### 1. Create Initial Backup
```bash
# Create full system backup
npm run backup:create

# Validate backup integrity
npm run backup:validate

# Generate recovery plan
npm run backup:recovery-plan
```

### 2. Schedule Regular Backups
- Database: Every 6 hours (automated via Supabase)
- Configuration: Daily
- Full system: Weekly

### 3. Test Recovery Procedures
- Monthly: Test database restore
- Quarterly: Full system recovery test

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Verify `.env.production` file exists
   - Check hosting platform environment variable configuration
   - Ensure no typos in variable names

2. **Database Connection Issues**
   - Verify Supabase project URL and keys
   - Check network connectivity
   - Validate RLS policies

3. **Stripe Integration Issues**
   - Verify live API keys are being used
   - Check webhook endpoint configuration
   - Validate webhook signature verification

4. **Authentication Issues**
   - Check site URL configuration in Supabase
   - Verify OAuth provider settings
   - Validate redirect URLs

### Debug Commands
```bash
# Check environment configuration
node -e "console.log(process.env.SUPABASE_URL)"

# Test Supabase connection
supabase status

# Validate Stripe configuration
npm run stripe:validate-webhooks

# Check application health
curl -v https://your-domain.com/api/health
```

## Rollback Procedures

### 1. Application Rollback
```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy previous version
git checkout previous-tag
npm run deploy:production
```

### 2. Database Rollback
```bash
# Restore from backup
npm run backup:validate
# Follow recovery procedures in DISASTER_RECOVERY_PLAN.md
```

### 3. Configuration Rollback
- Restore previous environment variables
- Revert Stripe configuration changes
- Update DNS if needed

## Maintenance

### Regular Tasks
- [ ] Weekly: Review monitoring dashboards
- [ ] Monthly: Update dependencies
- [ ] Monthly: Test backup and recovery
- [ ] Quarterly: Security audit
- [ ] Quarterly: Performance optimization

### Updates and Patches
1. Test in staging environment
2. Create backup before deployment
3. Deploy during low-traffic periods
4. Monitor for issues post-deployment
5. Have rollback plan ready

## Support and Documentation

### Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Application API Documentation](./docs/API_DOCUMENTATION.md)
- [Troubleshooting Guide](./docs/TROUBLESHOOTING_GUIDE.md)

### Emergency Contacts
- **Primary**: [Your contact information]
- **Secondary**: [Backup contact information]
- **Supabase Support**: support@supabase.io
- **Stripe Support**: support@stripe.com

---

**Last Updated**: ${new Date().toISOString()}
**Version**: 1.0.0