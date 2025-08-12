# Server-Side Conversion Metering System

This document describes the implementation of the server-side conversion metering system for the image converter application.

## Overview

The system implements comprehensive usage tracking with the following key features:

- **Server-side metering**: All usage tracking is handled by Edge Functions with service-role access
- **Atomic operations**: Usage counters are incremented atomically to prevent race conditions
- **Quota enforcement**: Users cannot exceed their plan limits
- **Conversion history**: Detailed tracking of all conversions for analytics and billing
- **Monthly reset**: Automatic quota reset at the beginning of each month

## Architecture

### Edge Functions

#### 1. Usage Tracking (`/functions/usage-tracking`)
- **Purpose**: Core usage tracking operations
- **Actions**:
  - `check_quota`: Verify if user can perform conversions
  - `increment_usage`: Atomically increment usage counter and record conversion
  - `get_usage`: Retrieve user's current usage information
- **Security**: Uses service role for database writes, bypassing RLS

#### 2. Image Conversion (`/functions/image-conversion`)
- **Purpose**: Process image conversions with integrated usage tracking
- **Features**:
  - File validation (size, format)
  - Quota checking before processing
  - Image conversion using Canvas API
  - Secure file storage with signed URLs
  - Usage increment after successful conversion
- **Security**: Requires user authentication, validates file types and sizes

#### 3. Usage Management (`/functions/usage-management`)
- **Purpose**: Administrative and utility functions
- **Actions**:
  - `reset_monthly_usage`: Reset all users' monthly quotas
  - `get_usage_analytics`: Generate usage reports and statistics
  - `enforce_limits`: Identify quota violations and warnings
  - `get_period_info`: Get current billing period information
  - `cleanup_old_data`: Remove old conversion and usage records

#### 4. Monthly Reset (`/functions/monthly-reset`)
- **Purpose**: Scheduled function for monthly quota reset
- **Trigger**: Cron job or scheduled task
- **Security**: Requires service role or cron signature

### Database Schema

#### Core Tables

```sql
-- Usage tracking per billing period
CREATE TABLE usage_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  period_start DATE,
  period_end DATE,
  conversions_used INTEGER DEFAULT 0,
  conversions_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

-- Detailed conversion history
CREATE TABLE conversions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  original_filename TEXT,
  original_format TEXT,
  target_format TEXT,
  file_size_bytes INTEGER,
  processing_time_ms INTEGER,
  storage_path TEXT,
  billing_period_start TIMESTAMPTZ,
  billed_to_stripe BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Key Functions

```sql
-- Atomically increment usage counter
CREATE FUNCTION increment_usage_counter(
  user_id UUID,
  conversion_details JSONB
) RETURNS TABLE(success BOOLEAN, remaining_quota INTEGER, error_message TEXT);

-- Get user usage information
CREATE FUNCTION get_user_usage_info(user_id UUID)
RETURNS TABLE(plan_name TEXT, conversions_used INTEGER, conversions_limit INTEGER, ...);

-- Reset monthly usage for all users
CREATE FUNCTION reset_monthly_usage()
RETURNS TABLE(users_reset INTEGER, errors_count INTEGER);
```

### Row Level Security (RLS)

- **usage_records**: Users can SELECT their own records; service role can UPDATE/INSERT
- **conversions**: Users can SELECT their own records; service role can INSERT
- **profiles**: Users can SELECT/UPDATE their own profile
- **user_subscriptions**: Users can SELECT their own subscriptions; service role manages all

## Client-Side Integration

### Usage Tracking Client

```javascript
const client = new UsageTrackingClient(supabaseUrl, supabaseAnonKey);

// Check quota before conversion
const quotaCheck = await client.checkQuota();
if (!quotaCheck.can_convert) {
  // Show upgrade prompt
}

// Convert image with usage tracking
const result = await client.convertImage(file, {
  target_format: 'png',
  quality: 90
});

// Get current usage
const usage = await client.getUserUsage();
```

### Usage Display Widget

```javascript
const ui = new UsageTrackingUI(client);
ui.init('#usage-container');
```

## API Reference

### Usage Tracking Endpoint

**POST** `/functions/v1/usage-tracking`

#### Check Quota
```json
{
  "action": "check_quota",
  "user_id": "uuid"
}
```

Response:
```json
{
  "success": true,
  "can_convert": true,
  "remaining_quota": 45,
  "data": {
    "plan_name": "Pro",
    "conversions_used": 5,
    "conversions_limit": 50,
    "period_start": "2024-01-01",
    "period_end": "2024-01-31"
  }
}
```

#### Increment Usage
```json
{
  "action": "increment_usage",
  "user_id": "uuid",
  "conversion_details": {
    "original_filename": "image.jpg",
    "original_format": "image/jpeg",
    "target_format": "png",
    "file_size_bytes": 1024000,
    "processing_time_ms": 250,
    "storage_path": "conversions/user/file.png"
  }
}
```

### Image Conversion Endpoint

**POST** `/functions/v1/image-conversion`

Form data:
- `file`: Image file to convert
- `params`: JSON string with conversion parameters

```json
{
  "target_format": "png",
  "quality": 90,
  "max_width": 1920,
  "max_height": 1080
}
```

Response:
```json
{
  "success": true,
  "download_url": "https://...",
  "filename": "converted.png",
  "file_size": 856432,
  "processing_time": 1250,
  "remaining_quota": 44
}
```

## Security Features

### Authentication & Authorization
- All endpoints require valid Supabase auth token
- Service role required for administrative functions
- RLS policies prevent cross-user data access

### Input Validation
- File size limits (50MB max)
- Supported format validation
- Parameter sanitization
- UUID validation for user IDs

### Rate Limiting
- Per-user conversion limits based on plan
- File size restrictions per plan tier
- Processing time monitoring

### Data Protection
- Signed URLs for file access (1-hour expiry)
- Private storage buckets
- Automatic file cleanup
- Audit logging for all operations

## Monitoring & Analytics

### Usage Statistics
- Total conversions per period
- Unique active users
- Average conversions per user
- Format popularity breakdown
- Plan distribution analysis

### Performance Metrics
- Conversion processing time
- Edge Function response time
- Database query performance
- Storage usage tracking

### Error Tracking
- Failed conversions with reasons
- Quota violations and overages
- System errors and recovery
- Webhook processing failures

## Deployment

### Environment Variables
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### Database Migration
```bash
# Apply the billing integration schema
supabase db push

# Verify RLS policies
supabase db test
```

### Edge Function Deployment
```bash
# Deploy all functions
supabase functions deploy usage-tracking
supabase functions deploy image-conversion
supabase functions deploy usage-management
supabase functions deploy monthly-reset
```

### Scheduled Tasks
Set up a cron job to call the monthly reset function:
```bash
# First day of each month at 00:00 UTC
0 0 1 * * curl -X POST https://your-project.supabase.co/functions/v1/monthly-reset \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Testing

### Unit Tests
- Database function tests using pgTAP
- Edge Function integration tests
- RLS policy validation tests

### Load Testing
- Concurrent conversion processing
- Database performance under load
- Edge Function cold start optimization

### Security Testing
- Authentication bypass attempts
- RLS policy enforcement
- Input validation and sanitization

## Troubleshooting

### Common Issues

1. **Quota not updating**: Check service role permissions and RLS policies
2. **Conversion failures**: Verify file format support and size limits
3. **Authentication errors**: Ensure valid auth tokens and user sessions
4. **Performance issues**: Monitor database query performance and Edge Function metrics

### Debug Tools
- Test page: `/test-usage-tracking.html`
- Database logs: Supabase dashboard
- Edge Function logs: Supabase Functions panel
- Usage analytics: Usage management endpoint

## Future Enhancements

### Stripe Usage-Based Billing
The system is designed to support migration to Stripe usage-based billing:
- `conversions` table includes `stripe_usage_record_id` field
- `billing_period_start` and `billed_to_stripe` fields for tracking
- Conversion records can be sent as usage events to Stripe

### Real-Time Updates
- WebSocket connections for live usage updates
- Real-time quota warnings and notifications
- Live conversion progress tracking

### Advanced Analytics
- User behavior analysis
- Conversion pattern insights
- Predictive usage modeling
- Cost optimization recommendations

## Support

For issues or questions about the usage tracking system:
1. Check the troubleshooting section above
2. Review Edge Function logs in Supabase dashboard
3. Test with the provided test page
4. Verify database schema and RLS policies