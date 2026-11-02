import { Router } from 'express';
import {
  getPublicPromotions,
  getAllPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotionPublished,
} from '../controllers/promotionController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { requireRoles, requireAdminOnly } from '../middlewares/roleMiddleware.js';

const router = Router();

// Public: Get published active promotion banners
router.get('/', getPublicPromotions);

// Staff: Get all promotion campaigns (drafts + published)
router.get('/admin/all', verifyToken, requireRoles('admin', 'coordinator', 'support'), getAllPromotions);

// Staff: Create campaign banner
router.post('/admin', verifyToken, requireRoles('admin', 'coordinator'), createPromotion);

// Staff: Update campaign banner
router.put('/admin/:id', verifyToken, requireRoles('admin', 'coordinator'), updatePromotion);

// Staff: Toggle published status
router.patch('/admin/:id/toggle', verifyToken, requireRoles('admin', 'coordinator'), togglePromotionPublished);

// Admin only: Delete campaign banner
router.delete('/admin/:id', verifyToken, requireAdminOnly, deletePromotion);

export default router;
