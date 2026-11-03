import { db } from '../config/firebaseAdmin.js';
import { stripe, isStripeInitialized } from '../config/stripe.js';

/**
 * Refund the Stripe payment of a booking that has ALREADY been claimed as Cancelled.
 *
 * Refund honesty: booking.paymentStatus becomes 'Refunded' ONLY if Stripe accepts the
 * refund; otherwise it stays 'Paid' with refundStatus 'failed' and a failure reason so
 * support can complete it manually.
 *
 * @returns {Promise<{ refundResult: object|null, refundFailed: boolean, refundSkippedReason: string|null }>}
 */
export const refundCancelledBooking = async (bookingId, booking, { metadata = {}, idempotencyKey } = {}) => {
  const now = new Date().toISOString();
  let refundResult = null;
  let refundFailed = false;
  let refundSkippedReason = null;

  if (!isStripeInitialized || !stripe) {
    refundFailed = true;
    refundSkippedReason = 'payment_gateway_unavailable';
  } else {
    const paySnap = await db
      .collection('payments')
      .where('bookingId', '==', bookingId)
      .where('paymentStatus', '==', 'Paid')
      .limit(1)
      .get();

    if (paySnap.empty) {
      refundFailed = true;
      refundSkippedReason = 'payment_record_missing';
    } else {
      const paymentDoc = paySnap.docs[0];
      const paymentData = paymentDoc.data();
      if (!paymentData.referenceNumber) {
        refundFailed = true;
        refundSkippedReason = 'missing_payment_reference';
      } else {
        try {
          refundResult = await stripe.refunds.create(
            {
              payment_intent: paymentData.referenceNumber,
              reason: 'requested_by_customer',
              metadata: { bookingId, bookingReference: booking.bookingReference || '', ...metadata },
            },
            idempotencyKey ? { idempotencyKey } : undefined
          );
          await paymentDoc.ref.update({
            paymentStatus: 'Refunded',
            stripeRefundId: refundResult.id,
            refundedAt: now,
          });
        } catch (refundErr) {
          console.error(`[Refund] Stripe refund failed for booking ${bookingId}:`, refundErr.message);
          refundResult = null;
          refundFailed = true;
          refundSkippedReason = 'stripe_refund_error';
        }
      }
    }
  }

  await db.collection('bookings').doc(bookingId).update({
    paymentStatus: refundResult ? 'Refunded' : 'Paid',
    refundProcessed: Boolean(refundResult),
    refundStatus: refundResult ? 'completed' : 'failed',
    refundFailureReason: refundFailed ? refundSkippedReason : null,
    updatedAt: new Date().toISOString(),
  });

  return { refundResult, refundFailed, refundSkippedReason };
};
