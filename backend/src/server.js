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
import { isAllowedOrigin } from './config/urls.js';

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
// Any Vercel deployment counts as production (strict rate limit), even if NODE_ENV is unset.
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

// Behind a reverse proxy (Vercel, or nginx in Docker Compose) every request
// otherwise appears to come from the proxy IP, so the rate limiter would put
// ALL clients in one shared bucket. Trust exactly one hop on Vercel by default;
// set TRUST_PROXY=1 when running behind the nginx /api proxy.
const trustProxy = process.env.TRUST_PROXY ?? (process.env.VERCEL === '1' ? '1' : '');
if (trustProxy) {
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

// Security HTTP headers
app.use(helmet());

// CORS Configuration — allowlist is ALWAYS enforced (no dev bypass).
// Origins come from CLIENT_URL / ADMIN_URL / CORS_ORIGINS (comma-separated,
// trailing slashes stripped); see src/config/urls.js.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      const corsErr = new Error(`CORS policy blocks access from origin: ${origin}`);
      corsErr.statusCode = 403; // was surfacing as a 500 Internal Server Error
      return callback(corsErr);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
    maxAge: 600, // cache preflights for 10 min (cross-origin frontends on Vercel)
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

// Stripe webhook: read the body as RAW bytes before any JSON parsing so the
// signature can be verified byte-for-byte (works locally and on Vercel; set
// NODEJS_HELPERS=0 on Vercel so the platform never pre-parses the body).
app.use('/api/webhooks', express.raw({ type: '*/*', limit: '1mb' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body;
    try {
      req.body = req.rawBody.length ? JSON.parse(req.rawBody.toString('utf8')) : {};
    } catch {
      req.body = {};
    }
  }
  next();
});

// Body parsers for every other route (express.json skips requests already parsed above)
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/api/webhooks') && !req.rawBody) {
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
