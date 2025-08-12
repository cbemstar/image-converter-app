# Authentication Flow Testing Checklist
**Task 13.5: Test and validate authentication flow**

This checklist provides manual testing steps to validate the authentication flow implementation.

## Prerequisites
- [ ] Supabase project is configured and running
- [ ] Environment variables are set correctly
- [ ] AuthManager is loaded and initialized
- [ ] Image converter tool is accessible

## 1. Sign-in Redirect Functionality

### Test 1.1: Callback URL Preservation
- [ ] Navigate to `/tools/image-converter/index.html?format=webp&quality=80`
- [ ] Click "Sign In" button
- [ ] Verify you're redirected to auth page
- [ ] Complete authentication
- [ ] Verify you're redirected back to original URL with query parameters intact
- [ ] **Expected**: Return to `/tools/image-converter/index.html?format=webp&quality=80`

### Test 1.2: OAuth Provider Redirect
- [ ] From image converter, click "Sign In"
- [ ] Choose Google OAuth
- [ ] Complete Google authentication
- [ ] Verify redirect back to image converter
- [ ] **Expected**: Successful OAuth flow with callback preservation

### Test 1.3: Email/Password Sign-in
- [ ] From image converter, click "Sign In"
- [ ] Enter valid email and password
- [ ] Submit form
- [ ] Verify redirect back to image converter
- [ ] **Expected**: Successful email/password authentication

### Test 1.4: Sign-up Flow
- [ ] From image converter, click "Sign In"
- [ ] Click "Sign Up" option
- [ ] Enter new user details
- [ ] Submit form
- [ ] Check email for verification link
- [ ] Click verification link
- [ ] Verify redirect back to image converter
- [ ] **Expected**: Complete sign-up flow with email verification

## 2. Auth State Persistence Across Page Reloads

### Test 2.1: Page Reload After Authentication
- [ ] Sign in to image converter
- [ ] Verify authenticated UI is displayed
- [ ] Reload the page (F5 or Ctrl+R)
- [ ] Wait for page to fully load
- [ ] **Expected**: User remains authenticated, UI shows user menu

### Test 2.2: Browser Tab Close/Reopen
- [ ] Sign in to image converter
- [ ] Close browser tab
- [ ] Reopen image converter in new tab
- [ ] **Expected**: User remains authenticated (session persisted)

### Test 2.3: Browser Restart
- [ ] Sign in to image converter
- [ ] Close entire browser
- [ ] Restart browser
- [ ] Navigate to image converter
- [ ] **Expected**: User remains authenticated (depending on session settings)

### Test 2.4: Session Expiration Handling
- [ ] Sign in to image converter
- [ ] Wait for session to expire (or manually expire in dev tools)
- [ ] Try to perform an authenticated action
- [ ] **Expected**: Graceful handling of expired session, prompt to re-authenticate

## 3. User Dropdown Menu Functionality

### Test 3.1: Dropdown Visibility Toggle
- [ ] Sign in to image converter
- [ ] Locate user dropdown button in navigation
- [ ] Click dropdown button
- [ ] **Expected**: Dropdown menu opens with user options

### Test 3.2: User Information Display
- [ ] Open user dropdown
- [ ] Verify user name is displayed correctly
- [ ] Verify user avatar is displayed (if available)
- [ ] **Expected**: Correct user information shown

### Test 3.3: Navigation Links
- [ ] Open user dropdown
- [ ] Click "Dashboard" link
- [ ] **Expected**: Navigate to dashboard page
- [ ] Go back to image converter
- [ ] Open dropdown, click "Profile" link
- [ ] **Expected**: Navigate to profile page

### Test 3.4: Sign Out Functionality
- [ ] Open user dropdown
- [ ] Click "Sign Out" option
- [ ] **Expected**: User is signed out, UI switches to guest mode

### Test 3.5: Dropdown Accessibility
- [ ] Navigate to dropdown using keyboard (Tab key)
- [ ] Press Enter or Space to open dropdown
- [ ] Use arrow keys to navigate menu items
- [ ] Press Enter to select an item
- [ ] **Expected**: Full keyboard accessibility

### Test 3.6: No Duplicate Navigation Elements
- [ ] Sign in to image converter
- [ ] Inspect navigation bar carefully
- [ ] **Expected**: Only user dropdown is visible, no "Sign In" button
- [ ] Sign out
- [ ] **Expected**: Only "Sign In" button is visible, no user dropdown

## 4. Quota Display for Authenticated Users

### Test 4.1: Initial Quota Display
- [ ] Sign in to image converter
- [ ] Locate quota display section
- [ ] **Expected**: Shows current usage (e.g., "3 / 10 conversions")
- [ ] **Expected**: Shows current plan (e.g., "Free Plan")
- [ ] **Expected**: Shows reset date

### Test 4.2: Quota Update After Conversion
- [ ] Note current quota usage
- [ ] Convert an image
- [ ] Wait for conversion to complete
- [ ] **Expected**: Quota usage increments by 1
- [ ] **Expected**: UI updates immediately

### Test 4.3: Different Plan Types
- [ ] Test with Free plan user
- [ ] **Expected**: Shows correct limits (e.g., 10 conversions)
- [ ] Test with Pro plan user (if available)
- [ ] **Expected**: Shows correct limits (e.g., 1000 conversions)

### Test 4.4: Quota Exceeded State
- [ ] Use account at quota limit
- [ ] Try to convert an image
- [ ] **Expected**: Conversion blocked with upgrade prompt
- [ ] **Expected**: Clear message about quota exceeded

### Test 4.5: Guest vs Authenticated Quota
- [ ] Visit image converter without signing in
- [ ] **Expected**: Shows guest quota (e.g., "0 / 3 conversions")
- [ ] Sign in
- [ ] **Expected**: Shows authenticated user quota
- [ ] Sign out
- [ ] **Expected**: Returns to guest quota display

## 5. Error Handling and Edge Cases

### Test 5.1: Network Connectivity Issues
- [ ] Disconnect internet during sign-in
- [ ] **Expected**: Appropriate error message displayed
- [ ] Reconnect and retry
- [ ] **Expected**: Sign-in works normally

### Test 5.2: Invalid Credentials
- [ ] Try signing in with wrong password
- [ ] **Expected**: Clear error message, no redirect
- [ ] Try signing in with non-existent email
- [ ] **Expected**: Appropriate error message

### Test 5.3: Email Verification Required
- [ ] Sign up with new account
- [ ] Try to access paid features before email verification
- [ ] **Expected**: Blocked with verification prompt
- [ ] Verify email and retry
- [ ] **Expected**: Access granted

### Test 5.4: Session Conflicts
- [ ] Sign in on multiple tabs
- [ ] Sign out from one tab
- [ ] Check other tabs
- [ ] **Expected**: All tabs reflect signed-out state

## 6. Performance and UX

### Test 6.1: Authentication Speed
- [ ] Time the sign-in process
- [ ] **Expected**: Sign-in completes within 3 seconds
- [ ] **Expected**: UI updates are smooth and immediate

### Test 6.2: Loading States
- [ ] Observe loading indicators during authentication
- [ ] **Expected**: Clear loading states shown
- [ ] **Expected**: No broken UI states during transitions

### Test 6.3: Mobile Responsiveness
- [ ] Test authentication flow on mobile device
- [ ] **Expected**: All buttons and dropdowns work correctly
- [ ] **Expected**: UI is properly responsive

## 7. Integration with Other Systems

### Test 7.1: Usage Tracking Integration
- [ ] Sign in and convert images
- [ ] Check that conversions are properly tracked
- [ ] **Expected**: Usage data is accurate and persistent

### Test 7.2: Billing Integration
- [ ] Try to upgrade plan from image converter
- [ ] **Expected**: Proper integration with Stripe checkout
- [ ] Complete upgrade and return
- [ ] **Expected**: Updated quota limits displayed

## Test Results Summary

### Sign-in Redirect Functionality
- [ ] ✅ All tests passed
- [ ] ❌ Issues found: ________________

### Auth State Persistence
- [ ] ✅ All tests passed  
- [ ] ❌ Issues found: ________________

### User Dropdown Menu
- [ ] ✅ All tests passed
- [ ] ❌ Issues found: ________________

### Quota Display
- [ ] ✅ All tests passed
- [ ] ❌ Issues found: ________________

### Overall Assessment
- [ ] ✅ Authentication flow is working correctly
- [ ] ❌ Critical issues need to be addressed
- [ ] ⚠️ Minor issues noted but not blocking

## Notes and Observations
_Use this space to record any additional observations or issues found during testing_

---

**Testing completed by:** ________________  
**Date:** ________________  
**Browser/Environment:** ________________  
**Task 13.5 Status:** [ ] Complete [ ] Needs fixes