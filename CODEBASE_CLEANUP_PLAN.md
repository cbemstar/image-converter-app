# Codebase Cleanup Plan

## Issues Identified

1. **Duplicate Quota Displays**
   - Multiple quota systems running simultaneously
   - `quota-status` div and `usage-counter` div both showing quota
   - Different scripts updating different elements

2. **Supabase Client Not Initialized**
   - Console error: "Supabase client not initialized"
   - Authentication system not working properly
   - Multiple initialization attempts

3. **Stripe Integration Issues**
   - Archived pricing table products/prices
   - Permissions policy violations
   - Multiple Stripe scripts loading

4. **Multiple Conflicting Scripts**
   - `core.js` has its own auth management
   - `auth-manager.js` separate system
   - `quota-system-init.js` another system
   - All trying to manage the same UI elements

5. **Console Errors**
   - RAW-WASM library not found
   - Permissions policy violations
   - Multiple script conflicts

## Cleanup Strategy

### Phase 1: Consolidate Authentication
- Use single AuthManager instance
- Remove duplicate auth initialization
- Fix Supabase client initialization

### Phase 2: Consolidate Quota Management
- Use single quota display system
- Remove duplicate quota elements
- Centralize quota state management

### Phase 3: Fix Stripe Integration
- Update to active products/prices
- Remove duplicate Stripe scripts
- Fix permissions policy issues

### Phase 4: Clean Up Scripts
- Remove redundant script loading
- Consolidate initialization logic
- Fix console errors

### Phase 5: Test and Validate
- Ensure authentication works
- Verify quota display is accurate
- Test sign-in functionality
- Validate all integrations