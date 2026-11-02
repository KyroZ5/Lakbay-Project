import { Router } from 'express';
import { isFirebaseInitialized } from '../config/firebaseAdmin.js';
import { isStripeInitialized, DEFAULT_CURRENCY } from '../config/stripe.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/', (req, res) => {
  return sendSuccess(res, {
    status: 'healthy',
    service: 'Lakbay API Server',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    integrations: {
      firebase: {
        initialized: isFirebaseInitialized,
        serviceAccountProvided: isFirebaseInitialized,
      },
      stripe: {
        initialized: isStripeInitialized,
        currency: DEFAULT_CURRENCY.toUpperCase(),
      },
      geoapify: {
        configured: Boolean(process.env.GEOAPIFY_API_KEY && !process.env.GEOAPIFY_API_KEY.toLowerCase().includes('placeholder')),
      },
      openWeather: {
        configured: Boolean(process.env.OPENWEATHER_API_KEY && !process.env.OPENWEATHER_API_KEY.toLowerCase().includes('placeholder')),
      },
    },
  }, 'System is operating normally');
});

export default router;
