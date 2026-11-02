import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { sendError } from './utils/apiResponse.js';
import { db, isFirebaseInitialized } from './config/firebaseAdmin.js';
import apiRoutes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// Security HTTP headers
app.use(helmet());

// CORS Configuration — allowlist is ALWAYS enforced (no dev bypass).
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3001',
  'http://localhost:5173', // Vite default dev port
  'http://localhost:5174',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocks access from origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
  })
);

// Rate limiting: general API budget (auth is handled client-side by Firebase,
// so there is no backend login route to harden separately)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 300 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Morgan request logging
app.use(requestLogger);

// Body parsers: preserve raw body for Stripe webhook signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/api/webhooks')) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Null-DB guard: fail fast with 503 instead of crashing request handlers
// when Firebase Admin credentials are not configured. /api/health stays open
// so liveness probes work on an unconfigured instance.
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!isFirebaseInitialized || !db) {
    return sendError(res, 'Backend is not fully configured (Firebase credentials missing). See README setup steps.', 503);
  }
  return next();
});

// Rate limit (webhook excluded: Stripe retries must never be throttled out)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  return apiLimiter(req, res, next);
});

// Mount main API routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Lakbay Tour & Travel Booking Platform API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// 404 Not Found Handler
app.use((req, res) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
});

// Global Error Handler
app.use(errorHandler);

// Start HTTP Server
const isVercel = process.env.VERCEL === '1';
if (process.env.NODE_ENV !== 'test' && !isVercel) {
  app.listen(PORT, HOST, () => {
    console.log(`[Lakbay API] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`[Lakbay API] Health check available at: http://localhost:${PORT}/api/health`);
  });
}

export default app;
