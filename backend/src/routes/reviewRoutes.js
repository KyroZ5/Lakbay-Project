import { Router } from 'express';
import {
  createReview,
  getPackageReviews,
  getMyReviews,
  adminGetAllReviews,
  adminModerateReview,
  adminDeleteReview,
} from '../controllers/reviewController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { requireRoles, requireAdminOnly } from '../middlewares/roleMiddleware.js';

const router = Router();

// Public: View approved reviews for a package
router.get('/package/:packageId', getPackageReviews);

// Customer: Submit review (requires completed booking)
router.post('/', verifyToken, createReview);

// Customer: View own reviews
router.get('/my-reviews', verifyToken, getMyReviews);

// Staff / Operations / Operator: View and moderate reviews
router.get('/admin', verifyToken, requireRoles('admin', 'coordinator', 'support', 'guide', 'operator'), adminGetAllReviews);
router.patch('/:id/moderate', verifyToken, requireRoles('admin', 'support'), adminModerateReview);
router.delete('/:id', verifyToken, requireAdminOnly, adminDeleteReview);

export default router;
