# User Guide: Dashboard and Account Management

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Account Information](#account-information)
4. [Usage Monitoring](#usage-monitoring)
5. [File Management](#file-management)
6. [Subscription Management](#subscription-management)
7. [Settings and Preferences](#settings-and-preferences)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Accessing Your Dashboard

1. **Sign In**: Navigate to the application and click "Sign In" in the top navigation
2. **Enter Credentials**: Use your email and password, or sign in with Google/GitHub
3. **Dashboard Access**: Once authenticated, click your profile icon and select "Dashboard"

### First-Time Setup

When you first access your dashboard, you'll see:
- Welcome message with your account details
- Current plan information (Free tier by default)
- Usage meters showing your current consumption
- Quick action buttons for common tasks

## Dashboard Overview

### Main Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│ Welcome back, [Your Name]!                             │
│ Plan: [Free/Pro/Agency] • Member since [Date]          │
├─────────────────────────────────────────────────────────┤
│ Usage Overview                                          │
│ ┌─────────────────┐ ┌─────────────────┐                │
│ │ Storage         │ │ Conversions     │                │
│ │ [████████░░] 80%│ │ [███░░░░░░░] 30%│                │
│ │ 40 MB / 50 MB   │ │ 150 / 500       │                │
│ └─────────────────┘ └─────────────────┘                │
├─────────────────────────────────────────────────────────┤
│ Quick Actions                                           │
│ [Upload Files] [View Files] [Manage Subscription]      │
├─────────────────────────────────────────────────────────┤
│ Recent Activity                                         │
│ • Converted image.png to WebP (2 hours ago)            │
│ • Uploaded document.pdf (1 day ago)                    │
│ • Created QR code (3 days ago)                         │
└─────────────────────────────────────────────────────────┘
```

### Navigation Elements

- **Profile Menu**: Access dashboard, settings, and sign out
- **Plan Badge**: Shows your current subscription tier
- **Usage Meters**: Visual representation of your quota usage
- **Quick Actions**: One-click access to common features
- **Activity Feed**: Recent tool usage and file operations

## Account Information

### Viewing Account Details

Your account information is displayed at the top of the dashboard:

- **Name**: Your full name (editable in settings)
- **Email**: Your registered email address
- **Plan Type**: Current subscription (Free, Pro, or Agency)
- **Member Since**: Account creation date
- **Account Status**: Active, Past Due, or Cancelled

### Updating Profile Information

1. Click the **Settings** button in the dashboard
2. Navigate to **Profile** tab
3. Update your information:
   - Full Name
   - Profile Picture (optional)
   - Notification Preferences
4. Click **Save Changes**

## Usage Monitoring

### Understanding Usage Meters

The dashboard displays three key usage metrics:

#### Storage Usage
- **What it tracks**: Total file storage across all tools
- **Visual indicator**: Progress bar with percentage
- **Details**: Shows used space / total allowance
- **Color coding**:
  - Green: 0-70% usage
  - Yellow: 70-85% usage
  - Orange: 85-95% usage
  - Red: 95-100% usage

#### Monthly Conversions
- **What it tracks**: Number of file conversions this month
- **Reset date**: First day of each month
- **Includes**: All tool operations (image conversion, PDF merge, etc.)

#### API Calls
- **What it tracks**: Backend API requests
- **Purpose**: Ensures fair usage within free tier limits
- **Automatic**: Tracked transparently in the background

### Usage Warnings

You'll receive notifications when approaching limits:

- **70% Warning**: "You're using 70% of your [quota type] allowance"
- **85% Critical**: "You're approaching your [quota type] limit"
- **95% Exceeded**: "You've used 95% of your [quota type]. Upgrade to continue"

### Plan Limits Reference

| Feature | Free Plan | Pro Plan | Agency Plan |
|---------|-----------|----------|-------------|
| Storage | 50 MB | 2 GB | 20 GB |
| Monthly Conversions | 500 | 5,000 | 50,000 |
| Max File Size | 25 MB | 100 MB | 250 MB |
| API Calls | 5,000/month | 50,000/month | 500,000/month |
| Priority Support | ❌ | ✅ | ✅ |
| Advanced Features | ❌ | ✅ | ✅ |

## File Management

### Viewing Your Files

1. Click **View Files** in the dashboard quick actions
2. Browse your uploaded files organized by:
   - **Recent**: Most recently uploaded
   - **Tool Type**: Grouped by the tool that created them
   - **File Type**: Organized by format (images, PDFs, etc.)

### File Operations

#### Downloading Files
1. Locate the file in your file list
2. Click the **Download** button
3. File will be saved to your default download location

#### Sharing Files
1. Click the **Share** button next to any file
2. Choose sharing duration (1 hour, 1 day, 1 week)
3. Copy the generated sharing link
4. Share the link with others (no account required to access)

#### Deleting Files
1. Select files you want to delete
2. Click the **Delete** button
3. Confirm deletion in the popup
4. **Note**: Deleted files immediately free up storage quota

### File Organization Tips

- **Regular Cleanup**: Delete old files you no longer need
- **Use Descriptive Names**: Rename files for easy identification
- **Monitor Storage**: Keep an eye on your storage usage meter
- **Bulk Operations**: Select multiple files for batch operations

## Subscription Management

### Current Plan Information

Your current plan is displayed prominently in the dashboard with:
- Plan name and features
- Billing cycle (monthly/yearly)
- Next billing date
- Current usage against plan limits

### Upgrading Your Plan

#### From Dashboard
1. Click **Manage Subscription** button
2. Choose your desired plan (Pro or Agency)
3. Click **Upgrade Now**
4. Complete payment through Stripe Checkout
5. Your plan will be activated immediately

#### Plan Comparison
Before upgrading, review the plan comparison table to understand:
- Storage allowances
- Monthly conversion limits
- Maximum file sizes
- Additional features included

### Managing Billing

#### Stripe Customer Portal
Click **Manage Subscription** to access the Stripe Customer Portal where you can:

- **Update Payment Method**: Add or change credit cards
- **View Invoices**: Download past billing statements
- **Update Billing Address**: Change billing information
- **Cancel Subscription**: Downgrade to free plan
- **Reactivate**: Restore cancelled subscriptions

#### Billing Cycle
- **Monthly Plans**: Billed on the same date each month
- **Annual Plans**: Billed yearly with 2 months free
- **Proration**: Upgrades are prorated for the current billing period
- **Downgrades**: Take effect at the end of the current billing period

### Subscription Status

#### Active Subscription
- Full access to plan features
- Regular billing on schedule
- No usage restrictions beyond plan limits

#### Past Due
- Limited access to premium features
- Billing issue needs resolution
- Update payment method in Customer Portal

#### Cancelled
- Access continues until end of billing period
- Automatic downgrade to Free plan
- Can reactivate anytime before period ends

## Settings and Preferences

### Account Settings

#### Profile Settings
- **Name**: Update your display name
- **Email**: Change your email address (requires verification)
- **Password**: Update your password
- **Two-Factor Authentication**: Enable 2FA for security

#### Notification Preferences
- **Usage Alerts**: Get notified when approaching limits
- **Billing Notifications**: Receive payment and invoice emails
- **Feature Updates**: Stay informed about new features
- **Marketing Emails**: Opt in/out of promotional content

#### Privacy Settings
- **Data Export**: Download all your account data
- **Account Deletion**: Permanently delete your account
- **Usage Analytics**: Control data collection preferences

### Tool Preferences

Each tool remembers your preferences:
- **Default Settings**: Set preferred conversion options
- **Quality Settings**: Choose default quality levels
- **Output Formats**: Set preferred output formats
- **Auto-Save**: Enable automatic saving of converted files

### Theme and Display

- **Dark/Light Mode**: Toggle between themes
- **Language**: Select your preferred language
- **Timezone**: Set your local timezone for accurate timestamps
- **Accessibility**: Enable high contrast, large text, etc.

## Troubleshooting

### Common Issues

#### Can't Access Dashboard
**Problem**: Dashboard won't load or shows errors
**Solutions**:
1. Refresh the page and try again
2. Clear browser cache and cookies
3. Try a different browser or incognito mode
4. Check your internet connection
5. Contact support if issue persists

#### Usage Meters Not Updating
**Problem**: Usage statistics appear incorrect
**Solutions**:
1. Refresh the dashboard page
2. Wait a few minutes for data synchronization
3. Check if recent operations completed successfully
4. Contact support with specific details

#### Subscription Issues
**Problem**: Plan changes not reflected or billing problems
**Solutions**:
1. Check the Stripe Customer Portal for latest status
2. Verify payment method is valid and current
3. Look for email notifications from Stripe
4. Contact support with your customer ID

#### File Upload Problems
**Problem**: Files won't upload or uploads fail
**Solutions**:
1. Check file size against your plan limits
2. Verify file format is supported
3. Check your storage quota usage
4. Try uploading smaller files first
5. Clear browser cache if uploads consistently fail

### Getting Help

#### Self-Service Resources
- **FAQ**: Check frequently asked questions
- **Documentation**: Review detailed guides
- **Video Tutorials**: Watch step-by-step walkthroughs
- **Community Forum**: Ask questions and share tips

#### Contact Support
- **Email**: support@yourapp.com
- **Response Time**: 24-48 hours for Free, 4-8 hours for Pro/Agency
- **Include**: Account email, description of issue, screenshots if helpful

#### Account Recovery
If you can't access your account:
1. Use the "Forgot Password" link on the sign-in page
2. Check your email for reset instructions
3. Contact support if you don't receive the email
4. Provide account verification information

### Best Practices

#### Security
- Use a strong, unique password
- Enable two-factor authentication
- Don't share your account credentials
- Sign out when using shared computers
- Review account activity regularly

#### Usage Optimization
- Monitor your usage meters regularly
- Delete unnecessary files to free up storage
- Use appropriate quality settings for your needs
- Consider upgrading if you frequently hit limits
- Take advantage of bulk operations for efficiency

#### Data Management
- Regularly backup important files
- Use descriptive filenames for organization
- Clean up old files periodically
- Export your data before making major account changes

---

**Need More Help?**

If you can't find what you're looking for in this guide:
- Check our [FAQ section](link-to-faq)
- Visit our [video tutorials](link-to-tutorials)
- Contact our support team at support@yourapp.com

*Last updated: January 2024*