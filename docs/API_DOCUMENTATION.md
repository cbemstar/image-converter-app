# API Documentation

## Overview

This document provides comprehensive API documentation for the Image Converter App with Supabase CMS integration. The application uses a combination of client-side JavaScript modules and Supabase Edge Functions to provide authentication, file management, quota enforcement, and payment processing.

## Table of Contents

1. [Authentication API](#authentication-api)
2. [Quota Management API](#quota-management-api)
3. [File Management API](#file-management-api)
4. [Dashboard API](#dashboard-api)
5. [Stripe Integration API](#stripe-integration-api)
6. [Edge Functions](#edge-functions)
7. [Database Schema](#database-schema)
8. [Error Handling](#error-handling)

## Authentication API

### AuthManager Class

The `AuthManager` class handles all authentication operations including user registration, login, logout, and session management.

#### Constructor

```javascript
const authManager = new AuthManager(supabaseClient);
```

**Parameters:**
- `supabaseClient` (SupabaseClient): Initialized Supabase client instance

#### Methods

##### signUp(email, password, userData)

Register a new user account.

```javascript
const result = await authManager.signUp(
  'user@example.com', 
  'securePassword123',
  { full_name: 'John Doe' }
);
```

**Parameters:**
- `email` (string): User's email address
- `password` (string): User's password (minimum 8 characters)
- `userData` (object): Additional user profile data

**Returns:**
- `Promise<{user: User, session: Session, error: Error}>`: Authentication result

**Errors:**
- `SIGNUP_DISABLED`: Registration is disabled
- `EMAIL_ALREADY_EXISTS`: Email is already registered
- `WEAK_PASSWORD`: Password doesn't meet requirements

##### signIn(email, password)

Authenticate an existing user.

```javascript
const result = await authManager.signIn('user@example.com', 'password123');
```

**Parameters:**
- `email` (string): User's email address
- `password` (string): User's password

**Returns:**
- `Promise<{user: User, session: Session, error: Error}>`: Authentication result

**Errors:**
- `INVALID_CREDENTIALS`: Invalid email or password
- `EMAIL_NOT_CONFIRMED`: Email verification required
- `TOO_MANY_REQUESTS`: Rate limit exceeded

##### signInWithProvider(provider)

Authenticate using OAuth providers.

```javascript
const result = await authManager.signInWithProvider('google');
```

**Parameters:**
- `provider` (string): OAuth provider ('google', 'github')

**Returns:**
- `Promise<{user: User, session: Session, error: Error}>`: Authentication result

##### signOut()

Sign out the current user.

```javascript
await authManager.signOut();
```

**Returns:**
- `Promise<{error: Error}>`: Sign out result

##### getCurrentUser()

Get the currently authenticated user.

```javascript
const user = authManager.getCurrentUser();
```

**Returns:**
- `User | null`: Current user object or null if not authenticated

##### isAuthenticated()

Check if a user is currently authenticated.

```javascript
const isAuth = authManager.isAuthenticated();
```

**Returns:**
- `boolean`: True if user is authenticated

##### onAuthStateChange(callback)

Listen for authentication state changes.

```javascript
authManager.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session);
});
```

**Parameters:**
- `callback` (function): Callback function to handle state changes

## Quota Management API

### QuotaManager Class

The `QuotaManager` class handles usage tracking, quota enforcement, and limit checking for storage, conversions, and API calls.

#### Constructor

```javascript
const quotaManager = new QuotaManager(authManager, profileManager, supabaseClient);
```

#### Methods

##### checkStorageQuota(fileSize)

Check if a file upload would exceed storage quota.

```javascript
const canUpload = await quotaManager.checkStorageQuota(1024 * 1024); // 1MB
```

**Parameters:**
- `fileSize` (number): Size of file to upload in bytes

**Returns:**
- `Promise<{allowed: boolean, usage: number, limit: number, percentage: number}>`: Quota check result

##### checkConversionQuota()

Check if user can perform another conversion.

```javascript
const canConvert = await quotaManager.checkConversionQuota();
```

**Returns:**
- `Promise<{allowed: boolean, usage: number, limit: number, percentage: number}>`: Quota check result

##### checkApiCallQuota()

Check and decrement API call quota.

```javascript
const canCall = await quotaManager.checkApiCallQuota();
```

**Returns:**
- `Promise<{allowed: boolean, usage: number, limit: number, percentage: number}>`: Quota check result

##### updateUsage(type, amount)

Update usage counters for a specific quota type.

```javascript
await quotaManager.updateUsage('storage', 1024 * 1024); // Add 1MB to storage usage
await quotaManager.updateUsage('conversions', 1); // Increment conversion count
```

**Parameters:**
- `type` (string): Usage type ('storage', 'conversions', 'apiCalls')
- `amount` (number): Amount to add to usage counter

##### getUsagePercentage(type)

Get current usage as a percentage of the limit.

```javascript
const storagePercentage = quotaManager.getUsagePercentage('storage');
```

**Parameters:**
- `type` (string): Usage type ('storage', 'conversions', 'apiCalls')

**Returns:**
- `number`: Usage percentage (0-100)

##### getCurrentUsage()

Get current usage statistics for all quota types.

```javascript
const usage = await quotaManager.getCurrentUsage();
// Returns: { storage: 12345, conversions: 45, apiCalls: 123 }
```

**Returns:**
- `Promise<{storage: number, conversions: number, apiCalls: number}>`: Current usage statistics

##### getPlanLimits(planType)

Get quota limits for a specific plan.

```javascript
const limits = quotaManager.getPlanLimits('pro');
// Returns: { storage: 2147483648, conversions: 5000, apiCalls: 50000, maxFileSize: 104857600 }
```

**Parameters:**
- `planType` (string): Plan type ('free', 'pro', 'agency')

**Returns:**
- `object`: Plan limits object

## File Management API

### FileManager Class

The `FileManager` class handles file uploads, downloads, and storage management with quota enforcement.

#### Constructor

```javascript
const fileManager = new FileManager(authManager, quotaManager, supabaseClient);
```

#### Methods

##### uploadFile(file, toolType, metadata)

Upload a file to Supabase Storage with quota checking.

```javascript
const result = await fileManager.uploadFile(
  fileObject, 
  'image-converter',
  { originalFormat: 'png', targetFormat: 'webp' }
);
```

**Parameters:**
- `file` (File): File object to upload
- `toolType` (string): Tool that generated the file
- `metadata` (object): Additional file metadata

**Returns:**
- `Promise<{success: boolean, fileId: string, url: string, error: Error}>`: Upload result

##### downloadFile(fileId)

Download a file by ID.

```javascript
const blob = await fileManager.downloadFile('file-uuid');
```

**Parameters:**
- `fileId` (string): UUID of the file to download

**Returns:**
- `Promise<Blob>`: File blob data

##### deleteFile(fileId)

Delete a file and update quota usage.

```javascript
const result = await fileManager.deleteFile('file-uuid');
```

**Parameters:**
- `fileId` (string): UUID of the file to delete

**Returns:**
- `Promise<{success: boolean, error: Error}>`: Deletion result

##### listUserFiles(options)

List files belonging to the current user.

```javascript
const files = await fileManager.listUserFiles({
  limit: 50,
  offset: 0,
  toolType: 'image-converter'
});
```

**Parameters:**
- `options` (object): Query options
  - `limit` (number): Maximum number of files to return
  - `offset` (number): Number of files to skip
  - `toolType` (string): Filter by tool type

**Returns:**
- `Promise<Array<FileRecord>>`: Array of file records

##### generateShareUrl(fileId, expiresIn)

Generate a time-limited sharing URL for a file.

```javascript
const shareUrl = await fileManager.generateShareUrl('file-uuid', 3600); // 1 hour
```

**Parameters:**
- `fileId` (string): UUID of the file to share
- `expiresIn` (number): Expiration time in seconds

**Returns:**
- `Promise<string>`: Signed URL for file access

## Dashboard API

### Dashboard Class

The `Dashboard` class provides user account management and usage visualization.

#### Constructor

```javascript
const dashboard = new Dashboard(authManager, profileManager, quotaManager);
```

#### Methods

##### renderUsageMeters()

Render usage visualization meters with WCAG 2.1 AA compliance.

```javascript
await dashboard.renderUsageMeters();
```

**Returns:**
- `Promise<void>`: Renders usage meters in the DOM

##### renderPlanBadge()

Display current subscription plan badge.

```javascript
await dashboard.renderPlanBadge();
```

**Returns:**
- `Promise<void>`: Renders plan badge in the DOM

##### renderRecentActivity()

Display recent user activity and file operations.

```javascript
await dashboard.renderRecentActivity();
```

**Returns:**
- `Promise<void>`: Renders activity list in the DOM

##### handleManageSubscription()

Redirect to Stripe Customer Portal for subscription management.

```javascript
await dashboard.handleManageSubscription();
```

**Returns:**
- `Promise<void>`: Redirects to Stripe Customer Portal

##### exportUserData()

Export user data for GDPR compliance.

```javascript
const data = await dashboard.exportUserData();
```

**Returns:**
- `Promise<object>`: User data export object

## Stripe Integration API

### StripeManager Class

The `StripeManager` class handles payment processing and subscription management.

#### Constructor

```javascript
const stripeManager = new StripeManager();
```

#### Methods

##### createCheckoutSession(priceId, successUrl, cancelUrl)

Create a Stripe Checkout session for subscription upgrade.

```javascript
const session = await stripeManager.createCheckoutSession(
  'price_1234567890',
  'https://app.com/success',
  'https://app.com/cancel'
);
```

**Parameters:**
- `priceId` (string): Stripe price ID for the subscription
- `successUrl` (string): URL to redirect after successful payment
- `cancelUrl` (string): URL to redirect if payment is cancelled

**Returns:**
- `Promise<{sessionId: string, url: string}>`: Checkout session details

##### redirectToCustomerPortal(returnUrl)

Redirect user to Stripe Customer Portal for subscription management.

```javascript
await stripeManager.redirectToCustomerPortal('https://app.com/dashboard');
```

**Parameters:**
- `returnUrl` (string): URL to return to after portal session

**Returns:**
- `Promise<void>`: Redirects to Stripe Customer Portal

## Edge Functions

### quota-check Function

Validates user quotas and enforces limits server-side.

**Endpoint:** `https://your-project.supabase.co/functions/v1/quota-check`

**Method:** POST

**Headers:**
```
Authorization: Bearer <user-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "action_type": "upload",
  "file_size": 1048576,
  "tool_type": "image-converter"
}
```

**Response (Success):**
```json
{
  "allowed": true,
  "current_usage": {
    "storage": 12345678,
    "conversions": 45,
    "api_calls": 123
  },
  "limits": {
    "storage": 52428800,
    "conversions": 500,
    "api_calls": 5000
  }
}
```

**Response (Quota Exceeded):**
```json
{
  "allowed": false,
  "error": "Quota exceeded",
  "quota_type": "storage",
  "current_usage": 52428800,
  "limit": 52428800,
  "upgrade_required": true
}
```

### stripe-webhook Function

Handles Stripe webhook events for subscription management.

**Endpoint:** `https://your-project.supabase.co/functions/v1/stripe-webhook`

**Method:** POST

**Headers:**
```
Stripe-Signature: <webhook-signature>
Content-Type: application/json
```

**Supported Events:**
- `checkout.session.completed`: Activates new subscription
- `invoice.payment_succeeded`: Confirms payment
- `invoice.payment_failed`: Marks subscription as past due
- `customer.subscription.updated`: Updates subscription details
- `customer.subscription.deleted`: Cancels subscription

## Database Schema

### Tables

#### user_profiles
Stores user profile information and subscription details.

```sql
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'agency')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled')),
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### payment_subscriptions
Tracks active subscriptions and billing information.

```sql
CREATE TABLE payment_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('pro', 'agency')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### user_files
Tracks uploaded files and storage usage.

```sql
CREATE TABLE user_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  share_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### usage_analytics
Tracks user activity and tool usage.

```sql
CREATE TABLE usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tool_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### monthly_usage
Tracks monthly usage quotas.

```sql
CREATE TABLE monthly_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month_year TEXT NOT NULL,
  conversions_count INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);
```

## Error Handling

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `AUTH_001` | Invalid credentials | Check email and password |
| `AUTH_002` | Email not confirmed | Check email for confirmation link |
| `AUTH_003` | Session expired | Re-authenticate |
| `QUOTA_001` | Storage limit exceeded | Upgrade plan or delete files |
| `QUOTA_002` | Conversion limit exceeded | Upgrade plan or wait for monthly reset |
| `QUOTA_003` | API call limit exceeded | Upgrade plan or wait for monthly reset |
| `FILE_001` | File too large | Reduce file size or upgrade plan |
| `FILE_002` | Invalid file type | Use supported file formats |
| `STRIPE_001` | Payment failed | Update payment method |
| `STRIPE_002` | Subscription cancelled | Reactivate subscription |

### Error Response Format

```json
{
  "error": {
    "code": "QUOTA_001",
    "message": "Storage limit exceeded",
    "details": {
      "current_usage": 52428800,
      "limit": 52428800,
      "quota_type": "storage"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Authentication | 5 requests | 1 minute |
| File Upload | 10 requests | 1 minute |
| Quota Check | 100 requests | 1 minute |
| Dashboard API | 50 requests | 1 minute |

## SDK Examples

### Complete User Registration Flow

```javascript
// Initialize managers
const authManager = new AuthManager(supabaseClient);
const profileManager = new ProfileManager(authManager, supabaseClient);
const quotaManager = new QuotaManager(authManager, profileManager, supabaseClient);

// Register new user
try {
  const { user, session, error } = await authManager.signUp(
    'user@example.com',
    'securePassword123',
    { full_name: 'John Doe' }
  );
  
  if (error) throw error;
  
  // Create user profile
  await profileManager.createProfile(user.id, {
    subscription_plan: 'free',
    subscription_status: 'active'
  });
  
  console.log('User registered successfully:', user.email);
  
} catch (error) {
  console.error('Registration failed:', error.message);
}
```

### File Upload with Quota Check

```javascript
// Check quota before upload
const fileSize = file.size;
const quotaCheck = await quotaManager.checkStorageQuota(fileSize);

if (!quotaCheck.allowed) {
  // Show upgrade prompt
  showUpgradeModal('Storage limit exceeded. Upgrade to continue.');
  return;
}

// Upload file
try {
  const result = await fileManager.uploadFile(file, 'image-converter', {
    originalFormat: 'png',
    targetFormat: 'webp'
  });
  
  if (result.success) {
    console.log('File uploaded:', result.url);
    
    // Update usage
    await quotaManager.updateUsage('storage', fileSize);
    await quotaManager.updateUsage('conversions', 1);
  }
  
} catch (error) {
  console.error('Upload failed:', error.message);
}
```

### Subscription Upgrade Flow

```javascript
// Create checkout session
try {
  const session = await stripeManager.createCheckoutSession(
    'price_pro_monthly',
    `${window.location.origin}/dashboard?success=true`,
    `${window.location.origin}/pricing?cancelled=true`
  );
  
  // Redirect to Stripe Checkout
  window.location.href = session.url;
  
} catch (error) {
  console.error('Checkout failed:', error.message);
}
```

## Webhooks

### Stripe Webhook Configuration

Configure the following webhook events in your Stripe dashboard:

- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Webhook URL:** `https://your-project.supabase.co/functions/v1/stripe-webhook`

### Webhook Security

All webhooks are verified using Stripe's signature verification:

```javascript
const signature = request.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

## Testing

### Unit Tests

Run the test suite:

```bash
npm test
```

### Integration Tests

Test complete user flows:

```bash
npm run test:integration
```

### API Testing

Use the provided Postman collection or curl commands:

```bash
# Test quota check
curl -X POST https://your-project.supabase.co/functions/v1/quota-check \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"action_type": "upload", "file_size": 1048576}'
```

## Support

For API support and questions:

- Documentation: [Link to full documentation]
- GitHub Issues: [Link to repository issues]
- Email: support@yourapp.com

---

*Last updated: January 2024*
*API Version: 1.0.0*