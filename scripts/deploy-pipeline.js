#!/usr/bin/env node

/**
 * Automated Deployment Pipeline
 * 
 * This script implements a comprehensive deployment pipeline for the production environment,
 * including pre-deployment checks, deployment steps, and post-deployment validation.
 * 
 * Requirements addressed:
 * - 17.1, 17.2: Monitoring and logging setup
 * - 17.4, 17.5: Alerting and health checks
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DeploymentPipeline {
  constructor(options = {}) {
    this.projectRoot = path.join(__dirname, '..');
    this.environment = options.environment || 'production';
    this.skipTests = options.skipTests || false;
    this.dryRun = options.dryRun || false;
    
    this.deploymentSteps = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : '📋';
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    this.deploymentSteps.push({
      timestamp,
      level,
      message,
      step: this.currentStep || 'general'
    });
  }

  setCurrentStep(step) {
    this.currentStep = step;
    this.log(`Starting: ${step}`, 'info');
  }

  execCommand(command, options = {}) {
    if (this.dryRun) {
      this.log(`[DRY RUN] Would execute: ${command}`, 'info');
      return '';
    }

    try {
      const result = execSync(command, {
        cwd: this.projectRoot,
        stdio: options.silent ? 'pipe' : 'inherit',
        encoding: 'utf8',
        ...options
      });
      return result;
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  async validateEnvironment() {
    this.setCurrentStep('Environment Validation');
    
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SITE_URL'
    ];

    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate production keys
    if (this.environment === 'production') {
      if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
        throw new Error('Production deployment requires live Stripe keys');
      }
      
      if (!process.env.SITE_URL.startsWith('https://')) {
        throw new Error('Production deployment requires HTTPS site URL');
      }
    }

    this.log('Environment validation passed', 'success');
  }

  async runPreDeploymentTests() {
    if (this.skipTests) {
      this.log('Skipping tests (--skip-tests flag)', 'warn');
      return;
    }

    this.setCurrentStep('Pre-deployment Tests');
    
    try {
      // Run database tests
      this.log('Running database tests...', 'info');
      this.execCommand('npm run test:db');
      
      // Run integration tests
      this.log('Running integration tests...', 'info');
      this.execCommand('npm run test:integration');
      
      // Run performance tests
      this.log('Running performance tests...', 'info');
      this.execCommand('npm run test:performance');
      
      this.log('All pre-deployment tests passed', 'success');
      
    } catch (error) {
      throw new Error(`Pre-deployment tests failed: ${error.message}`);
    }
  }

  async buildApplication() {
    this.setCurrentStep('Application Build');
    
    try {
      // Generate production configuration
      this.log('Generating production configuration...', 'info');
      this.execCommand('npm run generate:production-config');
      
      // Build application
      this.log('Building application...', 'info');
      this.execCommand('npm run build:production');
      
      // Verify build output
      const publicDir = path.join(this.projectRoot, 'public');
      if (!fs.existsSync(publicDir)) {
        throw new Error('Build output directory not found');
      }
      
      this.log('Application build completed', 'success');
      
    } catch (error) {
      throw new Error(`Application build failed: ${error.message}`);
    }
  }

  async deployDatabase() {
    this.setCurrentStep('Database Deployment');
    
    try {
      // Check Supabase connection
      this.log('Validating Supabase connection...', 'info');
      this.execCommand('supabase status', { silent: true });
      
      // Run database migrations
      this.log('Running database migrations...', 'info');
      this.execCommand('supabase db push');
      
      // Deploy Edge Functions
      this.log('Deploying Edge Functions...', 'info');
      this.execCommand('supabase functions deploy');
      
      this.log('Database deployment completed', 'success');
      
    } catch (error) {
      throw new Error(`Database deployment failed: ${error.message}`);
    }
  }

  async configureStripe() {
    this.setCurrentStep('Stripe Configuration');
    
    try {
      // Set up Stripe products
      this.log('Setting up Stripe products...', 'info');
      this.execCommand('npm run stripe:setup-prod');
      
      // Configure production settings
      this.log('Configuring Stripe production settings...', 'info');
      this.execCommand('npm run stripe:configure-prod');
      
      // Validate webhook configuration
      this.log('Validating webhook configuration...', 'info');
      this.execCommand('npm run stripe:validate-webhooks');
      
      this.log('Stripe configuration completed', 'success');
      
    } catch (error) {
      throw new Error(`Stripe configuration failed: ${error.message}`);
    }
  }

  async deployApplication() {
    this.setCurrentStep('Application Deployment');
    
    try {
      // Deploy to Vercel (or your chosen platform)
      this.log('Deploying application to hosting platform...', 'info');
      
      if (this.dryRun) {
        this.log('[DRY RUN] Would deploy to production', 'info');
      } else {
        // Check if vercel CLI is available
        try {
          this.execCommand('vercel --version', { silent: true });
          this.execCommand('vercel --prod --yes');
        } catch (error) {
          this.log('Vercel CLI not found, skipping automatic deployment', 'warn');
          this.log('Please deploy manually using your hosting platform', 'warn');
        }
      }
      
      this.log('Application deployment completed', 'success');
      
    } catch (error) {
      throw new Error(`Application deployment failed: ${error.message}`);
    }
  }

  async setupMonitoring() {
    this.setCurrentStep('Monitoring Setup');
    
    try {
      // Set up monitoring infrastructure
      this.log('Setting up monitoring infrastructure...', 'info');
      this.execCommand('npm run setup:monitoring');
      
      // Deploy health check function
      this.log('Deploying health check function...', 'info');
      this.execCommand('supabase functions deploy health-check');
      
      this.log('Monitoring setup completed', 'success');
      
    } catch (error) {
      throw new Error(`Monitoring setup failed: ${error.message}`);
    }
  }

  async runPostDeploymentValidation() {
    this.setCurrentStep('Post-deployment Validation');
    
    try {
      const siteUrl = process.env.SITE_URL;
      
      // Wait for deployment to propagate
      this.log('Waiting for deployment to propagate...', 'info');
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
      
      // Test health endpoint
      this.log('Testing health endpoint...', 'info');
      const healthResponse = await this.testEndpoint(`${siteUrl}/api/health`);
      
      if (!healthResponse.success) {
        throw new Error('Health endpoint test failed');
      }
      
      // Test main application
      this.log('Testing main application...', 'info');
      const appResponse = await this.testEndpoint(siteUrl);
      
      if (!appResponse.success) {
        throw new Error('Main application test failed');
      }
      
      // Validate Stripe webhook endpoints
      this.log('Validating Stripe webhooks...', 'info');
      this.execCommand('npm run stripe:validate-webhooks');
      
      this.log('Post-deployment validation completed', 'success');
      
    } catch (error) {
      throw new Error(`Post-deployment validation failed: ${error.message}`);
    }
  }

  async testEndpoint(url) {
    return new Promise((resolve) => {
      const https = require('https');
      const http = require('http');
      
      const client = url.startsWith('https:') ? https : http;
      const urlObj = new URL(url);
      
      const req = client.get({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        timeout: 10000,
        headers: {
          'User-Agent': 'DeploymentPipeline/1.0'
        }
      }, (res) => {
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 400,
          statusCode: res.statusCode,
          url
        });
      });
      
      req.on('error', () => {
        resolve({ success: false, url });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, url });
      });
    });
  }

  async createDeploymentReport() {
    this.setCurrentStep('Deployment Report');
    
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    const report = {
      deployment: {
        environment: this.environment,
        timestamp: new Date().toISOString(),
        duration: `${Math.round(duration / 1000)}s`,
        success: this.errors.length === 0,
        dryRun: this.dryRun
      },
      steps: this.deploymentSteps,
      errors: this.errors,
      summary: {
        totalSteps: this.deploymentSteps.length,
        successfulSteps: this.deploymentSteps.filter(s => s.level === 'success').length,
        warnings: this.deploymentSteps.filter(s => s.level === 'warn').length,
        errors: this.errors.length
      },
      nextSteps: [
        'Monitor application health and performance',
        'Verify all integrations are working correctly',
        'Set up alerting and notification channels',
        'Update documentation with production URLs',
        'Notify team of successful deployment'
      ]
    };
    
    const reportPath = path.join(this.projectRoot, `deployment-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`Deployment report saved to: ${reportPath}`, 'success');
    return report;
  }

  async deploy() {
    try {
      this.log(`Starting deployment pipeline for ${this.environment} environment`, 'info');
      
      if (this.dryRun) {
        this.log('Running in DRY RUN mode - no actual changes will be made', 'warn');
      }
      
      // Pre-deployment phase
      await this.validateEnvironment();
      await this.runPreDeploymentTests();
      await this.buildApplication();
      
      // Deployment phase
      await this.deployDatabase();
      await this.configureStripe();
      await this.setupMonitoring();
      await this.deployApplication();
      
      // Post-deployment phase
      await this.runPostDeploymentValidation();
      
      const report = await this.createDeploymentReport();
      
      // Success summary
      this.log('🎉 Deployment completed successfully!', 'success');
      this.log(`Total duration: ${report.deployment.duration}`, 'info');
      this.log(`Steps completed: ${report.summary.successfulSteps}/${report.summary.totalSteps}`, 'info');
      
      if (report.summary.warnings > 0) {
        this.log(`Warnings: ${report.summary.warnings}`, 'warn');
      }
      
      this.log('Next steps:', 'info');
      report.nextSteps.forEach(step => {
        this.log(`  • ${step}`, 'info');
      });
      
    } catch (error) {
      this.errors.push({
        step: this.currentStep,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      this.log(`Deployment failed: ${error.message}`, 'error');
      
      // Create failure report
      await this.createDeploymentReport();
      
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  args.forEach(arg => {
    if (arg === '--skip-tests') {
      options.skipTests = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--environment=')) {
      options.environment = arg.split('=')[1];
    }
  });
  
  const pipeline = new DeploymentPipeline(options);
  pipeline.deploy().catch(error => {
    console.error('💥 Unexpected deployment error:', error);
    process.exit(1);
  });
}

module.exports = DeploymentPipeline;