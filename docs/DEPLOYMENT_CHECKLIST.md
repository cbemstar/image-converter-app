# Deployment Checklist and Rollback Procedures

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Process](#deployment-process)
3. [Post-Deployment Verification](#post-deployment-verification)
4. [Rollback Procedures](#rollback-procedures)
5. [Emergency Response](#emergency-response)
6. [Deployment Automation](#deployment-automation)

## Pre-Deployment Checklist

### Code Quality and Testing

- [ ] **Code Review Completed**
  - All pull requests reviewed and approved
  - Code follows established style guidelines
  - No obvious security vulnerabilities
  - Performance implications considered

- [ ] **Unit Tests Passing**
  ```bash
  npm test
  # Ensure all tests pass with >90% coverage
  ```

- [ ] **Integration Tests Completed**
  - Authentication flows tested
  - Payment processing verified
  - File upload/download functionality confirmed
  - Quota management working correctly

- [ ] **End-to-End Tests Passing**
  - Complete user journeys tested
  - Cross-browser compatibility verified
  - Mobile responsiveness confirmed
  - Accessibility standards met (WCAG 2.1 AA)

- [ ] **Security Scan Completed**
  - Dependency vulnerabilities checked
  - Environment variables secured
  - No hardcoded secrets in code
  - Input validation implemented

### Environment Configuration

- [ ] **Environment Variables Verified**
  ```bash
  # Check all required variables are set
  echo "Checking environment variables..."
  
  # Supabase
  [ -n "$SUPABASE_URL" ] && echo "✓ SUPABASE_URL" || echo "✗ SUPABASE_URL missing"
  [ -n "$SUPABASE_ANON_KEY" ] && echo "✓ SUPABASE_ANON_KEY" || echo "✗ SUPABASE_ANON_KEY missing"
  [ -n "$SUPABASE_SERVICE_ROLE" ] && echo "✓ SUPABASE_SERVICE_ROLE" || echo "✗ SUPABASE_SERVICE_ROLE missing"
  
  # Stripe
  [ -n "$STRIPE_SECRET_KEY" ] && echo "✓ STRIPE_SECRET_KEY" || echo "✗ STRIPE_SECRET_KEY missing"
  [ -n "$STRIPE_PUBLISHABLE_KEY" ] && echo "✓ STRIPE_PUBLISHABLE_KEY" || echo "✗ STRIPE_PUBLISHABLE_KEY missing"
  [ -n "$STRIPE_WEBHOOK_SECRET" ] && echo "✓ STRIPE_WEBHOOK_SECRET" || echo "✗ STRIPE_WEBHOOK_SECRET missing"
  ```

- [ ] **Database Migration Ready**
  - Migration scripts tested on staging
  - Backup created before migration
  - Rollback scripts prepared
  - Data integrity verified

- [ ] **Edge Functions Deployed**
  ```bash
  # Deploy and test Edge Functions
  supabase functions deploy quota-check
  supabase functions deploy stripe-webhook
  
  # Test function endpoints
  curl -X POST https://your-project.supabase.co/functions/v1/quota-check \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d '{"action_type": "test"}'
  ```

### Third-Party Services

- [ ] **Stripe Configuration**
  - Products and prices created
  - Webhooks configured and tested
  - Test payments processed successfully
  - Customer Portal accessible

- [ ] **OAuth Providers**
  - Google OAuth configured with production URLs
  - GitHub OAuth configured with production URLs
  - Redirect URLs match production domain
  - Test logins successful

- [ ] **DNS and SSL**
  - Domain pointing to correct servers
  - SSL certificates valid and active
  - HTTPS redirects working
  - CDN configuration verified

### Performance and Monitoring

- [ ] **Performance Benchmarks**
  - Page load times under 3 seconds
  - API response times under 500ms
  - File upload performance acceptable
  - Database query performance optimized

- [ ] **Monitoring Setup**
  - Error tracking configured (Sentry)
  - Performance monitoring active
  - Uptime monitoring enabled
  - Alert thresholds configured

- [ ] **Backup Verification**
  - Database backups working
  - File storage backups configured
  - Configuration backups created
  - Recovery procedures tested

## Deployment Process

### Step 1: Pre-Deployment Preparation

```bash
#!/bin/bash
# Pre-deployment script

echo "Starting pre-deployment checks..."

# 1. Verify git status
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory not clean"
  exit 1
fi

# 2. Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: Not on main branch (currently on $CURRENT_BRANCH)"
  exit 1
fi

# 3. Run tests
echo "Running tests..."
npm test
if [ $? -ne 0 ]; then
  echo "Error: Tests failed"
  exit 1
fi

# 4. Build verification
echo "Verifying build..."
npm run build
if [ $? -ne 0 ]; then
  echo "Error: Build failed"
  exit 1
fi

echo "Pre-deployment checks passed ✓"
```

### Step 2: Database Migration

```bash
#!/bin/bash
# Database migration script

echo "Starting database migration..."

# 1. Create backup
echo "Creating database backup..."
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
pg_dump $DATABASE_URL > "${BACKUP_NAME}.sql"

# 2. Run migration
echo "Running migration..."
supabase db push

# 3. Verify migration
echo "Verifying migration..."
supabase db diff

echo "Database migration completed ✓"
```

### Step 3: Application Deployment

```bash
#!/bin/bash
# Application deployment script

echo "Starting application deployment..."

# 1. Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

# 2. Deploy Edge Functions
echo "Deploying Edge Functions..."
supabase functions deploy quota-check
supabase functions deploy stripe-webhook

# 3. Update function secrets
echo "Updating function secrets..."
supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
supabase secrets set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"

echo "Application deployment completed ✓"
```

### Step 4: Configuration Updates

```bash
#!/bin/bash
# Configuration update script

echo "Updating configuration..."

# 1. Update Stripe webhook URLs
echo "Updating Stripe webhooks..."
# This would typically be done through Stripe CLI or dashboard

# 2. Update OAuth redirect URLs
echo "Verifying OAuth configurations..."
# Check Google and GitHub OAuth settings

# 3. Update DNS if needed
echo "Verifying DNS configuration..."
dig your-domain.com

echo "Configuration updates completed ✓"
```

## Post-Deployment Verification

### Automated Health Checks

```bash
#!/bin/bash
# Post-deployment health check script

echo "Starting post-deployment health checks..."

DOMAIN="https://your-domain.com"
API_ENDPOINT="https://your-project.supabase.co"

# 1. Basic connectivity
echo "Checking basic connectivity..."
curl -f "$DOMAIN" > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Main site accessible"
else
  echo "✗ Main site not accessible"
  exit 1
fi

# 2. API endpoints
echo "Checking API endpoints..."
curl -f "$API_ENDPOINT/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY" > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ API accessible"
else
  echo "✗ API not accessible"
  exit 1
fi

# 3. Authentication
echo "Testing authentication..."
# Add authentication test here

# 4. File upload
echo "Testing file upload..."
# Add file upload test here

# 5. Payment processing
echo "Testing payment processing..."
# Add payment test here

echo "Health checks completed ✓"
```

### Manual Verification Checklist

- [ ] **Homepage Loading**
  - Main page loads without errors
  - Navigation menu works
  - Theme toggle functions
  - Mobile view displays correctly

- [ ] **Authentication System**
  - Sign up process works
  - Email/password login successful
  - Social login (Google/GitHub) functional
  - Password reset flow working
  - User dashboard accessible

- [ ] **Core Functionality**
  - File upload works for all tools
  - Image conversion processes correctly
  - PDF tools function properly
  - File download links work
  - Quota tracking accurate

- [ ] **Payment System**
  - Pricing page displays correctly
  - Stripe Checkout loads properly
  - Test payment processes successfully
  - Customer Portal accessible
  - Subscription status updates correctly

- [ ] **Performance Metrics**
  - Page load time < 3 seconds
  - Time to Interactive < 5 seconds
  - Largest Contentful Paint < 2.5 seconds
  - Cumulative Layout Shift < 0.1

### Monitoring Dashboard Setup

```javascript
// Post-deployment monitoring setup
const setupMonitoring = async () => {
  // 1. Configure error tracking
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1
  });
  
  // 2. Set up performance monitoring
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Send metrics to monitoring service
      sendMetric(entry.name, entry.duration);
    }
  });
  observer.observe({ entryTypes: ['navigation', 'resource'] });
  
  // 3. Configure uptime monitoring
  setInterval(async () => {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      // Alert on health check failure
      alertHealthCheckFailure(error);
    }
  }, 60000); // Check every minute
};
```

## Rollback Procedures

### Immediate Rollback (< 5 minutes)

```bash
#!/bin/bash
# Emergency rollback script

echo "EMERGENCY ROLLBACK INITIATED"
echo "Timestamp: $(date)"

# 1. Rollback Vercel deployment
echo "Rolling back Vercel deployment..."
PREVIOUS_DEPLOYMENT=$(vercel ls --meta production | head -2 | tail -1 | awk '{print $1}')
vercel promote "$PREVIOUS_DEPLOYMENT"

# 2. Rollback Edge Functions
echo "Rolling back Edge Functions..."
supabase functions deploy quota-check --version previous
supabase functions deploy stripe-webhook --version previous

# 3. Notify team
echo "Sending rollback notification..."
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-type: application/json' \
  --data '{"text":"🚨 EMERGENCY ROLLBACK COMPLETED - Production deployment rolled back"}'

echo "Emergency rollback completed in $(date)"
```

### Database Rollback

```bash
#!/bin/bash
# Database rollback script

echo "Starting database rollback..."

# 1. Stop application traffic (maintenance mode)
echo "Enabling maintenance mode..."
vercel env add MAINTENANCE_MODE true

# 2. Create current state backup
echo "Creating current state backup..."
ROLLBACK_BACKUP="rollback_backup_$(date +%Y%m%d_%H%M%S)"
pg_dump $DATABASE_URL > "${ROLLBACK_BACKUP}.sql"

# 3. Restore from backup
echo "Restoring from backup..."
if [ -f "$BACKUP_FILE" ]; then
  psql $DATABASE_URL < "$BACKUP_FILE"
  echo "Database restored from $BACKUP_FILE"
else
  echo "Error: Backup file not found"
  exit 1
fi

# 4. Verify restoration
echo "Verifying database restoration..."
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user_profiles;"

# 5. Disable maintenance mode
echo "Disabling maintenance mode..."
vercel env rm MAINTENANCE_MODE

echo "Database rollback completed ✓"
```

### Configuration Rollback

```bash
#!/bin/bash
# Configuration rollback script

echo "Rolling back configuration..."

# 1. Restore environment variables
echo "Restoring environment variables..."
# Restore from backup or previous known good state

# 2. Revert DNS changes
echo "Reverting DNS changes..."
# Update DNS records if they were changed

# 3. Restore webhook configurations
echo "Restoring webhook configurations..."
# Revert Stripe webhook URLs

# 4. Update OAuth settings
echo "Updating OAuth settings..."
# Revert OAuth redirect URLs

echo "Configuration rollback completed ✓"
```

### Rollback Verification

```bash
#!/bin/bash
# Rollback verification script

echo "Verifying rollback..."

# 1. Check application accessibility
curl -f "https://your-domain.com" > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Application accessible after rollback"
else
  echo "✗ Application not accessible after rollback"
fi

# 2. Test core functionality
echo "Testing core functionality..."
# Add specific functionality tests

# 3. Verify data integrity
echo "Verifying data integrity..."
# Check database consistency

# 4. Monitor error rates
echo "Monitoring error rates..."
# Check error tracking for increased errors

echo "Rollback verification completed ✓"
```

## Emergency Response

### Incident Response Plan

#### Severity Levels

**P0 - Critical (Response: Immediate)**
- Complete site outage
- Data loss or corruption
- Security breach
- Payment processing failure

**P1 - High (Response: < 1 hour)**
- Major feature not working
- Performance severely degraded
- Authentication issues
- Significant user impact

**P2 - Medium (Response: < 4 hours)**
- Minor feature issues
- Moderate performance impact
- Limited user impact
- Non-critical bugs

**P3 - Low (Response: < 24 hours)**
- Cosmetic issues
- Enhancement requests
- Documentation updates
- Minor improvements

#### Emergency Contacts

```bash
# Emergency contact script
#!/bin/bash

INCIDENT_LEVEL=$1
MESSAGE=$2

case $INCIDENT_LEVEL in
  "P0")
    # Critical - notify everyone immediately
    curl -X POST "$SLACK_WEBHOOK_CRITICAL" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"🚨 P0 CRITICAL INCIDENT: $MESSAGE\"}"
    
    # Send SMS to on-call engineer
    curl -X POST "$SMS_API_ENDPOINT" \
      -d "to=$ONCALL_PHONE" \
      -d "message=P0 CRITICAL: $MESSAGE"
    ;;
  "P1")
    # High - notify team leads
    curl -X POST "$SLACK_WEBHOOK_HIGH" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"⚠️ P1 HIGH INCIDENT: $MESSAGE\"}"
    ;;
  *)
    # Medium/Low - standard notification
    curl -X POST "$SLACK_WEBHOOK_STANDARD" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"ℹ️ Incident: $MESSAGE\"}"
    ;;
esac
```

### Incident Response Checklist

#### Immediate Response (0-15 minutes)

- [ ] **Assess Severity**
  - Determine incident level (P0-P3)
  - Identify affected systems/users
  - Estimate business impact

- [ ] **Initial Communication**
  - Notify incident response team
  - Create incident channel/room
  - Post initial status update

- [ ] **Immediate Mitigation**
  - Enable maintenance mode if needed
  - Implement quick fixes if available
  - Consider rollback if appropriate

#### Investigation Phase (15-60 minutes)

- [ ] **Gather Information**
  - Check monitoring dashboards
  - Review error logs and metrics
  - Identify root cause
  - Document timeline of events

- [ ] **Coordinate Response**
  - Assign incident commander
  - Delegate investigation tasks
  - Maintain communication log
  - Update stakeholders regularly

#### Resolution Phase (1+ hours)

- [ ] **Implement Fix**
  - Deploy permanent solution
  - Test fix thoroughly
  - Monitor for regression
  - Verify full restoration

- [ ] **Post-Incident**
  - Conduct post-mortem meeting
  - Document lessons learned
  - Update procedures/runbooks
  - Implement preventive measures

## Deployment Automation

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
      
      - name: Deploy Edge Functions
        run: |
          npx supabase functions deploy quota-check
          npx supabase functions deploy stripe-webhook
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Run Health Checks
        run: |
          sleep 30  # Wait for deployment
          ./scripts/health-check.sh
      
      - name: Notify Success
        if: success()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-type: application/json' \
            --data '{"text":"✅ Production deployment successful"}'
      
      - name: Notify Failure
        if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-type: application/json' \
            --data '{"text":"❌ Production deployment failed - manual intervention required"}'
```

### Automated Rollback Trigger

```yaml
# .github/workflows/rollback.yml
name: Emergency Rollback

on:
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for rollback'
        required: true
        type: string

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Execute Rollback
        run: |
          echo "Executing rollback: ${{ github.event.inputs.reason }}"
          ./scripts/emergency-rollback.sh
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Verify Rollback
        run: ./scripts/rollback-verification.sh
      
      - name: Notify Team
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Emergency rollback completed: ${{ github.event.inputs.reason }}\"}"
```

### Deployment Status Dashboard

```javascript
// Simple deployment status page
const deploymentStatus = {
  async checkStatus() {
    const checks = [
      { name: 'Main Site', url: 'https://your-domain.com' },
      { name: 'API', url: 'https://your-project.supabase.co/rest/v1/' },
      { name: 'Auth', url: 'https://your-project.supabase.co/auth/v1/health' },
      { name: 'Functions', url: 'https://your-project.supabase.co/functions/v1/quota-check' }
    ];
    
    const results = await Promise.all(
      checks.map(async (check) => {
        try {
          const response = await fetch(check.url, { method: 'HEAD' });
          return {
            ...check,
            status: response.ok ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - startTime
          };
        } catch (error) {
          return {
            ...check,
            status: 'error',
            error: error.message
          };
        }
      })
    );
    
    return results;
  }
};
```

---

**Deployment Checklist Summary**

✅ **Pre-Deployment**
- Code quality verified
- Tests passing
- Environment configured
- Services ready

✅ **Deployment**
- Database migrated
- Application deployed
- Configuration updated
- Functions deployed

✅ **Verification**
- Health checks passed
- Functionality tested
- Performance verified
- Monitoring active

✅ **Rollback Ready**
- Procedures documented
- Scripts tested
- Team notified
- Recovery verified

*Last updated: January 2024*