import { db } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';
import { geocodeAddress } from '../services/locationService.js';
import { computeBookingDeadline } from './departureController.js';
import { todayInManila } from '../utils/dates.js';
import { parseLimit } from '../utils/query.js';
import { commitInChunks } from '../utils/batch.js';

const COLLECTION = 'tourPackages';

/**
 * Authoritative pricing calculation helper for percentage discounts
 */
export const computePricing = (pricePerPerson, discountPercent) => {
  const base = Number(pricePerPerson) || 0;
  const pct = Math.max(0, Math.min(90, Math.round(Number(discountPercent) || 0)));
  if (pct > 0) {
    const discountPrice = Math.round(base * (1 - pct / 100));
    return {
      discountPercent: pct,
      discountPrice,
      effectivePrice: discountPrice,
      hasDiscount: true,
    };
  }
  return {
    discountPercent: 0,
    discountPrice: null,
    effectivePrice: base,
    hasDiscount: false,
  };
};

export const enrichPackagePricing = (pkg) => {
  if (!pkg) return pkg;
  const pricing = computePricing(pkg.pricePerPerson, pkg.discountPercent);
  return {
    ...pkg,
    discountPercent: pricing.discountPercent,
    discountPrice: pricing.discountPrice,
    effectivePrice: pricing.effectivePrice,
    hasDiscount: pricing.hasDiscount,
  };
};

/**
 * Get all tour packages with comprehensive filters, search, and sorting
 */
export const getPackages = async (req, res, next) => {
  try {
    const {
      search,
      destinationId,
      category,
      minPrice,
      maxPrice,
      minDuration,
      maxDuration,
      sort,
      featured,
      discounted,
      operatorId,
      approvalStatus,
      myTours,
      departureDateFrom,
      departureDateTo,
      departureDate,
      limit = 50,
    } = req.query;

    const isStaff = req.user && ['coordinator', 'support', 'guide', 'admin', 'operator'].includes(req.user.role);

    let query = db.collection(COLLECTION);

    if (!isStaff) {
      query = query.where('isPublished', '==', true);
    } else if (req.query.isPublished !== undefined) {
      query = query.where('isPublished', '==', req.query.isPublished === 'true');
    }

    if (destinationId) {
      query = query.where('destinationId', '==', destinationId);
    }

    if (category) {
      query = query.where('category', '==', category);
    }

    if (featured !== undefined) {
      query = query.where('isFeatured', '==', featured === 'true');
    }

    // NOTE: the page-size limit is applied AFTER the in-memory filters below;
    // limiting the Firestore query first silently dropped matching packages.
    const snapshot = await query.get();
    let packages = snapshot.docs.map((doc) => enrichPackagePricing({ id: doc.id, ...doc.data() }));
    const pageSize = parseLimit(limit);

    // Rule: Public catalog only shows approved packages (or legacy packages without status)
    if (!isStaff) {
      packages = packages.filter((pkg) => !pkg.approvalStatus || pkg.approvalStatus === 'approved');
    }

    // Operator sandboxing: If logged in as operator and viewing their tours, scope to operatorId
    if (req.user?.role === 'operator' && (myTours === 'true' || !['admin', 'coordinator'].includes(req.user.role))) {
      packages = packages.filter((pkg) => pkg.operatorId === req.user.uid);
    } else if (operatorId) {
      packages = packages.filter((pkg) => pkg.operatorId === operatorId);
    }

    if (approvalStatus && approvalStatus !== 'all') {
      packages = packages.filter((pkg) => (pkg.approvalStatus || 'approved') === approvalStatus);
    }

    // Direct discount filter (Special Offers)
    if (discounted === 'true') {
      packages = packages.filter((pkg) => pkg.hasDiscount);
    }

    // In-memory multi-field filtering
    if (typeof search === 'string' && search.trim()) {
      const term = search.trim().toLowerCase();
      packages = packages.filter(
        (pkg) =>
          pkg.name?.toLowerCase().includes(term) ||
          pkg.description?.toLowerCase().includes(term) ||
          pkg.category?.toLowerCase().includes(term)
      );
    }

    // Ignore empty / non-numeric bounds instead of filtering everything out
    const numParam = (v) => (v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const [minP, maxP, minD, maxD] = [minPrice, maxPrice, minDuration, maxDuration].map(numParam);
    if (minP !== null) {
      packages = packages.filter((pkg) => Number(pkg.effectivePrice) >= minP);
    }
    if (maxP !== null) {
      packages = packages.filter((pkg) => Number(pkg.effectivePrice) <= maxP);
    }
    if (minD !== null) {
      packages = packages.filter((pkg) => Number(pkg.durationDays) >= minD);
    }
    if (maxD !== null) {
      packages = packages.filter((pkg) => Number(pkg.durationDays) <= maxD);
    }

    // Sorting
    if (sort === 'price_asc') {
      packages.sort((a, b) => Number(a.effectivePrice || a.pricePerPerson) - Number(b.effectivePrice || b.pricePerPerson));
    } else if (sort === 'price_desc') {
      packages.sort((a, b) => Number(b.effectivePrice || b.pricePerPerson) - Number(a.effectivePrice || a.pricePerPerson));
    } else if (sort === 'duration_asc') {
      packages.sort((a, b) => Number(a.durationDays) - Number(b.durationDays));
    } else if (sort === 'duration_desc') {
      packages.sort((a, b) => Number(b.durationDays) - Number(a.durationDays));
    } else if (sort === 'name_asc') {
      packages.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      // Default: featured first, then newest
      packages.sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return b.isFeatured ? 1 : -1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    }

    // Departure-date filtering depends on departure data, so only pre-slice
    // (to avoid N departure lookups) when no date filter is requested.
    const targetDateFrom = departureDateFrom || departureDate;
    const targetDateTo = departureDateTo || departureDate;
    if (!targetDateFrom && !targetDateTo) {
      packages = packages.slice(0, pageSize);
    }

    // Attach destination names and upcoming departure summaries
    const destCache = new Map();
    for (const pkg of packages) {
      if (pkg.destinationId && !destCache.has(pkg.destinationId)) {
        const dDoc = await db.collection('destinations').doc(pkg.destinationId).get();
        destCache.set(pkg.destinationId, dDoc.exists ? dDoc.data().name : '');
      }
      pkg.destinationName = destCache.get(pkg.destinationId) || '';

      // Upcoming open departures count
      const today = todayInManila();
      const nowIso = new Date().toISOString();
      const depSnap = await db
        .collection('departures')
        .where('packageId', '==', pkg.id)
        .get();

      const openDeps = depSnap.docs
        .map((d) => {
          const data = d.data();
          const bDeadline =
            data.bookingDeadline ||
            computeBookingDeadline(
              data.departureDate,
              data.departureTime || '07:00 AM',
              data.bookingDeadlineHours !== undefined ? Number(data.bookingDeadlineHours) : 24
            );
          return {
            id: d.id,
            ...data,
            bookingDeadline: bDeadline,
            isDeadlinePassed: Boolean(nowIso > bDeadline),
            remainingSlots: Math.max(0, (data.capacity || 0) - (data.bookedCount || 0)),
          };
        })
        .filter((d) => d.status === 'open' && (d.departureDate || '') >= today);

      openDeps.sort((a, b) => (a.departureDate || '').localeCompare(b.departureDate || ''));

      pkg.openDeparturesCount = openDeps.length;
      pkg.nextDepartureDate = openDeps[0]?.departureDate || null;
      pkg.availableSlots = openDeps.reduce(
        (acc, d) => acc + d.remainingSlots,
        0
      );
      pkg.openDepartures = openDeps;
    }

    // Departure Date filtering (Rule D & Checklist Sec A: Catalog Date Filter)
    if (targetDateFrom || targetDateTo) {
      packages = packages.filter((pkg) => {
        return (pkg.openDepartures || []).some((dep) => {
          if (dep.remainingSlots <= 0 || dep.isDeadlinePassed) return false;
          if (targetDateFrom && (dep.departureDate || '') < targetDateFrom) return false;
          if (targetDateTo && (dep.departureDate || '') > targetDateTo) return false;
          return true;
        });
      });
      packages = packages.slice(0, pageSize);
    }

    return sendSuccess(res, packages, `Retrieved ${packages.length} tour package(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get featured tour packages for public homepage
 */
export const getFeaturedPackages = async (req, res, next) => {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('isPublished', '==', true)
      .where('isFeatured', '==', true)
      .limit(6)
      .get();

    // Same public visibility rule as getPackages: hide pending/rejected operator packages
    const packages = snapshot.docs
      .map((doc) => enrichPackagePricing({ id: doc.id, ...doc.data() }))
      .filter((pkg) => !pkg.approvalStatus || pkg.approvalStatus === 'approved');

    for (const pkg of packages) {
      if (pkg.destinationId) {
        const dDoc = await db.collection('destinations').doc(pkg.destinationId).get();
        pkg.destinationName = dDoc.exists ? dDoc.data().name : '';
      }
    }

    return sendSuccess(res, packages);
  } catch (error) {
    next(error);
  }
};

/**
 * Get package details with itinerary and open departures
 */
export const getPackageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return sendError(res, 'Tour package not found', 404);
    }

    const pkg = enrichPackagePricing({ id: doc.id, ...doc.data() });
    // Owning operators get the same full view as staff for their own packages
    // (needed to edit pending/rejected tours from the operator portal).
    const isStaff =
      (req.user && ['coordinator', 'support', 'guide', 'admin'].includes(req.user.role)) ||
      (req.user?.role === 'operator' && pkg.operatorId === req.user.uid);

    const isApproved = !pkg.approvalStatus || pkg.approvalStatus === 'approved';
    if ((!pkg.isPublished || !isApproved) && !isStaff) {
      return sendError(res, 'Tour package is not published', 403);
    }

    // Fetch destination details
    if (pkg.destinationId) {
      const destDoc = await db.collection('destinations').doc(pkg.destinationId).get();
      pkg.destination = destDoc.exists ? { id: destDoc.id, ...destDoc.data() } : null;
    }

    // Fetch upcoming departures
    const today = todayInManila();
    const nowIso = new Date().toISOString();
    let depQuery = db.collection('departures').where('packageId', '==', id);

    if (!isStaff) {
      depQuery = depQuery.where('status', '==', 'open');
    }

    const depSnapshot = await depQuery.get();
    let deps = depSnapshot.docs.map((d) => {
      const data = d.data();
      const bDeadline =
        data.bookingDeadline ||
        computeBookingDeadline(
          data.departureDate,
          data.departureTime || '07:00 AM',
          data.bookingDeadlineHours !== undefined ? Number(data.bookingDeadlineHours) : 24
        );
      return {
        id: d.id,
        ...data,
        departureTime: data.departureTime || '07:00 AM',
        meetingPoint: data.meetingPoint || 'Designated Harbor / Meeting Terminal',
        bookingDeadlineHours: data.bookingDeadlineHours !== undefined ? Number(data.bookingDeadlineHours) : 24,
        bookingDeadline: bDeadline,
        isDeadlinePassed: Boolean(nowIso > bDeadline),
        remainingSlots: Math.max(0, (data.capacity || 0) - (data.bookedCount || 0)),
      };
    });

    if (!isStaff) {
      deps = deps.filter((d) => (d.departureDate || '') >= today);
    }
    deps.sort((a, b) => (a.departureDate || '').localeCompare(b.departureDate || ''));

    pkg.departures = deps;

    return sendSuccess(res, pkg);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to auto-geocode itinerary activities if coordinates are missing
 */
const enrichItineraryWithCoordinates = async (itinerary = [], defaultLocation = '') => {
  if (!Array.isArray(itinerary)) return [];

  const enriched = [];
  for (const day of itinerary) {
    const activities = [];
    for (const act of day.activities || []) {
      let coords = act.coordinates;
      if (!coords || !coords.lat || !coords.lng) {
        const placeSearch = `${act.locationName || act.activityName}, ${defaultLocation}, Philippines`;
        const geocoded = await geocodeAddress(placeSearch);
        coords = { lat: geocoded.lat, lng: geocoded.lng };
      }
      activities.push({
        timeSlot: act.timeSlot || '09:00 AM',
        activityName: act.activityName || 'Activity',
        locationName: act.locationName || '',
        coordinates: coords,
        description: act.description || '',
      });
    }

    enriched.push({
      dayNumber: day.dayNumber || enriched.length + 1,
      dayTitle: day.dayTitle || `Day ${enriched.length + 1}`,
      activities,
    });
  }

  return enriched;
};

/**
 * Create a new tour package (Coordinator / Admin / Operator)
 * Enforces Operator metadata & pending approval status for operators
 */
export const createPackage = async (req, res, next) => {
  try {
    const {
      name,
      destinationId,
      description = '',
      category = 'Island Hopping',
      pricePerPerson,
      discountPercent = 0,
      durationDays = 1,
      durationNights = 0,
      cancellationCutoffDays = 7,
      itinerary = [],
      inclusions = [],
      exclusions = [],
      accommodationDetails = '',
      transportDetails = '',
      imageUrls = [],
      isPublished = false,
      isFeatured = false,
    } = req.body;

    if (typeof name !== 'string' || !name.trim() || !destinationId || pricePerPerson === undefined) {
      return sendError(res, 'Name, destinationId, and pricePerPerson are required', 400);
    }

    const priceNum = Number(pricePerPerson);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return sendError(res, 'pricePerPerson must be a positive number', 400);
    }
    const daysNum = Number(durationDays);
    const nightsNum = Number(durationNights);
    if (!Number.isInteger(daysNum) || daysNum < 1 || !Number.isInteger(nightsNum) || nightsNum < 0) {
      return sendError(res, 'durationDays must be a whole number >= 1 and durationNights >= 0', 400);
    }

    // Verify destination exists
    const destDoc = await db.collection('destinations').doc(destinationId).get();
    if (!destDoc.exists) {
      return sendError(res, 'Specified destination does not exist', 400);
    }
    const destName = destDoc.data().name;

    // Enrich itinerary with coordinates
    const enrichedItinerary = await enrichItineraryWithCoordinates(itinerary, destName);

    const isOperator = req.user?.role === 'operator';
    const operatorId = isOperator ? req.user.uid : (req.body.operatorId || 'platform');
    // req.user (from verifyToken) carries no agencyName, so read it from the
    // operator's profile; otherwise the contact person's name was shown.
    let operatorAgencyName = '';
    if (isOperator) {
      const opDoc = await db.collection('users').doc(req.user.uid).get();
      operatorAgencyName = opDoc.exists ? opDoc.data().agencyName || '' : '';
    }
    const operatorName = isOperator
      ? (operatorAgencyName || req.user.fullName || req.user.email?.split('@')[0] || 'Tour Operator')
      : (req.body.operatorName || 'Lakbay Official');
    const APPROVAL_STATUSES = ['approved', 'pending_approval', 'rejected', 'draft'];
    const approvalStatus = isOperator
      ? 'pending_approval'
      : (APPROVAL_STATUSES.includes(req.body.approvalStatus) ? req.body.approvalStatus : 'approved');
    const isPublishedSafe = isOperator ? false : Boolean(isPublished);

    const cutoffNum = cancellationCutoffDays === undefined || cancellationCutoffDays === '' ? 7 : Number(cancellationCutoffDays);
    if (!Number.isInteger(cutoffNum) || cutoffNum < 0) {
      return sendError(res, 'cancellationCutoffDays must be a whole number of at least 0', 400);
    }
    const pricing = computePricing(pricePerPerson, discountPercent);
    const now = new Date().toISOString();
    const packageData = {
      name: name.trim(),
      destinationId,
      description,
      category,
      pricePerPerson: priceNum,
      discountPercent: pricing.discountPercent,
      discountPrice: pricing.discountPrice,
      effectivePrice: pricing.effectivePrice,
      hasDiscount: pricing.hasDiscount,
      durationDays: daysNum,
      durationNights: nightsNum,
      cancellationCutoffDays: cutoffNum,
      itinerary: enrichedItinerary,
      inclusions: Array.isArray(inclusions) ? inclusions : [],
      exclusions: Array.isArray(exclusions) ? exclusions : [],
      accommodationDetails,
      transportDetails,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      isPublished: isPublishedSafe,
      isFeatured: isOperator ? false : Boolean(isFeatured),
      operatorId,
      operatorName,
      approvalStatus,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(COLLECTION).add(packageData);
    const created = { id: docRef.id, ...packageData };

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'CREATE_PACKAGE',
      targetType: 'package',
      targetId: docRef.id,
      metadata: {
        name: created.name,
        price: created.pricePerPerson,
        discountPercent: created.discountPercent,
        effectivePrice: created.effectivePrice,
        operatorId,
        approvalStatus,
      },
    });

    return sendSuccess(res, created, 'Tour package created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a tour package (Coordinator / Admin / Operator)
 * Enforces Rule D: Operators cannot modify another operator's tours.
 */
export const updatePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Tour package not found', 404);
    }

    const existingData = doc.data();
    const isOperator = req.user.role === 'operator';

    // Rule D: Operator Ownership Guard
    if (isOperator && existingData.operatorId !== req.user.uid) {
      return sendError(res, "Forbidden: Operators cannot update packages they do not own (Rule D).", 403);
    }

    // SECURITY: explicit field allowlist — never spread raw req.body (prevents
    // mass assignment of effectivePrice / operatorId / approvalStatus / etc.)
    const UPDATABLE_FIELDS = [
      'name',
      'description',
      'category',
      'destinationId',
      'pricePerPerson',
      'discountPercent',
      'durationDays',
      'durationNights',
      'cancellationCutoffDays',
      'itinerary',
      'inclusions',
      'exclusions',
      'accommodationDetails',
      'transportDetails',
      'imageUrls',
      'isPublished',
      'isFeatured',
    ];
    const updates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    // Derived pricing/approval/ownership fields are ALWAYS server-controlled.
    delete updates.effectivePrice;
    delete updates.discountPrice;
    delete updates.hasDiscount;
    updates.updatedAt = new Date().toISOString();

    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) {
        return sendError(res, 'Package name cannot be empty', 400);
      }
      updates.name = updates.name.trim();
    }
    if (updates.destinationId !== undefined && updates.destinationId !== existingData.destinationId) {
      const newDest = await db.collection('destinations').doc(String(updates.destinationId)).get();
      if (!newDest.exists) {
        return sendError(res, 'Specified destination does not exist', 400);
      }
    }

    // Validate price when provided
    if (updates.pricePerPerson !== undefined) {
      const priceNum = Number(updates.pricePerPerson);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return sendError(res, 'pricePerPerson must be a positive number', 400);
      }
      updates.pricePerPerson = priceNum;
    }

    if (updates.pricePerPerson !== undefined || updates.discountPercent !== undefined) {
      const basePrice = updates.pricePerPerson !== undefined ? updates.pricePerPerson : existingData.pricePerPerson;
      const pct = updates.discountPercent !== undefined ? updates.discountPercent : (existingData.discountPercent || 0);
      const pricing = computePricing(basePrice, pct);
      updates.pricePerPerson = Number(basePrice);
      updates.discountPercent = pricing.discountPercent;
      updates.discountPrice = pricing.discountPrice;
      updates.effectivePrice = pricing.effectivePrice;
      updates.hasDiscount = pricing.hasDiscount;
    }
    // Numeric fields: must be whole numbers in range (never store NaN or negatives)
    const intField = (key, min, label) => {
      if (updates[key] === undefined) return null;
      const n = Number(updates[key]);
      if (!Number.isInteger(n) || n < min) return `${label} must be a whole number of at least ${min}`;
      updates[key] = n;
      return null;
    };
    const numError =
      intField('durationDays', 1, 'durationDays') ||
      intField('durationNights', 0, 'durationNights') ||
      intField('cancellationCutoffDays', 0, 'cancellationCutoffDays');
    if (numError) {
      return sendError(res, numError, 400);
    }

    // Geocode new itinerary activities if provided
    if (updates.itinerary) {
      const destId = updates.destinationId || doc.data().destinationId;
      const destDoc = await db.collection('destinations').doc(destId).get();
      const destName = destDoc.exists ? destDoc.data().name : '';
      updates.itinerary = await enrichItineraryWithCoordinates(updates.itinerary, destName);
    }

    // If an operator modifies their package, set back to pending_approval and unpublish until reviewed
    if (isOperator) {
      updates.approvalStatus = 'pending_approval';
      updates.isPublished = false;
      delete updates.isFeatured;
      delete updates.operatorId;
    }

    await docRef.update(updates);
    const updated = await docRef.get();

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'UPDATE_PACKAGE',
      targetType: 'package',
      targetId: id,
      metadata: { updatedFields: Object.keys(updates) },
    });

    return sendSuccess(res, { id, ...updated.data() }, 'Tour package updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a tour package safely (Coordinator / Admin / Operator)
 * Enforces Rule D: Operators cannot delete another operator's tours.
 */
export const deletePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Tour package not found', 404);
    }

    const isOperator = req.user.role === 'operator';
    if (isOperator && doc.data().operatorId !== req.user.uid) {
      return sendError(res, "Forbidden: Operators cannot delete another operator's tours (Rule D).", 403);
    }

    // Safety guard: prevent deleting packages with existing bookings
    const bookingsSnap = await db.collection('bookings').where('packageId', '==', id).limit(1).get();
    if (!bookingsSnap.empty) {
      return sendError(
        res,
        'Cannot delete package with existing booking history. Please unpublish or archive it instead.',
        400
      );
    }

    const packageName = doc.data().name;

    // Remove the package's departures too (none have bookings, checked above);
    // otherwise orphaned departures keep pointing at a deleted package.
    const depSnap = await db.collection('departures').where('packageId', '==', id).get();
    await commitInChunks(db, depSnap.docs, (batch, d) => batch.delete(d.ref));

    await docRef.delete();

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'DELETE_PACKAGE',
      targetType: 'package',
      targetId: id,
      metadata: { name: packageName },
    });

    return sendSuccess(res, null, `Tour package "${packageName}" deleted successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * Approve a tour package for publishing (Admin / Coordinator)
 */
export const approvePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Tour package not found', 404);
    }

    const now = new Date().toISOString();
    await docRef.update({
      approvalStatus: 'approved',
      isPublished: true,
      approvedAt: now,
      approvedBy: req.user.uid,
      rejectionReason: '',
      updatedAt: now,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'APPROVE_PACKAGE',
      targetType: 'package',
      targetId: id,
      metadata: { name: doc.data().name, operatorId: doc.data().operatorId },
    });

    return sendSuccess(res, { id, approvalStatus: 'approved', isPublished: true }, 'Tour package approved and published successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a tour package (Admin / Coordinator)
 */
export const rejectPackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Package details require adjustment' } = req.body;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Tour package not found', 404);
    }

    const now = new Date().toISOString();
    await docRef.update({
      approvalStatus: 'rejected',
      isPublished: false,
      rejectionReason: reason,
      rejectedAt: now,
      rejectedBy: req.user.uid,
      updatedAt: now,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'REJECT_PACKAGE',
      targetType: 'package',
      targetId: id,
      metadata: { name: doc.data().name, reason },
    });

    return sendSuccess(res, { id, approvalStatus: 'rejected', isPublished: false, rejectionReason: reason }, 'Tour package rejected');
  } catch (error) {
    next(error);
  }
};
