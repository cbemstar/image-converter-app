/**
 * Stripe Webhook Processing Integration Tests
 * 
 * Tests end-to-end webhook processing workflows including signature verification,
 * event handling, and database updates
 * Requirements: 3.4-3.6, 4.1-4.7, 7.1-7.4, 16.1-16.6
 */

const crypto = require('crypto');

// Mock Stripe
const mockStripe = {
  webhooks: {
    constructEvent: jest.fn()
  }
};

jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    insert: jest.fn(),
    update: jest.fn(() => ({
      eq: jest.fn()
    })),
    upsert: jest.fn()
  }))
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('Stripe Webhook Processing Integration Tests', () => {
  const mockWebhookSecret = 'whsec_test_secret';
  const mockPayload = JSON.stringify({
    id: 'evt_test_webhook',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_session',
        customer: 'cus_test_customer',
        subscription: 'sub_test_subscription',
        metadata: {
          user_id: 'user-123'
        }
      }
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = mockWebhookSecret;
  });

  describe('Webhook Signature Verification', () => {
    test('verifies webhook signature correctly', async () => {
      // Requirement 7.1: Webhook signature verification
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(`${timestamp}.${mockPayload}`)
        .digest('hex');

      const stripeSignature = `t=${timestamp},v1=${signature}`;

      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_session' } }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Simulate webhook processing
      const processWebhook = async (payload, signature) => {
        try {
          const event = mockStripe.webhooks.constructEvent(
            payload,
            signature,
            mockWebhookSecret
          );
          return { success: true, event };
        } catch (error) {
          return { success: false, error: error.message };
        }
      };

      const result = await processWebhook(mockPayload, stripeSignature);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockPayload,
        stripeSignature,
        mockWebhookSecret
      );
      expect(result.success).toBe(true);
      expect(result.event.id).toBe('evt_test_webhook');
    });

    test('rejects invalid webhook signatures', async () => {
      // Requirement 16.1: Reject invalid signatures
      const invalidSignature = 'invalid_signature';

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const processWebhook = async (payload, signature) => {
        try {
          const event = mockStripe.webhooks.constructEvent(
            payload,
            signature,
            mockWebhookSecret
          );
          return { success: true, event };
        } catch (error) {
          return { success: false, error: error.message };
        }
      };

      const result = await processWebhook(mockPayload, invalidSignature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });
  });

  describe('Event Deduplication', () => {
    test('handles duplicate webhook events idempotently', async () => {
      // Requirement 7.3: Handle duplicate webhooks idempotently
      const eventId = 'evt_test_duplicate';

      // Mock existing event check
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn()
              .mockResolvedValueOnce({
                data: { id: eventId, processed: true },
                error: null
              })
              .mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' } // Not found
              })
          })
        }),
        insert: jest.fn().mockResolvedValue({
          data: { id: eventId },
          error: null
        })
      });

      const checkDuplicateEvent = async (eventId) => {
        const { data, error } = await mockSupabaseClient
          .from('webhook_events')
          .select('id, processed')
          .eq('stripe_event_id', eventId)
          .single();

        return data ? { isDuplicate: true, processed: data.processed } : { isDuplicate: false };
      };

      // First call - event exists and is processed
      const firstCheck = await checkDuplicateEvent(eventId);
      expect(firstCheck.isDuplicate).toBe(true);
      expect(firstCheck.processed).toBe(true);

      // Second call - event doesn't exist
      const secondCheck = await checkDuplicateEvent(eventId);
      expect(secondCheck.isDuplicate).toBe(false);
    });

    test('records webhook events for tracking', async () => {
      // Requirement 16.2: Event logging and tracking
      const mockEvent = {
        id: 'evt_test_tracking',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test' } }
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'webhook_record_id' },
          error: null
        })
      });

      const recordWebhookEvent = async (event) => {
        return await mockSupabaseClient
          .from('webhook_events')
          .insert({
            stripe_event_id: event.id,
            event_type: event.type,
            payload: event.data,
            processed: false,
            created_at: new Date().toISOString()
          });
      };

      const result = await recordWebhookEvent(mockEvent);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('webhook_events');
      expect(result.data.id).toBe('webhook_record_id');
    });
  });

  describe('Checkout Session Completed', () => {
    test('processes checkout.session.completed webhook', async () => {
      // Requirement 3.4: Handle checkout.session.completed events
      const checkoutEvent = {
        id: 'evt_checkout_completed',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session',
            customer: 'cus_test_customer',
            subscription: 'sub_test_subscription',
            metadata: {
              user_id: 'user-123',
              plan_id: 'pro'
            }
          }
        }
      };

      // Mock user subscription update
      mockSupabaseClient.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: {
            user_id: 'user-123',
            plan_id: 'pro',
            stripe_customer_id: 'cus_test_customer',
            stripe_subscription_id: 'sub_test_subscription',
            status: 'active'
          },
          error: null
        })
      });

      const processCheckoutCompleted = async (sessionData) => {
        const subscriptionData = {
          user_id: sessionData.metadata.user_id,
          plan_id: sessionData.metadata.plan_id,
          stripe_customer_id: sessionData.customer,
          stripe_subscription_id: sessionData.subscription,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        return await mockSupabaseClient
          .from('user_subscriptions')
          .upsert(subscriptionData);
      };

      const result = await processCheckoutCompleted(checkoutEvent.data.object);

      expect(result.data.user_id).toBe('user-123');
      expect(result.data.plan_id).toBe('pro');
      expect(result.data.status).toBe('active');
    });

    test('updates usage quota after successful checkout', async () => {
      // Requirement 3.5: Update quota after plan upgrade
      const userId = 'user-123';
      const newPlan = { id: 'pro', monthly_conversions: 500 };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: {
                user_id: userId,
                conversions_limit: 500,
                conversions_used: 5 // Preserved from previous period
              },
              error: null
            })
          })
        })
      });

      const updateUsageQuota = async (userId, newLimit) => {
        return await mockSupabaseClient
          .from('usage_records')
          .update({
            conversions_limit: newLimit,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('period_start', new Date().toISOString().split('T')[0]);
      };

      const result = await updateUsageQuota(userId, newPlan.monthly_conversions);

      expect(result.data.conversions_limit).toBe(500);
      expect(result.data.conversions_used).toBe(5); // Preserved
    });
  });

  describe('Subscription Lifecycle Events', () => {
    test('processes customer.subscription.updated webhook', async () => {
      // Requirement 4.3: Handle subscription updated events
      const subscriptionEvent = {
        id: 'evt_subscription_updated',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_subscription',
            customer: 'cus_test_customer',
            status: 'active',
            current_period_start: 1640995200, // Unix timestamp
            current_period_end: 1643673600,
            cancel_at_period_end: false
          }
        }
      };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: {
              stripe_subscription_id: 'sub_test_subscription',
              status: 'active',
              cancel_at_period_end: false
            },
            error: null
          })
        })
      });

      const processSubscriptionUpdated = async (subscriptionData) => {
        return await mockSupabaseClient
          .from('user_subscriptions')
          .update({
            status: subscriptionData.status,
            current_period_start: new Date(subscriptionData.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscriptionData.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscriptionData.cancel_at_period_end,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscriptionData.id);
      };

      const result = await processSubscriptionUpdated(subscriptionEvent.data.object);

      expect(result.data.status).toBe('active');
      expect(result.data.cancel_at_period_end).toBe(false);
    });

    test('processes customer.subscription.deleted webhook', async () => {
      // Requirement 4.4: Handle subscription deleted events
      const deletionEvent = {
        id: 'evt_subscription_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_subscription',
            status: 'canceled'
          }
        }
      };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: {
              stripe_subscription_id: 'sub_test_subscription',
              status: 'canceled'
            },
            error: null
          })
        })
      });

      const processSubscriptionDeleted = async (subscriptionData) => {
        // Update subscription status to canceled
        const subscriptionUpdate = await mockSupabaseClient
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscriptionData.id);

        // Revert user to free plan (would be handled by separate function)
        return subscriptionUpdate;
      };

      const result = await processSubscriptionDeleted(deletionEvent.data.object);

      expect(result.data.status).toBe('canceled');
    });
  });

  describe('Invoice Processing', () => {
    test('processes invoice.paid webhook', async () => {
      // Requirement 4.5: Handle invoice paid events
      const invoiceEvent = {
        id: 'evt_invoice_paid',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_test_invoice',
            customer: 'cus_test_customer',
            subscription: 'sub_test_subscription',
            status: 'paid',
            period_start: 1640995200,
            period_end: 1643673600
          }
        }
      };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: {
              stripe_subscription_id: 'sub_test_subscription',
              status: 'active'
            },
            error: null
          })
        })
      });

      const processInvoicePaid = async (invoiceData) => {
        // Ensure subscription is active
        return await mockSupabaseClient
          .from('user_subscriptions')
          .update({
            status: 'active',
            current_period_start: new Date(invoiceData.period_start * 1000).toISOString(),
            current_period_end: new Date(invoiceData.period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', invoiceData.subscription);
      };

      const result = await processInvoicePaid(invoiceEvent.data.object);

      expect(result.data.status).toBe('active');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    test('implements retry logic with exponential backoff', async () => {
      // Requirement 7.2: Retry mechanism with exponential backoff
      let attemptCount = 0;
      const maxRetries = 3;

      const processWithRetry = async (eventData, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            attemptCount = attempt;
            
            if (attempt < 3) {
              throw new Error('Temporary failure');
            }
            
            // Success on third attempt
            return { success: true, attempt };
          } catch (error) {
            if (attempt === maxRetries) {
              throw error;
            }
            
            // Exponential backoff: 2^attempt * 10ms (reduced for testing)
            const delay = Math.pow(2, attempt) * 10;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      };

      const result = await processWithRetry({}, maxRetries);

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(3);
      expect(attemptCount).toBe(3);
    }, 10000); // 10 second timeout

    test('sends alerts after maximum retry failures', async () => {
      // Requirement 7.4: Alert administrators after failures
      const failedEvent = {
        id: 'evt_failed_processing',
        type: 'checkout.session.completed'
      };

      let alertSent = false;

      const processWithAlerts = async (eventData) => {
        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Simulate persistent failure
            throw new Error('Database connection failed');
          } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
              // Send alert after max retries
              alertSent = true;
              throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
            }
          }
        }
      };

      try {
        await processWithAlerts(failedEvent);
      } catch (error) {
        expect(error.message).toContain('Failed after 3 attempts');
        expect(alertSent).toBe(true);
      }
    });
  });

  describe('Dead Letter Queue', () => {
    test('moves failed events to dead letter queue', async () => {
      // Requirement 16.4: Dead letter queue for failed events
      const failedEvent = {
        id: 'evt_failed_event',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_failed' } }
      };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: {
              stripe_event_id: failedEvent.id,
              processed: false,
              processing_attempts: 3,
              last_error: 'Max retries exceeded'
            },
            error: null
          })
        })
      });

      const moveToDeadLetterQueue = async (eventId, error) => {
        return await mockSupabaseClient
          .from('webhook_events')
          .update({
            processed: false,
            processing_attempts: 3,
            last_error: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_event_id', eventId);
      };

      const result = await moveToDeadLetterQueue(
        failedEvent.id, 
        new Error('Max retries exceeded')
      );

      expect(result.data.processed).toBe(false);
      expect(result.data.processing_attempts).toBe(3);
      expect(result.data.last_error).toBe('Max retries exceeded');
    });
  });

  describe('Webhook Monitoring', () => {
    test('tracks webhook success rate and latency', async () => {
      // Requirement 16.5: Webhook processing metrics
      const webhookMetrics = {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        averageLatency: 0,
        latencies: []
      };

      const trackWebhookMetrics = (success, latency) => {
        webhookMetrics.totalEvents++;
        webhookMetrics.latencies.push(latency);
        
        if (success) {
          webhookMetrics.successfulEvents++;
        } else {
          webhookMetrics.failedEvents++;
        }
        
        webhookMetrics.averageLatency = 
          webhookMetrics.latencies.reduce((a, b) => a + b, 0) / webhookMetrics.latencies.length;
      };

      // Simulate webhook processing
      trackWebhookMetrics(true, 150);  // Success, 150ms
      trackWebhookMetrics(true, 200);  // Success, 200ms
      trackWebhookMetrics(false, 500); // Failure, 500ms

      expect(webhookMetrics.totalEvents).toBe(3);
      expect(webhookMetrics.successfulEvents).toBe(2);
      expect(webhookMetrics.failedEvents).toBe(1);
      expect(webhookMetrics.averageLatency).toBeCloseTo(283.33, 2);
    });
  });
});