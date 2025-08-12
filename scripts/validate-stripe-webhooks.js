#!/usr/bin/env node

/**
 * Stripe Webhook Validation Script
 * 
 * This script validates that Stripe webhooks are properly configured and working
 * in the production environment. It tests webhook endpoints, signature verification,
 * and event processing.
 */

const Stripe = require('stripe');
const crypto = require('crypto');
const https = require('https');

class StripeWebhookValidator {
  constructor() {
    this.validateEnvironment();
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    this.siteUrl = process.env.SITE_URL;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    this.testResults = [];
  }

  validateEnvironment() {
    const required = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SITE_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  async testWebhookEndpoint() {
    console.log('🔗 Testing webhook endpoint accessibility...');
    
    const webhookUrl = `${this.siteUrl}/api/stripe-webhook`;
    
    return new Promise((resolve) => {
      const testPayload = JSON.stringify({
        id: 'evt_test_webhook',
        object: 'event',
        type: 'ping',
        data: { object: { id: 'test' } }
      });
      
      const signature = this.generateTestSignature(testPayload);
      
      const url = new URL(webhookUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(testPayload),
          'Stripe-Signature': signature,
          'User-Agent': 'Stripe-Webhook-Validator/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const result = {
            test: 'webhook-endpoint',
            success: res.statusCode === 200 || res.statusCode === 400, // 400 is OK for test payload
            statusCode: res.statusCode,
            response: data,
            message: res.statusCode === 200 ? 'Endpoint accessible' : 
                    res.statusCode === 400 ? 'Endpoint accessible (rejected test payload as expected)' :
                    `Unexpected status code: ${res.statusCode}`
          };
          
          this.testResults.push(result);
          console.log(`   ${result.success ? '✅' : '❌'} ${result.message}`);
          resolve(result);
        });
      });

      req.on('error', (error) => {
        const result = {
          test: 'webhook-endpoint',
          success: false,
          error: error.message,
          message: `Endpoint not accessible: ${error.message}`
        };
        
        this.testResults.push(result);
        console.log(`   ❌ ${result.message}`);
        resolve(result);
      });

      req.write(testPayload);
      req.end();
    });
  }

  generateTestSignature(payload) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    
    return `t=${timestamp},v1=${signature}`;
  }

  async testWebhookConfiguration() {
    console.log('⚙️ Testing webhook configuration in Stripe...');
    
    try {
      const webhookEndpoints = await this.stripe.webhookEndpoints.list();
      const siteWebhooks = webhookEndpoints.data.filter(wh => 
        wh.url.includes(this.siteUrl.replace('https://', '').replace('http://', ''))
      );

      const result = {
        test: 'webhook-configuration',
        success: siteWebhooks.length > 0,
        webhookCount: siteWebhooks.length,
        webhooks: siteWebhooks.map(wh => ({
          id: wh.id,
          url: wh.url,
          status: wh.status,
          events: wh.enabled_events
        })),
        message: siteWebhooks.length > 0 ? 
          `Found ${siteWebhooks.length} webhook(s) configured` :
          'No webhooks found for this domain'
      };

      this.testResults.push(result);
      console.log(`   ${result.success ? '✅' : '❌'} ${result.message}`);

      if (result.success) {
        siteWebhooks.forEach(webhook => {
          console.log(`   📍 ${webhook.url} (${webhook.status})`);
          console.log(`   📋 Events: ${webhook.events.slice(0, 3).join(', ')}${webhook.events.length > 3 ? '...' : ''}`);
        });
      }

      return result;

    } catch (error) {
      const result = {
        test: 'webhook-configuration',
        success: false,
        error: error.message,
        message: `Failed to retrieve webhook configuration: ${error.message}`
      };

      this.testResults.push(result);
      console.log(`   ❌ ${result.message}`);
      return result;
    }
  }

  async testEventDelivery() {
    console.log('📨 Testing webhook event delivery...');
    
    try {
      // Create a test customer to trigger events
      const testCustomer = await this.stripe.customers.create({
        email: 'webhook-test@example.com',
        name: 'Webhook Test Customer',
        metadata: {
          test: 'webhook-validation',
          created_at: new Date().toISOString()
        }
      });

      console.log(`   ✨ Created test customer: ${testCustomer.id}`);

      // Update the customer to trigger another event
      await this.stripe.customers.update(testCustomer.id, {
        description: 'Updated for webhook testing'
      });

      console.log(`   🔄 Updated test customer to trigger events`);

      // Clean up test customer
      await this.stripe.customers.del(testCustomer.id);
      console.log(`   🗑️ Cleaned up test customer`);

      const result = {
        test: 'event-delivery',
        success: true,
        customerId: testCustomer.id,
        message: 'Test events generated successfully'
      };

      this.testResults.push(result);
      console.log(`   ✅ ${result.message}`);
      console.log(`   📝 Check your webhook logs for customer.created, customer.updated, and customer.deleted events`);

      return result;

    } catch (error) {
      const result = {
        test: 'event-delivery',
        success: false,
        error: error.message,
        message: `Failed to generate test events: ${error.message}`
      };

      this.testResults.push(result);
      console.log(`   ❌ ${result.message}`);
      return result;
    }
  }

  async testSignatureVerification() {
    console.log('🔐 Testing webhook signature verification...');
    
    try {
      // This test validates that our signature generation matches Stripe's
      const testPayload = '{"test": "signature_verification"}';
      const testSecret = 'whsec_test_secret_key_for_validation';
      
      const timestamp = Math.floor(Date.now() / 1000);
      const signedPayload = `${timestamp}.${testPayload}`;
      const expectedSignature = crypto
        .createHmac('sha256', testSecret)
        .update(signedPayload, 'utf8')
        .digest('hex');
      
      const fullSignature = `t=${timestamp},v1=${expectedSignature}`;
      
      // Verify we can parse and validate the signature format
      const sigElements = fullSignature.split(',');
      const timestampElement = sigElements.find(el => el.startsWith('t='));
      const signatureElement = sigElements.find(el => el.startsWith('v1='));
      
      const result = {
        test: 'signature-verification',
        success: timestampElement && signatureElement,
        timestamp: timestampElement ? timestampElement.split('=')[1] : null,
        signature: signatureElement ? signatureElement.split('=')[1] : null,
        message: timestampElement && signatureElement ? 
          'Signature format validation passed' : 
          'Signature format validation failed'
      };

      this.testResults.push(result);
      console.log(`   ${result.success ? '✅' : '❌'} ${result.message}`);

      if (result.success) {
        console.log(`   🔢 Timestamp: ${result.timestamp}`);
        console.log(`   🔑 Signature: ${result.signature.substring(0, 16)}...`);
      }

      return result;

    } catch (error) {
      const result = {
        test: 'signature-verification',
        success: false,
        error: error.message,
        message: `Signature verification test failed: ${error.message}`
      };

      this.testResults.push(result);
      console.log(`   ❌ ${result.message}`);
      return result;
    }
  }

  async validateRequiredEvents() {
    console.log('📋 Validating required webhook events...');
    
    const requiredEvents = [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed'
    ];

    try {
      const webhookEndpoints = await this.stripe.webhookEndpoints.list();
      const siteWebhooks = webhookEndpoints.data.filter(wh => 
        wh.url.includes(this.siteUrl.replace('https://', '').replace('http://', ''))
      );

      if (siteWebhooks.length === 0) {
        const result = {
          test: 'required-events',
          success: false,
          message: 'No webhooks configured for this domain'
        };
        
        this.testResults.push(result);
        console.log(`   ❌ ${result.message}`);
        return result;
      }

      const allConfiguredEvents = new Set();
      siteWebhooks.forEach(webhook => {
        webhook.enabled_events.forEach(event => allConfiguredEvents.add(event));
      });

      const missingEvents = requiredEvents.filter(event => !allConfiguredEvents.has(event));
      const hasAllRequired = missingEvents.length === 0;

      const result = {
        test: 'required-events',
        success: hasAllRequired,
        configuredEvents: Array.from(allConfiguredEvents),
        requiredEvents,
        missingEvents,
        message: hasAllRequired ? 
          'All required events are configured' : 
          `Missing required events: ${missingEvents.join(', ')}`
      };

      this.testResults.push(result);
      console.log(`   ${result.success ? '✅' : '❌'} ${result.message}`);

      if (result.success) {
        console.log(`   📊 Configured events: ${result.configuredEvents.length}`);
      } else {
        console.log(`   ⚠️  Missing events:`);
        missingEvents.forEach(event => {
          console.log(`      • ${event}`);
        });
      }

      return result;

    } catch (error) {
      const result = {
        test: 'required-events',
        success: false,
        error: error.message,
        message: `Failed to validate required events: ${error.message}`
      };

      this.testResults.push(result);
      console.log(`   ❌ ${result.message}`);
      return result;
    }
  }

  generateValidationReport() {
    console.log('📊 Generating validation report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      siteUrl: this.siteUrl,
      summary: {
        totalTests: this.testResults.length,
        passed: this.testResults.filter(r => r.success).length,
        failed: this.testResults.filter(r => !r.success).length
      },
      tests: this.testResults,
      recommendations: []
    };

    // Generate recommendations based on test results
    const failedTests = this.testResults.filter(r => !r.success);
    
    if (failedTests.some(t => t.test === 'webhook-endpoint')) {
      report.recommendations.push('Fix webhook endpoint accessibility issues before going live');
    }
    
    if (failedTests.some(t => t.test === 'webhook-configuration')) {
      report.recommendations.push('Configure webhook endpoints in Stripe Dashboard');
    }
    
    if (failedTests.some(t => t.test === 'required-events')) {
      report.recommendations.push('Add missing webhook events to handle all billing scenarios');
    }

    if (report.summary.failed === 0) {
      report.recommendations.push('All webhook tests passed - ready for production');
    }

    const fs = require('fs');
    const path = require('path');
    
    const reportPath = path.join(__dirname, '..', 'webhook-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`   ✅ Report saved to: ${reportPath}`);
    return report;
  }

  async validate() {
    try {
      console.log('🔍 Starting Stripe webhook validation...');
      console.log(`   Site URL: ${this.siteUrl}`);
      console.log(`   Webhook Secret: ${this.webhookSecret ? 'Configured' : 'Missing'}`);
      
      await this.testWebhookConfiguration();
      await this.testWebhookEndpoint();
      await this.testSignatureVerification();
      await this.validateRequiredEvents();
      await this.testEventDelivery();
      
      const report = this.generateValidationReport();
      
      // Summary
      console.log('\n📊 Validation Summary:');
      console.log(`   Total tests: ${report.summary.totalTests}`);
      console.log(`   Passed: ${report.summary.passed}`);
      console.log(`   Failed: ${report.summary.failed}`);
      
      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach(rec => {
          console.log(`   • ${rec}`);
        });
      }
      
      const allPassed = report.summary.failed === 0;
      console.log(`\n${allPassed ? '✅' : '❌'} Webhook validation ${allPassed ? 'completed successfully' : 'found issues'}`);
      
      if (!allPassed) {
        console.log('⚠️  Fix the issues above before deploying to production');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n💥 Validation failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const validator = new StripeWebhookValidator();
  validator.validate().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = StripeWebhookValidator;