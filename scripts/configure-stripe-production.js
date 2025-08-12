#!/usr/bin/env node

/**
 * Stripe Production Configuration Script
 * 
 * This script handles the complete setup of Stripe for production environment,
 * including webhook configuration, tax settings, and compliance requirements.
 * 
 * Requirements addressed:
 * - 15.1, 15.2: Tax handling and pricing configuration
 * - 15.3, 15.4, 15.5, 15.6: Production compliance and settings
 */

const Stripe = require('stripe');
const crypto = require('crypto');

class StripeProductionConfig {
  constructor() {
    this.validateEnvironment();
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    this.webhookEndpoints = [];
    this.taxRates = [];
    this.errors = [];
  }

  validateEnvironment() {
    const required = [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'SITE_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate that we're using live keys in production
    if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
      throw new Error('Production environment requires live Stripe keys (sk_live_...)');
    }

    if (!process.env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_')) {
      throw new Error('Production environment requires live Stripe publishable keys (pk_live_...)');
    }
  }

  generateIdempotencyKey(operation, identifier) {
    const data = `production-${operation}-${identifier}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  async configureWebhookEndpoints() {
    console.log('🔗 Configuring Stripe webhook endpoints...');
    
    const siteUrl = process.env.SITE_URL;
    const webhookConfigs = [
      {
        url: `${siteUrl}/api/stripe-webhook`,
        events: [
          'checkout.session.completed',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.paid',
          'invoice.payment_failed',
          'payment_intent.succeeded',
          'payment_intent.payment_failed'
        ],
        description: 'Main billing webhook for subscription management'
      }
    ];

    for (const config of webhookConfigs) {
      try {
        // Check if webhook endpoint already exists
        const existingEndpoints = await this.stripe.webhookEndpoints.list({
          limit: 100
        });

        const existing = existingEndpoints.data.find(ep => ep.url === config.url);

        let endpoint;
        if (existing) {
          // Update existing endpoint
          endpoint = await this.stripe.webhookEndpoints.update(existing.id, {
            enabled_events: config.events,
            description: config.description
          });
          console.log(`   ✅ Updated webhook endpoint: ${config.url}`);
        } else {
          // Create new endpoint
          endpoint = await this.stripe.webhookEndpoints.create({
            url: config.url,
            enabled_events: config.events,
            description: config.description
          });
          console.log(`   ✨ Created webhook endpoint: ${config.url}`);
        }

        this.webhookEndpoints.push({
          id: endpoint.id,
          url: endpoint.url,
          secret: endpoint.secret
        });

        console.log(`   🔑 Webhook secret: ${endpoint.secret}`);
        console.log(`   📝 Add this to your environment: STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);

      } catch (error) {
        console.error(`   ❌ Error configuring webhook ${config.url}:`, error.message);
        this.errors.push({
          operation: 'configure-webhook',
          url: config.url,
          error: error.message
        });
      }
    }
  }

  async configureTaxSettings() {
    console.log('🏛️ Configuring tax settings...');
    
    try {
      // Create NZ GST tax rate
      const nzGstRate = await this.createTaxRate({
        display_name: 'GST',
        description: 'New Zealand Goods and Services Tax',
        jurisdiction: 'NZ',
        percentage: 15.0,
        inclusive: false,
        country: 'NZ'
      });

      if (nzGstRate) {
        console.log(`   ✅ NZ GST tax rate configured: ${nzGstRate.id}`);
        this.taxRates.push(nzGstRate);
      }

      // Configure automatic tax calculation
      console.log('   📋 Tax configuration checklist:');
      console.log('   • Enable Stripe Tax in your Stripe Dashboard');
      console.log('   • Register for GST in New Zealand if required');
      console.log('   • Configure tax-inclusive pricing if needed');
      console.log('   • Test tax calculation in checkout');

    } catch (error) {
      console.error(`   ❌ Error configuring tax settings:`, error.message);
      this.errors.push({
        operation: 'configure-tax',
        error: error.message
      });
    }
  }

  async createTaxRate(config) {
    try {
      // Check if tax rate already exists
      const existingRates = await this.stripe.taxRates.list({
        limit: 100
      });

      const existing = existingRates.data.find(rate => 
        rate.jurisdiction === config.jurisdiction && 
        rate.percentage === config.percentage
      );

      if (existing) {
        console.log(`   ✅ Tax rate already exists: ${existing.display_name} (${existing.percentage}%)`);
        return existing;
      }

      // Create new tax rate
      const taxRate = await this.stripe.taxRates.create({
        display_name: config.display_name,
        description: config.description,
        jurisdiction: config.jurisdiction,
        percentage: config.percentage,
        inclusive: config.inclusive,
        country: config.country
      }, {
        idempotencyKey: this.generateIdempotencyKey('tax-rate', config.jurisdiction)
      });

      console.log(`   ✨ Created tax rate: ${taxRate.display_name} (${taxRate.percentage}%)`);
      return taxRate;

    } catch (error) {
      console.error(`   ❌ Error creating tax rate for ${config.jurisdiction}:`, error.message);
      return null;
    }
  }

  async configureCustomerPortal() {
    console.log('🏪 Configuring Stripe Customer Portal...');
    
    try {
      const siteUrl = process.env.SITE_URL;
      
      const portalConfig = {
        business_profile: {
          headline: 'Manage your Image Converter subscription',
          privacy_policy_url: `${siteUrl}/privacy`,
          terms_of_service_url: `${siteUrl}/terms`
        },
        features: {
          payment_method_update: {
            enabled: true
          },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end',
            proration_behavior: 'none'
          },
          subscription_pause: {
            enabled: false
          },
          subscription_update: {
            enabled: true,
            default_allowed_updates: ['price', 'quantity'],
            proration_behavior: 'create_prorations'
          },
          invoice_history: {
            enabled: true
          }
        },
        default_return_url: `${siteUrl}/dashboard`,
        metadata: {
          environment: 'production',
          configured_at: new Date().toISOString()
        }
      };

      // Note: Customer Portal configuration is typically done through the Dashboard
      // This is for documentation and validation purposes
      console.log('   📋 Customer Portal configuration:');
      console.log(`   • Business profile configured`);
      console.log(`   • Payment method updates: enabled`);
      console.log(`   • Subscription cancellation: at period end`);
      console.log(`   • Subscription updates: enabled with proration`);
      console.log(`   • Invoice history: enabled`);
      console.log(`   • Default return URL: ${portalConfig.default_return_url}`);
      
      console.log('   ⚠️  Configure these settings in your Stripe Dashboard > Customer Portal');

    } catch (error) {
      console.error(`   ❌ Error configuring Customer Portal:`, error.message);
      this.errors.push({
        operation: 'configure-portal',
        error: error.message
      });
    }
  }

  async validateProductionReadiness() {
    console.log('🔍 Validating production readiness...');
    
    const checks = [];

    try {
      // Check account details
      const account = await this.stripe.accounts.retrieve();
      checks.push({
        name: 'Account Status',
        status: account.details_submitted ? 'pass' : 'fail',
        message: account.details_submitted ? 'Account details submitted' : 'Account setup incomplete'
      });

      checks.push({
        name: 'Charges Enabled',
        status: account.charges_enabled ? 'pass' : 'fail',
        message: account.charges_enabled ? 'Charges enabled' : 'Charges not enabled'
      });

      checks.push({
        name: 'Payouts Enabled',
        status: account.payouts_enabled ? 'pass' : 'fail',
        message: account.payouts_enabled ? 'Payouts enabled' : 'Payouts not enabled'
      });

      // Check products exist
      const products = await this.stripe.products.list({
        active: true,
        limit: 10
      });

      checks.push({
        name: 'Products Configured',
        status: products.data.length > 0 ? 'pass' : 'fail',
        message: `${products.data.length} active products found`
      });

      // Check webhook endpoints
      const webhooks = await this.stripe.webhookEndpoints.list();
      const hasWebhooks = webhooks.data.some(wh => wh.url.includes(process.env.SITE_URL));

      checks.push({
        name: 'Webhook Endpoints',
        status: hasWebhooks ? 'pass' : 'fail',
        message: hasWebhooks ? 'Webhook endpoints configured' : 'No webhook endpoints found'
      });

      // Display results
      console.log('   📊 Production Readiness Check:');
      checks.forEach(check => {
        const icon = check.status === 'pass' ? '✅' : '❌';
        console.log(`   ${icon} ${check.name}: ${check.message}`);
      });

      const allPassed = checks.every(check => check.status === 'pass');
      
      if (allPassed) {
        console.log('   🎉 All production readiness checks passed!');
      } else {
        console.log('   ⚠️  Some checks failed. Review and fix before going live.');
      }

      return allPassed;

    } catch (error) {
      console.error(`   ❌ Error validating production readiness:`, error.message);
      this.errors.push({
        operation: 'validate-readiness',
        error: error.message
      });
      return false;
    }
  }

  async generateProductionChecklist() {
    console.log('📋 Generating production deployment checklist...');
    
    const checklist = `# Stripe Production Deployment Checklist

## Pre-Deployment
- [ ] Stripe account fully verified and activated
- [ ] Business details and tax information submitted
- [ ] Bank account connected for payouts
- [ ] Live API keys generated and secured

## Products and Pricing
- [ ] All products created with correct pricing
- [ ] Tax rates configured (NZ GST: 15%)
- [ ] Pricing tested with tax calculations
- [ ] Plan features and limits verified

## Webhooks
- [ ] Webhook endpoints configured for production domain
- [ ] Webhook secrets added to environment variables
- [ ] Webhook signature verification implemented
- [ ] Webhook event handling tested

## Customer Portal
- [ ] Customer Portal configured in Stripe Dashboard
- [ ] Business profile information updated
- [ ] Privacy policy and terms of service URLs set
- [ ] Return URLs configured correctly

## Tax and Compliance
- [ ] Stripe Tax enabled (if using automatic tax)
- [ ] GST registration completed (if required)
- [ ] Tax-inclusive vs exclusive pricing decided
- [ ] Invoice and receipt templates customized

## Testing
- [ ] End-to-end payment flow tested with live cards
- [ ] Subscription lifecycle tested (create, update, cancel)
- [ ] Webhook processing tested with live events
- [ ] Customer Portal functionality verified
- [ ] Tax calculation accuracy verified

## Security
- [ ] API keys stored securely (environment variables)
- [ ] Webhook endpoints use HTTPS
- [ ] Webhook signature verification enabled
- [ ] Rate limiting implemented on webhook endpoints

## Monitoring
- [ ] Stripe Dashboard notifications configured
- [ ] Payment failure alerts set up
- [ ] Webhook failure monitoring implemented
- [ ] Revenue and subscription metrics tracking

## Documentation
- [ ] API integration documented
- [ ] Webhook event handling documented
- [ ] Error handling procedures documented
- [ ] Customer support procedures updated

Generated: ${new Date().toISOString()}
Environment: Production
`;

    const fs = require('fs');
    const path = require('path');
    
    const checklistPath = path.join(__dirname, '..', 'STRIPE_PRODUCTION_CHECKLIST.md');
    fs.writeFileSync(checklistPath, checklist);
    
    console.log(`   ✅ Checklist saved to: ${checklistPath}`);
  }

  async configure() {
    try {
      console.log('🚀 Starting Stripe production configuration...');
      
      await this.configureWebhookEndpoints();
      await this.configureTaxSettings();
      await this.configureCustomerPortal();
      
      const isReady = await this.validateProductionReadiness();
      await this.generateProductionChecklist();
      
      // Summary
      console.log('\n📊 Configuration Summary:');
      console.log(`   Webhook endpoints: ${this.webhookEndpoints.length}`);
      console.log(`   Tax rates: ${this.taxRates.length}`);
      console.log(`   Errors: ${this.errors.length}`);
      console.log(`   Production ready: ${isReady ? 'Yes' : 'No'}`);
      
      if (this.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        this.errors.forEach(error => {
          console.log(`   • ${error.operation}: ${error.error}`);
        });
      }
      
      if (this.webhookEndpoints.length > 0) {
        console.log('\n🔑 Important: Add these webhook secrets to your environment:');
        this.webhookEndpoints.forEach(webhook => {
          console.log(`   STRIPE_WEBHOOK_SECRET=${webhook.secret}`);
        });
      }
      
      console.log('\n✅ Stripe production configuration completed!');
      console.log('📋 Review the generated checklist before going live.');
      
    } catch (error) {
      console.error('\n💥 Configuration failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const configurator = new StripeProductionConfig();
  configurator.configure().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = StripeProductionConfig;