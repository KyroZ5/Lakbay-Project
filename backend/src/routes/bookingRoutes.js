import { Router } from 'express';
import {
  createCheckoutSession,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAllBookings,
  supportUpdateBooking,
  processExceptionRefund,
  requestReschedule,
  cancelRescheduleRequest,
  approveRescheduleRequest,
  rejectRescheduleRequest,
} from '../controllers/bookingController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';

const router = Router();

// All booking operations require authentication
router.use(verifyToken);

// Customer endpoints
router.post('/checkout', createCheckoutSession);
router.get('/my-bookings', getMyBookings);
router.get('/:id', getBookingById);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/request-reschedule', requestReschedule);
router.post('/:id/cancel-reschedule', cancelRescheduleRequest);

// Support, Admin, Coordinator & Operator management endpoints
router.get('/', requireRoles('support', 'admin', 'coordinator', 'operator'), getAllBookings);
router.patch('/:id', requireRoles('support', 'admin', 'coordinator', 'operator'), supportUpdateBooking);
router.post('/:id/approve-reschedule', requireRoles('support', 'admin', 'coordinator', 'operator'), approveRescheduleRequest);
router.post('/:id/reject-reschedule', requireRoles('support', 'admin', 'coordinator', 'operator'), rejectRescheduleRequest);
router.post('/:id/exception-refund', requireRoles('support', 'admin'), processExceptionRefund);

export default router;
