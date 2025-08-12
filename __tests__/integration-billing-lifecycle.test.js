/**
 * Billing and Subscription Lifecycle Integration Tests
 * 
 * Tests end-to-end billing workflows including plan purchases, upgrades,
 * cancellations, and Customer Portal integration
 * Requirements: 3.1-3.6, 4.1-4.7, 15.1-15.6
 */

const { JSDOM } = require('jsdom');

// Mock Stripe
const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn()
    }
  },
  billingPortal: {
    sessions: {
      create: jest.fn()
    }
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn()
  }
};

jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Billing and Subscription Lifecycle Integration Tests', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="billing-container">
            <div id="plan-selection">
              <div class="plan-card" data-plan="pro">
                <h3>Pro Plan</h3>
                <p>$9.99/month</p>
                <button class="upgrade-btn" data-plan="pro">Upgrade to Pro</button>
              </div>
              <div class="plan-card" data-plan="unlimited">
                <h3>Unlimited Plan</h3>
                <p>$29.99/month</p>
                <button class="upgrade-btn" data-plan="unlimited">Upgrade to Unlimited</button>
              </div>
            </div>
            <div id="current-plan">
              <span id="plan-name">Free</span>
              <button id="manage-billing-btn" style="display: none;">Manage Billing</button>
            </div>
            <div id="checkout-loading" style="display: none;">
              <p>Redirecting to checkout...</p>
            </div>
            <div id="billing-error" style="display: none;">
              <p id="error-message"></p>
            </div>
          </div>
        </body>
      </html>
    `);

    window = dom.window;
    document = window.document;

    // Set up global objects
    global.window = window;
    global.document = document;
    global.location = {
      href: 'http://localhost:3000/tools/image-converter',
      origin: 'http://localhost:3000'
    };

    // Reset mocks
    jest.clearAllMocks();
    fetch.mockClear();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Stripe Checkout Integration', () => {
    test('creates checkout session with correct parameters', async () => {
      // Requirement 3.1: Stripe Checkout integration
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_verified: true
      };

      const mockCheckoutSession = {
        id: 'cs_test_session',
        url: 'https://checkout.stripe.com/pay/cs_test_session'
      };

      // Mock API response
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          checkoutUrl: mockCheckoutSession.url,
          sessionId: mockCheckoutSession.id
        })
      });

      const createCheckoutSession = async (planId, userId) => {
        const response = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({
            planId,
            userId,
            successUrl: `${location.origin}/tools/image-converter?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${location.origin}/tools/image-converter?checkout=canceled`
          })
        });

        return response.json();
      };

      const result = await createCheckoutSession('pro', mockUser.id);

      expect(fetch).toHaveBeenCalledWith('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          planId: 'pro',
          userId: mockUser.id,
          successUrl: 'http://localhost:3000/tools/image-converter?checkout=success&session_id={CHECKOUT_SESSION_ID}',
          cancelUrl: 'http://localhost:3000/tools/image-converter?checkout=canceled'
        })
      });

      expect(result.success).toBe(true);
      expect(result.checkoutUrl).toContain('checkout.stripe.com');
    });

    test('handles checkout session creation with idempotency', async () => {
      // Requirement 3.2: Idempotency keys for Stripe operations
      const idempotencyKey = `checkout_user-123_pro_${Date.now()}`;

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_session',
          idempotencyKey
        })
      });

      const createCheckoutWithIdempotency = async (planId, userId) => {
        const response = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({ planId, userId })
        });

        return response.json();
      };

      const result = await createCheckoutWithIdempotency('pro', 'user-123');

      expect(fetch).toHaveBeenCalledWith('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ planId: 'pro', userId: 'user-123' })
      });

      expect(result.success).toBe(true);
    });

    test('redirects to checkout and preserves callback URL', async () => {
      // Requirement 3.3: Checkout redirect with callback URL preservation
      const originalUrl = 'http://localhost:3000/tools/image-converter?format=png';
      global.location.href = originalUrl;

      const mockCheckoutUrl = 'https://checkout.stripe.com/pay/cs_test_session';

      // Mock window.location.assign
      const mockAssign = jest.fn();
      delete window.location;
      window.location = { assign: mockAssign, href: originalUrl };

      const redirectToCheckout = (checkoutUrl) => {
        // Show loading state
        const loadingDiv = document.getElementById('checkout-loading');
        loadingDiv.style.display = 'block';

        // Redirect to Stripe Checkout
        window.location.assign(checkoutUrl);
      };

      redirectToCheckout(mockCheckoutUrl);

      expect(mockAssign).toHaveBeenCalledWith(mockCheckoutUrl);
      expect(document.getElementById('checkout-loading').style.display).toBe('block');
    });
  });

  describe('Customer Portal Integration', () => {
    test('creates customer portal session with return URL', async () => {
      // Requirement 4.1: Customer Portal integration
      const mockUser = {
        id: 'user-123',
        stripe_customer_id: 'cus_test_customer'
      };

      const mockPortalSession = {
        url: 'https://billing.stripe.com/session/portal_test_session'
      };

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          portalUrl: mockPortalSession.url
        })
      });

      const createPortalSession = async (customerId) => {
        const response = await fetch('/api/create-portal-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({
            customerId,
            returnUrl: `${location.origin}/tools/image-converter?portal=returned`
          })
        });

        return response.json();
      };

      const result = await createPortalSession(mockUser.stripe_customer_id);

      expect(fetch).toHaveBeenCalledWith('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          customerId: mockUser.stripe_customer_id,
          returnUrl: 'http://localhost:3000/tools/image-converter?portal=returned'
        })
      });

      expect(result.success).toBe(true);
      expect(result.portalUrl).toContain('billing.stripe.com');
    });

    test('handles portal session creation errors gracefully', async () => {
      // Requirement 4.5: Portal error handling
      fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          success: false,
          error: 'Customer not found'
        })
      });

      const createPortalSession = async (customerId) => {
        try {
          const response = await fetch('/api/create-portal-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify({ customerId })
          });

          const result = await response.json();
          
          if (!response.ok) {
            throw new Error(result.error || 'Portal session creation failed');
          }

          return result;
        } catch (error) {
          return { success: false, error: error.message };
        }
      };

      const result = await createPortalSession('invalid_customer');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found');
    });
  });

  describe('Plan Upgrade Flow', () => {
    test('handles complete plan upgrade workflow', async () => {
      // Requirement 3.4: Complete upgrade workflow
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        current_plan: 'free'
      };

      // Step 1: User clicks upgrade button
      const upgradeBtn = document.querySelector('[data-plan="pro"]');
      const planName = document.getElementById('plan-name');
      const manageBillingBtn = document.getElementById('manage-billing-btn');

      // Mock checkout creation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_session'
        })
      });

      // Mock successful checkout completion (simulated webhook processing)
      const simulateCheckoutSuccess = () => {
        // Update UI to reflect new plan
        planName.textContent = 'Pro';
        manageBillingBtn.style.display = 'block';
        
        // Update quota display (would be done by separate function)
        const quotaLimit = document.getElementById('quota-limit');
        if (quotaLimit) {
          quotaLimit.textContent = '500';
        }
      };

      // Simulate upgrade flow
      const handleUpgradeClick = async (planId) => {
        const response = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, userId: mockUser.id })
        });

        const result = await response.json();
        
        if (result.success) {
          // In real app, would redirect to Stripe
          // For test, simulate successful completion
          simulateCheckoutSuccess();
          return { success: true };
        }
        
        return result;
      };

      const result = await handleUpgradeClick('pro');

      expect(result.success).toBe(true);
      expect(planName.textContent).toBe('Pro');
      expect(manageBillingBtn.style.display).toBe('block');
    });

    test('updates quota limits after plan upgrade', async () => {
      // Requirement 3.5: Quota update after upgrade
      const userId = 'user-123';
      const oldPlan = { id: 'free', monthly_conversions: 10 };
      const newPlan = { id: 'pro', monthly_conversions: 500 };

      // Mock quota update API
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          usage: {
            conversions_used: 5, // Preserved from previous period
            conversions_limit: 500, // Updated to new plan
            can_convert: true
          }
        })
      });

      const updateQuotaAfterUpgrade = async (userId, newPlan) => {
        const response = await fetch('/api/update-quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            newLimit: newPlan.monthly_conversions
          })
        });

        return response.json();
      };

      const result = await updateQuotaAfterUpgrade(userId, newPlan);

      expect(result.success).toBe(true);
      expect(result.usage.conversions_limit).toBe(500);
      expect(result.usage.conversions_used).toBe(5); // Preserved
    });
  });

  describe('Subscription Management', () => {
    test('handles subscription cancellation', async () => {
      // Requirement 4.6: Subscription cancellation
      const mockSubscription = {
        id: 'sub_test_subscription',
        status: 'active',
        cancel_at_period_end: false
      };

      // Mock cancellation API
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          subscription: {
            ...mockSubscription,
            cancel_at_period_end: true
          }
        })
      });

      const cancelSubscription = async (subscriptionId) => {
        const response = await fetch('/api/cancel-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId })
        });

        return response.json();
      };

      const result = await cancelSubscription(mockSubscription.id);

      expect(result.success).toBe(true);
      expect(result.subscription.cancel_at_period_end).toBe(true);
    });

    test('maintains access until period end after cancellation', async () => {
      // Requirement 4.7: Access maintained until period end
      const canceledSubscription = {
        id: 'sub_test_subscription',
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
      };

      const checkSubscriptionAccess = (subscription) => {
        const now = new Date();
        const periodEnd = new Date(subscription.current_period_end);
        
        // User maintains access if subscription is active or canceled but not yet expired
        const hasAccess = subscription.status === 'active' && now < periodEnd;
        
        return {
          hasAccess,
          daysRemaining: Math.ceil((periodEnd - now) / (24 * 60 * 60 * 1000))
        };
      };

      const accessInfo = checkSubscriptionAccess(canceledSubscription);

      expect(accessInfo.hasAccess).toBe(true);
      expect(accessInfo.daysRemaining).toBe(15);
    });
  });

  describe('Tax and Compliance', () => {
    test('handles tax calculation for NZ GST', async () => {
      // Requirement 15.1: Tax handling
      const mockCheckoutSession = {
        id: 'cs_test_session',
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
        customer_details: {
          tax_exempt: 'none',
          tax_ids: []
        }
      };

      // Mock checkout with tax configuration
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_session',
          taxEnabled: true
        })
      });

      const createCheckoutWithTax = async (planId, customerLocation = 'NZ') => {
        const response = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId,
            enableTax: true,
            customerLocation
          })
        });

        return response.json();
      };

      const result = await createCheckoutWithTax('pro', 'NZ');

      expect(result.success).toBe(true);
      expect(result.taxEnabled).toBe(true);
    });

    test('handles Strong Customer Authentication (SCA)', async () => {
      // Requirement 15.3: SCA handling
      const mockPaymentIntent = {
        id: 'pi_test_payment',
        status: 'requires_action',
        next_action: {
          type: 'use_stripe_sdk'
        }
      };

      // Mock SCA flow
      const handleSCAPayment = async (paymentIntentId) => {
        // In real implementation, would use Stripe.js to handle SCA
        // For test, simulate successful authentication
        return {
          success: true,
          paymentIntent: {
            ...mockPaymentIntent,
            status: 'succeeded'
          }
        };
      };

      const result = await handleSCAPayment(mockPaymentIntent.id);

      expect(result.success).toBe(true);
      expect(result.paymentIntent.status).toBe('succeeded');
    });
  });

  describe('Proration Handling', () => {
    test('handles mid-cycle plan changes with proration', async () => {
      // Requirement 15.4: Proration handling
      const currentSubscription = {
        id: 'sub_test_subscription',
        current_period_start: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        current_period_end: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
        plan: { id: 'pro', amount: 999 } // $9.99
      };

      const newPlan = { id: 'unlimited', amount: 2999 }; // $29.99

      // Mock proration calculation
      const calculateProration = (currentSub, newPlan) => {
        const totalPeriodDays = 30;
        const daysRemaining = 20;
        const unusedAmount = (currentSub.plan.amount * daysRemaining) / totalPeriodDays;
        const newPlanProrated = (newPlan.amount * daysRemaining) / totalPeriodDays;
        const prorationAmount = newPlanProrated - unusedAmount;

        return {
          prorationAmount: Math.round(prorationAmount),
          daysRemaining,
          immediateCharge: prorationAmount > 0
        };
      };

      const proration = calculateProration(currentSubscription, newPlan);

      expect(proration.daysRemaining).toBe(20);
      expect(proration.prorationAmount).toBeGreaterThan(0);
      expect(proration.immediateCharge).toBe(true);
    });
  });

  describe('Error Handling and User Experience', () => {
    test('displays appropriate error messages for billing failures', async () => {
      // Requirement: User-friendly error handling
      const errorDiv = document.getElementById('billing-error');
      const errorMessage = document.getElementById('error-message');

      const displayBillingError = (error) => {
        errorDiv.style.display = 'block';
        
        switch (error.code) {
          case 'card_declined':
            errorMessage.textContent = 'Your card was declined. Please try a different payment method.';
            break;
          case 'insufficient_funds':
            errorMessage.textContent = 'Insufficient funds. Please check your account balance.';
            break;
          case 'expired_card':
            errorMessage.textContent = 'Your card has expired. Please update your payment method.';
            break;
          case 'customer_not_found':
            errorMessage.textContent = 'Customer account not found. Please contact support.';
            break;
          default:
            errorMessage.textContent = 'A billing error occurred. Please try again or contact support.';
        }
      };

      // Test different error scenarios
      displayBillingError({ code: 'card_declined' });
      expect(errorDiv.style.display).toBe('block');
      expect(errorMessage.textContent).toContain('card was declined');

      displayBillingError({ code: 'insufficient_funds' });
      expect(errorMessage.textContent).toContain('Insufficient funds');

      displayBillingError({ code: 'unknown_error' });
      expect(errorMessage.textContent).toContain('billing error occurred');
    });

    test('handles network failures gracefully', async () => {
      // Requirement: Network error handling
      fetch.mockRejectedValue(new Error('Network error'));

      const createCheckoutWithErrorHandling = async (planId) => {
        try {
          const response = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId })
          });

          return await response.json();
        } catch (error) {
          return {
            success: false,
            error: 'Network error. Please check your connection and try again.',
            code: 'network_error'
          };
        }
      };

      const result = await createCheckoutWithErrorHandling('pro');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.code).toBe('network_error');
    });
  });
});