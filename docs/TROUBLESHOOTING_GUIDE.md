# Troubleshooting Guide

## Table of Contents

1. [Authentication Issues](#authentication-issues)
2. [File Upload Problems](#file-upload-problems)
3. [Quota and Billing Issues](#quota-and-billing-issues)
4. [Dashboard and UI Problems](#dashboard-and-ui-problems)
5. [Payment and Subscription Issues](#payment-and-subscription-issues)
6. [Performance Issues](#performance-issues)
7. [Browser Compatibility](#browser-compatibility)
8. [API and Integration Issues](#api-and-integration-issues)
9. [Database and Storage Issues](#database-and-storage-issues)
10. [Deployment Issues](#deployment-issues)

## Authentication Issues

### Cannot Sign In

**Symptoms:**
- "Invalid credentials" error with correct email/password
- Sign-in button doesn't respond
- Redirected back to sign-in page after attempting login

**Common Causes & Solutions:**

#### 1. Email Not Confirmed
**Solution:**
```javascript
// Check if email confirmation is required
if (error.message === 'Email not confirmed') {
  // Resend confirmation email
  await supabase.auth.resend({
    type: 'signup',
    email: userEmail
  });
}
```
- Check spam/junk folder for confirmation email
- Resend confirmation email from sign-in page
- Verify email address is typed correctly

#### 2. Account Locked or Suspended
**Solution:**
- Wait 15 minutes if rate limited
- Contact support if account appears suspended
- Check for security alerts in email

#### 3. Browser Issues
**Solution:**
- Clear browser cache and cookies
- Disable browser extensions temporarily
- Try incognito/private browsing mode
- Test in different browser

#### 4. Network/Firewall Issues
**Solution:**
- Check internet connection
- Disable VPN temporarily
- Try different network (mobile hotspot)
- Contact IT if on corporate network

### Social Login Not Working

**Symptoms:**
- Google/GitHub login button doesn't work
- Redirected to error page after OAuth
- "OAuth provider not configured" error

**Solutions:**

#### 1. OAuth Configuration
```javascript
// Verify OAuth provider is enabled
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
});
```

#### 2. Redirect URL Mismatch
- Verify redirect URLs in Supabase dashboard match your domain
- Check for HTTP vs HTTPS mismatch
- Ensure no trailing slashes in URLs

#### 3. Provider-Specific Issues
**Google:**
- Verify Google OAuth client ID and secret
- Check Google Cloud Console for API quotas
- Ensure OAuth consent screen is configured

**GitHub:**
- Verify GitHub OAuth app settings
- Check callback URL matches exactly
- Ensure app is not suspended

### Session Expires Quickly

**Symptoms:**
- Logged out after short period
- "Session expired" errors
- Need to re-authenticate frequently

**Solutions:**

#### 1. Token Refresh Issues
```javascript
// Implement proper token refresh
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed successfully');
  } else if (event === 'SIGNED_OUT') {
    // Handle sign out
    window.location.href = '/';
  }
});
```

#### 2. Browser Storage Issues
- Check if cookies are enabled
- Verify localStorage is not being cleared
- Check browser privacy settings
- Disable "Clear cookies on exit" setting

## File Upload Problems

### Upload Fails or Hangs

**Symptoms:**
- Upload progress bar stops
- "Upload failed" error message
- Files don't appear in file manager
- Browser becomes unresponsive during upload

**Common Causes & Solutions:**

#### 1. File Size Limits
```javascript
// Check file size before upload
const maxSize = quotaManager.getPlanLimits(userPlan).maxFileSize;
if (file.size > maxSize) {
  throw new Error(`File too large. Maximum size: ${formatBytes(maxSize)}`);
}
```

**Plan Limits:**
- Free: 25 MB maximum
- Pro: 100 MB maximum  
- Agency: 250 MB maximum

**Solutions:**
- Compress file before uploading
- Split large files if possible
- Upgrade plan for larger file support

#### 2. Storage Quota Exceeded
```javascript
// Check storage quota before upload
const quotaCheck = await quotaManager.checkStorageQuota(file.size);
if (!quotaCheck.allowed) {
  showUpgradeModal('Storage limit exceeded');
  return;
}
```

**Solutions:**
- Delete old files to free up space
- Upgrade to plan with more storage
- Check usage in dashboard

#### 3. Network Issues
**Solutions:**
- Check internet connection stability
- Try uploading smaller files first
- Use wired connection instead of WiFi
- Retry upload after network issues resolve

#### 4. Browser Memory Issues
**Solutions:**
- Close other browser tabs
- Restart browser
- Try different browser
- Upload files one at a time instead of batch

### Unsupported File Types

**Symptoms:**
- "File type not supported" error
- Upload button disabled for certain files
- File rejected during upload process

**Solutions:**

#### 1. Check Supported Formats
```javascript
const supportedTypes = {
  'image-converter': ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'],
  'pdf-merger': ['.pdf'],
  'background-remover': ['.jpg', '.jpeg', '.png']
};
```

#### 2. File Extension Issues
- Ensure file has correct extension
- Check for hidden characters in filename
- Rename file with proper extension
- Verify file is not corrupted

#### 3. MIME Type Detection
```javascript
// Verify MIME type matches extension
const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/webp', 
  'image/gif', 'application/pdf'
];
```

### Upload Progress Issues

**Symptoms:**
- Progress bar doesn't update
- Upload appears stuck at certain percentage
- No feedback during upload process

**Solutions:**

#### 1. Progress Tracking
```javascript
// Implement proper progress tracking
const uploadFile = async (file) => {
  const { data, error } = await supabase.storage
    .from('user-files')
    .upload(filePath, file, {
      onUploadProgress: (progress) => {
        const percentage = (progress.loaded / progress.total) * 100;
        updateProgressBar(percentage);
      }
    });
};
```

#### 2. Timeout Issues
- Increase timeout for large files
- Implement retry mechanism
- Show estimated time remaining
- Allow upload cancellation

## Quota and Billing Issues

### Quota Exceeded Errors

**Symptoms:**
- "Storage limit exceeded" messages
- "Monthly conversion limit reached" errors
- Features disabled or restricted
- Upgrade prompts appearing frequently

**Solutions:**

#### 1. Check Current Usage
```javascript
// Get detailed usage information
const usage = await quotaManager.getCurrentUsage();
const limits = quotaManager.getPlanLimits(userPlan);

console.log('Storage:', usage.storage, '/', limits.storage);
console.log('Conversions:', usage.conversions, '/', limits.conversions);
```

#### 2. Free Up Storage
- Delete unnecessary files from file manager
- Remove old conversion results
- Clear browser cache if files are cached locally

#### 3. Monitor Usage Patterns
- Check usage trends in dashboard
- Identify high-usage tools or periods
- Plan upgrades before hitting limits

### Incorrect Usage Calculations

**Symptoms:**
- Usage meters show wrong percentages
- Recently deleted files still count toward quota
- Usage doesn't reset at month start

**Solutions:**

#### 1. Force Usage Refresh
```javascript
// Manually refresh usage data
await quotaManager.refreshUsageData();
await dashboard.renderUsageMeters();
```

#### 2. Cache Issues
- Clear browser cache and reload
- Sign out and sign back in
- Wait 5-10 minutes for data synchronization

#### 3. Database Sync Issues
- Check if recent operations completed successfully
- Verify file deletions were processed
- Contact support if discrepancies persist

### Monthly Reset Problems

**Symptoms:**
- Conversion count doesn't reset on 1st of month
- Still seeing "limit exceeded" after reset date
- Usage history shows incorrect monthly data

**Solutions:**

#### 1. Timezone Issues
```javascript
// Check if timezone affects reset calculation
const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
```

#### 2. Manual Reset Request
- Contact support for manual reset
- Provide account details and expected reset date
- Document timezone and location

## Dashboard and UI Problems

### Dashboard Won't Load

**Symptoms:**
- Blank dashboard page
- Loading spinner that never completes
- JavaScript errors in browser console
- "Failed to load dashboard" error

**Solutions:**

#### 1. Browser Issues
```javascript
// Check for JavaScript errors
window.addEventListener('error', (e) => {
  console.error('Dashboard error:', e.error);
});
```

- Open browser developer tools (F12)
- Check Console tab for errors
- Clear browser cache and cookies
- Try different browser or incognito mode

#### 2. Authentication Issues
- Verify user is properly authenticated
- Check if session has expired
- Try signing out and back in
- Clear authentication tokens

#### 3. API Connection Issues
```javascript
// Test API connectivity
const testConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    console.log('API connection successful');
  } catch (error) {
    console.error('API connection failed:', error);
  }
};
```

### Usage Meters Not Updating

**Symptoms:**
- Usage bars show outdated information
- Percentages don't match actual usage
- Meters don't reflect recent file operations

**Solutions:**

#### 1. Force Refresh
```javascript
// Manually refresh dashboard data
const refreshDashboard = async () => {
  await quotaManager.refreshUsageData();
  await dashboard.renderUsageMeters();
  await dashboard.renderRecentActivity();
};
```

#### 2. Real-time Updates
- Check if WebSocket connection is active
- Verify real-time subscriptions are working
- Refresh page to get latest data

### Navigation Issues

**Symptoms:**
- Menu items don't work
- Broken links or 404 errors
- Dropdown menus don't open
- Mobile navigation problems

**Solutions:**

#### 1. JavaScript Errors
- Check browser console for errors
- Verify all JavaScript files are loading
- Check for conflicting scripts or extensions

#### 2. CSS/Styling Issues
```css
/* Check for CSS conflicts */
.navigation-menu {
  z-index: 1000 !important;
  position: relative;
}
```

#### 3. Mobile Responsiveness
- Test on different screen sizes
- Check viewport meta tag
- Verify touch events work properly

## Payment and Subscription Issues

### Payment Declined

**Symptoms:**
- "Payment failed" error during checkout
- Credit card declined message
- Unable to complete subscription upgrade
- Stuck on payment processing screen

**Solutions:**

#### 1. Card Issues
- Verify card number, expiry, and CVV are correct
- Check if card is expired or cancelled
- Ensure sufficient funds or credit limit
- Try different payment method

#### 2. Bank/Issuer Blocks
- Contact bank to authorize online payments
- Check for international transaction blocks
- Verify billing address matches card
- Try smaller test transaction first

#### 3. Stripe Issues
```javascript
// Handle Stripe errors properly
const handlePaymentError = (error) => {
  switch (error.code) {
    case 'card_declined':
      return 'Your card was declined. Please try a different payment method.';
    case 'insufficient_funds':
      return 'Insufficient funds. Please check your account balance.';
    case 'expired_card':
      return 'Your card has expired. Please use a different card.';
    default:
      return 'Payment failed. Please try again or contact support.';
  }
};
```

### Subscription Not Activated

**Symptoms:**
- Payment successful but still on free plan
- Features not unlocked after upgrade
- Dashboard shows old plan information
- Usage limits not updated

**Solutions:**

#### 1. Wait for Processing
- Allow 5-10 minutes for activation
- Refresh browser and check again
- Sign out and sign back in

#### 2. Webhook Issues
```javascript
// Check webhook processing
const checkWebhookStatus = async (sessionId) => {
  // Verify webhook was received and processed
  const { data } = await supabase
    .from('stripe_events')
    .select('*')
    .eq('event_type', 'checkout.session.completed')
    .order('created_at', { ascending: false });
};
```

#### 3. Manual Activation
- Contact support with payment confirmation
- Provide Stripe payment ID
- Include account email and desired plan

### Billing Address Issues

**Symptoms:**
- Payment declined due to address mismatch
- Tax calculation errors
- Unable to update billing information

**Solutions:**

#### 1. Address Verification
- Use exact address format from bank records
- Include apartment/unit numbers
- Verify postal/ZIP code format
- Check country and state selections

#### 2. International Addresses
- Use local address format
- Include country code for phone numbers
- Verify currency and tax requirements
- Check if service is available in your region

### Customer Portal Issues

**Symptoms:**
- Can't access Stripe Customer Portal
- Portal shows wrong information
- Unable to update payment methods
- Cancellation options not available

**Solutions:**

#### 1. Portal Access
```javascript
// Verify portal URL generation
const createPortalSession = async () => {
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: { return_url: window.location.origin + '/dashboard' }
  });
  
  if (error) {
    console.error('Portal access error:', error);
    return;
  }
  
  window.location.href = data.url;
};
```

#### 2. Session Timeout
- Try accessing portal again
- Sign out and back in to refresh session
- Clear browser cookies for Stripe domains

## Performance Issues

### Slow Loading Times

**Symptoms:**
- Pages take more than 5 seconds to load
- Tools are unresponsive
- File uploads are very slow
- Dashboard takes long time to display

**Solutions:**

#### 1. Network Optimization
```javascript
// Implement lazy loading
const lazyLoadComponents = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadComponent(entry.target);
      }
    });
  });
};
```

#### 2. Browser Performance
- Close unnecessary browser tabs
- Disable resource-heavy extensions
- Clear browser cache regularly
- Restart browser periodically

#### 3. Connection Issues
- Test internet speed (minimum 1 Mbps recommended)
- Use wired connection instead of WiFi
- Try different DNS servers (8.8.8.8, 1.1.1.1)
- Contact ISP if speeds are consistently slow

### Memory Issues

**Symptoms:**
- Browser becomes unresponsive
- "Out of memory" errors
- Tabs crash frequently
- System becomes slow during file operations

**Solutions:**

#### 1. Memory Management
```javascript
// Implement proper cleanup
const cleanupResources = () => {
  // Clear large objects from memory
  if (window.largeImageData) {
    window.largeImageData = null;
  }
  
  // Force garbage collection (Chrome DevTools)
  if (window.gc) {
    window.gc();
  }
};
```

#### 2. File Size Optimization
- Process smaller files when possible
- Implement chunked uploads for large files
- Clear processed files from memory
- Use streaming for large operations

### Database Performance

**Symptoms:**
- Slow query responses
- Timeout errors
- Dashboard data loads slowly
- File operations are sluggish

**Solutions:**

#### 1. Query Optimization
```sql
-- Check for missing indexes
EXPLAIN ANALYZE SELECT * FROM user_files WHERE user_id = 'uuid';

-- Add indexes if needed
CREATE INDEX IF NOT EXISTS idx_user_files_user_id_created 
ON user_files(user_id, created_at DESC);
```

#### 2. Connection Issues
- Check Supabase status page
- Verify API limits aren't exceeded
- Monitor connection pool usage
- Implement connection retry logic

## Browser Compatibility

### Internet Explorer Issues

**Symptoms:**
- Site doesn't load in IE
- JavaScript errors in older browsers
- Styling appears broken
- Features don't work properly

**Solutions:**

#### 1. Browser Support Notice
```javascript
// Detect unsupported browsers
const isUnsupportedBrowser = () => {
  const ua = navigator.userAgent;
  return ua.indexOf('MSIE') !== -1 || ua.indexOf('Trident/') !== -1;
};

if (isUnsupportedBrowser()) {
  showBrowserUpgradeNotice();
}
```

#### 2. Polyfills
```javascript
// Add necessary polyfills
if (!window.fetch) {
  // Load fetch polyfill
  loadScript('https://cdn.jsdelivr.net/npm/whatwg-fetch@3.6.2/dist/fetch.umd.js');
}
```

### Safari Issues

**Symptoms:**
- File uploads don't work
- Authentication redirects fail
- Local storage issues
- CSS styling problems

**Solutions:**

#### 1. Safari-Specific Fixes
```javascript
// Handle Safari's strict cookie policies
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
if (isSafari) {
  // Use different storage strategy
  useSessionStorage = true;
}
```

#### 2. iOS Safari Issues
- Check for iOS version compatibility
- Test in both Safari and Chrome on iOS
- Verify touch events work properly
- Check viewport settings for mobile

### Firefox Issues

**Symptoms:**
- WebP images don't display
- File API behaves differently
- CSS Grid layout problems
- Extension conflicts

**Solutions:**

#### 1. Feature Detection
```javascript
// Check for WebP support
const supportsWebP = () => {
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};
```

#### 2. Firefox-Specific Workarounds
- Use JPEG fallbacks for WebP images
- Test file operations in Firefox specifically
- Check for extension conflicts

## API and Integration Issues

### Supabase Connection Errors

**Symptoms:**
- "Failed to connect to Supabase" errors
- API requests timing out
- Authentication not working
- Database queries failing

**Solutions:**

#### 1. Configuration Check
```javascript
// Verify Supabase configuration
const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    console.log('Supabase connection successful');
  } catch (error) {
    console.error('Supabase connection failed:', error);
  }
};
```

#### 2. Network Issues
- Check Supabase status page
- Verify API URLs are correct
- Test from different network
- Check firewall/proxy settings

#### 3. Rate Limiting
```javascript
// Implement rate limiting handling
const handleRateLimit = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error.status === 429) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await operation();
    }
    throw error;
  }
};
```

### Stripe Integration Issues

**Symptoms:**
- Checkout sessions not creating
- Webhooks not being received
- Payment status not updating
- Customer portal not accessible

**Solutions:**

#### 1. Webhook Configuration
```javascript
// Verify webhook endpoint
const testWebhook = async () => {
  const response = await fetch('/api/stripe/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: true })
  });
  
  console.log('Webhook test:', response.status);
};
```

#### 2. API Key Issues
- Verify API keys are correct
- Check if using test vs live keys
- Ensure keys have proper permissions
- Rotate keys if compromised

### Edge Function Errors

**Symptoms:**
- Functions timing out
- "Function not found" errors
- Incorrect responses from functions
- High latency on function calls

**Solutions:**

#### 1. Function Debugging
```typescript
// Add logging to Edge Functions
export default async function handler(req: Request) {
  console.log('Function called:', req.method, req.url);
  
  try {
    // Function logic here
    const result = await processRequest(req);
    console.log('Function completed successfully');
    return new Response(JSON.stringify(result));
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    });
  }
}
```

#### 2. Timeout Issues
- Optimize function performance
- Reduce external API calls
- Implement proper error handling
- Use async operations efficiently

## Database and Storage Issues

### Database Connection Problems

**Symptoms:**
- "Connection refused" errors
- Queries timing out
- Inconsistent data retrieval
- RLS policy violations

**Solutions:**

#### 1. Connection Pool Issues
```javascript
// Implement connection retry logic
const retryQuery = async (queryFn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

#### 2. RLS Policy Issues
```sql
-- Debug RLS policies
SELECT * FROM pg_policies WHERE tablename = 'user_files';

-- Test policy with specific user
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub": "user-uuid"}';
SELECT * FROM user_files;
```

### File Storage Issues

**Symptoms:**
- Files not uploading to storage
- Download links not working
- Storage quota calculations wrong
- File permissions errors

**Solutions:**

#### 1. Storage Bucket Configuration
```javascript
// Verify bucket exists and is accessible
const testStorageAccess = async () => {
  try {
    const { data, error } = await supabase.storage
      .from('user-files')
      .list('', { limit: 1 });
    
    if (error) throw error;
    console.log('Storage access successful');
  } catch (error) {
    console.error('Storage access failed:', error);
  }
};
```

#### 2. File Path Issues
- Ensure proper file path format
- Check for special characters in filenames
- Verify folder structure exists
- Use proper UUID formatting

#### 3. Storage Policies
```sql
-- Check storage policies
SELECT * FROM storage.policies WHERE bucket_id = 'user-files';

-- Test policy with user context
SELECT storage.filename(name) FROM storage.objects 
WHERE bucket_id = 'user-files' LIMIT 5;
```

## Deployment Issues

### Vercel Deployment Failures

**Symptoms:**
- Build process fails
- Environment variables not loading
- Functions not deploying
- Site returns 500 errors

**Solutions:**

#### 1. Build Configuration
```json
// vercel.json
{
  "functions": {
    "api/cron/cleanup.js": {
      "maxDuration": 300
    }
  },
  "env": {
    "NODE_ENV": "production"
  }
}
```

#### 2. Environment Variables
- Verify all required variables are set
- Check for typos in variable names
- Ensure values don't contain special characters
- Test locally with same variables

#### 3. Function Deployment
```javascript
// Test function locally
export default function handler(req, res) {
  console.log('Function called:', req.method);
  
  try {
    // Function logic
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({ error: error.message });
  }
}
```

### Domain and SSL Issues

**Symptoms:**
- SSL certificate errors
- Domain not resolving
- Mixed content warnings
- Redirect loops

**Solutions:**

#### 1. DNS Configuration
```bash
# Check DNS resolution
nslookup your-domain.com
dig your-domain.com

# Verify CNAME record
dig CNAME your-domain.com
```

#### 2. SSL Certificate
- Wait 24-48 hours for certificate provisioning
- Verify domain ownership
- Check for conflicting DNS records
- Contact Vercel support if issues persist

#### 3. HTTPS Redirect
```javascript
// Force HTTPS redirect
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace('https:' + window.location.href.substring(window.location.protocol.length));
}
```

---

## Getting Additional Help

### Self-Service Resources

1. **Check Status Pages**:
   - Vercel Status: https://www.vercel-status.com/
   - Supabase Status: https://status.supabase.com/
   - Stripe Status: https://status.stripe.com/

2. **Documentation**:
   - Review API documentation
   - Check user guides
   - Browse FAQ section

3. **Community Support**:
   - GitHub Discussions
   - Discord community
   - Stack Overflow

### Contact Support

**When to Contact Support**:
- Issues persist after trying troubleshooting steps
- Data loss or corruption
- Security concerns
- Billing discrepancies

**How to Contact**:
- **Email**: support@yourapp.com
- **Include**: 
  - Account email
  - Detailed description of issue
  - Steps already tried
  - Screenshots or error messages
  - Browser and OS information

**Response Times**:
- Free Plan: 24-48 hours
- Pro Plan: 4-8 hours
- Agency Plan: 1-4 hours
- Critical Issues: 1 hour

### Escalation Process

1. **Level 1**: Self-service troubleshooting
2. **Level 2**: Community support
3. **Level 3**: Email support
4. **Level 4**: Priority support (Pro/Agency)
5. **Level 5**: Emergency escalation (critical issues)

---

*Last updated: January 2024*