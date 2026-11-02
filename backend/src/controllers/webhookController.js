import { db } from '../config/firebaseAdmin.js';
import { stripe, isStripeInitialized } from '../config/stripe.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';

const BOOKINGS_COLLECTION = 'bookings';
const DEPARTURES_COLLECTION = 'departures';
const PAYMENTS_COLLECTION = 'payments';
const NOTIFICATIONS_COLLECTION = 'notifications';

const isPlaceholderSecret = (secret) => !secret || secret.toLowerCase().includes('placeholder');

/**
 * Handle incoming Stripe Webhook events
 *
 * Security contract:
 * - Signature verification is REQUIRED whenever a real secret is configured.
 * - In production, unsigned delivery is rejected outright.
 * - In development only, unsigned delivery is allowed with a loud warning.
 * - Events are idempotent: already-confirmed bookings are never re-processed,
 *   and Cancelled bookings are never resurrected.
 */
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  const canVerify = isStripeInitialized && Boolean(sig) && !isPlaceholderSecret(webhookSecret);

  let event;

  if (canVerify) {
    try {
      if (!req.rawBody) {
        return sendError(res, 'Missing raw request body buffer for Stripe verification', 400);
      }
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return sendError(res, `Webhook Signature Error: ${err.message}`, 400);
    }
  } else if (isProduction) {
    // Fail closed: never trust unverified payment events in production.
    console.error('[Stripe Webhook] REJECTED in production: signature verification unavailable (missing secret or signature).');
    return sendError(res, 'Webhook signature verification is not configured', 401);
  } else {
    // Development-only fallback without signature verification.
    console.warn('[Stripe Webhook] WARNING: accepting UNVERIFIED event (development mode, no webhook secret configured).');
    event = req.body;
    if (!event || typeof event !== 'object' || !event.type) {
      return sendError(res, 'Missing or invalid webhook event body', 400);
    }
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);
  const now = new Date().toISOString();

  try {
    switch (event.type) {
      // 1. Payment successfully completed
      case 'checkout.session.completed': {
        const session = event.data.object;
        const bookingId = session.client_reference_id || session.metadata?.bookingId;

        if (!bookingId) {
          console.warn('[Stripe Webhook] checkout.session.completed missing bookingId');
          break;
        }

        const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(bookingId);
        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists) {
          console.error(`[Stripe Webhook] Booking ${bookingId} not found`);
          break;
        }

        const booking = bookingDoc.data();

        // Idempotency: never re-confirm or overwrite an already-processed booking.
        if (booking.paymentStatus === 'Paid' && booking.bookingStatus === 'Confirmed') {
          console.log(`[Stripe Webhook] Duplicate event for booking ${bookingId} — already Confirmed/Paid, skipping.`);
          break;
        }

        // Never resurrect a cancelled booking (seats were already released).
        if (booking.bookingStatus === 'Cancelled') {
          console.warn(`[Stripe Webhook] Ignoring payment event for Cancelled booking ${bookingId}.`);
          break;
        }

        // Dedupe: if this Stripe session already produced a payment record, skip.
        const existingPayment = await db
          .collection(PAYMENTS_COLLECTION)
          .where('stripeSessionId', '==', session.id)
          .limit(1)
          .get();
        if (!existingPayment.empty) {
          console.log(`[Stripe Webhook] Payment for session ${session.id} already recorded, skipping.`);
          break;
        }

        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || '';

        const amountPaid = (session.amount_total || 0) / 100;

        // Atomically mark booking Confirmed and Paid
        await bookingRef.update({
          bookingStatus: 'Confirmed',
          paymentStatus: 'Paid',
          stripePaymentIntentId: paymentIntentId,
          stripeSessionId: session.id,
          paidAt: now,
          updatedAt: now,
        });

        // Create record in payments collection
        await db.collection(PAYMENTS_COLLECTION).add({
          bookingId,
          bookingReference: booking.bookingReference,
          customerId: booking.customerId,
          amount: amountPaid || booking.totalPrice,
          currency: (session.currency || 'php').toUpperCase(),
          paymentMethod: 'stripe',
          referenceNumber: paymentIntentId,
          stripeSessionId: session.id,
          stripeRefundId: null,
          paymentStatus: 'Paid',
          createdAt: now,
          refundedAt: null,
        });

        // Create customer notification
        await db.collection(NOTIFICATIONS_COLLECTION).add({
          userId: booking.customerId,
          title: 'Payment Confirmed! Your Tour is Booked',
          message: `We received your payment of PHP ${Number(booking.totalPrice || 0).toLocaleString()} for booking ${
            booking.bookingReference
          }. Your departure is confirmed for ${booking.departureDate}.`,
          type: 'booking_confirmed',
          isRead: false,
          relatedBookingId: bookingId,
          createdAt: now,
        });

        await logActivity({
          actorUid: booking.customerId,
          actorRole: 'customer',
          action: 'STRIPE_PAYMENT_CONFIRMED',
          targetType: 'booking',
          targetId: bookingId,
          metadata: { amount: amountPaid, paymentIntentId },
        });

        console.log(`[Stripe Webhook] Booking ${bookingId} confirmed & payment recorded.`);
        break;
      }

      // 2. Checkout session expired without payment: release reserved seats
      case 'checkout.session.expired': {
        const session = event.data.object;
        const bookingId = session.client_reference_id || session.metadata?.bookingId;

        if (!bookingId) break;

        const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(bookingId);
        const bookingDoc = await bookingRef.get();

        if (bookingDoc.exists) {
          const booking = bookingDoc.data();

          // Only release if still pending/unpaid
          if (booking.bookingStatus === 'Pending' && booking.paymentStatus === 'Unpaid') {
            const depRef = db.collection(DEPARTURES_COLLECTION).doc(booking.departureId);

            await db.runTransaction(async (t) => {
              const bDoc = await t.get(bookingRef);
              // Re-check inside transaction to avoid double release on retry
              if (!bDoc.exists || bDoc.data().bookingStatus !== 'Pending') return;

              const dDoc = await t.get(depRef);
              if (dDoc.exists) {
                const booked = dDoc.data().bookedCount || 0;
                t.update(depRef, {
                  bookedCount: Math.max(0, booked - booking.numberOfTravelers),
                  updatedAt: now,
                });
              }

              t.update(bookingRef, {
                bookingStatus: 'Cancelled',
                cancellationReason: 'Checkout session expired without payment',
                updatedAt: now,
              });
            });

            console.log(`[Stripe Webhook] Released seats for expired checkout session ${session.id}`);
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error);
    // Return 500 so Stripe retries; avoid leaking internal error details.
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
