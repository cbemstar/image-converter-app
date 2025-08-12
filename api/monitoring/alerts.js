/**
 * API endpoint for alert management
 * Implements requirement 17.4, 17.5: Alert management and notification
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'POST':
        return await handleCreateAlert(req, res);
      case 'GET':
        return await handleGetAlerts(req, res);
      case 'PUT':
        return await handleUpdateAlert(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Alerts API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateAlert(req, res) {
  const alert = req.body;

  // Validate alert data
  if (!alert || !alert.name || !alert.severity || !alert.message) {
    return res.status(400).json({ error: 'Invalid alert format' });
  }

  try {
    // Store alert in database
    const { data, error } = await supabase
      .from('system_alerts')
      .insert({
        alert_type: alert.name,
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata || {},
        created_at: alert.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to store alert:', error);
      return res.status(500).json({ error: 'Failed to store alert' });
    }

    // Check if this is a critical alert that needs immediate attention
    if (alert.severity === 'critical') {
      await handleCriticalAlert(alert);
    }

    return res.status(201).json({ 
      success: true, 
      alert: data,
      id: data.id 
    });
  } catch (error) {
    console.error('Alert creation error:', error);
    return res.status(500).json({ error: 'Failed to create alert' });
  }
}

async function handleGetAlerts(req, res) {
  const {
    severity,
    resolved,
    limit = 50,
    offset = 0,
    startTime,
    endTime
  } = req.query;

  try {
    let query = supabase
      .from('system_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (severity) {
      query = query.eq('severity', severity);
    }

    if (resolved !== undefined) {
      query = query.eq('resolved', resolved === 'true');
    }

    if (startTime) {
      query = query.gte('created_at', startTime);
    }

    if (endTime) {
      query = query.lte('created_at', endTime);
    }

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: alerts, error, count } = await query;

    if (error) {
      console.error('Failed to retrieve alerts:', error);
      return res.status(500).json({ error: 'Failed to retrieve alerts' });
    }

    // Get alert statistics
    const stats = await getAlertStatistics();

    return res.status(200).json({
      alerts: alerts || [],
      total: count || 0,
      offset: parseInt(offset),
      limit: parseInt(limit),
      stats
    });
  } catch (error) {
    console.error('Alert retrieval error:', error);
    return res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
}

async function handleUpdateAlert(req, res) {
  const { alertId, resolved, resolvedBy } = req.body;

  if (!alertId) {
    return res.status(400).json({ error: 'Alert ID is required' });
  }

  try {
    const updateData = {};
    
    if (resolved !== undefined) {
      updateData.resolved = resolved;
      if (resolved) {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = resolvedBy || 'api';
      }
    }

    const { data, error } = await supabase
      .from('system_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update alert:', error);
      return res.status(500).json({ error: 'Failed to update alert' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.status(200).json({ 
      success: true, 
      alert: data 
    });
  } catch (error) {
    console.error('Alert update error:', error);
    return res.status(500).json({ error: 'Failed to update alert' });
  }
}

async function getAlertStatistics() {
  try {
    // Get counts by severity for active alerts
    const { data: severityCounts, error: severityError } = await supabase
      .from('system_alerts')
      .select('severity')
      .eq('resolved', false);

    if (severityError) {
      console.error('Failed to get severity counts:', severityError);
      return {};
    }

    const stats = {
      active: severityCounts?.length || 0,
      critical: severityCounts?.filter(a => a.severity === 'critical').length || 0,
      warning: severityCounts?.filter(a => a.severity === 'warning').length || 0,
      info: severityCounts?.filter(a => a.severity === 'info').length || 0
    };

    // Get total resolved alerts count
    const { count: resolvedCount, error: resolvedError } = await supabase
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', true);

    if (!resolvedError) {
      stats.resolved = resolvedCount || 0;
      stats.total = stats.active + stats.resolved;
    }

    return stats;
  } catch (error) {
    console.error('Failed to get alert statistics:', error);
    return {};
  }
}

async function handleCriticalAlert(alert) {
  try {
    // Store in critical alerts table for immediate attention
    await supabase
      .from('critical_alerts')
      .insert({
        alert_type: alert.name,
        component: alert.metadata?.component || 'unknown',
        message: alert.message,
        metadata: alert.metadata || {},
        created_at: alert.timestamp || new Date().toISOString()
      });

    // In a real implementation, you would:
    // 1. Send immediate notifications (SMS, Slack, PagerDuty, etc.)
    // 2. Create incident tickets
    // 3. Escalate to on-call engineers
    
    console.error('CRITICAL ALERT:', {
      name: alert.name,
      message: alert.message,
      timestamp: alert.timestamp
    });

    // Example: Send to external alerting service
    if (process.env.CRITICAL_ALERT_WEBHOOK) {
      try {
        await fetch(process.env.CRITICAL_ALERT_WEBHOOK, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `🚨 CRITICAL ALERT: ${alert.message}`,
            alert: alert,
            timestamp: new Date().toISOString()
          })
        });
      } catch (webhookError) {
        console.error('Failed to send critical alert webhook:', webhookError);
      }
    }

  } catch (error) {
    console.error('Failed to handle critical alert:', error);
  }
}