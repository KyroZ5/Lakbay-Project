import { Router } from 'express';
import {
  getProfile,
  syncProfile,
  updateProfile,
  deactivateAccount,
  getCoTravelers,
  createCoTraveler,
  updateCoTraveler,
  deleteCoTraveler,
  getNotifications,
  markNotificationRead,
} from '../controllers/customerController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// All customer endpoints require authentication
router.use(verifyToken);

// Profile
router.get('/profile', getProfile);
router.post('/sync-profile', syncProfile);
router.put('/profile', updateProfile);
router.patch('/profile', updateProfile);
router.post('/deactivate', deactivateAccount);

// Co-Travelers
router.get('/co-travelers', getCoTravelers);
router.post('/co-travelers', createCoTraveler);
router.put('/co-travelers/:id', updateCoTraveler);
router.patch('/co-travelers/:id', updateCoTraveler);
router.delete('/co-travelers/:id', deleteCoTraveler);

// Notifications
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

export default router;
