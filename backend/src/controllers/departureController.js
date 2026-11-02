import { db } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';
import { todayInManila, addDaysToDateStr } from '../utils/dates.js';
import { commitInChunks } from '../utils/batch.js';

const COLLECTION = 'departures';

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

    const deadlineTime = new Date(depDateTime.getTime() - Number(deadlineHours || 24) * 60 * 60 * 1000);
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
      bookingDeadline: doc.data().bookingDeadline || computeBookingDeadline(doc.data().departureDate, doc.data().departureTime || '07:00 AM', doc.data().bookingDeadlineHours || 24),
      isDeadlinePassed: Boolean(nowIso > (doc.data().bookingDeadline || computeBookingDeadline(doc.data().departureDate, doc.data().departureTime || '07:00 AM', doc.data().bookingDeadlineHours || 24))),
      remainingSlots: Math.max(0, (doc.data().capacity || 0) - (doc.data().bookedCount || 0)),
    };

    // Attach package details
    if (departure.packageId) {
      const pDoc = await db.collection('tourPackages').doc(departure.packageId).get();
      if (pDoc.exists) {
        departure.package = { id: pDoc.id, ...pDoc.data() };
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
    if (isNaN(numCapacity) || numCapacity <= 0) {
      return sendError(res, 'Capacity must be a positive number', 400);
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

    const ALLOWED_STATUSES = ['open', 'cancelled', 'completed'];
    if (updates.status !== undefined && !ALLOWED_STATUSES.includes(updates.status)) {
      return sendError(res, `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`, 400);
    }

    // Safety guard: Capacity cannot be set lower than already reserved seats
    if (updates.capacity !== undefined) {
      const newCapacity = Number(updates.capacity);
      if (isNaN(newCapacity) || newCapacity < existing.bookedCount) {
        return sendError(
          res,
          `Cannot reduce capacity to ${newCapacity}. There are already ${existing.bookedCount} confirmed/reserved seat(s).`,
          400
        );
      }
      updates.capacity = newCapacity;
    }

    // Recompute bookingDeadline if date, time, or deadline hours changed
    if (updates.departureDate || updates.departureTime || updates.bookingDeadlineHours !== undefined) {
      const targetDate = updates.departureDate || existing.departureDate;
      const targetTime = updates.departureTime || existing.departureTime || '07:00 AM';
      const targetHours = updates.bookingDeadlineHours !== undefined ? Number(updates.bookingDeadlineHours) : (existing.bookingDeadlineHours || 24);
      updates.bookingDeadline = computeBookingDeadline(targetDate, targetTime, targetHours);
    }

    await docRef.update(updates);
    const updated = await docRef.get();

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'UPDATE_DEPARTURE',
      targetType: 'departure',
      targetId: id,
      metadata: { updatedFields: Object.keys(updates) },
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

    const now = new Date().toISOString();
    await docRef.update({
      status: 'cancelled',
      cancellationReason: reason,
      updatedAt: now,
    });

    // Notify any confirmed/pending bookings
    const bookingsSnap = await db
      .collection('bookings')
      .where('departureId', '==', id)
      .where('bookingStatus', 'in', ['Pending', 'Confirmed'])
      .get();

    // Chunked commit: Firestore batches are capped at 500 ops
    await commitInChunks(db, bookingsSnap.docs, (batch, bDoc) => {
      const booking = bDoc.data();
      // Add notification for affected customers
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        userId: booking.customerId,
        title: 'Departure Cancelled',
        message: `Your upcoming tour scheduled for departure on ${doc.data().departureDate} has been cancelled by administration (${reason}). Our support team will process a full refund or assist with rescheduling.`,
        type: 'departure_cancelled',
        isRead: false,
        relatedBookingId: bDoc.id,
        createdAt: now,
      });
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'CANCEL_DEPARTURE',
      targetType: 'departure',
      targetId: id,
      metadata: { reason, affectedBookingsCount: bookingsSnap.size },
    });

    return sendSuccess(
      res,
      null,
      `Departure cancelled. ${bookingsSnap.size} booking(s) flagged and notified for refund/rescheduling.`
    );
  } catch (error) {
    next(error);
  }
};
