# Database Tests with pgTAP

This directory contains comprehensive pgTAP tests for the billing integration system's Row Level Security (RLS) policies and database functions.

## Overview

The test suite validates:

1. **RLS Policies** (`database_test.sql`):
   - User data isolation and access controls
   - Service role bypass functionality for Edge Functions
   - Cross-user data access prevention
   - Explicit policy rules for all tables

2. **Database Functions** (`functions_test.sql`):
   - Usage tracking and quota management functions
   - Feature flag checking mechanisms
   - User role and permission validation
   - Monthly usage reset functionality

## Requirements Covered

- **6.1, 6.2, 6.3, 6.4, 6.5, 6.6**: RLS policy enforcement and data security
- **2.1, 2.2, 2.4, 2.5**: Server-side conversion metering
- **5.2, 5.3, 5.4, 5.5**: Usage quota management

## Prerequisites

1. **Supabase CLI**: Make sure Supabase is running locally
   ```bash
   supabase start
   ```

2. **pgTAP Extension**: The test runner will attempt to install pgTAP automatically, but you may need to install it manually:
   
   **macOS (Homebrew):**
   ```bash
   brew install pgtap
   ```
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt-get install postgresql-contrib
   ```
   
   **Manual Installation:**
   ```bash
   # Connect to your local Supabase database
   psql -h localhost -p 54322 -U postgres -d postgres
   CREATE EXTENSION IF NOT EXISTS pgtap;
   ```

## Running Tests

### Option 1: Run pgTAP Tests Directly

```bash
# Make the script executable (if not already)
chmod +x supabase/tests/run_tests.sh

# Run all database tests
./supabase/tests/run_tests.sh
```

### Option 2: Run via Jest (Integrated with existing test suite)

```bash
# Run all tests including database tests
npm test

# Run only database tests
npm test -- --testNamePattern="Database"
```

### Option 3: Run Individual Test Files

```bash
# Run only RLS policy tests
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/database_test.sql

# Run only function tests
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/functions_test.sql
```

## Test Structure

### RLS Policy Tests (`database_test.sql`)

Tests 50 different scenarios covering:

- **Profiles Table (Tests 1-5)**:
  - User can select/update own profile
  - User cannot access other profiles
  - Profile insertion with proper auth context

- **User Subscriptions (Tests 6-10)**:
  - User can read own subscriptions
  - Service role can manage all subscriptions
  - Users cannot modify subscription data

- **Usage Records (Tests 11-15)**:
  - Read-only access for users
  - Service role can update usage counters
  - Edge Function-only write access

- **Conversions (Tests 16-20)**:
  - User can read own conversion history
  - Service role can insert conversion records
  - No client-side conversion insertion

- **Plans (Tests 21-25)**:
  - Public read access for active plans
  - No user modification of plan data

- **Webhook Events (Tests 26-30)**:
  - Service role only access
  - Webhook processing security

- **Feature Flags (Tests 31-35)**:
  - Administrative access only
  - Feature rollout control

- **Cross-User Access Prevention (Tests 36-40)**:
  - Complete data isolation between users
  - User switching validation

- **Service Role Bypass (Tests 41-45)**:
  - Administrative operations
  - Edge Function capabilities

- **Access Control Validation (Tests 46-50)**:
  - Unauthenticated user restrictions
  - Public data access

### Database Function Tests (`functions_test.sql`)

Tests 25 different scenarios covering:

- **Utility Functions (Tests 1-5)**:
  - Date calculations
  - Feature flag evaluation
  - Rollout percentage logic

- **Usage Information (Tests 6-10)**:
  - Plan and quota retrieval
  - Usage tracking accuracy
  - Conversion eligibility

- **Usage Counter Management (Tests 11-15)**:
  - Atomic increment operations
  - Quota enforcement
  - Error handling

- **Monthly Reset (Tests 16-20)**:
  - Bulk usage reset
  - Error reporting
  - Service role requirements

- **User Role Checking (Tests 21-25)**:
  - Authentication status
  - Permission validation
  - Service role detection

## Test Output

Successful test runs will show:

```
🧪 Starting Comprehensive Database Tests...
✅ Checking pgTAP installation...
✅ Setting up test environment...

=== RLS Policy Tests ===
✅ RLS Policy Tests passed!

=== Database Function Tests ===
✅ Database Function Tests passed!

=== Test Summary ===
Total test suites: 2
Passed: 2

🎉 All database tests passed successfully!
RLS policies are properly configured and database functions work correctly.
```

## Troubleshooting

### Common Issues

1. **Supabase Not Running**:
   ```
   Error: Supabase is not running. Please start it with 'supabase start'
   ```
   Solution: Run `supabase start` and wait for all services to be ready.

2. **pgTAP Not Installed**:
   ```
   Failed to install pgTAP. Make sure you have the pgtap extension available.
   ```
   Solution: Install pgTAP manually using the instructions above.

3. **Permission Errors**:
   ```
   permission denied for relation auth.users
   ```
   Solution: Make sure you're running tests against the local Supabase instance, not production.

4. **Test Timeouts**:
   If tests are timing out, you can increase the timeout in the Jest configuration or run pgTAP tests directly.

### Debugging Failed Tests

1. **Check Individual Test Results**:
   ```bash
   # Run with verbose output
   psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/database_test.sql -v ON_ERROR_STOP=1
   ```

2. **Verify Database State**:
   ```sql
   -- Check if RLS is enabled
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   
   -- Check existing policies
   SELECT schemaname, tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

3. **Test Authentication Context**:
   ```sql
   -- Check current auth context
   SELECT auth.uid(), auth.jwt();
   
   -- Test policy manually
   SET request.jwt.claims = '{"sub": "test-user-id"}';
   SELECT * FROM public.profiles WHERE id = auth.uid();
   ```

## Continuous Integration

These tests are designed to run in CI/CD pipelines. Make sure your CI environment:

1. Has PostgreSQL with pgTAP extension available
2. Runs Supabase locally or has access to a test database
3. Has proper environment variables configured
4. Runs tests in isolation to avoid conflicts

## Contributing

When adding new RLS policies or database functions:

1. Add corresponding pgTAP tests
2. Update the test plan count in the SQL files
3. Document the requirements being tested
4. Ensure tests clean up after themselves
5. Update this README if needed

## Security Notes

- These tests create and delete test data
- Never run against production databases
- Test users are created with predictable UUIDs for testing purposes
- All test data is cleaned up after test completion
- Service role access is simulated for testing Edge Function behavior