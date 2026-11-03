import { db } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';
import { todayInManila } from '../utils/dates.js';
import { parseLimit } from '../utils/query.js';

/**
 * Recomputes and updates the averageRating and reviewCount on a tour package.
 */
export const recalculatePackageRating = async (packageId) => {
  try {
    const reviewsSnap = await db
      .collection('reviews')
      .where('packageId', '==', packageId)
      .where('isApproved', '==', true)
      .get();

    let totalRating = 0;
    let approvedCount = 0;
    reviewsSnap.forEach((doc) => {
      const data = doc.data();
      totalRating += Number(data.rating || 0);
      approvedCount++;
    });

    const averageRating = approvedCount > 0 ? Number((totalRating / approvedCount).toFixed(1)) : 0;
    const reviewCount = approvedCount;

    await db.collection('tourPackages').doc(packageId).update({
      averageRating,
      reviewCount,
      updatedAt: new Date().toISOString(),
    });

    return { averageRating, reviewCount };
  } catch (err) {
    console.error(`[recalculatePackageRating] Failed for package ${packageId}:`, err);
  }
};

/**
 * 1. Customer: Create a review for a completed tour
 * Enforces Rule D: Only travelers with completed bookings can review
 */
export const createReview = async (req, res, next) => {
  try {
    const customerId = req.user.uid;
    const { packageId, bookingId, rating, comment } = req.body;

    if (!packageId || !bookingId || !rating) {
      return sendError(res, 'packageId, bookingId, and rating are required', 400);
    }

    if (comment !== undefined && comment !== null && typeof comment !== 'string') {
      return sendError(res, 'comment must be text', 400);
    }
    if (typeof comment === 'string' && comment.length > 2000) {
      return sendError(res, 'comment must be 2000 characters or fewer', 400);
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return sendError(res, 'Rating must be an integer between 1 and 5', 400);
    }

    // 1. Verify eligibility: Check booking belongs to customer, is for package, and is Completed
    const bookingDoc = await db.collection('bookings').doc(String(bookingId)).get();
    if (!bookingDoc.exists) {
      return sendError(res, 'Booking reservation not found', 404);
    }

    const bookingData = bookingDoc.data();
    if (bookingData.customerId !== customerId) {
      return sendError(res, 'You do not have permission to review this booking', 403);
    }

    if (bookingData.packageId !== packageId) {
      return sendError(res, 'Booking does not match the specified tour package', 400);
    }

    // Rule D: Review Eligibility - Restrict reviews to eligible travelers who completed the tour
    const today = todayInManila();
    const isCompleted =
      bookingData.bookingStatus === 'Completed' ||
      (bookingData.bookingStatus === 'Confirmed' && bookingData.departureDate && bookingData.departureDate < today);

    if (!isCompleted) {
      return sendError(
        res,
        'Review eligibility restricted: You may only submit a review after completing your tour.',
        403
      );
    }

    // 2. Prevent duplicate reviews for the same booking
    const existingSnap = await db
      .collection('reviews')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return sendError(res, 'A review has already been submitted for this booking.', 409);
    }

    // Get package title
    const pkgDoc = await db.collection('tourPackages').doc(packageId).get();
    const packageName = pkgDoc.exists ? pkgDoc.data().name : 'Tour Package';

    const now = new Date().toISOString();
    const reviewData = {
      packageId,
      packageName,
      bookingId,
      bookingReference: bookingData.bookingReference || '',
      customerId,
      customerName: req.user.fullName || req.user.email?.split('@')[0] || 'Verified Traveler',
      rating: numRating,
      comment: (comment || '').trim(),
      isApproved: true,
      isFlagged: false,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('reviews').add(reviewData);

    // 3. Recalculate package ratings
    await recalculatePackageRating(packageId);

    // 4. Log audit activity
    await logActivity({
      actorUid: customerId,
      actorRole: req.user.role,
      action: 'CREATE_REVIEW',
      targetType: 'review',
      targetId: docRef.id,
      metadata: { packageId, rating: numRating },
    });

    return sendSuccess(res, { id: docRef.id, ...reviewData }, 'Thank you! Your review has been submitted.', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Public: Get approved reviews and rating breakdown for a package
 */
export const getPackageReviews = async (req, res, next) => {
  try {
    const { packageId } = req.params;

    const snapshot = await db
      .collection('reviews')
      .where('packageId', '==', packageId)
      .where('isApproved', '==', true)
      .get();

    let reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    reviews.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    // Compute distribution (5 stars, 4 stars, etc.)
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalScore = 0;

    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      distribution[star] = (distribution[star] || 0) + 1;
      totalScore += Number(r.rating || 0);
    });

    const averageRating = reviews.length > 0 ? Number((totalScore / reviews.length).toFixed(1)) : 0;

    return sendSuccess(res, {
      packageId,
      totalReviews: reviews.length,
      averageRating,
      distribution,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Customer: Get all reviews written by logged-in customer
 */
export const getMyReviews = async (req, res, next) => {
  try {
    const customerId = req.user.uid;
    const snapshot = await db.collection('reviews').where('customerId', '==', customerId).get();
    let reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    reviews.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return sendSuccess(res, reviews);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Staff / Admin: Get all reviews across the platform with search & filter
 */
export const adminGetAllReviews = async (req, res, next) => {
  try {
    const { status, search, limit = 100 } = req.query;

    const snapshot = await db.collection('reviews').get();
    let reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Rule D: Operator scoping - operators only see reviews for their own tour packages
    if (req.user?.role === 'operator') {
      const myPkgSnap = await db
        .collection('tourPackages')
        .where('operatorId', '==', req.user.uid)
        .get();
      const myPkgIds = new Set(myPkgSnap.docs.map((d) => d.id));
      reviews = reviews.filter((r) => myPkgIds.has(r.packageId));
    }

    // In-memory filter to avoid composite index requirements
    if (status === 'approved') {
      reviews = reviews.filter((r) => r.isApproved === true && !r.isFlagged);
    } else if (status === 'hidden') {
      reviews = reviews.filter((r) => r.isApproved === false);
    } else if (status === 'flagged') {
      reviews = reviews.filter((r) => r.isFlagged === true);
    }

    if (search) {
      const q = search.toLowerCase();
      reviews = reviews.filter(
        (r) =>
          (r.packageName || '').toLowerCase().includes(q) ||
          (r.customerName || '').toLowerCase().includes(q) ||
          (r.comment || '').toLowerCase().includes(q) ||
          (r.bookingReference || '').toLowerCase().includes(q)
      );
    }

    reviews.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    reviews = reviews.slice(0, parseLimit(limit, 100, 500));

    return sendSuccess(res, reviews);
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Staff / Admin: Moderate review (hide/unhide, flag/unflag)
 */
export const adminModerateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isApproved, isFlagged } = req.body;

    const docRef = db.collection('reviews').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return sendError(res, 'Review not found', 404);
    }

    // Boolean("false") === true, so parse explicitly
    const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
    const updates = { updatedAt: new Date().toISOString() };
    if (isApproved !== undefined) updates.isApproved = toBool(isApproved);
    if (isFlagged !== undefined) updates.isFlagged = toBool(isFlagged);

    await docRef.update(updates);

    // Recalculate package rating if approval status toggled
    const reviewData = doc.data();
    if (isApproved !== undefined && reviewData.packageId) {
      await recalculatePackageRating(reviewData.packageId);
    }

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'MODERATE_REVIEW',
      targetType: 'review',
      targetId: id,
      metadata: updates,
    });

    const updated = await docRef.get();
    return sendSuccess(res, { id, ...updated.data() }, 'Review moderation status updated');
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Admin Only: Delete review
 */
export const adminDeleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('reviews').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return sendError(res, 'Review not found', 404);
    }

    const reviewData = doc.data();
    await docRef.delete();

    if (reviewData.packageId) {
      await recalculatePackageRating(reviewData.packageId);
    }

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'DELETE_REVIEW',
      targetType: 'review',
      targetId: id,
      metadata: { packageId: reviewData.packageId },
    });

    return sendSuccess(res, null, 'Review deleted successfully');
  } catch (error) {
    next(error);
  }
};
