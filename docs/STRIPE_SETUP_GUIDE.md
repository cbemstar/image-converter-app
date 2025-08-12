# Stripe Setup Guide

This guide covers setting up Stripe products, pricing, and tax configuration for the image converter billing integration.

## Prerequisites

- Stripe account (test and production)
- Supabase project with billing schema deployed
- Environment variables configured

## Environment Variables

Ensure these environment variables are set:

```bash
# Test Environment
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...

# Production Environment  
STRIPE_SECRET_KEY_LIVE=sk_live_...
STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...
STRIPE_WEBHOOK_SECRET_LIVE=whsec_...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Automated Setup

### 1. Install Dependencies

```bash
cd MAIN-image-converter-app
npm install
```

### 2. Run Setup Script

For test environment:
```bash
npm run stripe:setup-test
```

For production environment:
```bash
npm run stripe:setup-prod
```

For dry run (preview changes):
```bash
npm run stripe:dry-run
```

### 3. Verify Setup

The script will:
- ✅ Create Stripe products for each plan tier
- ✅ Create monthly recurring prices
- ✅ Update database with Stripe price IDs
- ✅ Generate configuration files
- ✅ Set up idempotency keys for safe operations

## Manual Setup (Alternative)

If you prefer manual setup or need custom configuration:

### 1. Create Products in Stripe Dashboard

#### Free Plan
- **Name**: Free
- **Description**: Basic image conversion with limited features
- **Metadata**:
  - `plan_id`: free
  - `plan_tier`: free
  - `conversion_limit`: 10
  - `file_size_limit`: 25MB

#### Pro Plan
- **Name**: Pro  
- **Description**: Advanced image conversion for professionals
- **Metadata**:
  - `plan_id`: pro
  - `plan_tier`: pro
  - `conversion_limit`: 500
  - `file_size_limit`: 100MB

#### Unlimited Plan
- **Name**: Unlimited
- **Description**: Unlimited image conversion for agencies
- **Metadata**:
  - `plan_id`: unlimited
  - `plan_tier`: unlimited
  - `conversion_limit`: unlimited
  - `file_size_limit`: 250MB

### 2. Create Prices

For each paid plan (Pro, Unlimited):
- **Billing**: Recurring
- **Interval**: Monthly
- **Currency**: USD
- **Tax Behavior**: Exclusive (tax added on top)

### 3. Update Database

Update the `plans` table with Stripe price IDs:

```sql
UPDATE public.plans 
SET stripe_price_id = 'price_pro_monthly_id' 
WHERE id = 'pro';

UPDATE public.plans 
SET stripe_price_id = 'price_unlimited_monthly_id' 
WHERE id = 'unlimited';
```

## Tax Configuration

### Option 1: Stripe Tax (Recommended)

1. **Enable Stripe Tax** in your Stripe Dashboard
2. **Add Tax Registration** for New Zealand:
   - Country: New Zealand
   - Tax ID: Your GST number
   - Tax Type: GST
3. **Configure Tax Settings**:
   - Enable automatic tax calculation
   - Set tax-inclusive or tax-exclusive pricing
4. **Test Tax Calculation** with NZ addresses

### Option 2: Manual GST Configuration

If Stripe Tax is not available, configure GST manually:

#### Create Tax Rate

```javascript
// Via Stripe API or Dashboard
const taxRate = await stripe.taxRates.create({
  display_name: 'GST',
  description: 'New Zealand Goods and Services Tax',
  jurisdiction: 'NZ',
  percentage: 15.0,
  inclusive: false, // Tax added on top of price
});
```

#### Apply Tax Rate in Checkout

Update checkout session creation to include tax:

```javascript
const session = await stripe.checkout.sessions.create({
  // ... other parameters
  line_items: [{
    price: 'price_id',
    quantity: 1,
    tax_rates: ['txr_gst_rate_id'], // Your GST tax rate ID
  }],
  // ... rest of configuration
});
```

#### Update Edge Functions

Modify `create-checkout-session/index.ts`:

```typescript
// Add tax rate to line items
line_items: [
  {
    price: price_id,
    quantity: 1,
    tax_rates: [Deno.env.get('STRIPE_GST_TAX_RATE_ID')!], // Add this
  },
],
```

## Customer Portal Configuration

Configure the Customer Portal in Stripe Dashboard:

### 1. Business Information
- **Business name**: Your business name
- **Support email**: support@yourdomain.com
- **Support phone**: Your support phone number

### 2. Functionality
- ✅ Update payment methods
- ✅ Update billing address  
- ✅ View invoice history
- ✅ Download invoices
- ✅ Cancel subscriptions (optional)

### 3. Return URL Configuration
- **Default return URL**: `https://yourdomain.com/dashboard`
- **After completion**: Configure specific return URLs for different flows

## Webhook Configuration

### 1. Create Webhook Endpoints

In Stripe Dashboard, create webhook endpoints:

**Test Environment**:
- URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
- Events: Select relevant events (see below)

**Production Environment**:
- URL: `https://your-production-domain.com/api/stripe-webhook`
- Events: Select relevant events (see below)

### 2. Required Webhook Events

Select these events for your webhook:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.created`
- `customer.updated`

### 3. Webhook Security

- Copy the webhook signing secret
- Add to environment variables as `STRIPE_WEBHOOK_SECRET`
- Ensure webhook signature verification is enabled

## Testing

### 1. Test Cards

Use Stripe test cards for testing:
- **Success**: `4242424242424242`
- **Decline**: `4000000000000002`
- **3D Secure**: `4000002500003155`

### 2. Test Scenarios

Test these scenarios:
- ✅ Successful subscription creation
- ✅ Payment method updates
- ✅ Subscription cancellation
- ✅ Failed payment handling
- ✅ Tax calculation (for NZ addresses)
- ✅ Webhook processing
- ✅ Customer Portal access

### 3. Verify Database Updates

After each test, verify:
- User subscription status updated
- Usage quotas reflect new plan
- Webhook events logged
- Tax amounts calculated correctly

## Production Checklist

Before going live:

### Stripe Configuration
- [ ] Production API keys configured
- [ ] Webhook endpoints created and tested
- [ ] Tax registration completed (if using Stripe Tax)
- [ ] Customer Portal configured
- [ ] Test transactions completed successfully

### Application Configuration
- [ ] Production environment variables set
- [ ] Database schema deployed to production
- [ ] Edge Functions deployed
- [ ] Frontend configuration updated
- [ ] SSL certificates valid

### Compliance
- [ ] Terms of Service updated with billing terms
- [ ] Privacy Policy updated with payment data handling
- [ ] GST registration completed (if required)
- [ ] PCI compliance requirements met

### Monitoring
- [ ] Webhook monitoring set up
- [ ] Payment failure alerts configured
- [ ] Usage analytics tracking enabled
- [ ] Error logging and monitoring active

## Troubleshooting

### Common Issues

#### Products Not Created
- Check API keys are correct
- Verify network connectivity
- Check for rate limiting

#### Tax Not Calculated
- Ensure Stripe Tax is enabled
- Verify tax registration
- Check customer address format

#### Webhooks Not Processing
- Verify webhook URL is accessible
- Check webhook signature verification
- Review webhook event logs

#### Database Updates Failing
- Check Supabase service role key
- Verify RLS policies allow service role access
- Review database connection

### Debug Commands

```bash
# Test Stripe connection
node -e "const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_TEST); stripe.products.list().then(console.log);"

# Check webhook events
curl -X GET "https://api.stripe.com/v1/webhook_endpoints" \
  -H "Authorization: Bearer $STRIPE_SECRET_KEY_TEST"

# Test database connection
npx supabase db ping
```

## Support

For additional help:
- [Stripe Documentation](https://stripe.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [New Zealand GST Information](https://www.ird.govt.nz/gst)

## Security Notes

- Never commit API keys to version control
- Use environment variables for all secrets
- Regularly rotate webhook secrets
- Monitor for suspicious payment activity
- Implement proper error handling and logging