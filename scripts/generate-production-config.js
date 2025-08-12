#!/usr/bin/env node

/**
 * Production Configuration Generator
 * 
 * This script generates production-ready configuration files for the frontend
 * and validates that all required environment variables are set.
 */

const fs = require('fs');
const path = require('path');

class ProductionConfigGenerator {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.outputPath = path.join(this.projectRoot, 'js', 'production-config.js');
  }

  validateRequiredVars() {
    const required = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'STRIPE_PUBLISHABLE_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  generateConfig() {
    this.validateRequiredVars();

    const config = {
      supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY
      },
      stripe: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
      },
      oauth: {
        githubClientId: process.env.SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID || '',
        googleClientId: process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID || ''
      },
      features: {
        billing: process.env.ENABLE_BILLING === 'true',
        oauth: process.env.ENABLE_OAUTH === 'true',
        monitoring: process.env.ENABLE_MONITORING === 'true'
      },
      limits: {
        free: {
          storage: parseInt(process.env.FREE_LIMIT_STORAGE) || 52428800,
          conversions: parseInt(process.env.FREE_LIMIT_CONVERSIONS) || 500,
          apiCalls: parseInt(process.env.FREE_LIMIT_API_CALLS) || 5000,
          maxFileSize: parseInt(process.env.FREE_LIMIT_MAX_FILE_SIZE) || 26214400
        },
        pro: {
          storage: parseInt(process.env.PRO_LIMIT_STORAGE) || 2147483648,
          conversions: parseInt(process.env.PRO_LIMIT_CONVERSIONS) || 5000,
          apiCalls: parseInt(process.env.PRO_LIMIT_API_CALLS) || 50000,
          maxFileSize: parseInt(process.env.PRO_LIMIT_MAX_FILE_SIZE) || 104857600
        },
        agency: {
          storage: parseInt(process.env.AGENCY_LIMIT_STORAGE) || 21474836480,
          conversions: parseInt(process.env.AGENCY_LIMIT_CONVERSIONS) || 50000,
          apiCalls: parseInt(process.env.AGENCY_LIMIT_API_CALLS) || 500000,
          maxFileSize: parseInt(process.env.AGENCY_LIMIT_MAX_FILE_SIZE) || 262144000
        }
      },
      site: {
        url: process.env.SITE_URL || 'https://localhost:3000',
        environment: 'production'
      }
    };

    return config;
  }

  writeConfigFile(config) {
    const configContent = `/**
 * Production Configuration
 * Generated automatically - DO NOT EDIT MANUALLY
 * 
 * This file contains production-safe configuration values.
 * Secret keys are never included in frontend code.
 */

// Supabase Configuration (Frontend Safe)
window.SUPABASE_CONFIG = {
  SUPABASE_URL: '${config.supabase.url}',
  SUPABASE_ANON_KEY: '${config.supabase.anonKey}'
};

// Stripe Configuration (Frontend Safe - Only Publishable Key)
window.STRIPE_CONFIG = {
  STRIPE_PUBLISHABLE_KEY: '${config.stripe.publishableKey}'
};

// OAuth Configuration
window.OAUTH_CONFIG = {
  GITHUB_CLIENT_ID: '${config.oauth.githubClientId}',
  GOOGLE_CLIENT_ID: '${config.oauth.googleClientId}'
};

// Feature Flags
window.FEATURE_FLAGS = {
  BILLING_ENABLED: ${config.features.billing},
  OAUTH_ENABLED: ${config.features.oauth},
  MONITORING_ENABLED: ${config.features.monitoring}
};

// Plan Limits
window.PLAN_LIMITS = {
  FREE: {
    STORAGE: ${config.limits.free.storage},
    CONVERSIONS: ${config.limits.free.conversions},
    API_CALLS: ${config.limits.free.apiCalls},
    MAX_FILE_SIZE: ${config.limits.free.maxFileSize}
  },
  PRO: {
    STORAGE: ${config.limits.pro.storage},
    CONVERSIONS: ${config.limits.pro.conversions},
    API_CALLS: ${config.limits.pro.apiCalls},
    MAX_FILE_SIZE: ${config.limits.pro.maxFileSize}
  },
  AGENCY: {
    STORAGE: ${config.limits.agency.storage},
    CONVERSIONS: ${config.limits.agency.conversions},
    API_CALLS: ${config.limits.agency.apiCalls},
    MAX_FILE_SIZE: ${config.limits.agency.maxFileSize}
  }
};

// Site Configuration
window.SITE_CONFIG = {
  URL: '${config.site.url}',
  ENVIRONMENT: '${config.site.environment}'
};

console.log('Production configuration loaded');
console.log('Environment:', window.SITE_CONFIG.ENVIRONMENT);
console.log('Features enabled:', Object.keys(window.FEATURE_FLAGS).filter(key => window.FEATURE_FLAGS[key]));
`;

    fs.writeFileSync(this.outputPath, configContent);
    console.log(`✅ Production configuration written to: ${this.outputPath}`);
  }

  generate() {
    try {
      console.log('🔧 Generating production configuration...');
      
      const config = this.generateConfig();
      this.writeConfigFile(config);
      
      console.log('✅ Production configuration generated successfully');
      console.log('📋 Configuration summary:');
      console.log(`   Supabase URL: ${config.supabase.url}`);
      console.log(`   Stripe Publishable Key: ${config.stripe.publishableKey.substring(0, 20)}...`);
      console.log(`   Features enabled: ${Object.keys(config.features).filter(key => config.features[key]).join(', ')}`);
      
    } catch (error) {
      console.error('❌ Failed to generate production configuration:', error.message);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const generator = new ProductionConfigGenerator();
  generator.generate();
}

module.exports = ProductionConfigGenerator;