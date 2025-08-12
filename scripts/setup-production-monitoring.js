#!/usr/bin/env node

/**
 * Production Monitoring Setup
 * 
 * This script sets up monitoring, alerting, and observability for the production environment.
 * It configures health checks, error tracking, and performance monitoring.
 */

const fs = require('fs');
const path = require('path');

class ProductionMonitoringSetup {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
  }

  createHealthCheckFunction() {
    const functionPath = path.join(this.projectRoot, 'supabase', 'functions', 'health-check');
    
    if (!fs.existsSync(functionPath)) {
      fs.mkdirSync(functionPath, { recursive: true });
    }

    const healthCheckCode = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Basic health checks
    const checks = {
      database: await checkDatabase(supabaseClient),
      storage: await checkStorage(supabaseClient),
      timestamp: new Date().toISOString()
    }

    const allHealthy = Object.values(checks).every(check => 
      typeof check === 'object' ? check.status === 'healthy' : true
    )

    return new Response(
      JSON.stringify({
        status: allHealthy ? 'healthy' : 'degraded',
        checks,
        version: '1.0.0'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: allHealthy ? 200 : 503
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function checkDatabase(supabase) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) throw error
    
    return { status: 'healthy', message: 'Database accessible' }
  } catch (error) {
    return { status: 'unhealthy', message: error.message }
  }
}

async function checkStorage(supabase) {
  try {
    const { data, error } = await supabase.storage
      .from('conversions')
      .list('', { limit: 1 })
    
    if (error && error.message !== 'The resource was not found') {
      throw error
    }
    
    return { status: 'healthy', message: 'Storage accessible' }
  } catch (error) {
    return { status: 'unhealthy', message: error.message }
  }
}`;

    fs.writeFileSync(path.join(functionPath, 'index.ts'), healthCheckCode);
    console.log('✅ Health check Edge Function created');
  }

  createMonitoringDashboard() {
    const dashboardPath = path.join(this.projectRoot, 'monitoring-dashboard.html');
    
    const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Production Monitoring Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .dashboard {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-title {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .status-healthy { color: #10b981; }
        .status-degraded { color: #f59e0b; }
        .status-unhealthy { color: #ef4444; }
        .refresh-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
        }
        .refresh-btn:hover {
            background: #2563eb;
        }
        .logs {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .log-entry {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
            font-family: monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>Production Monitoring Dashboard</h1>
            <button class="refresh-btn" onclick="refreshMetrics()">Refresh Metrics</button>
            <span id="last-updated"></span>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">Overall Status</div>
                <div class="metric-value" id="overall-status">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Database</div>
                <div class="metric-value" id="database-status">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Storage</div>
                <div class="metric-value" id="storage-status">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Stripe Integration</div>
                <div class="metric-value" id="stripe-status">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Response Time</div>
                <div class="metric-value" id="response-time">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Edge Functions</div>
                <div class="metric-value" id="functions-status">Loading...</div>
            </div>
        </div>
        
        <div class="logs">
            <h3>Recent Health Checks</h3>
            <div id="health-logs"></div>
        </div>
    </div>

    <script>
        let healthHistory = [];
        
        async function refreshMetrics() {
            try {
                const response = await fetch('/api/health');
                const health = await response.json();
                
                updateMetrics(health);
                addToHistory(health);
                
                document.getElementById('last-updated').textContent = 
                    \`Last updated: \${new Date().toLocaleTimeString()}\`;
                    
            } catch (error) {
                console.error('Failed to fetch health metrics:', error);
                document.getElementById('overall-status').textContent = 'Error';
                document.getElementById('overall-status').className = 'metric-value status-unhealthy';
            }
        }
        
        function updateMetrics(health) {
            const statusClass = \`status-\${health.status}\`;
            
            document.getElementById('overall-status').textContent = health.status.toUpperCase();
            document.getElementById('overall-status').className = \`metric-value \${statusClass}\`;
            
            if (health.checks) {
                updateCheckStatus('database-status', health.checks.database);
                updateCheckStatus('storage-status', health.checks.storage);
                updateCheckStatus('stripe-status', health.checks.stripe);
                updateCheckStatus('functions-status', health.checks.edgeFunctions);
            }
            
            if (health.totalResponseTime) {
                document.getElementById('response-time').textContent = \`\${health.totalResponseTime}ms\`;
            }
        }
        
        function updateCheckStatus(elementId, check) {
            const element = document.getElementById(elementId);
            if (check) {
                element.textContent = check.status.toUpperCase();
                element.className = \`metric-value status-\${check.status}\`;
            }
        }
        
        function addToHistory(health) {
            healthHistory.unshift({
                timestamp: health.timestamp,
                status: health.status,
                responseTime: health.totalResponseTime
            });
            
            if (healthHistory.length > 10) {
                healthHistory = healthHistory.slice(0, 10);
            }
            
            updateHealthLogs();
        }
        
        function updateHealthLogs() {
            const logsContainer = document.getElementById('health-logs');
            logsContainer.innerHTML = healthHistory.map(entry => 
                \`<div class="log-entry">
                    \${entry.timestamp} - Status: \${entry.status} - Response: \${entry.responseTime}ms
                </div>\`
            ).join('');
        }
        
        // Auto-refresh every 30 seconds
        setInterval(refreshMetrics, 30000);
        
        // Initial load
        refreshMetrics();
    </script>
</body>
</html>`;

    fs.writeFileSync(dashboardPath, dashboardHtml);
    console.log('✅ Monitoring dashboard created');
  }

  createAlertingConfig() {
    const alertConfigPath = path.join(this.projectRoot, 'monitoring', 'alerts.json');
    
    if (!fs.existsSync(path.dirname(alertConfigPath))) {
      fs.mkdirSync(path.dirname(alertConfigPath), { recursive: true });
    }

    const alertConfig = {
      alerts: [
        {
          name: "Database Connection Failure",
          condition: "database.status != 'healthy'",
          severity: "critical",
          channels: ["email", "slack"],
          cooldown: 300
        },
        {
          name: "High Response Time",
          condition: "totalResponseTime > 5000",
          severity: "warning",
          channels: ["email"],
          cooldown: 600
        },
        {
          name: "Stripe Integration Failure",
          condition: "stripe.status != 'healthy'",
          severity: "high",
          channels: ["email", "slack"],
          cooldown: 300
        },
        {
          name: "Storage Access Failure",
          condition: "storage.status != 'healthy'",
          severity: "high",
          channels: ["email"],
          cooldown: 300
        },
        {
          name: "Edge Functions Degraded",
          condition: "edgeFunctions.status == 'degraded'",
          severity: "warning",
          channels: ["email"],
          cooldown: 900
        }
      ],
      channels: {
        email: {
          enabled: true,
          recipients: ["admin@your-domain.com"],
          smtp: {
            host: "smtp.your-provider.com",
            port: 587,
            secure: false,
            auth: {
              user: "alerts@your-domain.com",
              pass: "env:SMTP_PASSWORD"
            }
          }
        },
        slack: {
          enabled: false,
          webhook: "env:SLACK_WEBHOOK_URL",
          channel: "#alerts"
        }
      }
    };

    fs.writeFileSync(alertConfigPath, JSON.stringify(alertConfig, null, 2));
    console.log('✅ Alerting configuration created');
  }

  createUptimeMonitoring() {
    const uptimeConfigPath = path.join(this.projectRoot, 'monitoring', 'uptime.js');
    
    const uptimeScript = `/**
 * Uptime Monitoring Script
 * 
 * This script can be deployed to a separate service (like Vercel, Netlify Functions, or AWS Lambda)
 * to monitor the production application from an external perspective.
 */

const https = require('https');
const http = require('http');

class UptimeMonitor {
  constructor(config) {
    this.config = {
      url: config.url || 'https://your-domain.com',
      interval: config.interval || 60000, // 1 minute
      timeout: config.timeout || 10000, // 10 seconds
      alertThreshold: config.alertThreshold || 3, // failures before alert
      ...config
    };
    
    this.failureCount = 0;
    this.lastStatus = null;
  }

  async checkHealth() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const url = new URL(this.config.url + '/api/health');
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.get(url, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'UptimeMonitor/1.0'
        }
      }, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          try {
            const healthData = JSON.parse(data);
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              responseTime,
              health: healthData,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              responseTime,
              error: 'Invalid JSON response',
              timestamp: new Date().toISOString()
            });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout',
          responseTime: this.config.timeout,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  async sendAlert(status) {
    console.log(\`🚨 ALERT: Service is down - \${status.error || 'Unknown error'}\`);
    
    // Implement your alerting logic here:
    // - Send email
    // - Post to Slack
    // - Send SMS
    // - Create incident in PagerDuty
    
    if (this.config.webhookUrl) {
      try {
        await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: \`🚨 Service Alert: \${this.config.url} is down`,
            status,
            timestamp: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error('Failed to send webhook alert:', error);
      }
    }
  }

  async sendRecoveryNotification(status) {
    console.log(\`✅ RECOVERY: Service is back online\`);
    
    if (this.config.webhookUrl) {
      try {
        await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: \`✅ Service Recovery: \${this.config.url} is back online`,
            status,
            timestamp: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error('Failed to send recovery notification:', error);
      }
    }
  }

  async monitor() {
    const status = await this.checkHealth();
    
    console.log(\`[\${status.timestamp}] \${this.config.url} - \${status.success ? '✅' : '❌'} \${status.responseTime}ms\`);
    
    if (status.success) {
      if (this.failureCount >= this.config.alertThreshold) {
        await this.sendRecoveryNotification(status);
      }
      this.failureCount = 0;
    } else {
      this.failureCount++;
      
      if (this.failureCount >= this.config.alertThreshold && this.lastStatus?.success !== false) {
        await this.sendAlert(status);
      }
    }
    
    this.lastStatus = status;
    
    // Log to file or database for historical tracking
    if (this.config.logFile) {
      const fs = require('fs');
      fs.appendFileSync(this.config.logFile, JSON.stringify(status) + '\\n');
    }
  }

  start() {
    console.log(\`🔍 Starting uptime monitoring for \${this.config.url}\`);
    console.log(\`📊 Check interval: \${this.config.interval}ms\`);
    console.log(\`⏰ Timeout: \${this.config.timeout}ms\`);
    console.log(\`🚨 Alert threshold: \${this.config.alertThreshold} failures\`);
    
    // Initial check
    this.monitor();
    
    // Schedule regular checks
    setInterval(() => this.monitor(), this.config.interval);
  }
}

// Export for use as a module
module.exports = UptimeMonitor;

// CLI usage
if (require.main === module) {
  const config = {
    url: process.env.MONITOR_URL || 'https://your-domain.com',
    interval: parseInt(process.env.MONITOR_INTERVAL) || 60000,
    timeout: parseInt(process.env.MONITOR_TIMEOUT) || 10000,
    alertThreshold: parseInt(process.env.ALERT_THRESHOLD) || 3,
    webhookUrl: process.env.WEBHOOK_URL,
    logFile: process.env.LOG_FILE || './uptime.log'
  };
  
  const monitor = new UptimeMonitor(config);
  monitor.start();
}`;

    fs.writeFileSync(uptimeConfigPath, uptimeScript);
    console.log('✅ Uptime monitoring script created');
  }

  setup() {
    console.log('🔧 Setting up production monitoring...');
    
    this.createHealthCheckFunction();
    this.createMonitoringDashboard();
    this.createAlertingConfig();
    this.createUptimeMonitoring();
    
    console.log('✅ Production monitoring setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Deploy the health-check Edge Function: supabase functions deploy health-check');
    console.log('2. Configure alerting channels in monitoring/alerts.json');
    console.log('3. Set up external uptime monitoring using monitoring/uptime.js');
    console.log('4. Access monitoring dashboard at /monitoring-dashboard.html');
    console.log('5. Test health endpoint at /api/health');
  }
}

// CLI interface
if (require.main === module) {
  const setup = new ProductionMonitoringSetup();
  setup.setup();
}

module.exports = ProductionMonitoringSetup;