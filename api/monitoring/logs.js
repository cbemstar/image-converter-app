/**
 * API endpoint for log ingestion and retrieval
 * Implements requirement 17.1: Log aggregation and search capabilities
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'POST':
        return await handleLogIngestion(req, res);
      case 'GET':
        return await handleLogRetrieval(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Monitoring API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleLogIngestion(req, res) {
  const logEntry = req.body;

  // Validate log entry
  if (!logEntry || !logEntry.timestamp || !logEntry.level || !logEntry.message) {
    return res.status(400).json({ error: 'Invalid log entry format' });
  }

  try {
    // Store log entry in database
    const { error } = await supabase
      .from('system_logs')
      .insert({
        timestamp: logEntry.timestamp,
        level: logEntry.level,
        component: logEntry.component || 'unknown',
        message: logEntry.message,
        metadata: logEntry.metadata || {},
        session_id: logEntry.sessionId,
        user_id: logEntry.userId || null
      });

    if (error) {
      console.error('Failed to store log entry:', error);
      return res.status(500).json({ error: 'Failed to store log entry' });
    }

    // Check for critical errors and trigger alerts
    if (logEntry.level === 'error') {
      await checkForCriticalErrors(logEntry);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Log ingestion error:', error);
    return res.status(500).json({ error: 'Failed to ingest log' });
  }
}

async function handleLogRetrieval(req, res) {
  const {
    level,
    component,
    startTime,
    endTime,
    search,
    limit = 100,
    offset = 0
  } = req.query;

  try {
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    // Apply filters
    if (level) {
      query = query.eq('level', level);
    }

    if (component) {
      query = query.eq('component', component);
    }

    if (startTime) {
      query = query.gte('timestamp', startTime);
    }

    if (endTime) {
      query = query.lte('timestamp', endTime);
    }

    if (search) {
      query = query.or(`message.ilike.%${search}%,metadata->>error.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Failed to retrieve logs:', error);
      return res.status(500).json({ error: 'Failed to retrieve logs' });
    }

    return res.status(200).json({
      logs: logs || [],
      total: count || 0,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Log retrieval error:', error);
    return res.status(500).json({ error: 'Failed to retrieve logs' });
  }
}

async function checkForCriticalErrors(logEntry) {
  // Check for patterns that indicate critical issues
  const criticalPatterns = [
    'webhook.*fail',
    'quota.*write.*fail',
    'database.*connection',
    'stripe.*error',
    'authentication.*fail'
  ];

  const isCritical = criticalPatterns.some(pattern => {
    const regex = new RegExp(pattern, 'i');
    return regex.test(logEntry.message) || 
           regex.test(JSON.stringify(logEntry.metadata));
  });

  if (isCritical) {
    // Store critical error for alerting
    await supabase
      .from('critical_alerts')
      .insert({
        alert_type: 'critical_error',
        component: logEntry.component,
        message: logEntry.message,
        metadata: logEntry.metadata,
        created_at: new Date().toISOString()
      });

    // In a real implementation, you would trigger external alerting here
    console.error('CRITICAL ERROR DETECTED:', logEntry);
  }
}