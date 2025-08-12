# Migration Workflow Documentation

This document outlines the migration workflow for the billing integration system, including staging testing and production deployment procedures.

## Migration Structure

Each migration consists of two files:
- `YYYYMMDDHHMMSS_migration_name.sql` - The forward migration
- `YYYYMMDDHHMMSS_migration_name_rollback.sql` - The rollback script

## Workflow Steps

### 1. Development Phase

1. Create migration files with both forward and rollback scripts
2. Test locally using Supabase CLI
3. Validate migration syntax and rollback compatibility

### 2. Staging Testing

```bash
# Validate all migrations
node scripts/migration-manager.js validate

# Test specific migration on staging
node scripts/migration-manager.js test 20250210000000_billing_integration_schema.sql

# Check migration status
node scripts/migration-manager.js status
```

### 3. Production Deployment

```bash
# Deploy to production (requires confirmation)
CONFIRM_PRODUCTION=true node scripts/migration-manager.js deploy 20250210000000_billing_integration_schema.sql
```

### 4. Rollback (if needed)

```bash
# Rollback migration on staging
node scripts/migration-manager.js rollback 20250210000000_billing_integration_schema.sql

# Rollback on production (if necessary)
CONFIRM_PRODUCTION=true node scripts/migration-manager.js rollback 20250210000000_billing_integration_schema.sql
```

## Environment Setup

Set the following environment variables:

```bash
# Staging environment
export SUPABASE_STAGING_URL="postgresql://..."

# Production environment  
export SUPABASE_PRODUCTION_URL="postgresql://..."

# For production operations
export CONFIRM_PRODUCTION=true
```

## Migration Best Practices

### 1. Always Create Rollback Scripts
- Every migration must have a corresponding rollback script
- Test rollback scripts on staging before production deployment
- Rollback scripts should reverse all changes made by the forward migration

### 2. Test on Staging First
- Never deploy directly to production
- Staging environment should mirror production as closely as possible
- Run full application tests after migration on staging

### 3. Atomic Operations
- Keep migrations focused and atomic
- Avoid mixing schema changes with data migrations
- Use transactions where appropriate

### 4. Backup Before Production
- Always backup production database before major migrations
- Document the backup location and restoration procedure
- Test backup restoration process periodically

## Migration Validation Checklist

Before deploying to production:

- [ ] Migration file exists and is syntactically correct
- [ ] Rollback file exists and has been tested
- [ ] Migration passes validation checks
- [ ] Staging deployment successful
- [ ] Application tests pass on staging
- [ ] Production backup completed
- [ ] Deployment window scheduled and communicated
- [ ] Rollback plan documented and ready

## Troubleshooting

### Migration Fails on Staging
1. Check migration syntax and dependencies
2. Verify database permissions
3. Check for conflicting schema changes
4. Review migration logs for specific errors

### Migration Fails on Production
1. **DO NOT PANIC** - assess the situation
2. Check if partial migration was applied
3. Determine if rollback is safe and necessary
4. Execute rollback if required
5. Investigate root cause before retry

### Rollback Required
1. Verify rollback script is correct
2. Check data dependencies before rollback
3. Execute rollback on staging first if possible
4. Monitor application after rollback
5. Document incident and lessons learned

## Monitoring and Alerts

Set up monitoring for:
- Migration execution time
- Database performance during migrations
- Application health after migrations
- Failed migration attempts

## Emergency Contacts

- Database Administrator: [contact info]
- DevOps Team: [contact info]
- On-call Engineer: [contact info]

## Migration History

| Date | Migration | Status | Notes |
|------|-----------|--------|-------|
| 2025-02-10 | billing_integration_schema | Pending | Initial billing system schema |

## Related Documentation

- [Supabase Migration Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Database Schema Documentation](./schema.md)
- [RLS Policies Documentation](./rls-policies.md)