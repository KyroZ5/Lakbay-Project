import { Router } from 'express';
import {
  getDepartures,
  getDepartureById,
  createDeparture,
  updateDeparture,
  cancelDeparture,
} from '../controllers/departureController.js';
import { verifyToken, optionalToken } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';

const router = Router();

// Public routes (filtered to open future departures for non-staff, allows staff & operators to view all)
router.get('/', optionalToken, getDepartures);
router.get('/:id', optionalToken, getDepartureById);

// Protected routes (Coordinator, Admin, & Operator)
router.post('/', verifyToken, requireRoles('coordinator', 'admin', 'operator'), createDeparture);
router.put('/:id', verifyToken, requireRoles('coordinator', 'admin', 'operator'), updateDeparture);
router.patch('/:id', verifyToken, requireRoles('coordinator', 'admin', 'operator'), updateDeparture);
router.post('/:id/cancel', verifyToken, requireRoles('coordinator', 'admin', 'operator'), cancelDeparture);

export default router;
