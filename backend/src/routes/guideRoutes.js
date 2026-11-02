import { Router } from 'express';
import {
  getAssignedDepartures,
  getDepartureManifest,
  updatePassengerCheckIn,
  completeDeparture,
} from '../controllers/guideController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';

const router = Router();

// Tour guide, Admin, and Tour Operator access
router.use(verifyToken, requireRoles('guide', 'admin', 'operator'));

router.get('/departures', getAssignedDepartures);
router.get('/departures/:id/manifest', getDepartureManifest);
router.patch('/departures/:id/checkin', updatePassengerCheckIn);
router.post('/departures/:id/complete', completeDeparture);

export default router;
