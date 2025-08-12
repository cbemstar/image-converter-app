/**
 * Health check API endpoint for monitoring system
 * Implements requirement 17.1: Real-time monitoring dashboards
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const healthStatus = await performHealthChecks();
    const responseTime = Date.now() - startTime;
    
    // Add response time header
    res.setHeader('x-response-time', `${responseTime}ms`);
    
    const overallStatus = healthStatus.checks.every(check => check.status === 'healthy') 
      ? 'healthy' 
      : 'unhealthy';
    
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    
    return res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks: healthStatus.checks,
      metrics: healthStatus.metrics
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error.message
    });
  }
}

async function performHealthChecks() {
  const checks = [];
  const metrics = {};
  
  // Database connectivity check
  try {
    const { data, error } = await supabase
      .from('system_logs')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    checks.push({
      component: 'database',
      status: 'healthy',
      message: 'Database connection successful'
    });
  } catch (error) {
    checks.push({
      component: 'database',
      status: 'unhealthy',
      message: 'Database connection failed',
      error: error.message
    });
  }
  
  // Webhook metrics check
  try {
    const { data: webhookMetrics, error } = await supabase
      .rpc('get_webhook_success_rate', {
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString()
      });
    
    if (error) throw error;
    
    const successRate = webhookMetrics || 100;
    metrics.webhookSuccessRate = successRate;
    
    checks.push({
      component: 'webhooks',
      status: successRate >= 90 ? 'healthy' : 'unhealthy',
      message: `Webhook success rate: ${successRate.toFixed(1)}%`,
      value: successRate
    });
  } catch (error) {
    checks.push({
      component: 'webhooks',
      status: 'unknown',
      message: 'Unable to check webhook metrics',
      error: error.message
    });
  }
  
  // Quota write metrics check
  try {
    const { data: quotaFailureRate, error } = await supabase
      .rpc('get_quota_write_failure_rate', {
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString()
      });
    
    if (error) throw error;
    
    const failureRate = quotaFailureRate || 0;
    metrics.quotaWriteFailureRate = failureRate;
    
    checks.push({
      component: 'quota_writes',
      status: failureRate <= 5 ? 'healthy' : 'unhealthy',
      message: `Quota write failure rate: ${failureRate.toFixed(1)}%`,
      value: failureRate
    });
  } catch (error) {
    checks.push({
      component: 'quota_writes',
      status: 'unknown',
      message: 'Unable to check quota write metrics',
      error: error.message
    });
  }
  
  // Recent error rate check
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: errorLogs, error } = await supabase
      .from('system_logs')
      .select('count')
      .eq('level', 'error')
      .gte('timestamp', oneHourAgo);
    
    if (error) throw error;
    
    const errorCount = errorLogs?.length || 0;
    metrics.recentErrors = errorCount;
    
    checks.push({
      component: 'error_rate',
      status: errorCount < 10 ? 'healthy' : 'warning',
      message: `Recent errors (1h): ${errorCount}`,
      value: errorCount
    });
  } catch (error) {
    checks.push({
      component: 'error_rate',
      status: 'unknown',
      message: 'Unable to check error rate',
      error: error.message
    });
  }
  
  // Critical alerts check
  try {
    const { data: criticalAlerts, error } = await supabase
      .from('critical_alerts')
      .select('count')
      .eq('acknowledged', false);
    
    if (error) throw error;
    
    const alertCount = criticalAlerts?.length || 0;
    metrics.unacknowledgedAlerts = alertCount;
    
    checks.push({
      component: 'critical_alerts',
      status: alertCount === 0 ? 'healthy' : 'critical',
      message: `Unacknowledged critical alerts: ${alertCount}`,
      value: alertCount
    });
  } catch (error) {
    checks.push({
      component: 'critical_alerts',
      status: 'unknown',
      message: 'Unable to check critical alerts',
      error: error.message
    });
  }
  
  // System resource check (simplified)
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    metrics.memoryUsageMB = memoryUsageMB;
    
    checks.push({
      component: 'memory',
      status: memoryUsageMB < 500 ? 'healthy' : 'warning',
      message: `Memory usage: ${memoryUsageMB}MB`,
      value: memoryUsageMB
    });
  } catch (error) {
    checks.push({
      component: 'memory',
      status: 'unknown',
      message: 'Unable to check memory usage',
      error: error.message
    });
  }
  
  return { checks, metrics };
}