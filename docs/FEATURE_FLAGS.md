# Feature Flags System

The feature flags system provides controlled rollout capabilities for new features, allowing gradual deployment and easy rollback if issues arise.

## Overview

Feature flags are stored in the database and can be managed through:
- Database functions for runtime checking
- Client-side JavaScript utilities
- Command-line administration tools
- Environment variable fallbacks

## Database Schema

```sql
CREATE TABLE public.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  description TEXT,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_users TEXT[], -- Array of user IDs for targeted rollout
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Default Feature Flags

| Flag Name | Description | Default State |
|-----------|-------------|---------------|
| `auth_enabled` | Enable authentication system | Enabled (100%) |
| `billing_enabled` | Enable billing and subscription features | Disabled (0%) |
| `conversion_metering` | Enable conversion usage tracking | Disabled (0%) |
| `stripe_integration` | Enable Stripe payment processing | Disabled (0%) |

## Usage

### Client-Side JavaScript

```javascript
// Initialize feature flags
const supabase = createClient(url, key);
const featureFlags = FeatureFlags.initializeFeatureFlags(supabase);

// Check a single flag
const isEnabled = await FeatureFlags.isFeatureEnabled('billing_enabled');

// Check multiple flags
const flags = await featureFlags.checkMultiple(['auth_enabled', 'billing_enabled']);

// Conditional rendering
await FeatureFlags.withFeatureFlag('billing_enabled', 
  () => showBillingUI(),
  () => showFreeTierMessage()
);

// With environment fallback
const isEnabled = await FeatureFlags.isFeatureEnabledWithFallback('new_feature', false);
```

### Server-Side (Edge Functions)

```javascript
// Check feature flag in Edge Function
const { data: isEnabled } = await supabase
  .rpc('check_feature_flag', { flag_name: 'billing_enabled' });

if (isEnabled) {
  // Feature is enabled for this user
  await processBillingOperation();
}
```

### Command Line Administration

```bash
# List all flags
node scripts/feature-flag-admin.js list

# Create a new flag
node scripts/feature-flag-admin.js create new_feature "Description of new feature"

# Enable a flag for 50% of users
node scripts/feature-flag-admin.js enable new_feature 50

# Disable a flag
node scripts/feature-flag-admin.js disable new_feature

# Check flag for specific user
node scripts/feature-flag-admin.js check billing_enabled user-123

# Add target users
node scripts/feature-flag-admin.js target-add new_feature user1,user2,user3

# Initialize default flags
node scripts/feature-flag-admin.js init
```

## Rollout Strategies

### 1. Boolean Toggle
Simple on/off switch for all users:
```sql
UPDATE feature_flags SET is_enabled = true WHERE flag_name = 'new_feature';
```

### 2. Percentage Rollout
Gradual rollout to percentage of users:
```sql
UPDATE feature_flags SET is_enabled = true, rollout_percentage = 25 WHERE flag_name = 'new_feature';
```

### 3. Targeted Users
Enable for specific users only:
```sql
UPDATE feature_flags SET 
  is_enabled = true, 
  target_users = ARRAY['user1', 'user2', 'user3'] 
WHERE flag_name = 'new_feature';
```

### 4. Combined Strategy
Target specific users + percentage rollout:
- Target users always get the feature if enabled
- Other users get it based on rollout percentage

## Environment Variable Fallbacks

For development and testing, feature flags can be overridden with environment variables:

```bash
# Enable billing in development
export FEATURE_BILLING_ENABLED=true

# Disable auth for testing
export FEATURE_AUTH_ENABLED=false
```

Environment variable format: `FEATURE_{FLAG_NAME_UPPERCASE}=true|false`

## Best Practices

### 1. Naming Convention
- Use snake_case for flag names
- Be descriptive but concise
- Include the feature area: `billing_enabled`, `auth_oauth_providers`

### 2. Gradual Rollout
1. Start with 0% rollout (disabled)
2. Enable for internal users first (target_users)
3. Gradually increase percentage: 5% → 25% → 50% → 100%
4. Monitor metrics at each stage

### 3. Cleanup
- Remove feature flags after full rollout
- Keep flags for features that might need quick disable
- Document flag lifecycle in code comments

### 4. Testing
- Test both enabled and disabled states
- Use environment variables for consistent test environments
- Include flag checks in integration tests

## Monitoring and Alerts

### Database Queries for Monitoring

```sql
-- Check flag usage
SELECT flag_name, is_enabled, rollout_percentage, 
       array_length(target_users, 1) as target_count
FROM feature_flags 
ORDER BY updated_at DESC;

-- Find flags that haven't been updated recently
SELECT flag_name, updated_at
FROM feature_flags 
WHERE updated_at < NOW() - INTERVAL '30 days'
ORDER BY updated_at;
```

### Metrics to Track
- Feature flag check frequency
- Error rates when flags are enabled/disabled
- User engagement with flagged features
- Performance impact of flag checks

## Security Considerations

### Row Level Security
- Feature flags table is restricted to service role only
- Users cannot directly modify flags
- Flag checking function is security definer

### Caching
- Client-side caching reduces database load
- Cache expiry prevents stale flag states
- Clear cache when flags change

### Audit Trail
- All flag changes are timestamped
- Consider adding audit log for flag modifications
- Track who made changes (if admin interface is added)

## Troubleshooting

### Common Issues

1. **Flag not taking effect**
   - Check cache expiry
   - Verify user is in target group
   - Check rollout percentage calculation

2. **Performance issues**
   - Increase cache duration
   - Preload commonly used flags
   - Use environment fallbacks for development

3. **Inconsistent behavior**
   - Clear client-side cache
   - Check database connection
   - Verify RLS policies

### Debug Commands

```bash
# Check flag status
node scripts/feature-flag-admin.js check flag_name user_id

# List all flags with details
node scripts/feature-flag-admin.js list

# Test flag function directly
psql -c "SELECT check_feature_flag('flag_name', 'user_id');"
```

## Migration Guide

When removing a feature flag:

1. Ensure feature is stable in production
2. Remove flag checks from code
3. Deploy code changes
4. Delete flag from database
5. Remove any related environment variables

```sql
-- Remove flag after code deployment
DELETE FROM feature_flags WHERE flag_name = 'old_feature';
```

## Related Documentation

- [Database Schema](./DATABASE_SCHEMA.md)
- [Edge Functions](./EDGE_FUNCTIONS.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)