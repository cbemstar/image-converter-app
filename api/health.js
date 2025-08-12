/**
 * Production Health Check Endpoint
 * 
 * This endpoint provides comprehensive health checks for the production environment
 * including database connectivity, Stripe integration, and system status.
 */

const { createClient } = require('@supabase/supabase-js');

class HealthChecker {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
    
    this.checks = {
      database: this.checkDatabase.bind(this),
      storage: this.checkStorage.bind(this),
      stripe: this.checkStripe.bind(this),
      edgeFunctions: this.checkEdgeFunctions.bind(this),
      environment: this.checkEnvironment.bind(this)
    };
  }

  async checkDatabase() {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      return {
        status: 'healthy',
        message: 'Database connection successful',
        responseTime: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        error: error.message
      };
    }
  }

  async checkStorage() {
    try {
      const { data, error } = await this.supabase.storage
        .from('conversions')
        .list('', { limit: 1 });
      
      if (error && error.message !== 'The resource was not found') {
        throw error;
      }
      
      return {
        status: 'healthy',
        message: 'Storage access successful'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Storage access failed: ${error.message}`,
        error: error.message
      };
    }
  }

  async checkStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        status: 'unhealthy',
        message: 'Stripe secret key not configured'
      };
    }

    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      await stripe.products.list({ limit: 1 });
      
      return {
        status: 'healthy',
        message: 'Stripe API connection successful'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Stripe API connection failed: ${error.message}`,
        error: error.message
      };
    }
  }

  async checkEdgeFunctions() {
    try {
      // Check if Edge Functions are deployed by testing a simple function
      const { data, error } = await this.supabase.functions.invoke('health-check', {
        body: { test: true }
      });
      
      return {
        status: 'healthy',
        message: 'Edge Functions accessible'
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Edge Functions may not be deployed or accessible',
        error: error.message
      };
    }
  }

  checkEnvironment() {
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY'
    ];

    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      return {
        status: 'unhealthy',
        message: `Missing environment variables: ${missing.join(', ')}`,
        missing
      };
    }

    return {
      status: 'healthy',
      message: 'All required environment variables are set',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  async runAllChecks() {
    const results = {};
    const startTime = Date.now();
    
    for (const [name, checkFn] of Object.entries(this.checks)) {
      const checkStart = Date.now();
      try {
        results[name] = await checkFn();
        results[name].responseTime = Date.now() - checkStart;
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          message: `Health check failed: ${error.message}`,
          error: error.message,
          responseTime: Date.now() - checkStart
        };
      }
    }

    const overallStatus = Object.values(results).every(r => r.status === 'healthy') 
      ? 'healthy' 
      : Object.values(results).some(r => r.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      checks: results,
      version: process.env.npm_package_version || '1.0.0'
    };
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const healthChecker = new HealthChecker();
    const healthStatus = await healthChecker.runAllChecks();
    
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      message: 'Health check system failure',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};