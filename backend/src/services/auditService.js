import { db } from '../config/firebaseAdmin.js';

/**
 * Record an action in the Firestore activityLogs collection.
 * 
 * @param {Object} params
 * @param {string} params.actorUid UID of the user performing the action
 * @param {string} params.actorRole Role of the actor (admin, coordinator, support, guide, customer, system)
 * @param {string} params.action Specific action descriptor (e.g. 'CREATE_PACKAGE', 'CANCEL_BOOKING')
 * @param {string} params.targetType Type of entity modified (e.g. 'destination', 'package', 'booking', 'user')
 * @param {string} params.targetId Identifier of the modified target
 * @param {Object} [params.metadata] Additional key-value context
 */
export const logActivity = async ({
  actorUid = 'system',
  actorRole = 'system',
  action,
  targetType,
  targetId = '',
  metadata = {},
}) => {
  if (!db) return;

  try {
    await db.collection('activityLogs').add({
      actorUid,
      actorRole,
      action,
      targetType,
      targetId,
      metadata,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AuditService] Failed to record activity log:', error.message);
  }
};
