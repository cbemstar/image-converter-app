#!/usr/bin/env node

/**
 * Production Deployment Script
 * 
 * This script handles the deployment of the image converter app to production.
 * It includes database migrations, Edge Function deployment, and configuration validation.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProductionDeployer {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_WEBHOOK_SECRET'
    ];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  validateEnvironment() {
    this.log('Validating production environment variables...');
    
    const missing = [];
    for (const envVar of this.requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }

    if (missing.length > 0) {
      this.log(`Missing required environment variables: ${missing.join(', ')}`, 'error');
      process.exit(1);
    }

    this.log('Environment validation passed');
  }

  validateSupabaseConnection() {
    this.log('Validating Supabase connection...');
    
    try {
      execSync('supabase status', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      this.log('Supabase connection validated');
    } catch (error) {
      this.log('Failed to connect to Supabase. Please check your configuration.', 'error');
      throw error;
    }
  }

  runDatabaseMigrations() {
    this.log('Running database migrations...');
    
    try {
      execSync('supabase db push', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      this.log('Database migrations completed successfully');
    } catch (error) {
      this.log('Database migration failed', 'error');
      throw error;
    }
  }

  deployEdgeFunctions() {
    this.log('Deploying Edge Functions...');
    
    const functionsDir = path.join(this.projectRoot, 'supabase', 'functions');
    
    if (!fs.existsSync(functionsDir)) {
      this.log('No Edge Functions directory found, skipping...', 'warn');
      return;
    }

    try {
      execSync('supabase functions deploy', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      this.log('Edge Functions deployed successfully');
    } catch (error) {
      this.log('Edge Functions deployment failed', 'error');
      throw error;
    }
  }

  setupStorageBuckets() {
    this.log('Setting up storage buckets...');
    
    const storageSetupPath = path.join(this.projectRoot, 'sql', 'storage-setup.sql');
    
    if (fs.existsSync(storageSetupPath)) {
      try {
        execSync(`supabase db reset --db-url "${process.env.SUPABASE_URL}" --linked`, {
          cwd: this.projectRoot,
          stdio: 'inherit'
        });
        this.log('Storage buckets configured successfully');
      } catch (error) {
        this.log('Storage bucket setup failed', 'error');
        throw error;
      }
    } else {
      this.log('No storage setup script found, skipping...', 'warn');
    }
  }

  generateProductionConfig() {
    this.log('Generating production configuration...');
    
    try {
      execSync('npm run generate:public-config', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      this.log('Production configuration generated');
    } catch (error) {
      this.log('Failed to generate production configuration', 'error');
      throw error;
    }
  }

  runProductionTests() {
    this.log('Running production readiness tests...');
    
    try {
      // Run database tests
      execSync('npm run test:db', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      // Run integration tests
      execSync('npm run test:integration', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      this.log('Production tests passed');
    } catch (error) {
      this.log('Production tests failed', 'error');
      throw error;
    }
  }

  setupStripeProducts() {
    this.log('Setting up Stripe products in production...');
    
    try {
      execSync('npm run stripe:setup-prod', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      this.log('Stripe products configured successfully');
    } catch (error) {
      this.log('Stripe product setup failed', 'error');
      throw error;
    }
  }

  async deploy() {
    try {
      this.log('Starting production deployment...');
      
      // Pre-deployment checks
      this.validateEnvironment();
      this.validateSupabaseConnection();
      
      // Generate configuration
      this.generateProductionConfig();
      
      // Database setup
      this.runDatabaseMigrations();
      this.setupStorageBuckets();
      
      // Function deployment
      this.deployEdgeFunctions();
      
      // External service setup
      this.setupStripeProducts();
      
      // Post-deployment validation
      this.runProductionTests();
      
      this.log('🎉 Production deployment completed successfully!');
      this.log('Next steps:');
      this.log('1. Update your domain DNS settings');
      this.log('2. Configure Stripe webhook endpoints');
      this.log('3. Set up monitoring and alerting');
      this.log('4. Verify OAuth redirect URLs');
      
    } catch (error) {
      this.log('Production deployment failed', 'error');
      console.error(error);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const deployer = new ProductionDeployer();
  
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const skipTests = args.includes('--skip-tests');
  
  if (isDryRun) {
    console.log('🔍 Dry run mode - validating configuration only');
    deployer.validateEnvironment();
    deployer.validateSupabaseConnection();
    console.log('✅ Dry run completed - configuration is valid');
  } else {
    deployer.deploy();
  }
}

module.exports = ProductionDeployer;