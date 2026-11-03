import { Router } from 'express';
import {
  getDestinations,
  getFeaturedDestinations,
  getDestinationById,
  createDestination,
  updateDestination,
  deleteDestination,
} from '../controllers/destinationController.js';
import { verifyToken, optionalToken } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';

const router = Router();

// Public routes (optionalToken lets staff see unpublished destinations)
router.get('/', optionalToken, getDestinations);
router.get('/featured', getFeaturedDestinations);
router.get('/:id', optionalToken, getDestinationById);

// Protected routes (Coordinator & Admin)
router.post('/', verifyToken, requireRoles('coordinator', 'admin'), createDestination);
router.put('/:id', verifyToken, requireRoles('coordinator', 'admin'), updateDestination);
router.patch('/:id', verifyToken, requireRoles('coordinator', 'admin'), updateDestination);
router.delete('/:id', verifyToken, requireRoles('coordinator', 'admin'), deleteDestination);

export default router;
