import { Router } from 'express';
import { handleStripeWebhook } from '../controllers/webhookController.js';

const router = Router();

// Stripe Webhook endpoint
router.post('/stripe', handleStripeWebhook);

export default router;
