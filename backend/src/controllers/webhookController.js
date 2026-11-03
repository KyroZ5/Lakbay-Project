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
  // Fail closed: the unsigned dev fallback runs ONLY when NODE_ENV is explicitly 'development'
  // (an unset/mistyped NODE_ENV in a deployment must not accept forged events).
  // On Vercel (VERCEL=1) unsigned delivery is NEVER accepted, whatever NODE_ENV says.
  const isProduction = process.env.NODE_ENV !== 'development' || process.env.VERCEL === '1';
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
      // 1. Checkout finished. For card payments payment_status is 'paid'; for delayed
      //    (async) methods it is 'unpaid' and the outcome arrives later via
      //    checkout.session.async_payment_succeeded / _failed.
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
          await confirmPaidSession(session, now);
        } else {
          console.log(`[Stripe Webhook] Session ${session.id} completed with payment_status=${session.payment_status}; awaiting async result.`);
        }
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        await confirmPaidSession(event.data.object, now);
        break;
      }

      // 2. Session expired or async payment failed: release reserved seats
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        await releaseUnpaidSession(
          event.data.object,
          now,
          event.type === 'checkout.session.expired'
            ? 'Checkout session expired without payment'
            : 'Payment failed'
        );
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

const getBookingIdFromSession = (session) => session?.client_reference_id || session?.metadata?.bookingId;

const getPaymentIntentId = (session) =>
  typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '';

/**
 * Mark a booking Confirmed/Paid for a paid Checkout session — atomically.
 * The booking re-check and the payment record write happen in ONE transaction
 * (payment doc id derived from the session id), so a concurrent cancellation can't
 * be overwritten back to Confirmed and duplicate deliveries can't double-record.
 */
const confirmPaidSession = async (session, now) => {
  const bookingId = getBookingIdFromSession(session);
  if (!bookingId) {
    console.warn('[Stripe Webhook] paid session missing bookingId');
    return;
  }

  const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(bookingId);
  const paymentIntentId = getPaymentIntentId(session);
  const amountPaid = (session.amount_total || 0) / 100;

  // Legacy dedupe: payment records created before deterministic ids were used
  const existingPayment = await db
    .collection(PAYMENTS_COLLECTION)
    .where('stripeSessionId', '==', session.id)
    .limit(1)
    .get();
  if (!existingPayment.empty) {
    console.log(`[Stripe Webhook] Payment for session ${session.id} already recorded, skipping.`);
    return;
  }

  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(`stripe_${session.id}`);

  const outcome = await db.runTransaction(async (t) => {
    const bDoc = await t.get(bookingRef);
    const pDoc = await t.get(paymentRef);
    if (!bDoc.exists) return { result: 'missing' };
    const booking = bDoc.data();

    if (pDoc.exists || (booking.paymentStatus === 'Paid' && booking.bookingStatus === 'Confirmed')) {
      return { result: 'duplicate', booking };
    }

    // Never resurrect a cancelled/rejected booking (seats were already released).
    if (['Cancelled', 'Rejected'].includes(booking.bookingStatus)) {
      return { result: 'cancelled', booking };
    }

    t.update(bookingRef, {
      bookingStatus: 'Confirmed',
      paymentStatus: 'Paid',
      stripePaymentIntentId: paymentIntentId,
      stripeSessionId: session.id,
      paidAt: now,
      updatedAt: now,
    });

    t.set(paymentRef, {
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

    return { result: 'confirmed', booking };
  });

  if (outcome.result === 'missing') {
    console.error(`[Stripe Webhook] Booking ${bookingId} not found`);
    return;
  }
  if (outcome.result === 'duplicate') {
    console.log(`[Stripe Webhook] Duplicate event for booking ${bookingId} — already Confirmed/Paid, skipping.`);
    return;
  }

  if (outcome.result === 'cancelled') {
    // Money was captured for a booking that no longer holds seats: refund it rather than keep it.
    if (paymentIntentId && isStripeInitialized && stripe) {
      try {
        const refund = await stripe.refunds.create(
          { payment_intent: paymentIntentId, reason: 'requested_by_customer' },
          { idempotencyKey: `late-payment-refund-${session.id}` }
        );
        await bookingRef.update({
          latePaymentRefundId: refund.id,
          latePaymentRefundStatus: refund.status,
          updatedAt: now,
        });
        console.warn(`[Stripe Webhook] Refunded late payment ${paymentIntentId} for ${outcome.booking.bookingStatus} booking ${bookingId}.`);
      } catch (refundErr) {
        // Refund honesty: record the failure for support instead of pretending it succeeded
        await bookingRef.update({ latePaymentRefundStatus: 'failed', updatedAt: now });
        console.error(`[Stripe Webhook] Late-payment refund FAILED for booking ${bookingId}:`, refundErr.message);
      }
    } else {
      await bookingRef.update({ latePaymentRefundStatus: 'failed', updatedAt: now });
      console.error(`[Stripe Webhook] Late payment on ${outcome.booking.bookingStatus} booking ${bookingId} could not be refunded automatically.`);
    }
    await logActivity({
      actorUid: 'system',
      actorRole: 'system',
      action: 'LATE_PAYMENT_ON_CANCELLED_BOOKING',
      targetType: 'booking',
      targetId: bookingId,
      metadata: { stripeSessionId: session.id, paymentIntentId },
    });
    return;
  }

  const booking = outcome.booking;

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
};

/** Release the seats of a still-Pending/Unpaid booking whose session expired or whose payment failed. */
const releaseUnpaidSession = async (session, now, reason) => {
  const bookingId = getBookingIdFromSession(session);
  if (!bookingId) return;

  const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(bookingId);

  const released = await db.runTransaction(async (t) => {
    const bDoc = await t.get(bookingRef);
    // Check inside the transaction to avoid double release on retry / race with payment
    if (!bDoc.exists) return false;
    const booking = bDoc.data();
    if (booking.bookingStatus !== 'Pending' || booking.paymentStatus !== 'Unpaid') return false;

    const depRef = db.collection(DEPARTURES_COLLECTION).doc(booking.departureId);
    const dDoc = await t.get(depRef);
    if (dDoc.exists) {
      const booked = dDoc.data().bookedCount || 0;
      t.update(depRef, {
        bookedCount: Math.max(0, booked - (booking.numberOfTravelers || 0)),
        updatedAt: now,
      });
    }

    t.update(bookingRef, {
      bookingStatus: 'Cancelled',
      cancellationReason: reason,
      updatedAt: now,
    });
    return true;
  });

  if (released) {
    console.log(`[Stripe Webhook] Released seats for session ${session.id} (${reason})`);
  }
};
