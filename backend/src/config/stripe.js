import Stripe from 'stripe';

let stripe = null;
let isStripeInitialized = false;
const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'php').toLowerCase();

// Case-insensitive placeholder detection (e.g. "Placeholder", "PLACEHOLDER")
const isPlaceholderKey = (key) => !key || key.toLowerCase().includes('placeholder');

if (process.env.STRIPE_SECRET_KEY && !isPlaceholderKey(process.env.STRIPE_SECRET_KEY)) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      appInfo: {
        name: 'Lakbay Tour & Travel Platform',
        version: '1.0.0',
      },
    });
    isStripeInitialized = true;
    console.log('[Stripe] Initialized successfully with currency:', DEFAULT_CURRENCY.toUpperCase());
  } catch (error) {
    console.error('[Stripe] Initialization error:', error.message);
  }
} else {
  console.warn('[Stripe] Notice: STRIPE_SECRET_KEY is not set or contains placeholder value.');
}

export { stripe, isStripeInitialized, DEFAULT_CURRENCY };
