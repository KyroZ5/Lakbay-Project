import { db, auth } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';

const USERS_COLLECTION = 'users';
const COTRAVELERS_COLLECTION = 'coTravelers';
const NOTIFICATIONS_COLLECTION = 'notifications';
const BOOKINGS_COLLECTION = 'bookings';

/**
 * Get current customer profile (auto-provisions if document not yet created)
 */
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const docRef = db.collection(USERS_COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      const now = new Date().toISOString();
      const newProfile = {
        uid: userId,
        fullName: req.user.fullName || req.user.email?.split('@')[0] || 'Customer',
        email: req.user.email || '',
        phone: '',
        emergencyContact: '',
        role: req.user.role || 'customer',
        accountStatus: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await docRef.set(newProfile);
      return sendSuccess(res, { id: userId, ...newProfile });
    }

    return sendSuccess(res, { id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync customer profile during registration or social sign-in
 */
export const syncProfile = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { fullName, phone, emergencyContact } = req.body;
    const now = new Date().toISOString();
    const docRef = db.collection(USERS_COLLECTION).doc(userId);
    const existing = await docRef.get();
    const existingData = existing.exists ? existing.data() : null;

    // NEVER clobber role/accountStatus: syncProfile runs on every sign-in, so
    // forcing role:'customer' would demote staff accounts, and forcing
    // accountStatus:'active' would silently reactivate deactivated accounts.
    const data = {
      uid: userId,
      fullName: (fullName || req.user.fullName || existingData?.fullName || '').trim(),
      email: req.user.email || existingData?.email || '',
      phone: (phone !== undefined ? phone : existingData?.phone || '').trim(),
      emergencyContact:
        emergencyContact !== undefined ? emergencyContact : existingData?.emergencyContact || '',
      role: existingData?.role || req.user.role || 'customer',
      accountStatus: existingData?.accountStatus || 'active',
      updatedAt: now,
      createdAt: existingData?.createdAt || now,
    };

    await docRef.set(data, { merge: true });
    return sendSuccess(res, { id: userId, ...data }, 'Profile synced successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Update current customer profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { fullName, phone, emergencyContact } = req.body;

    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const updates = {
      updatedAt: new Date().toISOString(),
    };

    if (fullName !== undefined) updates.fullName = fullName.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;

    await userRef.update(updates);

    // Also update Firebase Auth display name if fullName provided
    if (fullName && auth) {
      await auth.updateUser(userId, { displayName: fullName.trim() });
    }

    const updated = await userRef.get();
    return sendSuccess(res, { id: userId, ...updated.data() }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate own account (only permitted if no active bookings exist)
 */
export const deactivateAccount = async (req, res, next) => {
  try {
    const userId = req.user.uid;

    // Check for active bookings
    const activeBookings = await db
      .collection(BOOKINGS_COLLECTION)
      .where('customerId', '==', userId)
      .where('bookingStatus', 'in', ['Pending', 'Confirmed'])
      .limit(1)
      .get();

    if (!activeBookings.empty) {
      return sendError(
        res,
        'Cannot deactivate account while you have pending or confirmed upcoming bookings.',
        400
      );
    }

    const now = new Date().toISOString();
    await db.collection(USERS_COLLECTION).doc(userId).update({
      accountStatus: 'deactivated',
      deactivatedAt: now,
      updatedAt: now,
    });

    if (auth) {
      await auth.updateUser(userId, { disabled: true });
    }

    await logActivity({
      actorUid: userId,
      actorRole: 'customer',
      action: 'DEACTIVATE_ACCOUNT',
      targetType: 'user',
      targetId: userId,
    });

    return sendSuccess(res, null, 'Account has been deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------------
// Co-Travelers CRUD
// -------------------------------------------------------------------

export const getCoTravelers = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const snap = await db
      .collection(COTRAVELERS_COLLECTION)
      .where('userId', '==', userId)
      .get();

    const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return sendSuccess(res, list);
  } catch (error) {
    next(error);
  }
};

export const createCoTraveler = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { fullName, birthDate, relationship = 'Companion', dietaryOrMedicalNotes = '' } = req.body;

    if (!fullName) {
      return sendError(res, 'Full name is required for co-traveler', 400);
    }

    const now = new Date().toISOString();
    const data = {
      userId,
      fullName: fullName.trim(),
      birthDate: birthDate || '',
      relationship: relationship.trim(),
      dietaryOrMedicalNotes: dietaryOrMedicalNotes.trim(),
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(COTRAVELERS_COLLECTION).add(data);
    return sendSuccess(res, { id: docRef.id, ...data }, 'Co-traveler saved successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateCoTraveler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const docRef = db.collection(COTRAVELERS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().userId !== userId) {
      return sendError(res, 'Co-traveler not found', 404);
    }

    const updates = { ...req.body };
    delete updates.id;
    delete updates.userId;
    delete updates.createdAt;
    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);
    const updated = await docRef.get();

    return sendSuccess(res, { id, ...updated.data() }, 'Co-traveler updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteCoTraveler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const docRef = db.collection(COTRAVELERS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().userId !== userId) {
      return sendError(res, 'Co-traveler not found', 404);
    }

    await docRef.delete();
    return sendSuccess(res, null, 'Co-traveler deleted successfully');
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------------
// Customer Notifications
// -------------------------------------------------------------------

export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const snap = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .where('userId', '==', userId)
      .get();

    let list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    list = list.slice(0, 30);
    const unreadCount = list.filter((n) => !n.isRead).length;

    return sendSuccess(res, { notifications: list, unreadCount });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const notifRef = db.collection(NOTIFICATIONS_COLLECTION).doc(id);
    const doc = await notifRef.get();

    if (!doc.exists || doc.data().userId !== userId) {
      return sendError(res, 'Notification not found', 404);
    }

    await notifRef.update({ isRead: true });
    return sendSuccess(res, null, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};
