import { db } from '../config/firebaseAdmin.js';
import { stripe, isStripeInitialized, DEFAULT_CURRENCY } from '../config/stripe.js';
import { sendSuccess, sendError, httpError } from '../utils/apiResponse.js';
import { generateBookingReference } from '../utils/bookingReference.js';
import { todayInManila, daysBetweenDateStrs } from '../utils/dates.js';
import { parseLimit } from '../utils/query.js';
import { logActivity } from '../services/auditService.js';
import { computeBookingDeadline } from './departureController.js';
import { getClientBaseUrl } from '../config/urls.js';

const BOOKINGS_COLLECTION = 'bookings';
const DEPARTURES_COLLECTION = 'departures';
const PACKAGES_COLLECTION = 'tourPackages';
const PAYMENTS_COLLECTION = 'payments';
const NOTIFICATIONS_COLLECTION = 'notifications';

/** Rule D helper: does this operator own the package? (missing operatorId = platform-owned) */
const operatorOwnsPackage = async (operatorUid, packageId) => {
  if (!packageId) return false;
  const pDoc = await db.collection(PACKAGES_COLLECTION).doc(packageId).get();
  return pDoc.exists && pDoc.data().operatorId === operatorUid;
};

/**
 * 1. Checkout Creation (POST /api/bookings/checkout)
 * Runs a Firestore transaction to check capacity, reserve seats, create Pending/Unpaid booking,
 * and initiates a Stripe Checkout session in Philippine Pesos (PHP).
 */
export const createCheckoutSession = async (req, res, next) => {
  try {
    // Fail loudly (before reserving seats) rather than redirecting paying
    // customers to localhost when CLIENT_URL is missing in production.
    if (!getClientBaseUrl()) {
      console.error('[Checkout] CLIENT_URL is not configured; refusing to create a checkout session.');
      return sendError(res, 'Checkout is temporarily unavailable (server misconfiguration).', 500);
    }

    const {
      packageId,
      departureId,
      numberOfTravelers,
      travelerManifest = [],
      customerName,
      customerEmail,
      customerPhone,
      specialRequests = '',
    } = req.body;

    const customerId = req.user.uid;

    if (!packageId || !departureId || !numberOfTravelers) {
      return sendError(res, 'packageId, departureId, and numberOfTravelers are required', 400);
    }

    const travelerCount = Number(numberOfTravelers);
    if (!Number.isInteger(travelerCount) || travelerCount < 1) {
      return sendError(res, 'numberOfTravelers must be a whole number of at least 1', 400);
    }
    if (travelerCount > 50) {
      return sendError(res, 'numberOfTravelers cannot exceed 50 per booking', 400);
    }

    // References
    const pkgRef = db.collection(PACKAGES_COLLECTION).doc(packageId);
    const depRef = db.collection(DEPARTURES_COLLECTION).doc(departureId);

    // Fetch package to verify publication and get authoritative pricePerPerson
    const pkgDoc = await pkgRef.get();
    if (!pkgDoc.exists) {
      return sendError(res, 'Tour package not found', 404);
    }
    const pkgData = pkgDoc.data();
    if (!pkgData.isPublished) {
      return sendError(res, 'This tour package is not currently available for booking', 400);
    }

    const originalPricePerPerson = Number(pkgData.pricePerPerson);
    const discountPercent = Number(pkgData.discountPercent) || 0;
    const effectivePricePerPerson = (discountPercent > 0 && discountPercent < 100)
      ? (Number(pkgData.discountPrice) || Math.round(originalPricePerPerson * (1 - discountPercent / 100)))
      : (Number(pkgData.effectivePrice) || originalPricePerPerson);
    if (!Number.isFinite(effectivePricePerPerson) || effectivePricePerPerson <= 0) {
      // Misconfigured package price would otherwise produce a NaN/0 total and a broken Stripe session
      return sendError(res, 'This tour package has no valid price configured and cannot be booked', 400);
    }
    const discountAppliedPerPerson = Math.max(0, originalPricePerPerson - effectivePricePerPerson);
    const pricePerPerson = effectivePricePerPerson;
    const totalPrice = Math.round(pricePerPerson * travelerCount * 100) / 100;

    // No mass assignment: keep only known traveler fields as strings, never more
    // entries than travelers (prevents injecting e.g. isCheckedIn or nested objects).
    const MANIFEST_FIELDS = ['fullName', 'birthDate', 'relationship', 'dietaryOrMedicalNotes', 'contactPhone'];
    const sanitizedManifest = (Array.isArray(travelerManifest) ? travelerManifest : [])
      .filter((t) => t && typeof t === 'object')
      .slice(0, travelerCount)
      .map((t) => {
        const clean = {};
        for (const f of MANIFEST_FIELDS) {
          if (t[f] !== undefined && t[f] !== null) clean[f] = String(t[f]).slice(0, 500);
        }
        return clean;
      });
    const bookingReference = generateBookingReference();
    const now = new Date().toISOString();

    let newBookingId = null;

    // Run Firestore transaction to atomically reserve seats and create booking
    await db.runTransaction(async (transaction) => {
      const depDoc = await transaction.get(depRef);
      if (!depDoc.exists) {
        throw httpError('Selected departure schedule not found', 404);
      }

      const depData = depDoc.data();

      // SECURITY: the departure must belong to the requested package — otherwise a
      // cheap packageId could be paired with an expensive departureId (price fraud).
      if (depData.packageId !== packageId) {
        throw httpError('Selected departure does not belong to the selected tour package', 400);
      }

      if (depData.status !== 'open') {
        throw httpError(`Departure schedule is not open for bookings (status: ${depData.status})`, 409);
      }

      const today = todayInManila();
      if (depData.departureDate < today) {
        throw httpError('Cannot book a departure date in the past', 400);
      }

      // Rule D: Booking Deadline - Prevent reservations after deadline
      const deadline =
        depData.bookingDeadline ||
        computeBookingDeadline(
          depData.departureDate,
          depData.departureTime || '07:00 AM',
          depData.bookingDeadlineHours !== undefined ? Number(depData.bookingDeadlineHours) : 24
        );

      if (now > deadline) {
        const formattedCutoff = new Date(deadline).toLocaleString('en-PH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        throw httpError(
          `Booking deadline passed: Reservations for this departure closed on ${formattedCutoff}. New bookings are no longer accepted (Rule D).`,
          409
        );
      }

      const currentBooked = depData.bookedCount || 0;
      const capacity = depData.capacity || 0;
      const remainingSlots = capacity - currentBooked;

      if (currentBooked + travelerCount > capacity) {
        throw httpError(
          `Insufficient seats remaining. Requested: ${travelerCount}, Available: ${Math.max(0, remainingSlots)}`,
          409
        );
      }

      // Reserve seats on departure
      transaction.update(depRef, {
        bookedCount: currentBooked + travelerCount,
        updatedAt: now,
      });

      // Create new booking record
      const newBookingRef = db.collection(BOOKINGS_COLLECTION).doc();
      newBookingId = newBookingRef.id;

      const bookingRecord = {
        bookingReference,
        customerId,
        packageId,
        departureId,
        packageName: pkgData.name,
        departureDate: depData.departureDate,
        returnDate: depData.returnDate,
        departureTime: depData.departureTime || '07:00 AM',
        meetingPoint: depData.meetingPoint || 'Designated Harbor / Meeting Terminal',
        customerName: customerName || req.user.fullName || '',
        customerEmail: customerEmail || req.user.email || '',
        customerPhone: customerPhone || '',
        numberOfTravelers: travelerCount,
        travelerManifest: sanitizedManifest,
        originalPricePerPerson,
        discountPercent,
        discountAppliedPerPerson,
        pricePerPerson: effectivePricePerPerson,
        totalPrice,
        bookingStatus: 'Pending',
        paymentStatus: 'Unpaid',
        specialRequests: String(specialRequests ?? '').slice(0, 2000),
        cancellationCutoffDays: pkgData.cancellationCutoffDays ?? 7,
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(newBookingRef, bookingRecord);
    });

    // Create Stripe Checkout Session
    // Normalized CLIENT_URL (null in production when unset; see config/urls.js)
    const clientBaseUrl = getClientBaseUrl();
    let checkoutUrl = '';
    let stripeSessionId = '';

    if (isStripeInitialized && stripe) {
      // Amount in smallest currency unit (centavos for PHP)
      const unitAmountInCentavos = Math.round(effectivePricePerPerson * 100);

      let session;
      try {
        session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          currency: DEFAULT_CURRENCY,
          line_items: [
            {
              price_data: {
                currency: DEFAULT_CURRENCY,
                product_data: {
                  name: `${pkgData.name} - Tour Departure`,
                  description: `Departure (${travelerCount} traveler(s)) | Ref: ${bookingReference}${discountPercent > 0 ? ` | ${discountPercent}% Discount Applied` : ''}`,
                  images: (pkgData.imageUrls || []).slice(0, 1),
                },
                unit_amount: unitAmountInCentavos,
              },
              quantity: travelerCount,
            },
          ],
          customer_email: customerEmail || req.user.email,
          client_reference_id: newBookingId,
          metadata: {
            bookingId: newBookingId,
            bookingReference,
            customerId,
            packageId,
            departureId,
          },
          success_url: `${clientBaseUrl}/dashboard/bookings?session_id={CHECKOUT_SESSION_ID}&ref=${bookingReference}&status=success`,
          cancel_url: `${clientBaseUrl}/packages/${packageId}?booking_ref=${bookingReference}&status=cancelled`,
        });
      } catch (stripeError) {
        // Roll back the seat reservation and cancel the booking so capacity
        // is not leaked when session creation fails after the transaction.
        const rollbackRef = db.collection(BOOKINGS_COLLECTION).doc(newBookingId);
        const rollbackDepRef = db.collection(DEPARTURES_COLLECTION).doc(departureId);
        await db.runTransaction(async (t) => {
          const bDoc = await t.get(rollbackRef);
          if (bDoc.exists && bDoc.data().bookingStatus === 'Pending') {
            const depSnap = await t.get(rollbackDepRef);
            if (depSnap.exists) {
              const booked = depSnap.data().bookedCount || 0;
              t.update(rollbackDepRef, {
                bookedCount: Math.max(0, booked - travelerCount),
                updatedAt: new Date().toISOString(),
              });
            }
            t.update(rollbackRef, {
              bookingStatus: 'Cancelled',
              cancellationReason: 'Checkout session creation failed',
              updatedAt: new Date().toISOString(),
            });
          }
        });
        console.error('[Checkout] Stripe session creation failed, seats released:', stripeError.message);
        return sendError(res, 'Unable to start the payment session. Your seats were released — please try again.', 502);
      }

      checkoutUrl = session.url;
      stripeSessionId = session.id;

      // Update booking with stripeSessionId
      await db.collection(BOOKINGS_COLLECTION).doc(newBookingId).update({
        stripeSessionId,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Development mock fallback URL if Stripe secret key is not yet configured
      checkoutUrl = `${clientBaseUrl}/dashboard/bookings?mock_payment=pending&ref=${bookingReference}`;
    }

    await logActivity({
      actorUid: customerId,
      actorRole: 'customer',
      action: 'CREATE_BOOKING_CHECKOUT',
      targetType: 'booking',
      targetId: newBookingId,
      metadata: { bookingReference, totalPrice, travelerCount, discountPercent, pricePerPerson: effectivePricePerPerson },
    });

    return sendSuccess(
      res,
      {
        bookingId: newBookingId,
        bookingReference,
        totalPrice,
        pricePerPerson: effectivePricePerPerson,
        originalPricePerPerson,
        discountPercent,
        discountAppliedPerPerson,
        numberOfTravelers: travelerCount,
        checkoutUrl,
        stripeSessionId,
      },
      'Booking reserved and checkout session created',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Early-Cancellation Auto-Refund (POST /api/bookings/:id/cancel)
 * If cancelled >= cancellationCutoffDays before departureDate, triggers automated Stripe refund
 * and releases reserved seats. If past cutoff, flags for Support Agent exception review.
 */
export const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by customer' } = req.body;
    const userId = req.user.uid;
    const isStaff = ['support', 'admin'].includes(req.user.role);

    const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();

    // Verify ownership if not staff
    if (!isStaff && booking.customerId !== userId) {
      return sendError(res, 'Unauthorized: You can only cancel your own bookings', 403);
    }

    if (['Cancelled', 'Completed', 'Rejected'].includes(booking.bookingStatus)) {
      return sendError(res, `Cannot cancel a booking that is already ${booking.bookingStatus}`, 400);
    }

    // Days remaining until departure, in Manila calendar days (independent of server TZ)
    const daysRemaining = daysBetweenDateStrs(todayInManila(), booking.departureDate);
    const cutoffDays = booking.cancellationCutoffDays ?? 7;

    const isEligibleForAutoRefund = daysRemaining >= cutoffDays;
    // Nothing to refund on an unpaid booking — always release its seats immediately
    const cancelImmediately = isEligibleForAutoRefund || booking.paymentStatus !== 'Paid';
    const now = new Date().toISOString();

    if (!cancelImmediately && booking.cancellationRequested) {
      return sendError(res, 'A cancellation request for this booking is already under review by our support team.', 409);
    }

    if (cancelImmediately) {
      // STEP 1 (atomic): claim the cancellation inside a transaction so a
      // concurrent/double cancel aborts here — prevents double seat release
      // and double Stripe refunds.
      const depRef = db.collection(DEPARTURES_COLLECTION).doc(booking.departureId);
      const claimed = await db.runTransaction(async (t) => {
        const bDoc = await t.get(bookingRef);
        if (!bDoc.exists) return { ok: false, reason: 'not_found' };
        const current = bDoc.data();
        if (['Cancelled', 'Completed', 'Rejected'].includes(current.bookingStatus)) {
          return { ok: false, reason: `already_${current.bookingStatus}` };
        }
        // Payment landed (webhook) between the pre-read and this transaction: the refund
        // decision below was made on stale state — abort instead of keeping the money un-refunded.
        if (current.paymentStatus !== booking.paymentStatus) {
          return { ok: false, reason: 'state_changed' };
        }

        const dDoc = await t.get(depRef);
        if (dDoc.exists) {
          const currentBooked = dDoc.data().bookedCount || 0;
          t.update(depRef, {
            bookedCount: Math.max(0, currentBooked - booking.numberOfTravelers),
            updatedAt: now,
          });
        }

        t.update(bookingRef, {
          bookingStatus: 'Cancelled',
          cancellationReason: reason,
          cancelledAt: now,
          refundStatus: booking.paymentStatus === 'Paid' ? 'pending' : 'not_applicable',
          refundProcessed: false,
          updatedAt: now,
        });
        return { ok: true };
      });

      if (!claimed.ok) {
        if (claimed.reason === 'not_found') {
          return sendError(res, 'Booking not found', 404);
        }
        if (claimed.reason === 'state_changed') {
          return sendError(res, 'This booking was just updated (e.g. payment received). Please refresh and try again.', 409);
        }
        return sendError(res, `Cannot cancel a booking that is already ${claimed.reason.replace('already_', '')}`, 400);
      }

      // Unpaid booking with an open Checkout session: expire it so the customer can't pay for a
      // cancelled booking. (The webhook also refunds any payment that slips through.)
      if (booking.paymentStatus !== 'Paid' && booking.stripeSessionId && isStripeInitialized && stripe) {
        try {
          await stripe.checkout.sessions.expire(booking.stripeSessionId);
        } catch (expireErr) {
          // Already expired/completed sessions throw — safe to ignore
          console.warn(`[Cancel] Could not expire Stripe session ${booking.stripeSessionId}:`, expireErr.message);
        }
      }

      // STEP 2: attempt the Stripe refund (only if actually paid).
      // paymentStatus is ONLY flipped to 'Refunded' when the refund succeeds.
      let refundResult = null;
      let refundFailed = false;
      let refundSkippedReason = null;

      if (booking.paymentStatus === 'Paid') {
        const paymentSnap = await db
          .collection(PAYMENTS_COLLECTION)
          .where('bookingId', '==', id)
          .where('paymentStatus', '==', 'Paid')
          .limit(1)
          .get();

        if (paymentSnap.empty || !isStripeInitialized || !stripe) {
          refundSkippedReason = !isStripeInitialized || !stripe
            ? 'payment_gateway_unavailable'
            : 'payment_record_missing';
          refundFailed = true;
        } else {
          const paymentDoc = paymentSnap.docs[0];
          const paymentData = paymentDoc.data();

          if (!paymentData.referenceNumber) {
            refundFailed = true;
            refundSkippedReason = 'missing_payment_reference';
          } else {
            try {
              refundResult = await stripe.refunds.create({
                payment_intent: paymentData.referenceNumber,
                reason: 'requested_by_customer',
                metadata: {
                  bookingId: id,
                  bookingReference: booking.bookingReference,
                },
              });

              await paymentDoc.ref.update({
                paymentStatus: 'Refunded',
                stripeRefundId: refundResult.id,
                refundedAt: now,
              });
            } catch (refundErr) {
              console.error('[CancelBooking] Stripe refund failed:', refundErr.message);
              refundFailed = true;
              refundSkippedReason = 'stripe_refund_error';
            }
          }
        }

        // STEP 3: finalize paymentStatus honestly.
        const finalPaymentStatus = refundResult
          ? 'Refunded'
          : (refundFailed ? 'Paid' : booking.paymentStatus);
        await bookingRef.update({
          paymentStatus: finalPaymentStatus,
          refundProcessed: Boolean(refundResult),
          refundStatus: refundResult ? 'completed' : (refundFailed ? 'failed' : 'not_applicable'),
          refundFailureReason: refundFailed ? refundSkippedReason : null,
          updatedAt: new Date().toISOString(),
        });
      }

      // Notification text must match what actually happened.
      let cancelMessage;
      if (booking.paymentStatus !== 'Paid') {
        cancelMessage = `Your booking (${booking.bookingReference}) for departure on ${booking.departureDate} has been cancelled. No payment was collected.`;
      } else if (refundResult) {
        cancelMessage = `Your booking (${booking.bookingReference}) for departure on ${booking.departureDate} has been cancelled. Your refund has been initiated and will appear on your card in 5-10 business days.`;
      } else {
        cancelMessage = `Your booking (${booking.bookingReference}) for departure on ${booking.departureDate} has been cancelled. Your refund could not be processed automatically — our support team has been notified and will complete it manually.`;
      }

      await db.collection(NOTIFICATIONS_COLLECTION).add({
        userId: booking.customerId,
        title: refundResult ? 'Booking Cancelled & Refunded' : 'Booking Cancelled',
        message: cancelMessage,
        type: refundResult ? 'booking_cancelled_refunded' : 'booking_cancelled',
        isRead: false,
        relatedBookingId: id,
        createdAt: now,
      });

      await logActivity({
        actorUid: userId,
        actorRole: req.user.role,
        action: 'AUTO_CANCEL_AND_REFUND',
        targetType: 'booking',
        targetId: id,
        metadata: {
          daysRemaining,
          cutoffDays,
          refundId: refundResult?.id,
          refundFailed,
          refundSkippedReason,
        },
      });

      return sendSuccess(
        res,
        {
          bookingId: id,
          bookingStatus: 'Cancelled',
          paymentStatus: refundResult ? 'Refunded' : booking.paymentStatus,
          refundInitiated: Boolean(refundResult),
          refundFailed,
          refundSkippedReason,
          daysRemaining,
          cutoffDays,
        },
        refundResult
          ? 'Booking cancelled successfully. Reserved seats released and refund initiated.'
          : booking.paymentStatus === 'Paid'
            ? 'Booking cancelled and seats released. Refund could not be processed automatically — support will complete it manually.'
            : 'Booking cancelled successfully. Reserved seats released.'
      );
    } else {
      // PAST EARLY-CANCELLATION CUTOFF: Flag for Support Agent exception review
      await bookingRef.update({
        cancellationRequested: true,
        cancellationRequestReason: reason,
        cancellationRequestedAt: now,
        cancellationDaysRemaining: daysRemaining,
        cancellationCutoffDays: cutoffDays,
        updatedAt: now,
      });

      // Notify customer that request is under review
      await db.collection(NOTIFICATIONS_COLLECTION).add({
        userId: booking.customerId,
        title: 'Cancellation Request Submitted',
        message: `Your cancellation request for booking ${booking.bookingReference} is within the ${cutoffDays}-day cutoff window (${daysRemaining} days left). Our support team will review your exception request.`,
        type: 'cancellation_under_review',
        isRead: false,
        relatedBookingId: id,
        createdAt: now,
      });

      await logActivity({
        actorUid: userId,
        actorRole: req.user.role,
        action: 'REQUEST_EXCEPTION_CANCELLATION',
        targetType: 'booking',
        targetId: id,
        metadata: { daysRemaining, cutoffDays, reason },
      });

      return sendSuccess(
        res,
        {
          bookingId: id,
          cancellationRequested: true,
          daysRemaining,
          cutoffDays,
          status: 'pending_support_review',
        },
        `Notice: Your departure is in ${daysRemaining} day(s), which is past the ${cutoffDays}-day early cancellation cutoff. Your request has been routed to a Support Agent for exception review.`
      );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get customer's personal bookings (/api/bookings/my-bookings)
 */
export const getMyBookings = async (req, res, next) => {
  try {
    const customerId = req.user.uid;
    const { status } = req.query;

    let query = db.collection(BOOKINGS_COLLECTION).where('customerId', '==', customerId);

    if (status) {
      query = query.where('bookingStatus', '==', status);
    }

    const snapshot = await query.get();
    let bookings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return sendSuccess(res, bookings, `Retrieved ${bookings.length} booking(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Get booking details by ID
 */
export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(BOOKINGS_COLLECTION).doc(id).get();

    if (!doc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = { id: doc.id, ...doc.data() };
    const isStaff = ['coordinator', 'support', 'guide', 'admin', 'operator'].includes(req.user.role);

    // Enforce authorization
    if (!isStaff && booking.customerId !== req.user.uid) {
      return sendError(res, 'Unauthorized access to booking', 403);
    }

    // Operator ownership guard: Operator can only view bookings on their own tours
    if (req.user.role === 'operator' && booking.packageId) {
      const pDoc = await db.collection(PACKAGES_COLLECTION).doc(booking.packageId).get();
      if (!pDoc.exists || pDoc.data().operatorId !== req.user.uid) {
        return sendError(res, "Unauthorized: Operators can only access bookings for their own tours.", 403);
      }
    }

    // Guides may only view bookings on departures they are assigned to
    if (req.user.role === 'guide') {
      const dDoc = booking.departureId
        ? await db.collection(DEPARTURES_COLLECTION).doc(booking.departureId).get()
        : null;
      if (!dDoc?.exists || dDoc.data().assignedGuideId !== req.user.uid) {
        return sendError(res, 'Unauthorized: Guides can only access bookings on their assigned departures.', 403);
      }
    }

    // Attach package itinerary details
    if (booking.packageId) {
      const pDoc = await db.collection(PACKAGES_COLLECTION).doc(booking.packageId).get();
      if (pDoc.exists) {
        booking.package = {
          id: pDoc.id,
          name: pDoc.data().name,
          itinerary: pDoc.data().itinerary,
          inclusions: pDoc.data().inclusions,
          exclusions: pDoc.data().exclusions,
          imageUrls: pDoc.data().imageUrls,
        };
      }
    }

    // Attach payment details if available
    const paySnap = await db.collection(PAYMENTS_COLLECTION).where('bookingId', '==', id).get();
    booking.payments = paySnap.docs.map((p) => ({ id: p.id, ...p.data() }));

    return sendSuccess(res, booking);
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Support / Admin: Search and list all bookings
 */
export const getAllBookings = async (req, res, next) => {
  try {
    const {
      search,
      bookingStatus,
      paymentStatus,
      packageId,
      departureDate,
      rescheduleStatus,
      limit = 50,
    } = req.query;

    let query = db.collection(BOOKINGS_COLLECTION);

    if (bookingStatus) {
      query = query.where('bookingStatus', '==', bookingStatus);
    }
    if (paymentStatus) {
      query = query.where('paymentStatus', '==', paymentStatus);
    }
    if (packageId) {
      query = query.where('packageId', '==', packageId);
    }

    const snapshot = await query.get();
    let bookings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Rule D: Operator scoping - operators only see bookings for their own tours
    if (req.user?.role === 'operator') {
      const myPkgSnap = await db
        .collection(PACKAGES_COLLECTION)
        .where('operatorId', '==', req.user.uid)
        .get();
      const myPkgIds = new Set(myPkgSnap.docs.map((d) => d.id));
      bookings = bookings.filter((b) => myPkgIds.has(b.packageId));
    }

    bookings.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    // In-memory text search (filters run BEFORE the limit so older matches aren't silently dropped)
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      bookings = bookings.filter(
        (b) =>
          b.bookingReference?.toLowerCase().includes(term) ||
          b.customerName?.toLowerCase().includes(term) ||
          b.customerEmail?.toLowerCase().includes(term) ||
          b.packageName?.toLowerCase().includes(term)
      );
    }

    if (departureDate) {
      bookings = bookings.filter((b) => b.departureDate === departureDate);
    }

    if (rescheduleStatus) {
      bookings = bookings.filter((b) => b.rescheduleRequest?.status === rescheduleStatus);
    }

    bookings = bookings.slice(0, parseLimit(limit));

    return sendSuccess(res, bookings, `Retrieved ${bookings.length} booking(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Support / Admin: Update booking status, internal notes, or reschedule
 */
export const supportUpdateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      bookingStatus,
      paymentStatus,
      internalNotes,
      specialRequests,
      rescheduleDepartureId,
    } = req.body;

    const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const currentBooking = bookingDoc.data();

    // Operator ownership guard (same rule as getBookingById)
    if (req.user.role === 'operator' && currentBooking.packageId) {
      const pDoc = await db.collection(PACKAGES_COLLECTION).doc(currentBooking.packageId).get();
      if (!pDoc.exists || pDoc.data().operatorId !== req.user.uid) {
        return sendError(res, 'Forbidden: Operators can only update bookings for their own tours.', 403);
      }
    }

    // Status allowlists — reject arbitrary/unknown status values
    const ALLOWED_BOOKING_STATUSES = ['Pending', 'Confirmed', 'Cancelled', 'Completed', 'Rejected'];
    const ALLOWED_PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Refunded'];

    if (bookingStatus && !ALLOWED_BOOKING_STATUSES.includes(bookingStatus)) {
      return sendError(res, `Invalid bookingStatus. Allowed: ${ALLOWED_BOOKING_STATUSES.join(', ')}`, 400);
    }

    // paymentStatus is money state — only support/admin may change it, and only
    // to a known value (prevents operators forging "Paid" without a payment).
    if (paymentStatus) {
      if (!['support', 'admin'].includes(req.user.role)) {
        return sendError(res, 'Forbidden: Only support or admin can change payment status', 403);
      }
      if (!ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
        return sendError(res, `Invalid paymentStatus. Allowed: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`, 400);
      }
    }

    // Seat accounting: Cancelled/Rejected bookings have released their seats, so they
    // cannot be silently reactivated (would oversell), and moving an active booking
    // into Cancelled/Rejected must release its seats atomically.
    const isTerminal = (s) => ['Cancelled', 'Rejected'].includes(s);
    const statusChanging = Boolean(bookingStatus) && bookingStatus !== currentBooking.bookingStatus;
    if (statusChanging && isTerminal(currentBooking.bookingStatus)) {
      return sendError(
        res,
        `Cannot change the status of a ${currentBooking.bookingStatus} booking — its seats were already released. Create a new booking instead.`,
        400
      );
    }
    // Refund honesty: a PAID booking must be cancelled through the cancel / exception-refund
    // endpoints (which call Stripe), never by a bare status flip that keeps the money.
    if (statusChanging && isTerminal(bookingStatus) && currentBooking.paymentStatus === 'Paid') {
      return sendError(
        res,
        'This booking is paid. Use the cancellation / exception-refund action so the customer is refunded.',
        400
      );
    }
    const releaseSeats = statusChanging && isTerminal(bookingStatus) && currentBooking.bookingStatus !== 'Completed';
    const wantsReschedule = Boolean(rescheduleDepartureId) && rescheduleDepartureId !== currentBooking.departureId;
    if (wantsReschedule && (isTerminal(currentBooking.bookingStatus) || currentBooking.bookingStatus === 'Completed' || releaseSeats)) {
      return sendError(res, 'Only active (Pending/Confirmed) bookings can be rescheduled', 400);
    }

    const now = new Date().toISOString();
    const updates = { updatedAt: now };

    if (bookingStatus) updates.bookingStatus = bookingStatus;
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    if (specialRequests !== undefined) updates.specialRequests = specialRequests;

    if (internalNotes) {
      const existingNotes = currentBooking.internalNotes || [];
      updates.internalNotes = [
        ...existingNotes,
        {
          note: internalNotes,
          authorUid: req.user.uid,
          authorName: req.user.fullName,
          timestamp: now,
        },
      ];
    }

    // Handle departure rescheduling
    if (wantsReschedule) {
      const oldDepRef = db.collection(DEPARTURES_COLLECTION).doc(currentBooking.departureId);
      const newDepRef = db.collection(DEPARTURES_COLLECTION).doc(rescheduleDepartureId);

      await db.runTransaction(async (t) => {
        // Re-read the booking inside the transaction so a concurrent cancel/reschedule
        // can't cause a double seat release / double transfer.
        const bDoc = await t.get(bookingRef);
        const oldDoc = await t.get(oldDepRef);
        const newDoc = await t.get(newDepRef);

        const cur = bDoc.exists ? bDoc.data() : null;
        if (!cur || !['Pending', 'Confirmed'].includes(cur.bookingStatus) || cur.departureId !== currentBooking.departureId) {
          throw httpError('Booking changed while rescheduling (cancelled or already moved). Please refresh and retry.', 409);
        }

        if (!newDoc.exists) {
          throw httpError('Target departure schedule does not exist', 404);
        }

        const newData = newDoc.data();
        // Price integrity / Rule D: a booking may only move between departures of its own package
        if (newData.packageId !== currentBooking.packageId) {
          throw httpError('Target departure does not belong to the same tour package', 400);
        }
        if (newData.status !== 'open') {
          throw httpError(`Target departure is not open (status: ${newData.status})`, 409);
        }

        // Rule D: Booking Deadline Check on target departure
        const targetDeadline =
          newData.bookingDeadline ||
          computeBookingDeadline(
            newData.departureDate,
            newData.departureTime || '07:00 AM',
            newData.bookingDeadlineHours !== undefined ? Number(newData.bookingDeadlineHours) : 24
          );
        if (now > targetDeadline) {
          throw httpError('Target departure booking cutoff has already passed (Rule D).', 409);
        }

        const remainingInNew = (newData.capacity || 0) - (newData.bookedCount || 0);
        if (currentBooking.numberOfTravelers > remainingInNew) {
          throw httpError(`Insufficient capacity on target departure (${remainingInNew} slot(s) available)`, 409);
        }

        // Adjust seat counts
        if (oldDoc.exists) {
          const oldBooked = oldDoc.data().bookedCount || 0;
          t.update(oldDepRef, {
            bookedCount: Math.max(0, oldBooked - currentBooking.numberOfTravelers),
            updatedAt: now,
          });
        }

        t.update(newDepRef, {
          bookedCount: (newData.bookedCount || 0) + currentBooking.numberOfTravelers,
          updatedAt: now,
        });

        updates.departureId = rescheduleDepartureId;
        updates.departureDate = newData.departureDate;
        updates.departureTime = newData.departureTime || '07:00 AM';
        updates.meetingPoint = newData.meetingPoint || 'Designated Harbor / Meeting Terminal';
        updates.returnDate = newData.returnDate || newData.departureDate;
        updates.rescheduledAt = now;

        t.update(bookingRef, updates);
      });

      // Send rescheduling notification to customer
      await db.collection(NOTIFICATIONS_COLLECTION).add({
        userId: currentBooking.customerId,
        title: 'Booking Rescheduled',
        message: `Your booking (${currentBooking.bookingReference}) has been rescheduled to depart on ${updates.departureDate}.`,
        type: 'booking_rescheduled',
        isRead: false,
        relatedBookingId: id,
        createdAt: now,
      });
    } else if (releaseSeats) {
      await db.runTransaction(async (t) => {
        const bDoc = await t.get(bookingRef);
        const cur = bDoc.exists ? bDoc.data() : null;
        if (!cur || isTerminal(cur.bookingStatus)) {
          throw httpError('Booking was already cancelled/rejected — seats not released again.', 409);
        }
        if (cur.paymentStatus === 'Paid') {
          throw httpError('Booking was just paid. Use the cancellation / exception-refund action instead.', 409);
        }
        const depRef = db.collection(DEPARTURES_COLLECTION).doc(cur.departureId);
        const dDoc = await t.get(depRef);
        if (dDoc.exists) {
          t.update(depRef, {
            bookedCount: Math.max(0, (dDoc.data().bookedCount || 0) - (cur.numberOfTravelers || 0)),
            updatedAt: now,
          });
        }
        t.update(bookingRef, { ...updates, cancelledAt: now, refundStatus: 'not_applicable' });
      });

      // Close any open Checkout session so the customer can't pay for the cancelled booking
      if (currentBooking.stripeSessionId && isStripeInitialized && stripe) {
        try {
          await stripe.checkout.sessions.expire(currentBooking.stripeSessionId);
        } catch (expireErr) {
          console.warn(`[SupportUpdate] Could not expire Stripe session ${currentBooking.stripeSessionId}:`, expireErr.message);
        }
      }
    } else {
      await bookingRef.update(updates);
    }

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'SUPPORT_UPDATE_BOOKING',
      targetType: 'booking',
      targetId: id,
      metadata: { updates },
    });

    const updated = await bookingRef.get();
    return sendSuccess(res, { id, ...updated.data() }, 'Booking updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Support / Admin: Process approved exception refund
 */
export const processExceptionRefund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { exceptionReason = 'Approved exception refund by support' } = req.body;

    const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();
    const now = new Date().toISOString();

    // STEP 1 (atomic): claim the cancellation before touching Stripe, so a
    // retry/double-click cannot double-refund or double-release seats.
    const depRef = db.collection(DEPARTURES_COLLECTION).doc(booking.departureId);
    const claimed = await db.runTransaction(async (t) => {
      const bDoc = await t.get(bookingRef);
      if (!bDoc.exists) return { ok: false, reason: 'not_found' };
      const current = bDoc.data();
      if (['Cancelled', 'Completed', 'Rejected'].includes(current.bookingStatus)) {
        return { ok: false, reason: current.bookingStatus };
      }
      // Refund decision below uses the pre-read paymentStatus — abort if it changed meanwhile
      if (current.paymentStatus !== booking.paymentStatus) {
        return { ok: false, reason: 'state_changed' };
      }

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
        cancellationReason: exceptionReason,
        exceptionApprovedBy: req.user.uid,
        cancelledAt: now,
        refundStatus: current.paymentStatus === 'Paid' ? 'pending' : 'not_applicable',
        updatedAt: now,
      });
      return { ok: true };
    });

    if (!claimed.ok) {
      if (claimed.reason === 'not_found') {
        return sendError(res, 'Booking not found', 404);
      }
      if (claimed.reason === 'state_changed') {
        return sendError(res, 'Booking payment state changed during processing. Please refresh and retry.', 409);
      }
      return sendError(res, `Booking is already ${claimed.reason} — refund not processed again.`, 400);
    }

    // STEP 2: attempt the Stripe refund. paymentStatus becomes 'Refunded'
    // ONLY if the refund actually succeeds (refund honesty).
    let refundResult = null;
    let refundFailed = false;
    let refundSkippedReason = null;

    if (booking.paymentStatus === 'Paid') {
      if (!isStripeInitialized || !stripe) {
        refundFailed = true;
        refundSkippedReason = 'payment_gateway_unavailable';
      } else {
        const paySnap = await db
          .collection(PAYMENTS_COLLECTION)
          .where('bookingId', '==', id)
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
              refundResult = await stripe.refunds.create({
                payment_intent: paymentData.referenceNumber,
                reason: 'requested_by_customer',
                metadata: {
                  bookingId: id,
                  exceptionReason,
                  approvedBy: req.user.uid,
                },
              });

              await paymentDoc.ref.update({
                paymentStatus: 'Refunded',
                stripeRefundId: refundResult.id,
                refundedAt: now,
              });
            } catch (refundErr) {
              console.error('[ExceptionRefund] Stripe refund failed:', refundErr.message);
              refundFailed = true;
              refundSkippedReason = 'stripe_refund_error';
            }
          }
        }
      }

      await bookingRef.update({
        paymentStatus: refundResult ? 'Refunded' : 'Paid',
        refundProcessed: Boolean(refundResult),
        refundStatus: refundResult ? 'completed' : 'failed',
        refundFailureReason: refundFailed ? refundSkippedReason : null,
        updatedAt: new Date().toISOString(),
      });
    }

    // Notify customer — state must match reality
    await db.collection(NOTIFICATIONS_COLLECTION).add({
      userId: booking.customerId,
      title: refundResult ? 'Exception Refund Approved' : 'Exception Refund Approved — Refund Pending',
      message: refundResult
        ? `Your exception refund request for booking ${booking.bookingReference} has been approved and processed.`
        : `Your exception refund request for booking ${booking.bookingReference} has been approved. The refund could not be processed automatically — our team will complete it manually.`,
      type: 'refund_approved',
      isRead: false,
      relatedBookingId: id,
      createdAt: now,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'APPROVE_EXCEPTION_REFUND',
      targetType: 'booking',
      targetId: id,
      metadata: { exceptionReason, refundId: refundResult?.id, refundFailed, refundSkippedReason },
    });

    return sendSuccess(
      res,
      {
        bookingId: id,
        status: 'Cancelled',
        paymentStatus: refundResult ? 'Refunded' : booking.paymentStatus,
        refundProcessed: Boolean(refundResult),
        refundFailed,
        refundSkippedReason,
        refundResult,
      },
      refundResult
        ? 'Exception refund successfully processed.'
        : booking.paymentStatus === 'Paid'
          ? 'Booking cancelled. Refund could not be processed automatically — support must complete it manually.'
          : 'Exception approved and booking cancelled.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Customer: Request Booking Reschedule / Departure Modification
 * (POST /api/bookings/:id/request-reschedule)
 */
export const requestReschedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetDepartureId, reason = '' } = req.body;
    const userId = req.user.uid;
    const isStaff = ['support', 'admin', 'coordinator', 'operator'].includes(req.user.role);

    if (!targetDepartureId) {
      return sendError(res, 'Target departure schedule is required', 400);
    }

    const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();

    // Verify ownership
    if (!isStaff && booking.customerId !== userId) {
      return sendError(res, 'Unauthorized: You can only reschedule your own bookings', 403);
    }

    // Rule D: operators may only act on bookings for their own packages
    if (req.user.role === 'operator' && !(await operatorOwnsPackage(req.user.uid, booking.packageId))) {
      return sendError(res, 'Forbidden: You can only manage bookings for your own packages (Rule D)', 403);
    }

    if (['Cancelled', 'Completed', 'Rejected'].includes(booking.bookingStatus)) {
      return sendError(res, `Cannot reschedule a booking that is ${booking.bookingStatus}`, 400);
    }

    // Departure date check: Cannot reschedule a tour that has already departed
    const today = todayInManila();
    if (booking.departureDate < today) {
      return sendError(res, 'Cannot reschedule a departure that has already occurred', 400);
    }

    if (targetDepartureId === booking.departureId) {
      return sendError(res, 'Target departure is identical to your current departure', 400);
    }

    // Validate target departure
    const targetDepDoc = await db.collection(DEPARTURES_COLLECTION).doc(targetDepartureId).get();
    if (!targetDepDoc.exists) {
      return sendError(res, 'Target departure schedule not found', 404);
    }

    const targetDep = targetDepDoc.data();
    if (targetDep.packageId !== booking.packageId) {
      return sendError(res, 'Target departure does not belong to the same tour package', 400);
    }

    if (targetDep.status !== 'open') {
      return sendError(res, `Target departure is not open for booking (status: ${targetDep.status})`, 400);
    }

    const remainingSlots = (targetDep.capacity || 0) - (targetDep.bookedCount || 0);
    if (booking.numberOfTravelers > remainingSlots) {
      return sendError(
        res,
        `Insufficient capacity: Target departure only has ${remainingSlots} seat(s) remaining for your party of ${booking.numberOfTravelers}.`,
        400
      );
    }

    // Rule D: Check target departure booking deadline
    const nowIso = new Date().toISOString();
    const targetDeadline =
      targetDep.bookingDeadline ||
      computeBookingDeadline(
        targetDep.departureDate,
        targetDep.departureTime || '07:00 AM',
        targetDep.bookingDeadlineHours !== undefined ? Number(targetDep.bookingDeadlineHours) : 24
      );

    if (nowIso > targetDeadline) {
      return sendError(
        res,
        `Target departure booking deadline has passed (closed on ${new Date(targetDeadline).toLocaleString('en-PH')}). Please pick a future departure date (Rule D).`,
        400
      );
    }

    // Policy Cutoff calculation for original departure
    const daysRemaining = daysBetweenDateStrs(todayInManila(), booking.departureDate);
    const cutoffDays = booking.cancellationCutoffDays ?? 7;
    const withinCutoff = daysRemaining >= cutoffDays;

    const rescheduleRequestData = {
      status: 'pending',
      targetDepartureId,
      targetDepartureDate: targetDep.departureDate,
      targetDepartureTime: targetDep.departureTime || '07:00 AM',
      targetReturnDate: targetDep.returnDate || targetDep.departureDate,
      targetMeetingPoint: targetDep.meetingPoint || 'Designated Harbor / Meeting Terminal',
      reason: (reason || '').trim(),
      withinCutoff,
      daysRemaining,
      cutoffDays,
      requestedAt: nowIso,
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
    };

    await bookingRef.update({
      rescheduleRequest: rescheduleRequestData,
      updatedAt: nowIso,
    });

    // Notify traveler
    await db.collection(NOTIFICATIONS_COLLECTION).add({
      userId: booking.customerId,
      title: 'Reschedule Request Submitted',
      message: `Your request to reschedule booking ${booking.bookingReference} to ${targetDep.departureDate} has been received. Our team will review seat availability.`,
      type: 'reschedule_requested',
      isRead: false,
      relatedBookingId: id,
      createdAt: nowIso,
    });

    await logActivity({
      actorUid: userId,
      actorRole: req.user.role,
      action: 'REQUEST_RESCHEDULE',
      targetType: 'booking',
      targetId: id,
      metadata: { targetDepartureId, targetDepartureDate: targetDep.departureDate, withinCutoff, reason },
    });

    return sendSuccess(
      res,
      { bookingId: id, rescheduleRequest: rescheduleRequestData },
      'Reschedule request submitted successfully. It is now under review by our operations team.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Customer: Cancel / Withdraw Pending Reschedule Request
 * (POST /api/bookings/:id/cancel-reschedule)
 */
export const cancelRescheduleRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const isStaff = ['support', 'admin', 'coordinator', 'operator'].includes(req.user.role);

    const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();

    if (!isStaff && booking.customerId !== userId) {
      return sendError(res, 'Unauthorized', 403);
    }

    if (req.user.role === 'operator' && !(await operatorOwnsPackage(req.user.uid, booking.packageId))) {
      return sendError(res, 'Forbidden: You can only manage bookings for your own packages (Rule D)', 403);
    }

    if (!booking.rescheduleRequest || booking.rescheduleRequest.status !== 'pending') {
      return sendError(res, 'No active pending reschedule request found for this booking', 400);
    }

    const nowIso = new Date().toISOString();
    await bookingRef.update({
      'rescheduleRequest.status': 'cancelled',
      'rescheduleRequest.cancelledAt': nowIso,
      updatedAt: nowIso,
    });

    await logActivity({
      actorUid: userId,
      actorRole: req.user.role,
      action: 'CANCEL_RESCHEDULE_REQUEST',
      targetType: 'booking',
      targetId: id,
    });

    return sendSuccess(res, { bookingId: id }, 'Reschedule request withdrawn successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * 10. Staff / Operator: Approve Reschedule Request (Atomic Capacity Transfer)
 * (POST /api/bookings/:id/approve-reschedule)
 */
export const approveRescheduleRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();

    // Operator sandboxing
    if (req.user.role === 'operator') {
      const pkgDoc = await db.collection(PACKAGES_COLLECTION).doc(booking.packageId).get();
      if (!pkgDoc.exists || pkgDoc.data().operatorId !== req.user.uid) {
        return sendError(res, 'Forbidden: You can only approve reschedules for your own packages (Rule D)', 403);
      }
    }

    if (!booking.rescheduleRequest || booking.rescheduleRequest.status !== 'pending') {
      return sendError(res, 'No pending reschedule request found for this booking', 400);
    }

    const reqData = booking.rescheduleRequest;
    const oldDepRef = db.collection(DEPARTURES_COLLECTION).doc(booking.departureId);
    const newDepRef = db.collection(DEPARTURES_COLLECTION).doc(reqData.targetDepartureId);
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (t) => {
      // Re-read the booking inside the transaction: a double-approve or a concurrent
      // cancellation must not move seats twice / move seats for a cancelled booking.
      const bDoc = await t.get(bookingRef);
      const oldDoc = await t.get(oldDepRef);
      const newDoc = await t.get(newDepRef);

      const cur = bDoc.exists ? bDoc.data() : null;
      if (
        !cur ||
        cur.rescheduleRequest?.status !== 'pending' ||
        cur.rescheduleRequest?.targetDepartureId !== reqData.targetDepartureId ||
        cur.departureId !== booking.departureId ||
        !['Pending', 'Confirmed'].includes(cur.bookingStatus)
      ) {
        throw httpError('This reschedule request is no longer pending or the booking is no longer active.', 409);
      }

      if (!newDoc.exists) {
        throw httpError('Target departure schedule does not exist', 404);
      }

      const targetDep = newDoc.data();
      if (targetDep.packageId !== booking.packageId) {
        throw httpError('Target departure does not belong to the same tour package', 400);
      }
      if (targetDep.status !== 'open') {
        throw httpError(`Target departure is not open for reservations (status: ${targetDep.status})`, 409);
      }

      // Check Rule D booking deadline
      const targetDeadline =
        targetDep.bookingDeadline ||
        computeBookingDeadline(
          targetDep.departureDate,
          targetDep.departureTime || '07:00 AM',
          targetDep.bookingDeadlineHours !== undefined ? Number(targetDep.bookingDeadlineHours) : 24
        );
      if (nowIso > targetDeadline) {
        throw httpError('Target departure booking cutoff has already passed (Rule D).', 409);
      }

      const remainingInNew = (targetDep.capacity || 0) - (targetDep.bookedCount || 0);
      if (booking.numberOfTravelers > remainingInNew) {
        throw httpError(`Insufficient capacity on target departure (${remainingInNew} slot(s) remaining)`, 409);
      }

      // Decrement bookedCount on old departure
      if (oldDoc.exists) {
        const oldBooked = oldDoc.data().bookedCount || 0;
        t.update(oldDepRef, {
          bookedCount: Math.max(0, oldBooked - booking.numberOfTravelers),
          updatedAt: nowIso,
        });
      }

      // Increment bookedCount on new departure
      t.update(newDepRef, {
        bookedCount: (targetDep.bookedCount || 0) + booking.numberOfTravelers,
        updatedAt: nowIso,
      });

      // Update booking
      t.update(bookingRef, {
        // Use the departure's CURRENT schedule (the request snapshot may be stale if it was edited)
        departureId: reqData.targetDepartureId,
        departureDate: targetDep.departureDate,
        departureTime: targetDep.departureTime || '07:00 AM',
        returnDate: targetDep.returnDate || targetDep.departureDate,
        meetingPoint: targetDep.meetingPoint || 'Designated Harbor / Meeting Terminal',
        rescheduledAt: nowIso,
        'rescheduleRequest.status': 'approved',
        'rescheduleRequest.reviewedBy': req.user.uid,
        'rescheduleRequest.reviewedAt': nowIso,
        updatedAt: nowIso,
      });
    });

    // Notify customer
    await db.collection(NOTIFICATIONS_COLLECTION).add({
      userId: booking.customerId,
      title: 'Reschedule Request Approved!',
      message: `Great news! Your booking (${booking.bookingReference}) has been approved and moved to departure date ${reqData.targetDepartureDate} at ${reqData.targetDepartureTime || '07:00 AM'}.`,
      type: 'booking_rescheduled',
      isRead: false,
      relatedBookingId: id,
      createdAt: nowIso,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'APPROVE_RESCHEDULE',
      targetType: 'booking',
      targetId: id,
      metadata: {
        fromDepartureId: booking.departureId,
        toDepartureId: reqData.targetDepartureId,
        newDate: reqData.targetDepartureDate,
      },
    });

    return sendSuccess(
      res,
      {
        bookingId: id,
        newDepartureDate: reqData.targetDepartureDate,
        newDepartureTime: reqData.targetDepartureTime,
        status: 'approved',
      },
      'Reschedule request approved successfully. Seats reallocated and schedule updated.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 11. Staff / Operator: Reject Reschedule Request
 * (POST /api/bookings/:id/reject-reschedule)
 */
export const rejectRescheduleRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewNotes = '' } = req.body;

    const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();

    // Operator sandboxing
    if (req.user.role === 'operator') {
      const pkgDoc = await db.collection(PACKAGES_COLLECTION).doc(booking.packageId).get();
      if (!pkgDoc.exists || pkgDoc.data().operatorId !== req.user.uid) {
        return sendError(res, 'Forbidden: You can only moderate bookings for your own packages (Rule D)', 403);
      }
    }

    if (!booking.rescheduleRequest || booking.rescheduleRequest.status !== 'pending') {
      return sendError(res, 'No pending reschedule request found for this booking', 400);
    }

    const nowIso = new Date().toISOString();
    const finalNotes = (reviewNotes || 'Unable to accommodate departure change due to scheduling or capacity limitations.').trim();

    await bookingRef.update({
      'rescheduleRequest.status': 'rejected',
      'rescheduleRequest.reviewedBy': req.user.uid,
      'rescheduleRequest.reviewedAt': nowIso,
      'rescheduleRequest.reviewNotes': finalNotes,
      updatedAt: nowIso,
    });

    // Notify customer
    await db.collection(NOTIFICATIONS_COLLECTION).add({
      userId: booking.customerId,
      title: 'Reschedule Request Update',
      message: `Your reschedule request for booking ${booking.bookingReference} could not be approved: ${finalNotes}. Your reservation remains on ${booking.departureDate}.`,
      type: 'reschedule_rejected',
      isRead: false,
      relatedBookingId: id,
      createdAt: nowIso,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'REJECT_RESCHEDULE',
      targetType: 'booking',
      targetId: id,
      metadata: { reviewNotes: finalNotes },
    });

    return sendSuccess(res, { bookingId: id, status: 'rejected', reviewNotes: finalNotes }, 'Reschedule request rejected.');
  } catch (error) {
    next(error);
  }
};
