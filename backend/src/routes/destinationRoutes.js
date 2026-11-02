import { Router } from 'express';
import {
  getDestinations,
  getFeaturedDestinations,
  getDestinationById,
  createDestination,
  updateDestination,
  deleteDestination,
} from '../controllers/destinationController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';

const router = Router();

// Public routes
router.get('/', getDestinations);
router.get('/featured', getFeaturedDestinations);
router.get('/:id', getDestinationById);

// Protected routes (Coordinator & Admin)
router.post('/', verifyToken, requireRoles('coordinator', 'admin'), createDestination);
router.put('/:id', verifyToken, requireRoles('coordinator', 'admin'), updateDestination);
router.patch('/:id', verifyToken, requireRoles('coordinator', 'admin'), updateDestination);
router.delete('/:id', verifyToken, requireRoles('coordinator', 'admin'), deleteDestination);

export default router;
