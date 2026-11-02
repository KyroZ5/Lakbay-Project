import { db } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';
import { getCurrentWeather } from '../services/weatherService.js';
import { commitInChunks } from '../utils/batch.js';

const DEPARTURES_COLLECTION = 'departures';
const BOOKINGS_COLLECTION = 'bookings';
const PACKAGES_COLLECTION = 'tourPackages';

/**
 * Shared authorization guard for departure-scoped guide actions:
 * admin always passes; operator must own the departure; guide must be assigned.
 */
const authorizeDepartureAccess = async (departure, user) => {
  if (user.role === 'admin') return true;
  if (user.role === 'operator') return departure.operatorId === user.uid;
  return departure.assignedGuideId === user.uid;
};

/**
 * Get all departures assigned to the logged-in tour guide
 */
export const getAssignedDepartures = async (req, res, next) => {
  try {
    const guideUid = req.user.uid;
    const isAdmin = req.user.role === 'admin';
    const isOperator = req.user.role === 'operator';

    let query = db.collection(DEPARTURES_COLLECTION);
    if (isOperator) {
      query = query.where('operatorId', '==', guideUid);
    } else if (!isAdmin) {
      query = query.where('assignedGuideId', '==', guideUid);
    }

    const snapshot = await query.get();
    let departures = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    departures.sort((a, b) => (a.departureDate || '').localeCompare(b.departureDate || ''));

    // Attach package info and destination weather
    for (const dep of departures) {
      if (dep.packageId) {
        const pDoc = await db.collection(PACKAGES_COLLECTION).doc(dep.packageId).get();
        if (pDoc.exists) {
          const pData = pDoc.data();
          dep.package = {
            id: pDoc.id,
            name: pData.name,
            durationDays: pData.durationDays,
            itinerary: pData.itinerary,
            imageUrls: pData.imageUrls,
          };

          // Destination weather
          if (pData.destinationId) {
            const destDoc = await db.collection('destinations').doc(pData.destinationId).get();
            if (destDoc.exists && destDoc.data().coordinates) {
              dep.destinationWeather = await getCurrentWeather(
                destDoc.data().coordinates.lat,
                destDoc.data().coordinates.lng
              );
            }
          }
        }
      }
    }

    return sendSuccess(res, departures, `Retrieved ${departures.length} assigned departure(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get passenger manifest for an assigned departure
 */
export const getDepartureManifest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const guideUid = req.user.uid;
    const isAdmin = req.user.role === 'admin';
    const isOperator = req.user.role === 'operator';

    const depDoc = await db.collection(DEPARTURES_COLLECTION).doc(id).get();
    if (!depDoc.exists) {
      return sendError(res, 'Departure schedule not found', 404);
    }

    const departure = { id: depDoc.id, ...depDoc.data() };

    // Verify assignment / ownership
    const isAuthorized =
      isAdmin ||
      departure.assignedGuideId === guideUid ||
      (isOperator && departure.operatorId === guideUid);

    if (!isAuthorized) {
      return sendError(res, 'Unauthorized: You are not authorized to view this departure manifest', 403);
    }

    // Fetch confirmed bookings for this departure
    const bookingsSnap = await db
      .collection(BOOKINGS_COLLECTION)
      .where('departureId', '==', id)
      .where('bookingStatus', '==', 'Confirmed')
      .get();

    const manifest = [];
    let totalHeadcount = 0;
    let checkedInHeadcount = 0;

    for (const bDoc of bookingsSnap.docs) {
      const bData = bDoc.data();
      const bookingId = bDoc.id;
      const travelers = bData.travelerManifest || [];

      // If travelerManifest is detailed
      if (travelers.length > 0) {
        travelers.forEach((traveler, index) => {
          totalHeadcount++;
          const isCheckedIn = Boolean(traveler.isCheckedIn);
          if (isCheckedIn) checkedInHeadcount++;

          manifest.push({
            bookingId,
            bookingReference: bData.bookingReference,
            travelerIndex: index,
            fullName: traveler.fullName || bData.customerName,
            birthDate: traveler.birthDate || '',
            relationship: traveler.relationship || (index === 0 ? 'Lead Traveler' : 'Companion'),
            dietaryOrMedicalNotes: traveler.dietaryOrMedicalNotes || '',
            contactPhone: bData.customerPhone,
            customerEmail: bData.customerEmail,
            specialRequests: bData.specialRequests,
            isCheckedIn,
          });
        });
      } else {
        // Fallback if individual co-travelers weren't enumerated
        const count = bData.numberOfTravelers || 1;
        totalHeadcount += count;
        const isCheckedIn = Boolean(bData.isCheckedIn);
        if (isCheckedIn) checkedInHeadcount += count;

        manifest.push({
          bookingId,
          bookingReference: bData.bookingReference,
          travelerIndex: 0,
          fullName: bData.customerName,
          relationship: `Lead Traveler (${count} person party)`,
          contactPhone: bData.customerPhone,
          customerEmail: bData.customerEmail,
          specialRequests: bData.specialRequests,
          headcount: count,
          isCheckedIn,
        });
      }
    }

    return sendSuccess(res, {
      departure,
      totalBookings: bookingsSnap.size,
      totalHeadcount,
      checkedInHeadcount,
      manifest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle check-in status for passenger(s) in a booking
 */
export const updatePassengerCheckIn = async (req, res, next) => {
  try {
    const { id } = req.params; // departureId
    const { bookingId, travelerIndex = 0, isCheckedIn = true } = req.body;

    if (!bookingId) {
      return sendError(res, 'bookingId is required', 400);
    }

    // AUTHZ: only the assigned guide / owning operator / admin may check in passengers
    const depDoc = await db.collection(DEPARTURES_COLLECTION).doc(id).get();
    if (!depDoc.exists) {
      return sendError(res, 'Departure schedule not found', 404);
    }
    if (!(await authorizeDepartureAccess(depDoc.data(), req.user))) {
      return sendError(res, 'Unauthorized: You are not assigned to this departure', 403);
    }

    const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();
    if (booking.departureId !== id) {
      return sendError(res, 'Booking does not belong to this departure', 400);
    }

    const travelers = booking.travelerManifest || [];
    if (travelers.length > travelerIndex) {
      travelers[travelerIndex].isCheckedIn = Boolean(isCheckedIn);
      await bookingRef.update({
        travelerManifest: travelers,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await bookingRef.update({
        isCheckedIn: Boolean(isCheckedIn),
        updatedAt: new Date().toISOString(),
      });
    }

    return sendSuccess(
      res,
      { bookingId, travelerIndex, isCheckedIn },
      `Check-in status updated to ${isCheckedIn ? 'Checked-In' : 'Not Checked-In'}`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a departure as Completed (Guide / Admin)
 */
export const completeDeparture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const depRef = db.collection(DEPARTURES_COLLECTION).doc(id);
    const depDoc = await depRef.get();

    if (!depDoc.exists) {
      return sendError(res, 'Departure not found', 404);
    }

    // AUTHZ: only the assigned guide / owning operator / admin may complete a departure
    if (!(await authorizeDepartureAccess(depDoc.data(), req.user))) {
      return sendError(res, 'Unauthorized: You are not assigned to this departure', 403);
    }

    const now = new Date().toISOString();

    // Update departure status to completed
    await depRef.update({
      status: 'completed',
      completedAt: now,
      completedBy: req.user.uid,
      updatedAt: now,
    });

    // Update all confirmed bookings to Completed
    const bookingsSnap = await db
      .collection(BOOKINGS_COLLECTION)
      .where('departureId', '==', id)
      .where('bookingStatus', '==', 'Confirmed')
      .get();

    // Chunked commit: Firestore batches are capped at 500 ops
    await commitInChunks(db, bookingsSnap.docs, (batch, bDoc) => {
      batch.update(bDoc.ref, {
        bookingStatus: 'Completed',
        updatedAt: now,
      });
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'COMPLETE_DEPARTURE',
      targetType: 'departure',
      targetId: id,
      metadata: { completedBookingsCount: bookingsSnap.size },
    });

    return sendSuccess(
      res,
      { departureId: id, completedBookings: bookingsSnap.size },
      `Departure marked as Completed. ${bookingsSnap.size} booking(s) updated to Completed.`
    );
  } catch (error) {
    next(error);
  }
};
