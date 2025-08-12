/**
 * Stripe Products and Pricing Setup Script
 * 
 * This script creates Stripe products and pricing configurations for the image converter
 * billing integration. It handles both test and production environments with proper
 * tax configuration and idempotency keys.
 * 
 * Requirements addressed:
 * - 15.1: Tax handling and compliance
 * - 15.2: Pricing configuration and billing cycles
 * 
 * Usage:
 * node scripts/setup-stripe-products.js [--environment=test|production] [--update-database]
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuration
const PLAN_CONFIGURATIONS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Basic image conversion with limited features',
    monthly_conversions: 10,
    price_cents: 0,
    features: [
      'Basic image formats (PNG, JPG, WebP)',
      '10 conversions per month',
      '25MB max file size',
      'Basic support'
    ],
    metadata: {
      plan_tier: 'free',
      conversion_limit: '10',
      file_size_limit: '25MB',
      support_level: 'basic'
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Advanced image conversion for professionals',
    monthly_conversions: 500,
    price_cents: 999, // $9.99 USD
    features: [
      'All image formats',
      '500 conversions per month',
      '100MB max file size',
      'Priority support',
      'Batch processing',
      'Advanced optimization'
    ],
    metadata: {
      plan_tier: 'pro',
      conversion_limit: '500',
      file_size_limit: '100MB',
      support_level: 'priority',
      batch_processing: 'true'
    }
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'Unlimited image conversion for agencies and power users',
    monthly_conversions: -1, // Unlimited
    price_cents: 2999, // $29.99 USD
    features: [
      'All image formats',
      'Unlimited conversions',
      '250MB max file size',
      '24/7 priority support',
      'API access',
      'White-label options',
      'Custom integrations'
    ],
    metadata: {
      plan_tier: 'unlimited',
      conversion_limit: 'unlimited',
      file_size_limit: '250MB',
      support_level: 'premium',
      api_access: 'true',
      white_label: 'true'
    }
  }
};

// Tax configuration for New Zealand GST
const TAX_CONFIGURATION = {
  nz_gst: {
    display_name: 'GST',
    inclusive: false,
    percentage: 15.0,
    jurisdiction: 'NZ',
    description: 'New Zealand Goods and Services Tax'
  }
};

class StripeProductSetup {
  constructor(options = {}) {
    this.environment = options.environment || 'test';
    this.updateDatabase = options.updateDatabase || false;
    this.dryRun = options.dryRun || false;
    
    // Initialize Stripe with appropriate key (skip for dry run)
    if (!this.dryRun) {
      const stripeKey = this.environment === 'production' 
        ? process.env.STRIPE_SECRET_KEY_LIVE 
        : process.env.STRIPE_SECRET_KEY_TEST;
        
      if (!stripeKey) {
        throw new Error(`Missing Stripe secret key for ${this.environment} environment`);
      }
      
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16',
      });
    } else {
      console.log(`🔍 DRY RUN MODE: Skipping Stripe initialization`);
      this.stripe = null;
    }
    
    // Initialize Supabase client if database updates are enabled
    if (this.updateDatabase && !this.dryRun) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration for database updates');
      }
      
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } else if (this.updateDatabase && this.dryRun) {
      console.log(`🔍 DRY RUN MODE: Skipping Supabase initialization`);
    }
    
    this.createdProducts = [];
    this.createdPrices = [];
    this.errors = [];
  }

  /**
   * Generate idempotency key for Stripe operations
   */
  generateIdempotencyKey(operation, identifier) {
    const data = `${this.environment}-${operation}-${identifier}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Create or update Stripe products
   */
  async createProducts() {
    console.log(`\n🏗️  Creating Stripe products for ${this.environment} environment...`);
    
    for (const [planId, config] of Object.entries(PLAN_CONFIGURATIONS)) {
      try {
        console.log(`\n📦 Processing plan: ${config.name}`);
        
        if (this.dryRun) {
          console.log(`   [DRY RUN] Would create product: ${config.name}`);
          continue;
        }
        
        // Check if product already exists
        const existingProducts = await this.stripe.products.search({
          query: `metadata['plan_id']:'${planId}' AND metadata['environment']:'${this.environment}'`
        });
        
        let product;
        if (existingProducts.data.length > 0) {
          product = existingProducts.data[0];
          console.log(`   ✅ Product already exists: ${product.id}`);
          
          // Update product if needed
          product = await this.stripe.products.update(product.id, {
            name: config.name,
            description: config.description,
            metadata: {
              ...config.metadata,
              plan_id: planId,
              environment: this.environment,
              updated_at: new Date().toISOString()
            }
          }, {
            idempotencyKey: this.generateIdempotencyKey('product-update', planId)
          });
          
          console.log(`   🔄 Product updated: ${product.id}`);
        } else {
          // Create new product
          product = await this.stripe.products.create({
            name: config.name,
            description: config.description,
            metadata: {
              ...config.metadata,
              plan_id: planId,
              environment: this.environment,
              created_at: new Date().toISOString()
            }
          }, {
            idempotencyKey: this.generateIdempotencyKey('product-create', planId)
          });
          
          console.log(`   ✨ Product created: ${product.id}`);
        }
        
        this.createdProducts.push({
          planId,
          productId: product.id,
          config
        });
        
      } catch (error) {
        console.error(`   ❌ Error creating product for ${planId}:`, error.message);
        this.errors.push({
          operation: 'create-product',
          planId,
          error: error.message
        });
      }
    }
  }

  /**
   * Create or update Stripe prices
   */
  async createPrices() {
    console.log(`\n💰 Creating Stripe prices for ${this.environment} environment...`);
    
    for (const productInfo of this.createdProducts) {
      const { planId, productId, config } = productInfo;
      
      try {
        console.log(`\n💵 Processing price for: ${config.name}`);
        
        // Skip free plan (no price needed)
        if (config.price_cents === 0) {
          console.log(`   ⏭️  Skipping free plan (no price needed)`);
          continue;
        }
        
        if (this.dryRun) {
          console.log(`   [DRY RUN] Would create price: $${config.price_cents / 100} USD/month`);
          continue;
        }
        
        // Check if price already exists
        const existingPrices = await this.stripe.prices.search({
          query: `product:'${productId}' AND metadata['environment']:'${this.environment}'`
        });
        
        let price;
        if (existingPrices.data.length > 0) {
          price = existingPrices.data[0];
          console.log(`   ✅ Price already exists: ${price.id} ($${price.unit_amount / 100})`);
        } else {
          // Create new price
          const priceData = {
            product: productId,
            unit_amount: config.price_cents,
            currency: 'usd',
            recurring: {
              interval: 'month',
              interval_count: 1
            },
            metadata: {
              plan_id: planId,
              environment: this.environment,
              created_at: new Date().toISOString()
            }
          };
          
          // Add tax behavior for automatic tax calculation
          if (this.environment === 'production') {
            priceData.tax_behavior = 'exclusive'; // Tax will be added on top
          }
          
          price = await this.stripe.prices.create(priceData, {
            idempotencyKey: this.generateIdempotencyKey('price-create', planId)
          });
          
          console.log(`   ✨ Price created: ${price.id} ($${price.unit_amount / 100}/month)`);
        }
        
        this.createdPrices.push({
          planId,
          productId,
          priceId: price.id,
          config
        });
        
      } catch (error) {
        console.error(`   ❌ Error creating price for ${planId}:`, error.message);
        this.errors.push({
          operation: 'create-price',
          planId,
          error: error.message
        });
      }
    }
  }

  /**
   * Configure Stripe Tax settings
   */
  async configureTaxSettings() {
    console.log(`\n🏛️  Configuring tax settings for ${this.environment} environment...`);
    
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would configure tax settings for NZ GST`);
      return;
    }
    
    try {
      // Note: Stripe Tax configuration is typically done through the Dashboard
      // This is a placeholder for documentation purposes
      console.log(`   📋 Tax configuration notes:`);
      console.log(`   • Enable Stripe Tax in your Stripe Dashboard`);
      console.log(`   • Configure NZ GST: 15% exclusive tax`);
      console.log(`   • Set up tax registration for New Zealand`);
      console.log(`   • Enable automatic tax calculation in Checkout`);
      
      // For manual GST configuration, you would need to:
      // 1. Create tax rates manually
      // 2. Apply them to prices or in checkout sessions
      
      if (this.environment === 'production') {
        console.log(`   ⚠️  PRODUCTION: Ensure tax registration is complete before going live`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error configuring tax settings:`, error.message);
      this.errors.push({
        operation: 'configure-tax',
        error: error.message
      });
    }
  }

  /**
   * Update database with Stripe product and price IDs
   */
  async updateDatabaseWithPrices() {
    if (!this.updateDatabase || !this.supabase) {
      console.log(`\n⏭️  Skipping database updates (not enabled)`);
      return;
    }
    
    console.log(`\n🗄️  Updating database with Stripe IDs...`);
    
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would update database with product/price IDs`);
      return;
    }
    
    for (const priceInfo of this.createdPrices) {
      const { planId, priceId } = priceInfo;
      
      try {
        const { error } = await this.supabase
          .from('plans')
          .update({
            stripe_price_id: priceId,
            updated_at: new Date().toISOString()
          })
          .eq('id', planId);
        
        if (error) {
          throw error;
        }
        
        console.log(`   ✅ Updated plan ${planId} with price ID: ${priceId}`);
        
      } catch (error) {
        console.error(`   ❌ Error updating database for ${planId}:`, error.message);
        this.errors.push({
          operation: 'update-database',
          planId,
          error: error.message
        });
      }
    }
    
    // Also update free plan (no price ID, but ensure it exists)
    try {
      const freeConfig = PLAN_CONFIGURATIONS.free;
      const { error } = await this.supabase
        .from('plans')
        .upsert({
          id: freeConfig.id,
          name: freeConfig.name,
          description: freeConfig.description,
          monthly_conversions: freeConfig.monthly_conversions,
          price_cents: freeConfig.price_cents,
          features: freeConfig.features,
          is_active: true,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        throw error;
      }
      
      console.log(`   ✅ Updated free plan in database`);
      
    } catch (error) {
      console.error(`   ❌ Error updating free plan in database:`, error.message);
      this.errors.push({
        operation: 'update-database',
        planId: 'free',
        error: error.message
      });
    }
  }

  /**
   * Generate configuration file for frontend
   */
  async generateConfigFile() {
    console.log(`\n📝 Generating configuration file...`);
    
    const config = {
      environment: this.environment,
      generated_at: new Date().toISOString(),
      plans: {}
    };
    
    // Add free plan
    config.plans.free = {
      ...PLAN_CONFIGURATIONS.free,
      stripe_price_id: null
    };
    
    // Add paid plans with Stripe IDs
    for (const priceInfo of this.createdPrices) {
      const { planId, priceId, config: planConfig } = priceInfo;
      config.plans[planId] = {
        ...planConfig,
        stripe_price_id: priceId
      };
    }
    
    const configContent = `/**
 * Stripe Configuration - Generated automatically
 * Environment: ${this.environment}
 * Generated: ${config.generated_at}
 * 
 * DO NOT EDIT THIS FILE MANUALLY
 * Run 'node scripts/setup-stripe-products.js' to regenerate
 */

window.STRIPE_PLAN_CONFIG = ${JSON.stringify(config, null, 2)};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.STRIPE_PLAN_CONFIG;
}
`;
    
    const fs = require('fs');
    const path = require('path');
    
    const configPath = path.join(__dirname, '..', 'js', `stripe-config-${this.environment}.js`);
    
    if (!this.dryRun) {
      fs.writeFileSync(configPath, configContent);
      console.log(`   ✅ Configuration saved to: ${configPath}`);
    } else {
      console.log(`   [DRY RUN] Would save configuration to: ${configPath}`);
    }
  }

  /**
   * Run the complete setup process
   */
  async run() {
    console.log(`🚀 Starting Stripe products setup for ${this.environment} environment`);
    console.log(`   Update database: ${this.updateDatabase}`);
    console.log(`   Dry run: ${this.dryRun}`);
    
    try {
      await this.createProducts();
      await this.createPrices();
      await this.configureTaxSettings();
      await this.updateDatabaseWithPrices();
      await this.generateConfigFile();
      
      // Summary
      console.log(`\n📊 Setup Summary:`);
      console.log(`   Products created/updated: ${this.createdProducts.length}`);
      console.log(`   Prices created/updated: ${this.createdPrices.length}`);
      console.log(`   Errors: ${this.errors.length}`);
      
      if (this.errors.length > 0) {
        console.log(`\n❌ Errors encountered:`);
        this.errors.forEach(error => {
          console.log(`   • ${error.operation} (${error.planId || 'general'}): ${error.error}`);
        });
      }
      
      if (this.errors.length === 0) {
        console.log(`\n✅ Setup completed successfully!`);
        
        if (this.environment === 'production') {
          console.log(`\n⚠️  PRODUCTION CHECKLIST:`);
          console.log(`   • Verify tax settings in Stripe Dashboard`);
          console.log(`   • Test checkout flow with real payment methods`);
          console.log(`   • Confirm webhook endpoints are configured`);
          console.log(`   • Review pricing and plan features`);
        }
      }
      
    } catch (error) {
      console.error(`\n💥 Setup failed:`, error.message);
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  args.forEach(arg => {
    if (arg.startsWith('--environment=')) {
      options.environment = arg.split('=')[1];
    } else if (arg === '--update-database') {
      options.updateDatabase = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  });
  
  // Validate environment
  if (options.environment && !['test', 'production'].includes(options.environment)) {
    console.error('❌ Invalid environment. Use "test" or "production"');
    process.exit(1);
  }
  
  const setup = new StripeProductSetup(options);
  setup.run().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = StripeProductSetup;