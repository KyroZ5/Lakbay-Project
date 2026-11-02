import { db } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';
import { geocodeAddress } from '../services/locationService.js';
import { getCurrentWeather } from '../services/weatherService.js';
import { parseLimit } from '../utils/query.js';

const COLLECTION = 'destinations';

/**
 * Get all destinations with search, filter, and sorting
 */
export const getDestinations = async (req, res, next) => {
  try {
    const { search, category, featured, sort, limit = 50 } = req.query;
    const isStaff = req.user && ['coordinator', 'support', 'guide', 'admin'].includes(req.user.role);

    let query = db.collection(COLLECTION);

    // Non-staff can only see published destinations
    if (!isStaff) {
      query = query.where('isPublished', '==', true);
    } else if (req.query.isPublished !== undefined) {
      query = query.where('isPublished', '==', req.query.isPublished === 'true');
    }

    if (featured !== undefined) {
      query = query.where('isFeatured', '==', featured === 'true');
    }

    if (category) {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.limit(parseLimit(limit)).get();
    let destinations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // In-memory text search filter for flexible multi-field matching
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      destinations = destinations.filter(
        (dest) =>
          dest.name?.toLowerCase().includes(term) ||
          dest.location?.toLowerCase().includes(term) ||
          dest.region?.toLowerCase().includes(term) ||
          dest.country?.toLowerCase().includes(term)
      );
    }

    // Sorting
    if (sort === 'name_asc') {
      destinations.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'name_desc') {
      destinations.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    } else {
      // Default: sort by featured first, then newest
      destinations.sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return b.isFeatured ? 1 : -1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    }

    return sendSuccess(res, destinations, `Retrieved ${destinations.length} destination(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get featured destinations for public homepage
 */
export const getFeaturedDestinations = async (req, res, next) => {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('isPublished', '==', true)
      .where('isFeatured', '==', true)
      .limit(6)
      .get();

    const destinations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return sendSuccess(res, destinations);
  } catch (error) {
    next(error);
  }
};

/**
 * Get destination details with weather and related packages
 */
export const getDestinationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return sendError(res, 'Destination not found', 404);
    }

    const destination = { id: doc.id, ...doc.data() };
    const isStaff = req.user && ['coordinator', 'support', 'guide', 'admin'].includes(req.user.role);

    if (!destination.isPublished && !isStaff) {
      return sendError(res, 'Destination is not publicly accessible', 403);
    }

    // Fetch related tour packages
    let packageQuery = db.collection('tourPackages').where('destinationId', '==', id);
    if (!isStaff) {
      packageQuery = packageQuery.where('isPublished', '==', true);
    }
    const pkgSnapshot = await packageQuery.get();
    destination.relatedPackages = pkgSnapshot.docs.map((p) => ({ id: p.id, ...p.data() }));

    // Fetch current weather preview if coordinates exist
    if (destination.coordinates?.lat && destination.coordinates?.lng) {
      destination.currentWeather = await getCurrentWeather(
        destination.coordinates.lat,
        destination.coordinates.lng
      );
    }

    return sendSuccess(res, destination);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new destination (Coordinator / Admin)
 */
export const createDestination = async (req, res, next) => {
  try {
    const {
      name,
      country = 'Philippines',
      region = '',
      location = '',
      coordinates,
      description = '',
      recommendedActivities = [],
      imageUrls = [],
      category = 'Island',
      isPublished = false,
      isFeatured = false,
    } = req.body;

    if (!name) {
      return sendError(res, 'Destination name is required', 400);
    }

    // Auto-resolve coordinates if missing or incomplete
    let finalCoordinates = coordinates;
    if (!finalCoordinates || !finalCoordinates.lat || !finalCoordinates.lng) {
      const geocoded = await geocodeAddress(`${name}, ${location || region}, ${country}`);
      finalCoordinates = { lat: geocoded.lat, lng: geocoded.lng };
    }

    const now = new Date().toISOString();
    const destinationData = {
      name: name.trim(),
      country: country.trim(),
      region: region.trim(),
      location: location.trim(),
      coordinates: finalCoordinates,
      description,
      recommendedActivities: Array.isArray(recommendedActivities) ? recommendedActivities : [],
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      category,
      isPublished: Boolean(isPublished),
      isFeatured: Boolean(isFeatured),
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(COLLECTION).add(destinationData);
    const created = { id: docRef.id, ...destinationData };

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'CREATE_DESTINATION',
      targetType: 'destination',
      targetId: docRef.id,
      metadata: { name: created.name },
    });

    return sendSuccess(res, created, 'Destination created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a destination (Coordinator / Admin)
 */
export const updateDestination = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Destination not found', 404);
    }

    const updates = { ...req.body };
    delete updates.id;
    delete updates.createdAt;
    updates.updatedAt = new Date().toISOString();

    // Re-geocode if location or name changed and coordinates were not explicitly provided
    if ((updates.name || updates.location) && (!updates.coordinates || !updates.coordinates.lat)) {
      const current = doc.data();
      const searchTarget = `${updates.name || current.name}, ${updates.location || current.location}, Philippines`;
      const geocoded = await geocodeAddress(searchTarget);
      updates.coordinates = { lat: geocoded.lat, lng: geocoded.lng };
    }

    await docRef.update(updates);
    const updatedDoc = await docRef.get();

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'UPDATE_DESTINATION',
      targetType: 'destination',
      targetId: id,
      metadata: { updatedFields: Object.keys(updates) },
    });

    return sendSuccess(res, { id, ...updatedDoc.data() }, 'Destination updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a destination safely (Coordinator / Admin)
 */
export const deleteDestination = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Destination not found', 404);
    }

    // Safety guard: prevent deleting destinations referenced by tour packages
    const pkgQuery = await db.collection('tourPackages').where('destinationId', '==', id).limit(1).get();
    if (!pkgQuery.empty) {
      return sendError(
        res,
        'Cannot delete destination that is referenced by tour packages. Please unpublish or archive instead.',
        400
      );
    }

    const destinationName = doc.data().name;
    await docRef.delete();

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'DELETE_DESTINATION',
      targetType: 'destination',
      targetId: id,
      metadata: { name: destinationName },
    });

    return sendSuccess(res, null, `Destination "${destinationName}" deleted successfully`);
  } catch (error) {
    next(error);
  }
};
