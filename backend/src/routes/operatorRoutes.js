import { Router } from 'express';
import {
  applyForOperator,
  getMyApplication,
  getOperatorApplications,
  approveOperatorApplication,
  rejectOperatorApplication,
  getAllOperators,
  setOperatorStatus,
  getOperatorDashboardMetrics,
} from '../controllers/operatorController.js';
import { verifyToken, optionalToken } from '../middlewares/authMiddleware.js';
import { requireRoles, requireAdminOnly } from '../middlewares/roleMiddleware.js';

const router = Router();

// Public / Guest application
router.post('/apply', optionalToken, applyForOperator);

// Applicant status check
router.get('/my-application', verifyToken, getMyApplication);

// Operator specific dashboard
router.get('/dashboard', verifyToken, requireRoles('operator', 'admin'), getOperatorDashboardMetrics);

// Admin Operator Management
router.get('/admin/applications', verifyToken, requireAdminOnly, getOperatorApplications);
router.patch('/admin/applications/:id/approve', verifyToken, requireAdminOnly, approveOperatorApplication);
router.patch('/admin/applications/:id/reject', verifyToken, requireAdminOnly, rejectOperatorApplication);
router.get('/admin/all', verifyToken, requireAdminOnly, getAllOperators);
router.patch('/admin/:uid/status', verifyToken, requireAdminOnly, setOperatorStatus);

export default router;
