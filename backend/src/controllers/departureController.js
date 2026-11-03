import { db } from '../config/firebaseAdmin.js';
import { stripe, isStripeInitialized } from '../config/stripe.js';
import { sendSuccess, sendError, httpError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';
import { todayInManila, addDaysToDateStr, daysBetweenDateStrs } from '../utils/dates.js';
import { commitInChunks } from '../utils/batch.js';
import { refundCancelledBooking } from '../utils/refunds.js';

const COLLECTION = 'departures';
// 'full' is offered by the admin UI and blocks new checkouts (checkout requires 'open')
const ALLOWED_STATUSES = ['open', 'full', 'cancelled', 'completed'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateStr = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/**
 * Cancel every active booking on a cancelled departure, release their seats atomically,
 * and refund paid ones via Stripe (refund honesty: 'Refunded' only on Stripe success).
 * Each booking is claimed in its own transaction so a concurrent customer cancel /
 * webhook can't double-release seats or double-refund.
 */
const cancelDepartureBookings = async (departureId, departureData, reason) => {
  const depRef = db.collection(COLLECTION).doc(departureId);
  const bookingsSnap = await db
    .collection('bookings')
    .where('departureId', '==', departureId)
    .where('bookingStatus', 'in', ['Pending', 'Confirmed'])
    .get();

  const summary = { affected: 0, refunded: 0, refundFailed: 0, unpaidCancelled: 0 };
  const notifications = [];

  const processBooking = async (bDoc) => {
    const now = new Date().toISOString();
    const claimed = await db.runTransaction(async (t) => {
      const cur = await t.get(bDoc.ref);
      if (!cur.exists) return null;
      const b = cur.data();
      if (!['Pending', 'Confirmed'].includes(b.bookingStatus) || b.departureId !== departureId) return null;
      const dDoc = await t.get(depRef);
      if (dDoc.exists) {
        t.update(depRef, {
          bookedCount: Math.max(0, (dDoc.data().bookedCount || 0) - (b.numberOfTravelers || 0)),
          updatedAt: now,
        });
      }
      t.update(bDoc.ref, {
        bookingStatus: 'Cancelled',
        cancellationReason: `Departure cancelled: ${reason}`,
        departureCancelled: true,
        cancelledAt: now,
        refundStatus: b.paymentStatus === 'Paid' ? 'pending' : 'not_applicable',
        refundProcessed: false,
        updatedAt: now,
      });
      return b;
    });
    if (!claimed) return;
    summary.affected++;

    let message;
    if (claimed.paymentStatus === 'Paid') {
      const { refundResult } = await refundCancelledBooking(bDoc.id, claimed, {
        metadata: { departureId, reason: 'departure_cancelled' },
        idempotencyKey: `departure-cancel-refund-${bDoc.id}`,
      });
      if (refundResult) {
        summary.refunded++;
        message = `Your tour departing ${departureData.departureDate} has been cancelled (${reason}). A full refund has been initiated and will appear on your card in 5-10 business days.`;
      } else {
        summary.refundFailed++;
        message = `Your tour departing ${departureData.departureDate} has been cancelled (${reason}). Your refund could not be processed automatically — our support team has been notified and will complete it manually.`;
      }
    } else {
      summary.unpaidCancelled++;
      if (claimed.stripeSessionId && isStripeInitialized && stripe) {
        try {
          await stripe.checkout.sessions.expire(claimed.stripeSessionId);
        } catch (expireErr) {
          console.warn(`[CancelDeparture] Could not expire Stripe session ${claimed.stripeSessionId}:`, expireErr.message);
        }
      }
      message = `Your tour departing ${departureData.departureDate} has been cancelled (${reason}). No payment was collected.`;
    }

    notifications.push({
      userId: claimed.customerId,
      title: 'Departure Cancelled',
      message,
      type: 'departure_cancelled',
      isRead: false,
      relatedBookingId: bDoc.id,
      createdAt: now,
    });
  };

  // Bounded concurrency (serverless time budget): each booking is still claimed
  // in its own transaction, so parallel processing cannot double-release seats.
  // Notifications are committed per group so a timeout mid-run doesn't lose the
  // ones already processed; a re-run of cancelDeparture resumes the rest.
  const CONCURRENCY = 5;
  const docs = bookingsSnap.docs;
  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(docs.slice(i, i + CONCURRENCY).map(processBooking));
    results
      .filter((r) => r.status === 'rejected')
      .forEach((r) => console.error('[CancelDeparture] Booking processing failed:', r.reason?.message || r.reason));
    const pending = notifications.splice(0, notifications.length);
    // Chunked commit: Firestore batches are capped at 500 ops
    await commitInChunks(db, pending, (batch, n) => {
      batch.set(db.collection('notifications').doc(), n);
    });
  }

  return summary;
};

/**
 * Helper to calculate the booking cutoff deadline timestamp
 * Combines departureDate (YYYY-MM-DD) and departureTime (e.g. 07:00 AM) and subtracts deadlineHours
 */
export const computeBookingDeadline = (departureDate, departureTime = '07:00 AM', deadlineHours = 24) => {
  try {
    let hours = 7;
    let minutes = 0;
    const match = (departureTime || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[3]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }

    // Anchor in Asia/Manila (fixed +08:00, no DST) so the deadline is
    // deterministic regardless of the server's local timezone.
    const pad = (n) => String(n).padStart(2, '0');
    const depDateTime = new Date(
      `${departureDate}T${pad(hours)}:${pad(minutes)}:00+08:00`
    );

    // 0 is a valid cutoff ("until departure time"); only fall back to 24h on missing/invalid input
    const hoursNum = Number(deadlineHours);
    const effectiveHours = deadlineHours !== null && deadlineHours !== '' && Number.isFinite(hoursNum) && hoursNum >= 0 ? hoursNum : 24;
    const deadlineTime = new Date(depDateTime.getTime() - effectiveHours * 60 * 60 * 1000);
    return deadlineTime.toISOString();
  } catch (err) {
    const d = new Date(`${departureDate}T00:00:00+08:00`);
    return new Date(d.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }
};

/**
 * Get departures with optional package, guide, date, and status filters
 */
export const getDepartures = async (req, res, next) => {
  try {
    const { packageId, status, from, to, guideId } = req.query;
    const isStaff = req.user && ['coordinator', 'support', 'guide', 'admin', 'operator'].includes(req.user.role);

    let query = db.collection(COLLECTION);

    if (packageId) {
      query = query.where('packageId', '==', packageId);
    }

    if (guideId) {
      query = query.where('assignedGuideId', '==', guideId);
    }

    if (status) {
      query = query.where('status', '==', status);
    } else if (!isStaff) {
      query = query.where('status', '==', 'open');
    }

    const snapshot = await query.get();
    let departures = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      remainingSlots: Math.max(0, (doc.data().capacity || 0) - (doc.data().bookedCount || 0)),
    }));

    // In-memory sort by departure date ascending
    departures.sort((a, b) => (a.departureDate || '').localeCompare(b.departureDate || ''));

    // Date filtering in memory
    const today = todayInManila();
    if (!isStaff) {
      departures = departures.filter((d) => d.departureDate >= today);
    }
    if (from) {
      departures = departures.filter((d) => d.departureDate >= from);
    }
    if (to) {
      departures = departures.filter((d) => d.departureDate <= to);
    }

    // Attach package title and assigned guide name if available
    const pkgMap = new Map();
    const pkgOperatorMap = new Map();
    const userMap = new Map();

    const nowIso = new Date().toISOString();
    for (const dep of departures) {
      if (dep.packageId && !pkgMap.has(dep.packageId)) {
        const pDoc = await db.collection('tourPackages').doc(dep.packageId).get();
        pkgMap.set(dep.packageId, pDoc.exists ? pDoc.data().name : 'Unknown Package');
        pkgOperatorMap.set(dep.packageId, pDoc.exists ? pDoc.data().operatorId : null);
      }
      dep.packageName = pkgMap.get(dep.packageId);
      dep.operatorId = dep.operatorId || pkgOperatorMap.get(dep.packageId);

      if (dep.assignedGuideId && !userMap.has(dep.assignedGuideId)) {
        const uDoc = await db.collection('users').doc(dep.assignedGuideId).get();
        userMap.set(dep.assignedGuideId, uDoc.exists ? uDoc.data().fullName : 'Unassigned');
      }
      dep.assignedGuideName = dep.assignedGuideId ? userMap.get(dep.assignedGuideId) : 'Unassigned';

      // Logistics & Deadline Enrichment
      dep.departureTime = dep.departureTime || '07:00 AM';
      dep.meetingPoint = dep.meetingPoint || 'Designated Harbor / Meeting Terminal';
      dep.bookingDeadlineHours = dep.bookingDeadlineHours !== undefined ? Number(dep.bookingDeadlineHours) : 24;
      dep.bookingDeadline = dep.bookingDeadline || computeBookingDeadline(dep.departureDate, dep.departureTime, dep.bookingDeadlineHours);
      dep.isDeadlinePassed = Boolean(nowIso > dep.bookingDeadline);
    }

    // Rule D: Operator sandboxing - operators only see departures for their own packages
    if (req.user?.role === 'operator') {
      departures = departures.filter((d) => d.operatorId === req.user.uid);
    }

    return sendSuccess(res, departures, `Retrieved ${departures.length} departure(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get departure by ID with manifest summary for staff
 */
export const getDepartureById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return sendError(res, 'Departure not found', 404);
    }

    const nowIso = new Date().toISOString();
    const departure = {
      id: doc.id,
      ...doc.data(),
      departureTime: doc.data().departureTime || '07:00 AM',
      meetingPoint: doc.data().meetingPoint || 'Designated Harbor / Meeting Terminal',
      bookingDeadlineHours: doc.data().bookingDeadlineHours !== undefined ? Number(doc.data().bookingDeadlineHours) : 24,
      bookingDeadline: doc.data().bookingDeadline || computeBookingDeadline(doc.data().departureDate, doc.data().departureTime || '07:00 AM', doc.data().bookingDeadlineHours !== undefined ? Number(doc.data().bookingDeadlineHours) : 24),
      isDeadlinePassed: Boolean(nowIso > (doc.data().bookingDeadline || computeBookingDeadline(doc.data().departureDate, doc.data().departureTime || '07:00 AM', doc.data().bookingDeadlineHours !== undefined ? Number(doc.data().bookingDeadlineHours) : 24))),
      remainingSlots: Math.max(0, (doc.data().capacity || 0) - (doc.data().bookedCount || 0)),
    };

    // Attach package details — same visibility rule as GET /packages/:id: guests only see
    // departures of published + approved packages; staff and the owning operator see all.
    if (departure.packageId) {
      const pDoc = await db.collection('tourPackages').doc(departure.packageId).get();
      if (pDoc.exists) {
        const pkg = pDoc.data();
        const role = req.user?.role;
        const isStaff = ['admin', 'coordinator', 'support', 'guide'].includes(role);
        const isOwner = role === 'operator' && pkg.operatorId === req.user?.uid;
        const isPublic = pkg.isPublished === true && (!pkg.approvalStatus || pkg.approvalStatus === 'approved');
        if (!isStaff && !isOwner && !isPublic) {
          return sendError(res, 'Departure not found', 404);
        }
        departure.package = { id: pDoc.id, ...pkg };
      }
    }

    return sendSuccess(res, departure);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new departure schedule (Coordinator / Admin)
 */
export const createDeparture = async (req, res, next) => {
  try {
    const {
      packageId,
      departureDate,
      returnDate,
      departureTime = '07:00 AM',
      meetingPoint = '',
      bookingDeadlineHours = 24,
      capacity,
      assignedGuideId = null,
      status = 'open',
    } = req.body;

    if (!packageId || !departureDate || capacity === undefined) {
      return sendError(res, 'packageId, departureDate, and capacity are required', 400);
    }

    const numCapacity = Number(capacity);
    if (!Number.isInteger(numCapacity) || numCapacity <= 0) {
      return sendError(res, 'Capacity must be a positive whole number', 400);
    }

    if (!isValidDateStr(departureDate)) {
      return sendError(res, 'departureDate must be a valid YYYY-MM-DD date', 400);
    }
    if (returnDate && (!isValidDateStr(returnDate) || returnDate < departureDate)) {
      return sendError(res, 'returnDate must be a valid YYYY-MM-DD date on or after departureDate', 400);
    }
    if (!['open', 'full'].includes(status)) {
      return sendError(res, "New departures must have status 'open' or 'full'", 400);
    }
    const hoursCheck = Number(bookingDeadlineHours);
    if (!Number.isFinite(hoursCheck) || hoursCheck < 0) {
      return sendError(res, 'bookingDeadlineHours must be a non-negative number', 400);
    }

    // Verify package exists
    const pkgDoc = await db.collection('tourPackages').doc(packageId).get();
    if (!pkgDoc.exists) {
      return sendError(res, 'Tour package does not exist', 400);
    }

    const pkgData = pkgDoc.data();
    const isOperator = req.user?.role === 'operator';

    // Rule D: Operator Ownership Guard — STRICT: operators may only schedule
    // departures for packages they own (missing operatorId = platform-owned).
    if (isOperator && pkgData.operatorId !== req.user.uid) {
      return sendError(res, "Forbidden: Operators cannot schedule departures for tours they do not own (Rule D).", 403);
    }

    // Calculate returnDate if not provided
    let calculatedReturnDate = returnDate;
    if (!calculatedReturnDate) {
      const durationDays = pkgData.durationDays || 1;
      calculatedReturnDate = addDaysToDateStr(departureDate, durationDays - 1);
    }

    const deadlineHours = bookingDeadlineHours !== undefined ? Number(bookingDeadlineHours) : 24;
    const computedDeadline = computeBookingDeadline(departureDate, departureTime, deadlineHours);

    const now = new Date().toISOString();
    const departureData = {
      packageId,
      departureDate,
      returnDate: calculatedReturnDate,
      departureTime: (departureTime || '07:00 AM').trim(),
      meetingPoint: (meetingPoint || '').trim(),
      bookingDeadlineHours: deadlineHours,
      bookingDeadline: computedDeadline,
      capacity: numCapacity,
      bookedCount: 0,
      assignedGuideId: assignedGuideId || null,
      operatorId: pkgData.operatorId || 'platform',
      status,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(COLLECTION).add(departureData);
    const created = { id: docRef.id, ...departureData };

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'CREATE_DEPARTURE',
      targetType: 'departure',
      targetId: docRef.id,
      metadata: { packageId, departureDate, capacity: numCapacity },
    });

    return sendSuccess(res, created, 'Departure schedule created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update departure schedule (Coordinator / Admin)
 * Safety guard: Cannot reduce capacity below already booked count
 */
export const updateDeparture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Departure not found', 404);
    }

    const existing = doc.data();
    const isOperator = req.user.role === 'operator';

    // Rule D: Operator Ownership Guard — STRICT: operators may only touch their
    // own departures; docs with a missing operatorId (platform-owned) are off-limits.
    if (isOperator && existing.operatorId !== req.user.uid) {
      return sendError(res, "Forbidden: Operators cannot modify departures for tours they do not own (Rule D).", 403);
    }

    // SECURITY: field allowlist — never spread raw req.body (prevents injection
    // of operatorId / packageId / bookedCount / createdAt etc.)
    const UPDATABLE_FIELDS = [
      'departureDate',
      'returnDate',
      'departureTime',
      'meetingPoint',
      'bookingDeadlineHours',
      'capacity',
      'assignedGuideId',
      'status',
    ];
    const updates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    updates.updatedAt = new Date().toISOString();

    if (updates.status !== undefined && !ALLOWED_STATUSES.includes(updates.status)) {
      return sendError(res, `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`, 400);
    }
    if (existing.status === 'cancelled' && updates.status !== undefined && updates.status !== 'cancelled') {
      // Its bookings were cancelled/refunded and seats released — reopening would desync accounting
      return sendError(res, 'A cancelled departure cannot be reopened. Create a new departure instead.', 400);
    }
    const isBeingCancelled = updates.status === 'cancelled' && existing.status !== 'cancelled';

    if (updates.departureDate !== undefined && !isValidDateStr(updates.departureDate)) {
      return sendError(res, 'departureDate must be a valid YYYY-MM-DD date', 400);
    }
    // Keep the trip length when only the start date moves
    if (
      updates.departureDate &&
      updates.departureDate !== existing.departureDate &&
      updates.returnDate === undefined &&
      existing.returnDate &&
      existing.departureDate
    ) {
      updates.returnDate = addDaysToDateStr(
        existing.returnDate,
        daysBetweenDateStrs(existing.departureDate, updates.departureDate)
      );
    }
    if (updates.returnDate !== undefined && updates.returnDate !== null) {
      const effDep = updates.departureDate || existing.departureDate;
      if (!isValidDateStr(updates.returnDate) || updates.returnDate < effDep) {
        return sendError(res, 'returnDate must be a valid YYYY-MM-DD date on or after departureDate', 400);
      }
    }
    if (updates.bookingDeadlineHours !== undefined) {
      const h = Number(updates.bookingDeadlineHours);
      if (!Number.isFinite(h) || h < 0) {
        return sendError(res, 'bookingDeadlineHours must be a non-negative number', 400);
      }
      updates.bookingDeadlineHours = h;
    }

    if (updates.capacity !== undefined) {
      const newCapacity = Number(updates.capacity);
      if (!Number.isInteger(newCapacity) || newCapacity <= 0) {
        return sendError(res, 'Capacity must be a positive whole number', 400);
      }
      updates.capacity = newCapacity;
    }

    // Recompute bookingDeadline if date, time, or deadline hours changed
    if (updates.departureDate || updates.departureTime || updates.bookingDeadlineHours !== undefined) {
      const targetDate = updates.departureDate || existing.departureDate;
      const targetTime = updates.departureTime || existing.departureTime || '07:00 AM';
      const targetHours = updates.bookingDeadlineHours !== undefined ? Number(updates.bookingDeadlineHours) : (existing.bookingDeadlineHours ?? 24);
      updates.bookingDeadline = computeBookingDeadline(targetDate, targetTime, targetHours);
    }
    if (isBeingCancelled) {
      updates.cancellationReason = (req.body.cancellationReason || req.body.reason || 'Cancelled by coordinator').toString();
    }

    // Capacity guard inside a transaction: a concurrent checkout can't push bookedCount
    // above the new capacity between our check and our write.
    await db.runTransaction(async (t) => {
      const snap = await t.get(docRef);
      const booked = snap.data().bookedCount || 0;
      if (updates.capacity !== undefined && updates.capacity < booked) {
        throw httpError(
          `Cannot reduce capacity to ${updates.capacity}. There are already ${booked} confirmed/reserved seat(s).`,
          400
        );
      }
      t.update(docRef, updates);
    });

    // Bookings denormalize schedule fields (cancellation windows & reminders read booking.departureDate),
    // so propagate schedule changes to active bookings on this departure.
    const SCHEDULE_FIELDS = ['departureDate', 'returnDate', 'departureTime', 'meetingPoint'];
    const scheduleChanges = {};
    for (const f of SCHEDULE_FIELDS) {
      if (updates[f] !== undefined && updates[f] !== existing[f]) scheduleChanges[f] = updates[f];
    }
    if (!isBeingCancelled && Object.keys(scheduleChanges).length > 0) {
      const activeSnap = await db
        .collection('bookings')
        .where('departureId', '==', id)
        .where('bookingStatus', 'in', ['Pending', 'Confirmed'])
        .get();
      await commitInChunks(db, activeSnap.docs, (batch, bDoc) => {
        batch.update(bDoc.ref, { ...scheduleChanges, updatedAt: updates.updatedAt });
      });
    }

    let cancellationSummary = null;
    if (isBeingCancelled) {
      cancellationSummary = await cancelDepartureBookings(id, { ...existing, ...updates }, updates.cancellationReason);
    }

    const updated = await docRef.get();

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'UPDATE_DEPARTURE',
      targetType: 'departure',
      targetId: id,
      metadata: { updatedFields: Object.keys(updates), cancellationSummary },
    });

    return sendSuccess(res, { id, ...updated.data() }, 'Departure schedule updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a departure schedule safely (Coordinator / Admin)
 */
export const cancelDeparture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by coordinator' } = req.body;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Departure not found', 404);
    }

    const existing = doc.data();
    const isOperator = req.user.role === 'operator';

    // Rule D: Operator Ownership Guard — STRICT (missing operatorId = platform-owned)
    if (isOperator && existing.operatorId !== req.user.uid) {
      return sendError(res, "Forbidden: Operators cannot cancel departures for tours they do not own (Rule D).", 403);
    }

    if (existing.status === 'completed') {
      return sendError(res, 'Departure is already completed', 400);
    }

    // Resume support: if a previous cancel run was cut short (e.g. serverless
    // timeout), the departure is already 'cancelled' but active bookings may
    // remain. Re-running sweeps only the remaining Pending/Confirmed bookings
    // (each claim is transactional and refunds use idempotency keys).
    const isResume = existing.status === 'cancelled';
    const effectiveReason = isResume ? existing.cancellationReason || reason : reason;

    if (!isResume) {
      const now = new Date().toISOString();
      // Flip status first (in a transaction) so no new checkout can reserve seats meanwhile
      await db.runTransaction(async (t) => {
        const snap = await t.get(docRef);
        if (['cancelled', 'completed'].includes(snap.data().status)) {
          throw httpError(`Departure is already ${snap.data().status}`, 409);
        }
        t.update(docRef, {
          status: 'cancelled',
          cancellationReason: reason,
          updatedAt: now,
        });
      });
    }

    const summary = await cancelDepartureBookings(id, existing, effectiveReason);

    if (isResume && summary.affected === 0) {
      return sendError(res, 'Departure is already cancelled', 400);
    }

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'CANCEL_DEPARTURE',
      targetType: 'departure',
      targetId: id,
      metadata: { reason: effectiveReason, resumed: isResume, affectedBookingsCount: summary.affected, ...summary },
    });

    return sendSuccess(
      res,
      summary,
      `Departure cancelled. ${summary.affected} booking(s) cancelled: ${summary.refunded} refunded, ${summary.unpaidCancelled} unpaid` +
        (summary.refundFailed ? `, ${summary.refundFailed} refund(s) FAILED and need manual processing by support.` : '.')
    );
  } catch (error) {
    next(error);
  }
};
