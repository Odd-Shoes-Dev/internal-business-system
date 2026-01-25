import type Stripe from 'stripe';

// Lazily initialize Stripe to avoid requiring STRIPE_SECRET_KEY at module import time
let stripeClient: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (stripeClient) return stripeClient;
  const StripeModule = (await import('stripe')).default as any;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not configured on the server');
  stripeClient = new StripeModule(apiKey, { apiVersion: '2025-02-24.acacia', typescript: true });
  return stripeClient as Stripe;
}

// Types for Stripe integration
export interface CreatePaymentIntentParams {
  amount: number; // in cents
  currency?: string;
  customerId?: string;
  invoiceId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreateCustomerParams {
  email: string;
  name: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  metadata?: Record<string, string>;
}

// Helper functions for common Stripe operations

/**
 * Create a payment intent for invoice payment
 */
export async function createPaymentIntent({
  amount,
  currency = 'usd',
  customerId,
  invoiceId,
  description,
  metadata = {},
}: CreatePaymentIntentParams) {
  try {
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // amount in cents
      currency,
      customer: customerId,
      description: description || `Payment for Invoice ${invoiceId}`,
      metadata: {
        invoice_id: invoiceId || '',
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

/**
 * Create or update a Stripe customer
 */
export async function createStripeCustomer({
  email,
  name,
  phone,
  address,
  metadata = {},
}: CreateCustomerParams) {
  try {
    // Check if customer already exists
    const stripe = await getStripe();
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      // Update existing customer
      const customer = await stripe.customers.update(existingCustomers.data[0].id, {
        name,
        phone,
        address: address
          ? {
              line1: address.line1,
              line2: address.line2 || undefined,
              city: address.city,
              state: address.state,
              postal_code: address.postal_code,
              country: address.country,
            }
          : undefined,
        metadata,
      });
      return customer;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      phone,
      address: address
        ? {
            line1: address.line1,
            line2: address.line2 || undefined,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country,
          }
        : undefined,
      metadata,
    });

    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
}

/**
 * Retrieve a payment intent
 */
export async function getPaymentIntent(paymentIntentId: string) {
  try {
    const stripe = await getStripe();
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    throw error;
  }
}

/**
 * List payments for a customer
 */
export async function listCustomerPayments(customerId: string, limit = 10) {
  try {
    const stripe = await getStripe();
    return await stripe.paymentIntents.list({
      customer: customerId,
      limit,
    });
  } catch (error) {
    console.error('Error listing customer payments:', error);
    throw error;
  }
}

/**
 * Create a refund
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
) {
  try {
    const stripe = await getStripe();
    return await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount, // If not provided, refunds the entire amount
      reason,
    });
  } catch (error) {
    console.error('Error creating refund:', error);
    throw error;
  }
}

/**
 * Create a checkout session for invoice payment
 */
export async function createCheckoutSession({
  invoiceId,
  invoiceNumber,
  amount,
  customerEmail,
  successUrl,
  cancelUrl,
}: {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  try {
    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice ${invoiceNumber}`,
              description: `Payment for Invoice ${invoiceNumber}`,
            },
            unit_amount: amount, // in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
) {
  try {
    const stripe = await getStripe();
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    throw error;
  }
}
