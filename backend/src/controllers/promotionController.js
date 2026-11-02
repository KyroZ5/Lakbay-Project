import { db } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';

const COLLECTION = 'promotions';

/**
 * 1. Public: Get all active published promotional campaign banners
 * (GET /api/promotions)
 */
export const getPublicPromotions = async (req, res, next) => {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('isPublished', '==', true)
      .get();

    const promotions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    promotions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return sendSuccess(res, promotions, `Retrieved ${promotions.length} active promotion(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Staff: Get all promotional banners (published and draft)
 * (GET /api/promotions/admin/all)
 */
export const getAllPromotions = async (req, res, next) => {
  try {
    const snapshot = await db.collection(COLLECTION).get();
    const promotions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    promotions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return sendSuccess(res, promotions, `Retrieved ${promotions.length} promotional campaign(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Staff: Create a new promotional campaign banner
 * (POST /api/promotions)
 */
export const createPromotion = async (req, res, next) => {
  try {
    const {
      title,
      subtitle = '',
      bannerImageUrl = '',
      badgeText = 'Special Promo',
      actionText = 'Explore Tours',
      actionUrl = '/packages',
      isPublished = true,
    } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, 'Promotion title is required', 400);
    }

    const now = new Date().toISOString();
    const promoData = {
      title: title.trim(),
      subtitle: (subtitle || '').trim(),
      bannerImageUrl: (bannerImageUrl || '').trim(),
      badgeText: (badgeText || 'Special Promo').trim(),
      actionText: (actionText || 'Explore Tours').trim(),
      actionUrl: (actionUrl || '/packages').trim(),
      isPublished: Boolean(isPublished),
      createdBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(COLLECTION).add(promoData);

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'CREATE_PROMOTION',
      targetType: 'promotion',
      targetId: docRef.id,
      metadata: { title: promoData.title },
    });

    return sendSuccess(
      res,
      { id: docRef.id, ...promoData },
      'Promotional campaign banner created successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Staff: Update an existing promotional banner
 * (PUT /api/promotions/:id)
 */
export const updatePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      bannerImageUrl,
      badgeText,
      actionText,
      actionUrl,
      isPublished,
    } = req.body;

    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Promotion not found', 404);
    }

    const updates = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (subtitle !== undefined) updates.subtitle = subtitle.trim();
    if (bannerImageUrl !== undefined) updates.bannerImageUrl = bannerImageUrl.trim();
    if (badgeText !== undefined) updates.badgeText = badgeText.trim();
    if (actionText !== undefined) updates.actionText = actionText.trim();
    if (actionUrl !== undefined) updates.actionUrl = actionUrl.trim();
    if (isPublished !== undefined) updates.isPublished = Boolean(isPublished);

    await docRef.update(updates);
    const updated = await docRef.get();

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'UPDATE_PROMOTION',
      targetType: 'promotion',
      targetId: id,
      metadata: updates,
    });

    return sendSuccess(res, { id: updated.id, ...updated.data() }, 'Promotion updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Staff: Toggle publish status of a promotional banner
 * (PATCH /api/promotions/:id/toggle)
 */
export const togglePromotionPublished = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Promotion not found', 404);
    }

    const currentStatus = Boolean(doc.data().isPublished);
    const newStatus = !currentStatus;

    await docRef.update({
      isPublished: newStatus,
      updatedAt: new Date().toISOString(),
    });

    return sendSuccess(
      res,
      { id, isPublished: newStatus },
      `Promotion ${newStatus ? 'published to homepage' : 'hidden from homepage'}`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Staff: Delete a promotional banner
 * (DELETE /api/promotions/:id)
 */
export const deletePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendError(res, 'Promotion not found', 404);
    }

    await docRef.delete();

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'DELETE_PROMOTION',
      targetType: 'promotion',
      targetId: id,
    });

    return sendSuccess(res, { id }, 'Promotion deleted successfully');
  } catch (error) {
    next(error);
  }
};
