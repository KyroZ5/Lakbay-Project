import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import destinationRoutes from './destinationRoutes.js';
import packageRoutes from './packageRoutes.js';
import departureRoutes from './departureRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import webhookRoutes from './webhookRoutes.js';
import guideRoutes from './guideRoutes.js';
import customerRoutes from './customerRoutes.js';
import adminRoutes from './adminRoutes.js';
import externalRoutes from './externalRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import operatorRoutes from './operatorRoutes.js';
import promotionRoutes from './promotionRoutes.js';

const router = Router();

// Mount all active modules
router.use('/health', healthRoutes);
router.use('/destinations', destinationRoutes);
router.use('/packages', packageRoutes);
router.use('/departures', departureRoutes);
router.use('/bookings', bookingRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/guide', guideRoutes);
router.use('/customers', customerRoutes);
router.use('/admin', adminRoutes);
router.use('/external', externalRoutes);
router.use('/reviews', reviewRoutes);
router.use('/operators', operatorRoutes);
router.use('/promotions', promotionRoutes);

export default router;
