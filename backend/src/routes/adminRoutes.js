import { Router } from 'express';
import {
  getDashboardMetrics,
  getUsers,
  createStaffAccount,
  setUserAccountStatus,
  setUserRole,
  getReports,
  getActivityLogs,
  getStaffProfile,
  updateStaffProfile,
} from '../controllers/adminController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { requireAdminOnly, requireRoles } from '../middlewares/roleMiddleware.js';

const router = Router();

// Staff Profile (accessible to all verified staff roles & operators)
router.get('/profile', verifyToken, requireRoles('admin', 'coordinator', 'support', 'guide', 'operator'), getStaffProfile);
router.patch('/profile', verifyToken, requireRoles('admin', 'coordinator', 'support', 'guide', 'operator'), updateStaffProfile);

// Strictly Admin-only below
router.use(verifyToken, requireAdminOnly);

router.get('/dashboard', getDashboardMetrics);
router.get('/users', getUsers);
router.post('/users', createStaffAccount);
router.patch('/users/:uid/status', setUserAccountStatus);
router.patch('/users/:uid/role', setUserRole);
router.get('/reports', getReports);
router.get('/activity-logs', getActivityLogs);

export default router;
