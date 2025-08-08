# User Guide: Subscription Management

## Table of Contents

1. [Subscription Overview](#subscription-overview)
2. [Plan Comparison](#plan-comparison)
3. [Upgrading Your Plan](#upgrading-your-plan)
4. [Managing Your Subscription](#managing-your-subscription)
5. [Billing and Payments](#billing-and-payments)
6. [Downgrading and Cancellation](#downgrading-and-cancellation)
7. [Troubleshooting](#troubleshooting)

## Subscription Overview

### Available Plans

The Image Converter App offers three subscription tiers designed to meet different usage needs:

- **Free Plan**: Perfect for occasional users with basic needs
- **Pro Plan**: Ideal for regular users and small businesses
- **Agency Plan**: Designed for high-volume users and agencies

### How Subscriptions Work

- **Immediate Activation**: Upgrades take effect immediately after payment
- **Monthly Billing**: All paid plans are billed monthly
- **Usage Tracking**: Your usage is monitored in real-time
- **Automatic Renewal**: Subscriptions renew automatically unless cancelled
- **Prorated Billing**: Upgrades are prorated for the current billing period

## Plan Comparison

### Detailed Feature Comparison

| Feature | Free | Pro | Agency |
|---------|------|-----|--------|
| **Storage Limit** | 50 MB | 2 GB | 20 GB |
| **Monthly Conversions** | 500 | 5,000 | 50,000 |
| **Max File Size** | 25 MB | 100 MB | 250 MB |
| **API Calls/Month** | 5,000 | 50,000 | 500,000 |
| **Supported Formats** | Basic | All | All + Advanced |
| **Batch Processing** | ❌ | ✅ | ✅ |
| **Priority Support** | ❌ | ✅ | ✅ |
| **Advanced Tools** | ❌ | ✅ | ✅ |
| **Custom Branding** | ❌ | ❌ | ✅ |
| **API Access** | ❌ | Limited | Full |
| **Monthly Price** | $0 | $9 | $49 |

### Plan Recommendations

#### Choose Free If:
- You convert fewer than 500 files per month
- Your files are typically under 25 MB
- You need basic image conversion only
- You're trying out the service

#### Choose Pro If:
- You convert 500-5,000 files per month
- You work with larger files (up to 100 MB)
- You need advanced conversion options
- You want priority customer support
- You're a freelancer or small business

#### Choose Agency If:
- You convert 5,000+ files per month
- You work with very large files (up to 250 MB)
- You need maximum storage capacity
- You want custom branding options
- You're an agency or large organization
- You need full API access

## Upgrading Your Plan

### From the Dashboard

1. **Access Dashboard**: Sign in and navigate to your dashboard
2. **View Current Plan**: Your current plan is displayed at the top
3. **Click Upgrade**: Click the "Manage Subscription" or "Upgrade" button
4. **Choose Plan**: Select Pro or Agency plan
5. **Review Details**: Confirm features and pricing
6. **Complete Payment**: Proceed through Stripe Checkout
7. **Confirmation**: You'll receive email confirmation and immediate access

### From Usage Warnings

When you approach your limits, you'll see upgrade prompts:

1. **Quota Warning**: Click "Upgrade Now" in the warning message
2. **Plan Selection**: Choose the plan that meets your needs
3. **Immediate Relief**: Your new limits take effect immediately

### Upgrade Process Details

#### Payment Processing
- **Secure Checkout**: All payments processed through Stripe
- **Accepted Cards**: Visa, Mastercard, American Express, Discover
- **International**: Supports international cards and currencies
- **Security**: PCI DSS compliant payment processing

#### Immediate Benefits
After successful payment:
- ✅ Increased storage and conversion limits
- ✅ Access to premium features
- ✅ Priority support queue
- ✅ Advanced tool options

#### Billing Cycle
- **First Charge**: Prorated amount for remaining days in current month
- **Subsequent Charges**: Full monthly amount on the same date each month
- **Invoice**: Detailed invoice sent via email

## Managing Your Subscription

### Stripe Customer Portal

The Stripe Customer Portal is your central hub for subscription management. Access it by clicking "Manage Subscription" in your dashboard.

#### Available Actions

**Payment Methods**
- Add new credit or debit cards
- Update existing payment information
- Set default payment method
- Remove old payment methods

**Billing Information**
- Update billing address
- Change company information
- Update tax information
- Set billing email preferences

**Invoices and Receipts**
- View all past invoices
- Download PDF receipts
- See payment history
- Track upcoming charges

**Subscription Details**
- View current plan and features
- See next billing date
- Check subscription status
- Review usage allowances

### Subscription Status Types

#### Active
- **Description**: Your subscription is current and all features are available
- **Access**: Full access to plan features
- **Billing**: Regular monthly charges
- **Action Required**: None

#### Past Due
- **Description**: Payment failed or was declined
- **Access**: Limited access to premium features
- **Billing**: Retry attempts for 7 days
- **Action Required**: Update payment method immediately

#### Cancelled
- **Description**: Subscription cancelled but still active until period end
- **Access**: Full access until end of billing period
- **Billing**: No future charges
- **Action Required**: Can reactivate before period ends

#### Unpaid
- **Description**: Multiple payment failures
- **Access**: Downgraded to Free plan
- **Billing**: Subscription suspended
- **Action Required**: Contact support to reactivate

## Billing and Payments

### Payment Schedule

#### Monthly Billing
- **Billing Date**: Same date each month as your initial upgrade
- **Example**: Upgraded on January 15th → billed 15th of each month
- **Time**: Charges typically process between 12:00-6:00 AM UTC
- **Notification**: Email receipt sent within 1 hour of successful payment

#### Prorated Charges
When you upgrade mid-month:
- **Immediate Charge**: Prorated amount for remaining days
- **Calculation**: (Days remaining / Days in month) × Monthly price
- **Example**: Upgrade on 15th of 30-day month = 50% of monthly price
- **Next Charge**: Full monthly amount on your billing date

### Payment Methods

#### Supported Cards
- **Credit Cards**: Visa, Mastercard, American Express, Discover
- **Debit Cards**: Most debit cards with credit processing
- **International**: Cards from most countries accepted
- **Currency**: Charges in USD, converted by your bank if needed

#### Payment Security
- **PCI Compliance**: All payments processed securely through Stripe
- **Encryption**: Card details encrypted and never stored on our servers
- **Fraud Protection**: Advanced fraud detection and prevention
- **3D Secure**: Additional authentication when required

### Invoice Details

#### What's Included
- **Service Period**: Dates covered by the charge
- **Plan Details**: Subscription tier and features
- **Prorations**: Any mid-cycle changes
- **Taxes**: Applied based on billing address
- **Total Amount**: Final charge to your payment method

#### Tax Information
- **US Customers**: Sales tax applied based on billing address
- **International**: VAT or local taxes may apply
- **Tax ID**: Provide business tax ID for B2B invoices
- **Receipts**: All invoices serve as tax receipts

## Downgrading and Cancellation

### Downgrading Your Plan

#### From Pro/Agency to Free
1. **Access Customer Portal**: Click "Manage Subscription"
2. **Cancel Subscription**: Click "Cancel subscription"
3. **Confirm Cancellation**: Confirm you want to cancel
4. **Effective Date**: Cancellation takes effect at end of billing period
5. **Data Retention**: Your data remains accessible during the transition

#### What Happens When You Downgrade
- **Immediate**: No new charges scheduled
- **Until Period End**: Continue enjoying premium features
- **After Period End**: Automatically downgraded to Free plan
- **Data Handling**: Files exceeding Free limits remain accessible but no new uploads allowed

### Cancellation Process

#### Step-by-Step Cancellation
1. **Sign In**: Access your account dashboard
2. **Manage Subscription**: Click the subscription management button
3. **Customer Portal**: You'll be redirected to Stripe Customer Portal
4. **Cancel Subscription**: Find and click "Cancel subscription"
5. **Reason (Optional)**: Provide feedback about why you're cancelling
6. **Confirm**: Confirm your cancellation decision
7. **Email Confirmation**: You'll receive cancellation confirmation via email

#### Cancellation Timeline
- **Immediate**: Cancellation request processed
- **Until Period End**: Full access to premium features continues
- **Period End**: Automatic downgrade to Free plan
- **Data**: All your data remains safe and accessible

### Data Handling After Cancellation

#### What Remains Accessible
- **All Files**: Your uploaded files remain in your account
- **Conversion History**: Past conversions and downloads stay available
- **Account Data**: Profile and preferences preserved
- **Tool Access**: All tools remain available with Free plan limits

#### What Changes
- **Storage Limit**: Reduced to Free plan limit (50 MB)
- **New Uploads**: Blocked if over Free storage limit
- **Conversions**: Limited to Free plan allowance (500/month)
- **File Size**: New uploads limited to 25 MB maximum

#### Data Export
Before cancelling, you can export your data:
1. **Dashboard**: Go to Settings → Data Export
2. **Request Export**: Click "Export My Data"
3. **Download**: Receive download link via email within 24 hours
4. **Contents**: Includes all files, conversion history, and account data

## Troubleshooting

### Common Subscription Issues

#### Payment Declined
**Symptoms**: 
- Email notification about failed payment
- Account shows "Past Due" status
- Limited access to premium features

**Solutions**:
1. **Check Card**: Ensure card is valid and not expired
2. **Sufficient Funds**: Verify adequate balance or credit limit
3. **Update Payment**: Add new payment method in Customer Portal
4. **Contact Bank**: Some banks block online subscriptions
5. **Try Different Card**: Use alternative payment method

#### Subscription Not Activated
**Symptoms**:
- Payment successful but still on Free plan
- Features not unlocked after upgrade
- Usage limits not updated

**Solutions**:
1. **Wait 5 Minutes**: Activation can take a few minutes
2. **Refresh Dashboard**: Hard refresh your browser (Ctrl+F5)
3. **Check Email**: Look for confirmation email from Stripe
4. **Clear Cache**: Clear browser cache and cookies
5. **Contact Support**: If issue persists after 30 minutes

#### Billing Address Issues
**Symptoms**:
- Payment declined due to address mismatch
- Tax calculation errors
- Invoice shows wrong address

**Solutions**:
1. **Update Address**: Use exact address on file with your bank
2. **Match Card**: Billing address must match card billing address
3. **International Format**: Use proper country and postal code format
4. **Contact Support**: For persistent address validation issues

#### Cancellation Problems
**Symptoms**:
- Can't find cancellation option
- Cancellation doesn't process
- Still being charged after cancellation

**Solutions**:
1. **Customer Portal**: Always use Stripe Customer Portal for cancellation
2. **Active Subscription**: Can only cancel active subscriptions
3. **Billing Cycle**: Cancellation takes effect at end of current period
4. **Email Confirmation**: Must receive cancellation confirmation email
5. **Contact Support**: If you don't receive confirmation within 1 hour

### Getting Help

#### Self-Service Options
- **Customer Portal**: Manage most subscription issues yourself
- **Dashboard**: Check current status and usage
- **Email Receipts**: Review payment history and invoices
- **FAQ**: Check common questions and solutions

#### Contact Support
**When to Contact Support**:
- Payment issues that can't be resolved in Customer Portal
- Billing discrepancies or incorrect charges
- Account access problems
- Technical issues with subscription features

**How to Contact**:
- **Email**: support@yourapp.com
- **Include**: Account email, subscription ID, description of issue
- **Response Time**: 24-48 hours for Free users, 4-8 hours for Pro/Agency

#### Emergency Billing Issues
For urgent billing problems:
1. **Document Issue**: Take screenshots of error messages
2. **Check Bank**: Verify no holds or blocks on your account
3. **Try Alternative**: Use different payment method if available
4. **Contact Immediately**: Don't wait if you need immediate access

### Best Practices

#### Subscription Management
- **Monitor Usage**: Keep track of your monthly usage patterns
- **Plan Ahead**: Upgrade before hitting limits to avoid interruptions
- **Update Payment**: Keep payment methods current and valid
- **Review Invoices**: Check monthly invoices for accuracy
- **Export Data**: Regularly backup important files

#### Cost Optimization
- **Right-Size Plan**: Choose plan that matches your actual usage
- **Monitor Trends**: Track usage patterns over time
- **Seasonal Adjustments**: Upgrade/downgrade based on seasonal needs
- **Team Accounts**: Consider single Agency plan vs. multiple Pro plans

#### Security
- **Secure Access**: Don't share Customer Portal access
- **Monitor Charges**: Review bank statements for unauthorized charges
- **Update Promptly**: Change payment methods when cards expire
- **Contact Immediately**: Report any suspicious billing activity

---

**Need Help with Your Subscription?**

- **Billing Questions**: Check your Stripe Customer Portal first
- **Technical Issues**: Contact support@yourapp.com
- **Urgent Problems**: Include "URGENT" in your email subject line

*Last updated: January 2024*